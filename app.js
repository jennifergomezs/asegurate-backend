import express from "express";
import { corsHeaders } from "./middleware/cors.js";
import { registerRoutes } from "./routes/index.js";

const app = express();

app.use(corsHeaders);
app.use(express.json());
registerRoutes(app);

export default app;
