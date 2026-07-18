import express from "express";
import mongoose from "mongoose";
import { Receipt } from "../models/index.js";
import { auth, allow } from "../middleware/auth.js";
const { isValidObjectId } = mongoose;

const router = express.Router();

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
    res.status(500).json({ error: "No se pudo eliminar el recibo" });
  }
});


// Anular recibo
router.put("/receipts/:id/cancel", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de recibo inválido" });
    }

    const receipt = await Receipt.findByIdAndUpdate(
      id,
      {
  status: "ANULADO",
  cancelledAt: new Date(),
  cancelledBy: req.user.name,
},
      {
        new: true,
      }
    );

    if (!receipt) {
      return res.status(404).json({ error: "Recibo no encontrado" });
    }

    res.json(receipt);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo anular el recibo" });
  }
});


export default router;
