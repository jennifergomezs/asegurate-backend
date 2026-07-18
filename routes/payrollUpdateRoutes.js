import express from "express";
import { Receipt } from "../models/index.js";
import { auth, allow } from "../middleware/auth.js";

const router = express.Router();

router.put("/payrolls/update", auth, allow("ADMIN") , async (req, res) => {
  try {
    const {
      oldPlanillaNumber,
      oldPaymentDate,
      oldOperator,
      oldBank,
      planillaNumber,
      paymentDate,
      operator,
      bank,
      lateFee,
      totalPaid,
    } = req.body;

    if (!oldPlanillaNumber) {
      return res.status(400).json({ error: "Falta la planilla original" });
    }

    if (!planillaNumber) {
      return res.status(400).json({ error: "Debes ingresar el número de planilla" });
    }

    const result = await Receipt.updateMany(
      {
        planillaStatus: "PLANILLA PAGADA",
        planillaNumber: oldPlanillaNumber,
        planillaPaymentDate: oldPaymentDate || "",
        operator: oldOperator || "",
        bank: oldBank || "",
      },
      {
        $set: {
          planillaNumber: String(planillaNumber || ""),
          planillaPaymentDate: String(paymentDate || ""),
          operator: String(operator || ""),
          bank: String(bank || ""),
          planillaLateFee: Number(lateFee || 0),
          planillaTotalPaid: Number(totalPaid || 0),
        },
      }
    );

    res.json({
      message: "Planilla actualizada correctamente",
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("ERROR PUT /payrolls/update", err);
    res.status(500).json({ error: "No se pudo actualizar la planilla" });
  }
});


export default router;
