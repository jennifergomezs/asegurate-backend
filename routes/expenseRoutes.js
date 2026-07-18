import express from "express";
import mongoose from "mongoose";
import { Expense } from "../models/index.js";
import { auth, allow } from "../middleware/auth.js";
const { isValidObjectId } = mongoose;

const router = express.Router();

// ---- Gastos
router.post("/expenses", auth, async (req, res) => {
  try {
    const expense = await Expense.create({
      ...req.body,
      createdBy: req.user.uid,
      createdByName: req.user.name,
    });

    res.json(expense);
  } catch (e) {
    res.status(400).json({ error: e.message || "No se pudo crear el gasto" });
  }
});

router.get("/expenses", auth, async (req, res) => {
  try {
    const query = {};

    if (req.user.role !== "ADMIN") {
      query.createdByName = req.user.name;
    }

    const expenses = await Expense.find(query).sort({ date: -1, createdAt: -1 });

    res.json(expenses);
  } catch (e) {
    res.status(500).json({ error: "No se pudieron cargar los gastos" });
  }
});

router.delete("/expenses/:id", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const expense = await Expense.findByIdAndDelete(id);

    if (!expense) {
      return res.status(404).json({ error: "Gasto no encontrado" });
    }

    res.json({ message: "Gasto eliminado correctamente" });
  } catch (e) {
    res.status(500).json({ error: "No se pudo eliminar el gasto" });
  }
});


export default router;
