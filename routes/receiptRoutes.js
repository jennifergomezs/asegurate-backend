import express from "express";
import mongoose from "mongoose";
import { Receipt, Client } from "../models/index.js";
import { auth, allow } from "../middleware/auth.js";
import { nextTicket, makePublicCode, calculateReceiptAmounts } from "../utils/helpers.js";
const { isValidObjectId } = mongoose;

const router = express.Router();

// ---- Recibos
router.post("/receipts", auth, allow("ADMIN", "ASESOR"), async (req, res) => {
  try {
    const {
      receiptType = "CLIENTE",
      clientId,
      month,
      year,
      monthLabel,
      paymentMethod,
      paymentBank,
      paymentReference,
      serviceType,
      occasionalServiceType,
      independentServiceType,
      occasionalCustomer,
      clientSnapshot,
      planCode,
      amounts,
      status,
      note,
      planillaStatus,
      planillaNumber,
      planillaPaymentDate,
      operator,
      bank,
      lateFee,
      totalPaid,
    } = req.body;

    const normalizedReceiptType = String(receiptType || "CLIENTE").toUpperCase();

    if (!month || !year || !monthLabel) {
      return res.status(400).json({ error: "Debes seleccionar mes y año" });
    }

    if (!paymentMethod) {
      return res.status(400).json({ error: "Debes seleccionar una forma de pago" });
    }

    const ticket = await nextTicket();
    const now = new Date();

    let publicCode = makePublicCode();

    while (await Receipt.findOne({ publicCode })) {
      publicCode = makePublicCode();
    }

    if (normalizedReceiptType === "OCASIONAL") {
      const customerName = String(occasionalCustomer?.name || "").trim();
      const received = Number(amounts?.received || 0);
      const planillaValue = Number(amounts?.planillaValue || 0);
      const service = Number(amounts?.service || 0);
      const totalSystem = Number(amounts?.totalSystem ?? (planillaValue + service));
      const balance = totalSystem - received;

      if (!customerName) {
        return res.status(400).json({ error: "Debes escribir el nombre o empresa del servicio ocasional" });
      }

      if (received <= 0) {
        return res.status(400).json({ error: "El valor recibido debe ser mayor a cero" });
      }

      const receipt = await Receipt.create({
        ticket,
        tempNumber: String(ticket),
        publicCode,

        createdAt: now,
        createdDate: now.toLocaleDateString("es-CO"),
        createdTime: now.toLocaleTimeString("es-CO"),

        registeredBy: req.user.name,
        registeredRole: req.user.role,

        receiptType: "OCASIONAL",

        month,
        year,
        monthLabel,

        paymentMethod,
        paymentBank: paymentBank || "",
        paymentReference: paymentReference || "",

        serviceType: "SERVICIO_OCASIONAL",
        occasionalServiceType: occasionalServiceType || "PAGO_PLANILLA",
        independentServiceType: "",

        clientId: null,

        occasionalCustomer: {
          name: customerName,
          docType: occasionalCustomer?.docType || "CC",
          docNumber: occasionalCustomer?.docNumber || "",
          phone: occasionalCustomer?.phone || "",
          email: occasionalCustomer?.email || "",
        },

        clientSnapshot: {
          fullName: customerName,
          docType: occasionalCustomer?.docType || "CC",
          docNumber: occasionalCustomer?.docNumber || "",
          phone: occasionalCustomer?.phone || "",
          email: occasionalCustomer?.email || "",
          clientType: "OCASIONAL",
          groupName: "",
          companyName: "",
          eps: "",
          afp: "",
          arl: "",
          ccf: "",
          plan: "",
          risk: "",
          over55: "",
        },

        planCode: "SERVICIO-OCASIONAL",

        amounts: {
          salaryBase: 0,
          proportionalBase: 0,
          daysWorked: 0,
          eps: 0,
          arl: 0,
          afp: 0,
          cofrem: 0,
          planillaValue,
          service,
          totalSystem,
          received,
          balance,
        },

        status: balance > 0 ? "SALDO PENDIENTE" : (status || "PAGADO"),

        note: note || "",

        planillaStatus: planillaStatus || "NO APLICA",
        planillaNumber: planillaNumber || "",
        planillaPaymentDate: planillaPaymentDate || "",
        operator: operator || "",
        bank: bank || "",
      });

      return res.json(receipt);
    }

    if (!clientId || !isValidObjectId(clientId)) {
      return res.status(400).json({ error: "Cliente inválido" });
    }

    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const existingReceipt = await Receipt.findOne({
      clientId,
      monthLabel,
      status: { $ne: "ANULADO" },
    });

    if (existingReceipt) {
      return res.status(400).json({
        error: `Este cliente ya tiene un recibo registrado para ${monthLabel}`,
      });
    }

    const received = Number(amounts?.received || 0);

    const safeAmounts = {
      ...amounts,
      received,
      balance: Number(amounts?.totalSystem || 0) - received,
    };

    const calculated = {
      code: planCode,
    };

    const receipt = await Receipt.create({
      ticket,
      tempNumber: String(ticket),
      publicCode,

      createdAt: now,
      createdDate: now.toLocaleDateString("es-CO"),
      createdTime: now.toLocaleTimeString("es-CO"),

      registeredBy: req.user.name,
      registeredRole: req.user.role,

      receiptType: "CLIENTE",

      month,
      year,
      monthLabel,

      paymentMethod,
      paymentBank: paymentBank || "",
      paymentReference: paymentReference || "",

      serviceType,
      independentServiceType,

      clientId: client._id,

      clientSnapshot: clientSnapshot || {
        fullName: `${client.firstName || ""} ${client.secondName || ""} ${client.lastName || ""} ${client.secondLastName || ""}`.replace(/\s+/g, " ").trim(),
        docType: client.docType,
        docNumber: client.docNumber,
        phone: client.phone,
        email: client.email,
        clientType: client.clientType,
        groupName: client.groupName,
        companyName: client.companyName,
        eps: client.eps,
        afp: client.afp,
        arl: client.arl,
        ccf: client.ccf,
        plan: client.plan,
        risk: client.risk,
        over55: client.over55,
      },

      planCode: calculated.code,
      amounts: safeAmounts,

      status: safeAmounts.balance > 0 ? "SALDO PENDIENTE" : (status || "PAGADO"),
      note: note || "",
      planillaStatus: planillaStatus || "PENDIENTE DE PLANILLA",
      planillaNumber: planillaNumber || "",
      planillaPaymentDate: planillaPaymentDate || "",
      operator: operator || "",
      bank: bank || "",
    });

    res.json(receipt);
  } catch (e) {
    console.error("ERROR POST /receipts", e);
    res.status(500).json({ error: e.message || "No se pudo crear el recibo" });
  }
});

