import express from "express";
import { Company, Client } from "../models/index.js";
import { auth, allow } from "../middleware/auth.js";

const router = express.Router();

// ---- Empresas
router.post("/companies", auth, allow("ADMIN"), async (req, res) => {
  try {
    console.log("BODY /companies:", req.body);

    const company = await Company.create(req.body);

    console.log("EMPRESA CREADA:", company);

    res.json(company);
  } catch (e) {
    console.error("ERROR POST /companies", e);
    res.status(400).json({ error: e.message || "No se pudo crear la empresa" });
  }
});

router.get("/companies", auth, allow("ADMIN", "ASESOR"), async (req, res) => {
  try {
    const list = await Company.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (e) {
    console.error("ERROR GET /companies", e);
    res.status(500).json({ error: "No se pudieron cargar las empresas" });
  }
});



router.put("/companies/:id", auth, allow("ADMIN"), async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!company) {
      return res.status(404).json({ error: "Empresa no encontrada" });
    }

    res.json(company);
  } catch (e) {
    console.error("ERROR PUT /companies/:id", e);
    res.status(400).json({ error: e.message || "No se pudo actualizar la empresa" });
  }
});

router.put(
  "/companies/:id/update-service",
  auth,
  allow("ADMIN"),
  async (req, res) => {
    try {
      const serviceValue = Number(req.body.serviceValue);

      if (!Number.isFinite(serviceValue) || serviceValue < 0) {
        return res.status(400).json({
          error: "El valor del servicio debe ser un número válido",
        });
      }

      const company = await Company.findById(req.params.id);

      if (!company) {
        return res.status(404).json({
          error: "Empresa no encontrada",
        });
      }

      const result = await Client.updateMany(
        {
          clientType: "AGRUPADO",
          companyNit: company.nit,
        },
        {
          $set: {
            serviceValue: String(serviceValue),
          },
        }
      );

      company.defaultServiceValue = serviceValue;
      await company.save();

      res.json({
        message: "Valor del servicio actualizado correctamente",
        updatedClients: result.modifiedCount,
        matchedClients: result.matchedCount,
        defaultServiceValue: company.defaultServiceValue,
      });
    } catch (e) {
      console.error("ERROR PUT /companies/:id/update-service", e);

      res.status(400).json({
        error:
          e.message ||
          "No se pudo actualizar el valor del servicio de los afiliados",
      });
    }
  }
);

export default router;
