import bcrypt from "bcryptjs";
import { User } from "../models/index.js";

export async function ensureAdmin() {
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

  await User.findOneAndUpdate(
    { email: process.env.ADMIN_EMAIL },
    {
      name: "Jennifer Gómez",
      email: process.env.ADMIN_EMAIL,
      passwordHash: hash,
      role: "ADMIN",
    },
    { upsert: true, new: true }
  );

  console.log("Admin listo:", process.env.ADMIN_EMAIL);
}
