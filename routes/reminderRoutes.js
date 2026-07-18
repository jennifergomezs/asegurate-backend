import express from "express";
import mongoose from "mongoose";
import { Reminder } from "../models/index.js";
import { auth, allow } from "../middleware/auth.js";
const { isValidObjectId } = mongoose;

const router = express.Router();

// ---- Recordatorios del Dashboard
router.get("/reminders", auth, async (req, res) => {
  try {
    const query = req.user.role === "ADMIN"
      ? {}
      : { active: true, visibleToAdvisors: true };

    const reminders = await Reminder.find(query).sort({ dayOfMonth: 1, createdAt: -1 });
    res.json(reminders);
  } catch (e) {
    res.status(500).json({ error: "No se pudieron cargar los recordatorios" });
  }
});

router.post("/reminders", auth, allow("ADMIN"), async (req, res) => {
  try {
    const reminder = await Reminder.create({
      ...req.body,
      amount: Number(req.body.amount || 0),
      dayOfMonth: Number(req.body.dayOfMonth || 1),
      createdByName: req.user.name,
    });
    res.json(reminder);
  } catch (e) {
    res.status(400).json({ error: e.message || "No se pudo crear el recordatorio" });
  }
});

router.put("/reminders/:id", auth, allow("ADMIN"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "ID de recordatorio inválido" });
    }

    const reminder = await Reminder.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        amount: Number(req.body.amount || 0),
        dayOfMonth: Number(req.body.dayOfMonth || 1),
      },
      { new: true, runValidators: true }
    );

    if (!reminder) return res.status(404).json({ error: "Recordatorio no encontrado" });
    res.json(reminder);
  } catch (e) {
    res.status(400).json({ error: e.message || "No se pudo actualizar el recordatorio" });
  }
});

router.put("/reminders/:id/complete", auth, allow("ADMIN", "ASESOR"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "ID de recordatorio inválido" });
    }

    const reminder = await Reminder.findById(req.params.id);
    if (!reminder) return res.status(404).json({ error: "Recordatorio no encontrado" });

    if (req.user.role !== "ADMIN" && (!reminder.active || !reminder.visibleToAdvisors)) {
      return res.status(403).json({ error: "Tarea no disponible" });
    }

    const period = String(req.body.period || "").trim();
    if (!period) return res.status(400).json({ error: "Periodo requerido" });

    const completed = reminder.completionPeriods.includes(period);

    if (completed) {
      reminder.completionPeriods = reminder.completionPeriods.filter((item) => item !== period);
      reminder.completionRecords = (reminder.completionRecords || []).filter(
        (item) => item.period !== period
      );
    } else {
      reminder.completionPeriods = [...reminder.completionPeriods, period];
      reminder.completionRecords = [
        ...(reminder.completionRecords || []).filter((item) => item.period !== period),
        {
          period,
          completedBy: req.user.name,
          completedAt: new Date(),
        },
      ];
    }

    await reminder.save();
    res.json(reminder);
  } catch (e) {
    console.error("ERROR PUT /reminders/:id/complete", e);
    res.status(500).json({ error: "No se pudo cambiar el estado del recordatorio" });
  }
});

router.delete("/reminders/:id", auth, allow("ADMIN"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "ID de recordatorio inválido" });
    }

    const reminder = await Reminder.findByIdAndDelete(req.params.id);
    if (!reminder) return res.status(404).json({ error: "Recordatorio no encontrado" });
    res.json({ message: "Recordatorio eliminado correctamente" });
  } catch (e) {
    res.status(500).json({ error: "No se pudo eliminar el recordatorio" });
  }
});


export default router;
