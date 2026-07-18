import express from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../models/index.js";
import { auth, allow } from "../middleware/auth.js";
const { isValidObjectId } = mongoose;

const router = express.Router();

// ---- Usuarios (crear asesor) - solo ADMIN
router.post("/users", auth, allow("ADMIN"), async (req,res)=>{
  try{
    const {name,email,password,role} = req.body;
    const r = role || "ASESOR";
    const hash = await bcrypt.hash(password,10);
    const u = await User.create({name,email,passwordHash:hash,role:r});
    res.json({id:u._id, name:u.name, email:u.email, role:u.role});
  }catch(e){
    res.status(400).json({error:e.message || "No se pudo crear el usuario"});
  }
});

router.get("/users", auth, allow("ADMIN"), async (req, res) => {
  try {
    const list = await User.find()
      .select("-passwordHash")
      .sort({ createdAt: -1 });

    res.json(list);
  } catch (e) {
    res.status(500).json({ error: "No se pudieron cargar los usuarios" });
  }
});

router.put("/users/:id/status", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de usuario inválido" });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { active: Boolean(active) },
      { new: true }
    ).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(user);
  } catch (e) {
    res.status(500).json({ error: "No se pudo actualizar el estado del usuario" });
  }
});



export default router;
