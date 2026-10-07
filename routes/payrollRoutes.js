import express from "express";
import mongoose from "mongoose";
import { Receipt, PayrollRecord } from "../models/index.js";
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

// ---- Registrar planilla de retiro desde Mensualidades (sin recibo)
router.post(
  "/payrolls/retirement",
  auth,
  allow("ADMIN", "ASESOR"),
  async (req, res) => {
    try {
      const {
        planillaNumber,
        paymentDate,
        operator,
        bank,
        planillaValue,
        lateFee,
        totalPaid,
        periodLabel,
        contributionPeriod,
        groupName,
        employees,
      } = req.body;

      if (!planillaNumber) {
        return res
          .status(400)
          .json({ error: "Debes ingresar el número de planilla" });
      }

      if (!paymentDate) {
        return res
          .status(400)
          .json({ error: "Debes ingresar la fecha de pago" });
      }

      if (!employees || !Array.isArray(employees) || employees.length === 0) {
        return res
          .status(400)
          .json({ error: "La planilla debe tener al menos un trabajador" });
      }

      const payrollRecord = await PayrollRecord.create({
        type: "RETIRO",

        planillaNumber: String(planillaNumber).trim(),
        paymentDate: String(paymentDate),

        operator: String(operator || ""),
        bank: String(bank || ""),

        planillaValue: Number(planillaValue || 0),
        lateFee: Number(lateFee || 0),
        totalPaid: Number(totalPaid || 0),

        periodLabel: String(periodLabel || ""),
        contributionPeriod: String(contributionPeriod || ""),
        groupName: String(groupName || ""),

        employees,

        registeredBy: req.user?.name || "",
        notes: "Planilla de retiro generada desde Mensualidades",
      });

      res.status(201).json({
        message: "Planilla de retiro registrada correctamente",
        payroll: payrollRecord,
      });
    } catch (err) {
      console.error("ERROR POST /payrolls/retirement", err);

      res.status(500).json({
        error: "No se pudo registrar la planilla de retiro",
      });
    }
  }
);

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

// ---- Planillas de retiro registradas desde Mensualidades
router.get(
  "/payrolls/retirements",
  auth,
  allow("ADMIN", "ASESOR"),
  async (req, res) => {
    try {
      const query = {
        type: "RETIRO",
        status: "REGISTRADA",
      };

      if (req.user.role !== "ADMIN") {
        query.registeredBy = req.user.name;
      }

      const payrolls = await PayrollRecord.find(query).sort({
        paymentDate: -1,
        createdAt: -1,
      });

      res.json(payrolls);
    } catch (err) {
      console.error("ERROR GET /payrolls/retirements", err);

      res.status(500).json({
        error: "No se pudieron cargar las planillas de retiro",
      });
    }
  }
);

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
