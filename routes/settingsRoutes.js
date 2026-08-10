import express from "express";
import { SystemSetting } from "../models/index.js";
import { auth, allow } from "../middleware/auth.js";

const router = express.Router();


// ======================================================
// CATÁLOGOS PERMITIDOS
// ======================================================

const ALLOWED_CATALOGS = [
  "eps",
  "afp",
  "arl",
  "ccf",
  "operators",
  "banks",
  "paymentMethods",
];


// ======================================================
// CONFIGURACIÓN INICIAL
// ======================================================

const DEFAULT_SETTINGS = {
  key: "MAIN",

  general: {
    minimumSalary: 1750905,
    currentYear: 2026,
  },

  catalogs: {
    eps: [],
    afp: [],
    arl: [],
    ccf: [],
    operators: [],

    banks: [
      {
        name: "BANCOLOMBIA",
        code: "",
        active: true,
        order: 1,
      },
      {
        name: "DAVIVIENDA",
        code: "",
        active: true,
        order: 2,
      },
      {
        name: "NEQUI",
        code: "",
        active: true,
        order: 3,
      },
      {
        name: "OTRO",
        code: "",
        active: true,
        order: 4,
      },
    ],

    paymentMethods: [
      {
        name: "EFECTIVO",
        code: "",
        active: true,
        order: 1,
      },
      {
        name: "TRANSFERENCIA",
        code: "",
        active: true,
        order: 2,
      },
      {
        name: "CONSIGNACIÓN",
        code: "",
        active: true,
        order: 3,
      },
      {
        name: "OTRO",
        code: "",
        active: true,
        order: 4,
      },
    ],
  },
};


// ======================================================
// VALIDAR TIPO DE CATÁLOGO
// ======================================================

function validateCatalogType(type) {
  return ALLOWED_CATALOGS.includes(type);
}


// ======================================================
// OBTENER / CREAR CONFIGURACIÓN PRINCIPAL
// ======================================================

async function getMainSettings() {
  let settings = await SystemSetting.findOne({
    key: "MAIN",
  });

  if (!settings) {
    settings = await SystemSetting.create(DEFAULT_SETTINGS);
  }

  return settings;
}


// ======================================================
// OBTENER TODA LA CONFIGURACIÓN
// ======================================================

