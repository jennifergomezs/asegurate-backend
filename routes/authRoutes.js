import express from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/index.js";
import { sign } from "../middleware/auth.js";

const router = express.Router();

// ---- Auth
router.post("/auth/login", async (req,res)=>{
  const {email, password} = req.body;
  const u = await User.findOne({email});
  if(!u) return res.status(400).json({error:"Credenciales inválidas"});
  const ok = await bcrypt.compare(password, u.passwordHash);
  if(!ok) return res.status(400).json({error:"Credenciales inválidas"});
  res.json({ token: sign(u), user: {name:u.name, role:u.role, email:u.email} });
});


export default router;
