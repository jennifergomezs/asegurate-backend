import express from "express";
import mongoose from "mongoose";
import { Group, Client } from "../models/index.js";
import { auth, allow } from "../middleware/auth.js";
const { isValidObjectId } = mongoose;

const router = express.Router();

// ---- Agrupadoras
router.post("/groups", auth, allow("ADMIN"), async (req, res) => {
  try {
    const group = await Group.create(req.body);
    res.json(group);
  } catch (e) {
    res.status(400).json({ error: e.message || "No se pudo crear la agrupadora" });
  }
});

router.get("/groups", auth, async (req, res) => {
  try {
    const groups = await Group.find({})
      .sort({ createdAt: -1 });

    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: "No se pudieron cargar las agrupadoras" });
  }
});

// Obtener una agrupadora por ID
router.get("/groups/:id", auth, allow("ADMIN", "ASESOR"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const group = await Group.findById(id);

    if (!group) {
      return res.status(404).json({ error: "Agrupadora no encontrada" });
    }

    res.json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo agrupadora" });
  }
});

// Editar agrupadora
router.put("/groups/:id", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const previousGroup = await Group.findById(id);

    if (!previousGroup) {
      return res.status(404).json({ error: "Agrupadora no encontrada" });
    }

    const group = await Group.findByIdAndUpdate(
      id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    await Client.updateMany(
      {
        $or: [
          { groupNit: previousGroup.nit },
          {
            groupNit: "",
            groupName: previousGroup.name,
          },
        ],
      },
      {
        $set: {
          groupName: group.name,
          groupNit: group.nit,
        },
      }
    );

    res.json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo actualizar la agrupadora" });
  }
});

// Eliminar agrupadora
router.delete("/groups/:id", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const group = await Group.findByIdAndDelete(id);

    if (!group) {
      return res.status(404).json({ error: "Agrupadora no encontrada" });
    }

    res.json({ message: "Agrupadora eliminada correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo eliminar la agrupadora" });
  }
});

// prueba agrupadora sin ver
router.get("/groups-debug", auth, allow("ADMIN"), async (req, res) => {
  try {
    const groups = await Group.find({}).sort({ createdAt: -1 });

    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: "Error revisando agrupadoras" });
  }
});


export default router;
