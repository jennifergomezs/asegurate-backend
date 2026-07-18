import dotenv from "dotenv";
import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { ensureAdmin } from "./services/ensureAdmin.js";

dotenv.config();

const port = process.env.PORT || 8080;

async function startServer() {
  try {
    await connectDatabase();
    await ensureAdmin();

    app.listen(port, () => {
      console.log("API Asegurate escuchando en puerto", port);
    });
  } catch (error) {
    console.error("Error iniciando el servidor:", error.message);
    process.exit(1);
  }
}

startServer();
