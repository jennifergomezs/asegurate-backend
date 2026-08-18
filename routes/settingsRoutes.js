import express from "express";
import {  SystemSetting,  Client,  Receipt,  CollectionAccount,  CollectionAccountPayroll,} from "../models/index.js";
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

    bankAccounts: [],

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

// ======================================================
// CUENTAS BANCARIAS
// ======================================================


// OBTENER CUENTAS BANCARIAS
router.get(
  "/settings/bank-accounts",
  auth,
  async (req, res) => {
    try {
      const settings = await getMainSettings();

      const accounts = [
        ...(settings.bankAccounts || []),
      ].sort(
        (a, b) =>
          Number(a.order || 0) -
          Number(b.order || 0)
      );

      res.json(accounts);
    } catch (e) {
      console.error(
        "ERROR GET /settings/bank-accounts",
        e
      );

      res.status(500).json({
        error:
          e.message ||
          "No se pudieron cargar las cuentas bancarias",
      });
    }
  }
);


// AGREGAR CUENTA BANCARIA
router.post(
  "/settings/bank-accounts",
  auth,
  allow("ADMIN"),
  async (req, res) => {
    try {
      const settings = await getMainSettings();

      const bank = String(
        req.body.bank || ""
      )
        .trim()
        .toUpperCase();

      const accountType = String(
        req.body.accountType || ""
      )
        .trim()
        .toUpperCase();

      const accountNumber = String(
        req.body.accountNumber || ""
      ).trim();

      const holderName = String(
        req.body.holderName || ""
      )
        .trim()
        .toUpperCase();

      const holderDocument = String(
        req.body.holderDocument || ""
      ).trim();

      if (!bank) {
        return res.status(400).json({
          error: "El banco es obligatorio",
        });
      }

      if (
        !["AHORROS", "CORRIENTE"].includes(
          accountType
        )
      ) {
        return res.status(400).json({
          error:
            "Selecciona un tipo de cuenta válido",
        });
      }

      if (!accountNumber) {
        return res.status(400).json({
          error:
            "El número de cuenta es obligatorio",
        });
      }

      if (!holderName) {
        return res.status(400).json({
          error:
            "El titular es obligatorio",
        });
      }

      if (!holderDocument) {
        return res.status(400).json({
          error:
            "El documento o NIT del titular es obligatorio",
        });
      }

      const accounts =
        settings.bankAccounts || [];

      const duplicate = accounts.some(
        (item) =>
          String(item.bank || "")
            .trim()
            .toUpperCase() === bank &&
          String(item.accountNumber || "")
            .trim() === accountNumber
      );

      if (duplicate) {
        return res.status(400).json({
          error:
            "Esta cuenta bancaria ya está registrada",
        });
      }

      let order = Number(req.body.order);

      if (
        !Number.isInteger(order) ||
        order < 1
      ) {
        const maxOrder = accounts.reduce(
          (max, item) =>
            Math.max(
              max,
              Number(item.order || 0)
            ),
          0
        );

        order = maxOrder + 1;
      }

      settings.bankAccounts.push({
        bank,
        accountType,
        accountNumber,
        holderName,
        holderDocument,
        active: true,
        order,
      });

      await settings.save();

      const updated = [
        ...settings.bankAccounts,
      ].sort(
        (a, b) =>
          Number(a.order || 0) -
          Number(b.order || 0)
      );

      res.status(201).json(updated);
    } catch (e) {
      console.error(
        "ERROR POST /settings/bank-accounts",
        e
      );

      res.status(400).json({
        error:
          e.message ||
          "No se pudo agregar la cuenta bancaria",
      });
    }
  }
);


