import express from "express";
import mongoose from "mongoose";
import { CollectionAccount } from "../models/index.js";
import { auth, allow } from "../middleware/auth.js";
import { nextCollectionAccountNumber, accountTotals } from "../utils/helpers.js";
const { isValidObjectId } = mongoose;

const router = express.Router();

// ---- Documentos / Cuentas de cobro (solo ADMIN)
router.get("/collection-accounts", auth, allow("ADMIN"), async (req, res) => {
  try {
    const list = await CollectionAccount.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: "No se pudieron cargar las cuentas de cobro" });
  }
});

router.get("/collection-accounts/:id", auth, allow("ADMIN"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
    const account = await CollectionAccount.findById(req.params.id);
    if (!account) return res.status(404).json({ error: "Cuenta de cobro no encontrada" });
    res.json(account);
  } catch (e) {
    res.status(500).json({ error: "No se pudo cargar la cuenta de cobro" });
  }
});

router.post("/collection-accounts", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { accountType, companyName, companyNit, companyClientId, groupName, periodMonth, periodYear, periodLabel, issueDate, dueDate, items = [], additionalValue = 0, discount = 0, notes = "" } = req.body;

    if (!["AGRUPADOS", "EMPRESA"].includes(accountType)) return res.status(400).json({ error: "Tipo de cuenta inválido" });
    if (!companyName || !periodMonth || !periodYear || !issueDate) return res.status(400).json({ error: "Empresa, periodo y fecha de emisión son obligatorios" });
    if (accountType === "AGRUPADOS" && !groupName) return res.status(400).json({ error: "La agrupadora es obligatoria para cuentas de agrupados" });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "La cuenta debe tener al menos un concepto" });

    const totals = accountTotals(items, additionalValue, discount, []);
    if (totals.total <= 0) return res.status(400).json({ error: "El total de la cuenta debe ser mayor a cero" });

    const account = await CollectionAccount.create({
      number: await nextCollectionAccountNumber(),
      accountType, companyName, companyNit: companyNit || "",
      companyClientId: companyClientId && isValidObjectId(companyClientId) ? companyClientId : null,
      groupName: accountType === "AGRUPADOS" ? groupName : "",
      periodMonth, periodYear, periodLabel: periodLabel || `${periodMonth}-${periodYear}`,
      issueDate, dueDate: dueDate || "", items: totals.normalizedItems,
      subtotal: totals.subtotal, additionalValue: Number(additionalValue || 0),
      discount: Number(discount || 0), total: totals.total, paidTotal: 0,
      balance: totals.total, status: "PENDIENTE", notes, createdByName: req.user.name,
    });
    res.json(account);
  } catch (e) {
    console.error("ERROR POST /collection-accounts", e);
    res.status(400).json({ error: e.message || "No se pudo crear la cuenta de cobro" });
  }
});

router.put("/collection-accounts/:id", auth, allow("ADMIN"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
    const current = await CollectionAccount.findById(req.params.id);
    if (!current) return res.status(404).json({ error: "Cuenta de cobro no encontrada" });
    const merged = { ...current.toObject(), ...req.body };
    const totals = accountTotals(merged.items, merged.additionalValue, merged.discount, current.payments || []);
    const updated = await CollectionAccount.findByIdAndUpdate(req.params.id, {
      ...req.body, items: totals.normalizedItems, subtotal: totals.subtotal, total: totals.total,
      paidTotal: totals.paidTotal, balance: totals.balance, status: totals.status,
    }, { new: true, runValidators: true });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message || "No se pudo actualizar la cuenta de cobro" });
  }
});

router.post("/collection-accounts/:id/payments", auth, allow("ADMIN"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
    const account = await CollectionAccount.findById(req.params.id);
    if (!account) return res.status(404).json({ error: "Cuenta de cobro no encontrada" });
    const amount = Number(req.body.amount || 0);
    if (amount <= 0) return res.status(400).json({ error: "El valor del abono debe ser mayor a cero" });
    if (amount > Number(account.balance || 0)) return res.status(400).json({ error: "El abono no puede superar el saldo pendiente" });
    account.payments.push({
      date: req.body.date || new Date().toISOString().slice(0, 10), amount,
      method: req.body.method || "TRANSFERENCIA", reference: req.body.reference || "",
      note: req.body.note || "", registeredBy: req.user.name,
    });
    const totals = accountTotals(account.items, account.additionalValue, account.discount, account.payments);
    account.paidTotal = totals.paidTotal; account.balance = totals.balance; account.status = totals.status;
    await account.save();
    res.json(account);
  } catch (e) {
    res.status(400).json({ error: e.message || "No se pudo registrar el abono" });
  }
});


router.delete("/collection-accounts/:id/payments/:paymentId", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { id, paymentId } = req.params;
    if (!isValidObjectId(id) || !isValidObjectId(paymentId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const account = await CollectionAccount.findById(id);
    if (!account) return res.status(404).json({ error: "Cuenta de cobro no encontrada" });

    const payment = account.payments.id(paymentId);
    if (!payment) return res.status(404).json({ error: "Abono no encontrado" });

    payment.deleteOne();

    const totals = accountTotals(account.items, account.additionalValue, account.discount, account.payments);
    account.paidTotal = totals.paidTotal;
    account.balance = totals.balance;
    account.status = totals.status;

    await account.save();
    res.json(account);
  } catch (e) {
    console.error("ERROR DELETE PAYMENT", e);
    res.status(400).json({ error: e.message || "No se pudo eliminar el abono" });
  }
});

router.delete("/collection-accounts/:id", auth, allow("ADMIN"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
    const account = await CollectionAccount.findByIdAndDelete(req.params.id);
    if (!account) return res.status(404).json({ error: "Cuenta de cobro no encontrada" });
    res.json({ message: "Cuenta de cobro eliminada correctamente" });
  } catch (e) {
    res.status(500).json({ error: "No se pudo eliminar la cuenta de cobro" });
  }
});



export default router;
