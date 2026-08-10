import express from "express";
import { SystemSetting } from "../models/index.js";
import { auth, allow } from "../middleware/auth.js";

const router = express.Router();

const DEFAULT_SETTINGS = {
  key: "MAIN",

  general: {
    minimumSalary: 1750905,
    currentYear: 2026,
  },

  banks: [
    { name: "BANCOLOMBIA", active: true },
    { name: "DAVIVIENDA", active: true },
    { name: "NEQUI", active: true },
    { name: "OTRO", active: true },
  ],

  paymentMethods: [
    { name: "EFECTIVO", active: true },
    { name: "TRANSFERENCIA", active: true },
    { name: "CONSIGNACIÓN", active: true },
    { name: "OTRO", active: true },
  ],
};


// ======================================================
// OBTENER CONFIGURACIÓN
// ======================================================

router.get(
  "/settings",
  auth,
  allow("ADMIN"),
  async (req, res) => {
    try {
      let settings = await SystemSetting.findOne({
        key: "MAIN",
      });

      if (!settings) {
        settings = await SystemSetting.create(DEFAULT_SETTINGS);
      }

      res.json(settings);
    } catch (e) {
      console.error("ERROR GET /settings", e);

      res.status(500).json({
        error: e.message || "No se pudo cargar la configuración",
      });
    }
  }
);


// ======================================================
// ACTUALIZAR CONFIGURACIÓN GENERAL
// ======================================================