// EDITAR / ACTIVAR / INACTIVAR CUENTA BANCARIA
router.put(
  "/settings/bank-accounts/:id",
  auth,
  allow("ADMIN"),
  async (req, res) => {
    try {
      const settings = await getMainSettings();

      const account =
        settings.bankAccounts.id(
          req.params.id
        );

      if (!account) {
        return res.status(404).json({
          error:
            "Cuenta bancaria no encontrada",
        });
      }

      if (req.body.bank !== undefined) {
        account.bank = String(
          req.body.bank || ""
        )
          .trim()
          .toUpperCase();
      }

      if (
        req.body.accountType !== undefined
      ) {
        const accountType = String(
          req.body.accountType || ""
        )
          .trim()
          .toUpperCase();

        if (
          !["AHORROS", "CORRIENTE"].includes(
            accountType
          )
        ) {
          return res.status(400).json({
            error:
              "Selecciona un tipo de cuenta válido",
          });
        }

        account.accountType =
          accountType;
      }

      if (
        req.body.accountNumber !== undefined
      ) {
        const accountNumber = String(
          req.body.accountNumber || ""
        ).trim();

        if (!accountNumber) {
          return res.status(400).json({
            error:
              "El número de cuenta es obligatorio",
          });
        }

        account.accountNumber =
          accountNumber;
      }

      if (
        req.body.holderName !== undefined
      ) {
        const holderName = String(
          req.body.holderName || ""
        )
          .trim()
          .toUpperCase();

        if (!holderName) {
          return res.status(400).json({
            error:
              "El titular es obligatorio",
          });
        }

        account.holderName =
          holderName;
      }

      if (
        req.body.holderDocument !== undefined
      ) {
        const holderDocument = String(
          req.body.holderDocument || ""
        ).trim();

        if (!holderDocument) {
          return res.status(400).json({
            error:
              "El documento o NIT es obligatorio",
          });
        }

        account.holderDocument =
          holderDocument;
      }

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
              "El orden debe ser mayor a 0",
          });
        }

        account.order = order;
      }

      if (req.body.active !== undefined) {
        account.active =
          Boolean(req.body.active);
      }

      await settings.save();

      const updated = [
        ...settings.bankAccounts,
      ].sort(
        (a, b) =>
          Number(a.order || 0) -
          Number(b.order || 0)
      );

      res.json(updated);
    } catch (e) {
      console.error(
        "ERROR PUT /settings/bank-accounts/:id",
        e
      );

      res.status(400).json({
        error:
          e.message ||
          "No se pudo actualizar la cuenta bancaria",
      });
    }
  }
);

// ======================================================
// IMPORTAR CATÁLOGOS DESDE DATOS EXISTENTES
// ======================================================