router.get("/receipts", auth, allow("ADMIN", "ASESOR"), async (req, res) => {
  try {
    const list = await Receipt.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: "No se pudieron cargar los recibos" });
  }
});

router.get("/receipts/client/:clientId", auth, allow("ADMIN", "ASESOR"), async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!isValidObjectId(clientId)) {
      return res.status(400).json({ error: "ID de cliente inválido" });
    }

    const list = await Receipt.find({ clientId }).sort({ createdAt: -1 });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: "No se pudieron cargar los recibos del cliente" });
  }
});

router.get("/public/receipts/:publicCode", async (req, res) => {
  try {
    const { publicCode } = req.params;

    let receipt = await Receipt.findOne({ publicCode });

    if (!receipt && publicCode.startsWith("R-")) {
      const ticket = Number(publicCode.replace("R-", ""));
      receipt = await Receipt.findOne({ ticket });
    }

    if (!receipt) {
      return res.status(404).json({ error: "Recibo no encontrado" });
    }

    res.json(receipt);
  } catch (e) {
    console.error("ERROR GET /public/receipts/:publicCode", e);
    res.status(500).json({ error: "No se pudo cargar el recibo público" });
  }
});

router.get("/receipts/:id", auth, allow("ADMIN", "ASESOR"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de recibo inválido" });
    }

    const receipt = await Receipt.findById(id);

    if (!receipt) {
      return res.status(404).json({ error: "Recibo no encontrado" });
    }

    res.json(receipt);
  } catch (e) {
    res.status(500).json({ error: "No se pudo cargar el recibo" });
  }
});

router.put("/receipts/:id", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de recibo inválido" });
    }

    const receipt = await Receipt.findById(id);

    if (!receipt) {
      return res.status(404).json({ error: "Recibo no encontrado" });
    }

    if (receipt.status === "ANULADO") {
      return res.status(400).json({ error: "No se puede editar un recibo anulado" });
    }

    const paymentMethod = req.body.paymentMethod || receipt.paymentMethod;
    const note = req.body.note ?? receipt.note;

    const received = Number(
      req.body.amounts?.received ??
      req.body.received ??
      receipt.amounts?.received ??
      0
    );

    const service = Number(
      req.body.amounts?.service ??
      req.body.service ??
      receipt.amounts?.service ??
      0
    );

    const planillaValue = Number(
      req.body.amounts?.planillaValue ??
      receipt.amounts?.planillaValue ??
      0
    );

    const isOccasional = String(receipt.receiptType || "").toUpperCase() === "OCASIONAL";

    const totalSystem = isOccasional
      ? planillaValue + service
      : Number(receipt.amounts?.eps || 0) +
        Number(receipt.amounts?.arl || 0) +
        Number(receipt.amounts?.afp || 0) +
        Number(receipt.amounts?.cofrem || 0) +
        service;

    const balance = totalSystem - received;

    const updated = await Receipt.findByIdAndUpdate(
      id,
      {
        paymentMethod,
        paymentBank: req.body.paymentBank ?? receipt.paymentBank,
        paymentReference: req.body.paymentReference ?? receipt.paymentReference,
        note,
        planillaNumber: req.body.planillaNumber ?? receipt.planillaNumber,
        planillaPaymentDate: req.body.planillaPaymentDate ?? receipt.planillaPaymentDate,
        operator: req.body.operator ?? receipt.operator,
        bank: req.body.bank ?? receipt.bank,
        "amounts.planillaValue": planillaValue,
        "amounts.service": service,
        "amounts.totalSystem": totalSystem,
        "amounts.received": received,
        "amounts.balance": balance,
        status: balance > 0 ? "SALDO PENDIENTE" : "PAGADO",
      },
      { new: true, runValidators: true }
    );

    res.json(updated);
  } catch (e) {
    console.error("ERROR PUT /receipts/:id", e);
    res.status(500).json({ error: e.message || "No se pudo actualizar el recibo" });
  }
});

router.delete("/receipts/:id", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de recibo inválido" });
    }

    const deleted = await Receipt.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Recibo no encontrado" });
    }

    res.json({ message: "Recibo eliminado correctamente" });
  } catch (e) {
    console.error("ERROR DELETE /receipts/:id", e);
    res.status(500).json({ error: "No se pudo eliminar el recibo" });
  }
});


// =========================
// 7) Iniciar servidor
// =========================


export default router;