router.put(
  "/settings/general",
  auth,
  allow("ADMIN"),
  async (req, res) => {
    try {
      const minimumSalary = Number(req.body.minimumSalary);
      const currentYear = Number(req.body.currentYear);

      if (!Number.isFinite(minimumSalary) || minimumSalary <= 0) {
        return res.status(400).json({
          error: "El salario mínimo debe ser un número válido",
        });
      }

      if (
        !Number.isInteger(currentYear) ||
        currentYear < 2020 ||
        currentYear > 2100
      ) {
        return res.status(400).json({
          error: "El año vigente no es válido",
        });
      }

      const settings = await SystemSetting.findOneAndUpdate(
        {
          key: "MAIN",
        },
        {
          $set: {
            "general.minimumSalary": minimumSalary,
            "general.currentYear": currentYear,
          },
          $setOnInsert: {
            key: "MAIN",
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
        }
      );

      res.json(settings);
    } catch (e) {
      console.error("ERROR PUT /settings/general", e);

      res.status(400).json({
        error:
          e.message ||
          "No se pudo actualizar la configuración general",
      });
    }
  }
);


// ======================================================
// AGREGAR BANCO
// ======================================================

router.post(
  "/settings/banks",
  auth,
  allow("ADMIN"),
  async (req, res) => {
    try {
      const name = String(req.body.name || "")
        .trim()
        .toUpperCase();

      if (!name) {
        return res.status(400).json({
          error: "El nombre del banco es obligatorio",
        });
      }

      let settings = await SystemSetting.findOne({
        key: "MAIN",
      });

      if (!settings) {
        settings = await SystemSetting.create(DEFAULT_SETTINGS);
      }

      const exists = settings.banks.some(
        (bank) =>
          String(bank.name || "").trim().toUpperCase() === name
      );

      if (exists) {
        return res.status(400).json({
          error: "Ese banco ya existe",
        });
      }

      settings.banks.push({
        name,
        active: true,
      });

      await settings.save();

      res.json(settings);
    } catch (e) {
      console.error("ERROR POST /settings/banks", e);

      res.status(400).json({
        error: e.message || "No se pudo agregar el banco",
      });
    }
  }
);


// ======================================================
// EDITAR / ACTIVAR / INACTIVAR BANCO
// ======================================================

router.put(
  "/settings/banks/:id",
  auth,
  allow("ADMIN"),
  async (req, res) => {
    try {
      const settings = await SystemSetting.findOne({
        key: "MAIN",
      });

      if (!settings) {
        return res.status(404).json({
          error: "Configuración no encontrada",
        });
      }

      const bank = settings.banks.id(req.params.id);

      if (!bank) {
        return res.status(404).json({
          error: "Banco no encontrado",
        });
      }

      if (req.body.name !== undefined) {
        const name = String(req.body.name || "")
          .trim()
          .toUpperCase();

        if (!name) {
          return res.status(400).json({
            error: "El nombre del banco es obligatorio",
          });
        }

        const duplicate = settings.banks.some(
          (item) =>
            String(item._id) !== String(bank._id) &&
            String(item.name || "").trim().toUpperCase() === name
        );

        if (duplicate) {
          return res.status(400).json({
            error: "Ese banco ya existe",
          });
        }

        bank.name = name;
      }

      if (req.body.active !== undefined) {
        bank.active = Boolean(req.body.active);
      }

      await settings.save();

      res.json(settings);
    } catch (e) {
      console.error("ERROR PUT /settings/banks/:id", e);

      res.status(400).json({
        error: e.message || "No se pudo actualizar el banco",
      });
    }
  }
);


// ======================================================
// AGREGAR MEDIO DE PAGO
// ======================================================

router.post(
  "/settings/payment-methods",
  auth,
  allow("ADMIN"),
  async (req, res) => {
    try {
      const name = String(req.body.name || "")
        .trim()
        .toUpperCase();

      if (!name) {
        return res.status(400).json({
          error: "El medio de pago es obligatorio",
        });
      }

      if (name === "MIXTO") {
        return res.status(400).json({
          error: "MIXTO no es un medio de pago",
        });
      }

      let settings = await SystemSetting.findOne({
        key: "MAIN",
      });

      if (!settings) {
        settings = await SystemSetting.create(DEFAULT_SETTINGS);
      }

      const exists = settings.paymentMethods.some(
        (item) =>
          String(item.name || "").trim().toUpperCase() === name
      );

      if (exists) {
        return res.status(400).json({
          error: "Ese medio de pago ya existe",
        });
      }

      settings.paymentMethods.push({
        name,
        active: true,
      });

      await settings.save();

      res.json(settings);
    } catch (e) {
      console.error(
        "ERROR POST /settings/payment-methods",
        e
      );

      res.status(400).json({
        error:
          e.message ||
          "No se pudo agregar el medio de pago",
      });
    }
  }
);


// ======================================================
// EDITAR / ACTIVAR / INACTIVAR MEDIO DE PAGO
// ======================================================

router.put(
  "/settings/payment-methods/:id",
  auth,
  allow("ADMIN"),
  async (req, res) => {
    try {
      const settings = await SystemSetting.findOne({
        key: "MAIN",
      });

      if (!settings) {
        return res.status(404).json({
          error: "Configuración no encontrada",
        });
      }

      const paymentMethod =
        settings.paymentMethods.id(req.params.id);

      if (!paymentMethod) {
        return res.status(404).json({
          error: "Medio de pago no encontrado",
        });
      }

      if (req.body.name !== undefined) {
        const name = String(req.body.name || "")
          .trim()
          .toUpperCase();

        if (!name) {
          return res.status(400).json({
            error: "El medio de pago es obligatorio",
          });
        }

        if (name === "MIXTO") {
          return res.status(400).json({
            error: "MIXTO no es un medio de pago",
          });
        }

        const duplicate = settings.paymentMethods.some(
          (item) =>
            String(item._id) !==
              String(paymentMethod._id) &&
            String(item.name || "")
              .trim()
              .toUpperCase() === name
        );

        if (duplicate) {
          return res.status(400).json({
            error: "Ese medio de pago ya existe",
          });
        }

        paymentMethod.name = name;
      }

      if (req.body.active !== undefined) {
        paymentMethod.active = Boolean(req.body.active);
      }

      await settings.save();

      res.json(settings);
    } catch (e) {
      console.error(
        "ERROR PUT /settings/payment-methods/:id",
        e
      );

      res.status(400).json({
        error:
          e.message ||
          "No se pudo actualizar el medio de pago",
      });
    }
  }
);


export default router;