router.post(
  "/settings/import-existing",
  auth,
  allow("ADMIN"),
  async (req, res) => {
    try {
      const settings = await getMainSettings();

      const clients = await Client.find({}).lean();

      const receipts = await Receipt.find({}).lean();

      const collectionAccounts =
        await CollectionAccount.find({}).lean();

      const collectionPayrolls =
        await CollectionAccountPayroll.find({}).lean();


      // ==================================================
      // AGREGAR VALOR ÚNICO AL CATÁLOGO
      // ==================================================

      const addUnique = (type, value) => {
        const name = String(value || "")
          .trim()
          .toUpperCase();

        if (!name) return false;

        if (
          type === "paymentMethods" &&
          name === "MIXTO"
        ) {
          return false;
        }

        const catalog = settings.catalogs[type];

        const exists = catalog.some(
          (item) =>
            String(item.name || "")
              .trim()
              .toUpperCase() === name
        );

        if (exists) return false;

        const maxOrder = catalog.reduce(
          (max, item) =>
            Math.max(
              max,
              Number(item.order || 0)
            ),
          0
        );

        catalog.push({
          name,
          code: "",
          active: true,
          order: maxOrder + 1,
        });

        return true;
      };


      // ==================================================
      // CONTADORES
      // ==================================================

      const imported = {
        eps: 0,
        afp: 0,
        arl: 0,
        ccf: 0,
        operators: 0,
        banks: 0,
        paymentMethods: 0,
      };


      // ==================================================
      // CLIENTES
      // ==================================================

      for (const client of clients) {
        if (addUnique("eps", client.eps)) {
          imported.eps++;
        }

        if (addUnique("afp", client.afp)) {
          imported.afp++;
        }

        if (addUnique("arl", client.arl)) {
          imported.arl++;
        }

        if (addUnique("ccf", client.ccf)) {
          imported.ccf++;
        }
      }


      // ==================================================
      // RECIBOS
      // ==================================================

      for (const receipt of receipts) {
        const snapshot =
          receipt.clientSnapshot || {};

        if (addUnique("eps", snapshot.eps)) {
          imported.eps++;
        }

        if (addUnique("afp", snapshot.afp)) {
          imported.afp++;
        }

        if (addUnique("arl", snapshot.arl)) {
          imported.arl++;
        }

        if (addUnique("ccf", snapshot.ccf)) {
          imported.ccf++;
        }


        // MEDIO DE PAGO PRINCIPAL
        if (
          addUnique(
            "paymentMethods",
            receipt.paymentMethod
          )
        ) {
          imported.paymentMethods++;
        }


        // BANCO PRINCIPAL
        if (
          addUnique(
            "banks",
            receipt.paymentBank
          )
        ) {
          imported.banks++;
        }


        // PAGOS COMBINADOS
        for (
          const payment of
          receipt.paymentDetails || []
        ) {
          if (
            addUnique(
              "paymentMethods",
              payment.method
            )
          ) {
            imported.paymentMethods++;
          }

          if (
            addUnique(
              "banks",
              payment.bank
            )
          ) {
            imported.banks++;
          }
        }


        // DATOS DE PLANILLA GUARDADOS EN RECIBO
        if (
          addUnique(
            "operators",
            receipt.operator
          )
        ) {
          imported.operators++;
        }

        if (
          addUnique(
            "banks",
            receipt.bank
          )
        ) {
          imported.banks++;
        }
      }


      // ==================================================
      // CUENTAS DE COBRO
      // ==================================================

      for (
        const account of collectionAccounts
      ) {
        for (
          const payment of account.payments || []
        ) {
          if (
            addUnique(
              "paymentMethods",
              payment.method
            )
          ) {
            imported.paymentMethods++;
          }
        }
      }


      // ==================================================
      // PLANILLAS DE CUENTAS DE COBRO
      // ==================================================

      for (
        const payroll of collectionPayrolls
      ) {
        if (
          addUnique(
            "operators",
            payroll.operator
          )
        ) {
          imported.operators++;
        }

        if (
          addUnique(
            "banks",
            payroll.bank
          )
        ) {
          imported.banks++;
        }
      }


      await settings.save();


      // ==================================================
      // RESPUESTA
      // ==================================================

      res.json({
        message:
          "Importación de catálogos completada correctamente",
        imported,
        catalogs: settings.catalogs,
      });
    } catch (e) {
      console.error(
        "ERROR POST /settings/import-existing",
        e
      );

      res.status(500).json({
        error:
          e.message ||
          "No se pudieron importar los datos existentes",
      });
    }
  }
);

// ======================================================
// IMPORTAR CATÁLOGO COMPLETO DE ADMINISTRADORAS PILA
// ======================================================

