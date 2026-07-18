import express from "express";
import mongoose from "mongoose";
import { Receipt } from "../models/index.js";
import { auth, allow } from "../middleware/auth.js";
const { isValidObjectId } = mongoose;

const router = express.Router();

// ---- Planillas
router.put("/payrolls/register", auth, allow("ADMIN" , "ASESOR" ), async (req, res) => {
  try {
    const { receiptIds, planillaNumber, paymentDate, operator, bank, lateFee, totalPaid } = req.body;

    if (!receiptIds || !Array.isArray(receiptIds) || receiptIds.length === 0) {
      return res.status(400).json({ error: "Debes seleccionar al menos un recibo" });
    }

    if (!planillaNumber) {
      return res.status(400).json({ error: "Debes ingresar el número de planilla" });
    }

    const invalidId = receiptIds.find((id) => !isValidObjectId(id));

    if (invalidId) {
      return res.status(400).json({ error: "Hay un ID de recibo inválido" });
    }

    await Receipt.updateMany(
      { _id: { $in: receiptIds } },
      {
        $set: {
          planillaStatus: "PLANILLA PAGADA",
          planillaNumber: String(planillaNumber || ""),
          planillaPaymentDate: String(paymentDate || ""),
          operator: String(operator || ""),
          bank: String(bank || ""),
          planillaLateFee: Number(lateFee || 0),
          planillaTotalPaid: Number(totalPaid || 0),
        },
      }
    );

    const updatedReceipts = await Receipt.find({
      _id: { $in: receiptIds },
    }).sort({ createdAt: -1 });

    res.json({
      message: "Planilla registrada correctamente",
      count: updatedReceipts.length,
      receipts: updatedReceipts,
    });
  } catch (err) {
    console.error("ERROR PUT /payrolls/register", err);
    res.status(500).json({ error: "No se pudo registrar la planilla" });
  }
});

router.get("/payrolls", auth, allow("ADMIN", "ASESOR"), async (req, res) => {
  try {
    const query = {
      planillaStatus: "PLANILLA PAGADA",
    };

    if (req.user.role !== "ADMIN") {
      query.registeredBy = req.user.name;
    }

    const payrolls = await Receipt.find(query).sort({
      planillaPaymentDate: -1,
      createdAt: -1,
    });

    res.json(payrolls);
  } catch (e) {
    console.error("ERROR GET /payrolls", e);
    res.status(500).json({ error: "No se pudieron cargar las planillas" });
  }
});

router.put("/payrolls/remove-receipt", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { receiptId } = req.body;

    if (!receiptId || !isValidObjectId(receiptId)) {
      return res.status(400).json({ error: "ID de recibo inválido" });
    }

    const receipt = await Receipt.findByIdAndUpdate(
      receiptId,
      {
        $set: {
          planillaStatus: "PENDIENTE DE PLANILLA",
          planillaNumber: "",
          planillaPaymentDate: "",
          operator: "",
          bank: "",
          planillaLateFee: 0,
          planillaTotalPaid: 0,
        },
      },
      { new: true }
    );

    if (!receipt) {
      return res.status(404).json({ error: "Recibo no encontrado" });
    }

    res.json(receipt);
  } catch (err) {
    console.error("ERROR PUT /payrolls/remove-receipt", err);
    res.status(500).json({ error: "No se pudo quitar el recibo de la planilla" });
  }
});



export default router;
