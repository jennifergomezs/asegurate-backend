import mongoose from "mongoose";

export async function connectDatabase() {
  console.log("ENV MONGODB_URI:", process.env.MONGODB_URI ? "SI EXISTE" : "NO EXISTE");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB conectado");
}