router.get(
  "/settings",
  auth,
  allow("ADMIN"),
  async (req, res) => {
    try {
      const settings = await getMainSettings();

      res.json(settings);
    } catch (e) {
      console.error("ERROR GET /settings", e);

      res.status(500).json({
        error:
          e.message ||
          "No se pudo cargar la configuración",
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
      const minimumSalary = Number(
        req.body.minimumSalary
      );

      const currentYear = Number(
        req.body.currentYear
      );

      if (
        !Number.isFinite(minimumSalary) ||
        minimumSalary <= 0
      ) {
        return res.status(400).json({
          error:
            "El salario mínimo debe ser un número válido",
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

      const settings =
        await SystemSetting.findOneAndUpdate(
          {
            key: "MAIN",
          },
          {
            $set: {
              "general.minimumSalary":
                minimumSalary,

              "general.currentYear":
                currentYear,
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
      console.error(
        "ERROR PUT /settings/general",
        e
      );

      res.status(400).json({
        error:
          e.message ||
          "No se pudo actualizar la configuración general",
      });
    }
  }
);


// ======================================================
// OBTENER UN CATÁLOGO
// ======================================================

router.get(
  "/settings/catalogs/:type",
  auth,
  allow("ADMIN"),
  async (req, res) => {
    try {
      const { type } = req.params;

      if (!validateCatalogType(type)) {
        return res.status(400).json({
          error: "Tipo de catálogo no válido",
        });
      }

      const settings = await getMainSettings();

      const items =
        settings.catalogs?.[type] || [];

      const orderedItems = [...items].sort(
        (a, b) =>
          Number(a.order || 0) -
          Number(b.order || 0)
      );

      res.json(orderedItems);
    } catch (e) {
      console.error(
        "ERROR GET /settings/catalogs/:type",
        e
      );

      res.status(500).json({
        error:
          e.message ||
          "No se pudo cargar el catálogo",
      });
    }
  }
);


// ======================================================
// AGREGAR ELEMENTO A UN CATÁLOGO
// ======================================================

router.post(
  "/settings/catalogs/:type",
  auth,
  allow("ADMIN"),
  async (req, res) => {
    try {
      const { type } = req.params;

      if (!validateCatalogType(type)) {
        return res.status(400).json({
          error: "Tipo de catálogo no válido",
        });
      }

      const name = String(
        req.body.name || ""
      )
        .trim()
        .toUpperCase();

      const code = String(
        req.body.code || ""
      )
        .trim()
        .toUpperCase();

      if (!name) {
        return res.status(400).json({
          error: "El nombre es obligatorio",
        });
      }

      if (
        type === "paymentMethods" &&
        name === "MIXTO"
      ) {
        return res.status(400).json({
          error:
            "MIXTO no es un medio de pago",
        });
      }

      const settings = await getMainSettings();

      const catalog =
        settings.catalogs[type];

      const duplicateName = catalog.some(
        (item) =>
          String(item.name || "")
            .trim()
            .toUpperCase() === name
      );

      if (duplicateName) {
        return res.status(400).json({
          error:
            "Ya existe un registro con ese nombre",
        });
      }

      if (code) {
        const duplicateCode = catalog.some(
          (item) =>
            String(item.code || "")
              .trim()
              .toUpperCase() === code
        );

        if (duplicateCode) {
          return res.status(400).json({
            error:
              "Ya existe un registro con ese código",
          });
        }
      }

      let order = Number(req.body.order);

      if (
        !Number.isInteger(order) ||
        order < 1
      ) {
        const maxOrder = catalog.reduce(
          (max, item) =>
            Math.max(
              max,
              Number(item.order || 0)
            ),
          0
        );

        order = maxOrder + 1;
      }

      catalog.push({
        name,
        code,
        active: true,
        order,
      });

      await settings.save();

      const updatedCatalog = [
        ...settings.catalogs[type],
      ].sort(
        (a, b) =>
          Number(a.order || 0) -
          Number(b.order || 0)
      );

      res.status(201).json(
        updatedCatalog
      );
    } catch (e) {
      console.error(
        "ERROR POST /settings/catalogs/:type",
        e
      );

      res.status(400).json({
        error:
          e.message ||
          "No se pudo agregar el registro",
      });
    }
  }
);


// ======================================================
// EDITAR / ACTIVAR / INACTIVAR REGISTRO
// ======================================================

router.put(
  "/settings/catalogs/:type/:id",
  auth,
  allow("ADMIN"),
  async (req, res) => {
    try {
      const { type, id } = req.params;

      if (!validateCatalogType(type)) {
        return res.status(400).json({
          error: "Tipo de catálogo no válido",
        });
      }

      const settings = await getMainSettings();

      const catalog =
        settings.catalogs[type];

      const item = catalog.id(id);

      if (!item) {
        return res.status(404).json({
          error: "Registro no encontrado",
        });
      }


      // ==================================================
      // EDITAR NOMBRE
      // ==================================================

      if (req.body.name !== undefined) {
        const name = String(
          req.body.name || ""
        )
          .trim()
          .toUpperCase();

        if (!name) {
          return res.status(400).json({
            error:
              "El nombre no puede quedar vacío",
          });
        }

        if (
          type === "paymentMethods" &&
          name === "MIXTO"
        ) {
          return res.status(400).json({
            error:
              "MIXTO no es un medio de pago",
          });
        }

        const duplicateName =
          catalog.some(
            (other) =>
              String(other._id) !==
                String(item._id) &&
              String(other.name || "")
                .trim()
                .toUpperCase() === name
          );

        if (duplicateName) {
          return res.status(400).json({
            error:
              "Ya existe un registro con ese nombre",
          });
        }

        item.name = name;
      }


      // ==================================================
      // EDITAR CÓDIGO
      // ==================================================

      if (req.body.code !== undefined) {
        const code = String(
          req.body.code || ""
        )
          .trim()
          .toUpperCase();

        if (code) {
          const duplicateCode =
            catalog.some(
              (other) =>
                String(other._id) !==
                  String(item._id) &&
                String(other.code || "")
                  .trim()
                  .toUpperCase() === code
            );

          if (duplicateCode) {
            return res.status(400).json({
              error:
                "Ya existe un registro con ese código",
            });
          }
        }

        item.code = code;
      }


      // ==================================================
      // EDITAR ORDEN
      // ==================================================

      if (req.body.order !== undefined) {
        const order = Number(
          req.body.order
        );

        if (
          !Number.isInteger(order) ||
          order < 1
        ) {
          return res.status(400).json({
            error:
              "El orden debe ser un número entero mayor a 0",
          });
        }

        item.order = order;
      }


      // ==================================================
      // ACTIVAR / INACTIVAR
      // ==================================================

      if (req.body.active !== undefined) {
        if (
          typeof req.body.active !==
          "boolean"
        ) {
          return res.status(400).json({
            error:
              "El estado debe ser verdadero o falso",
          });
        }

        item.active = req.body.active;
      }

      await settings.save();

      const updatedCatalog = [
        ...settings.catalogs[type],
      ].sort(
        (a, b) =>
          Number(a.order || 0) -
          Number(b.order || 0)
      );

      res.json(updatedCatalog);
    } catch (e) {
      console.error(
        "ERROR PUT /settings/catalogs/:type/:id",
        e
      );

      res.status(400).json({
        error:
          e.message ||
          "No se pudo actualizar el registro",
      });
    }
  }
);


export default router;