router.post(
  "/settings/import-pila-codes",
  auth,
  allow("ADMIN"),
  async (req, res) => {
    try {
      const settings = await getMainSettings();

      const ADMINISTRATORS = {
        eps: [
          {
            name: "ALIANSALUD",
            code: "EPS001",
            aliases: ["EPS001"],
            nit: "",
            historical: false,
          },
          {
            name: "SALUD TOTAL",
            code: "EPS002",
            aliases: ["EPS002"],
            nit: "",
            historical: false,
          },
          {
            name: "SANITAS",
            code: "EPS005",
            aliases: ["EPS005"],
            nit: "",
            historical: false,
          },
          {
            name: "COMPENSAR",
            code: "EPS008",
            aliases: ["EPS008"],
            nit: "",
            historical: false,
          },
          {
            name: "SURA",
            code: "EPS010",
            aliases: ["EPS010"],
            nit: "",
            historical: false,
          },
          {
            name: "FAMISANAR",
            code: "EPS017",
            aliases: ["EPS017"],
            nit: "",
            historical: false,
          },
          {
            name: "NUEVA EPS",
            code: "EPS037",
            aliases: ["EPS037"],
            nit: "",
            historical: false,
          },
          {
            name: "MUTUAL SER",
            code: "ESSC07",
            aliases: ["ESSC07", "ESS007"],
            nit: "",
            historical: false,
          },
          {
            name: "CAJACOPI",
            code: "CCFC55",
            aliases: ["CCFC55", "CCF055"],
            nit: "",
            historical: false,
          },
          {
            name: "COOSALUD",
            code: "ESS024",
            aliases: ["ESS024", "EPS042", "ESSC24", "EPSS42"],
            nit: "",
            historical: false,
          },
          {
            name: "CAPITAL SALUD",
            code: "EPSC34",
            aliases: ["EPSC34"],
            nit: "",
            historical: false,
          },
        ],

        afp: [
          {
            name: "PROTECCION",
            code: "230201",
            aliases: ["230201"],
            nit: "",
            historical: false,
          },
          {
            name: "PORVENIR",
            code: "230301",
            aliases: ["230301"],
            nit: "",
            historical: false,
          },
          {
            name: "COLFONDOS",
            code: "230901",
            aliases: ["230901"],
            nit: "",
            historical: false,
          },
          {
            name: "COLPENSIONES",
            code: "25-14",
            aliases: ["25-14"],
            nit: "",
            historical: false,
          },
        ],

        arl: [
          {
            name: "SURA",
            code: "14-11",
            aliases: ["14-11"],
            nit: "",
            historical: false,
          },
          {
            name: "POSITIVA",
            code: "14-23",
            aliases: ["14-23"],
            nit: "",
            historical: false,
          },
          {
            name: "SEGUROS BOLIVAR",
            code: "14-7",
            aliases: ["14-7"],
            nit: "",
            historical: false,
          },
        ],

        ccf: [
          {
            name: "CAFAM",
            code: "CCF21",
            aliases: ["CCF21"],
            nit: "",
            historical: false,
          },
          {
            name: "COLSUBSIDIO",
            code: "CCF22",
            aliases: ["CCF22"],
            nit: "",
            historical: false,
          },
          {
            name: "COMPENSAR",
            code: "CCF24",
            aliases: ["CCF24"],
            nit: "",
            historical: false,
          },
          {
            name: "COFREM",
            code: "CCF34",
            aliases: ["CCF34"],
            nit: "",
            historical: false,
          },
          {
            name: "CAJASAN",
            code: "CCF39",
            aliases: ["CCF39"],
            nit: "",
            historical: false,
          },
          {
            name: "COMFACASANARE",
            code: "CCF69",
            aliases: ["CCF69"],
            nit: "",
            historical: false,
          },
        ],
      };

      const result = {
        eps: 0,
        afp: 0,
        arl: 0,
        ccf: 0,
        updated: 0,
      };

      for (const type of ["eps", "afp", "arl", "ccf"]) {
        const catalog = settings.catalogs[type];

        for (const administrator of ADMINISTRATORS[type]) {
          const existing = catalog.find(
            (item) =>
              String(item.name || "")
                .trim()
                .toUpperCase() === administrator.name
          );

          if (existing) {
            existing.code = administrator.code;
            existing.aliases = administrator.aliases;
            existing.nit = administrator.nit;
            existing.historical = administrator.historical;

            result.updated++;
            continue;
          }

          const maxOrder = catalog.reduce(
            (max, item) =>
              Math.max(max, Number(item.order || 0)),
            0
          );

          catalog.push({
            ...administrator,
            active: true,
            order: maxOrder + 1,
          });

          result[type]++;
        }
      }

      await settings.save();

      res.json({
        message:
          "Catálogo de administradoras PILA importado correctamente",
        imported: result,
        catalogs: settings.catalogs,
      });
    } catch (e) {
      console.error(
        "ERROR POST /settings/import-pila-codes",
        e
      );

      res.status(500).json({
        error:
          e.message ||
          "No se pudo importar el catálogo de administradoras",
      });
    }
  }
);

export default router;
