import express from "express";
import mongoose from "mongoose";
import {  Client,  Company,  SystemSetting,} from "../models/index.js";
import multer from "multer";
import * as XLSX from "xlsx";
import { auth, allow } from "../middleware/auth.js";
const { isValidObjectId } = mongoose;

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
});

// ---- Clientes
router.post("/clients", auth, allow("ADMIN","ASESOR"), async (req,res)=>{
  try {

    const existingClient = await Client.findOne({
      docNumber: String(req.body.docNumber).trim(),
    });

    if (existingClient) {
      return res.status(400).json({
        error: "Ya existe un cliente registrado con ese número de documento.",
      });
    }

    const c = await Client.create(req.body);

    res.json(c);

  } catch (e) {
    console.error("ERROR POST /clients", e);
    res.status(400).json({
      error: e.message || "Datos inválidos",
    });
  }
});

router.get("/clients", auth, allow("ADMIN","ASESOR"), async (req,res)=>{
  try {
    const q = (req.query.search || "").trim();
    const returnAll = String(req.query.all || "").toLowerCase() === "true";

    let filter = {};

    if (q) {
      const escapedSearch = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(escapedSearch, "i");

      filter = {
        $or: [
          { docNumber: searchRegex },
          { firstName: searchRegex },
          { secondName: searchRegex },
          { lastName: searchRegex },
          { secondLastName: searchRegex },
          { phone: searchRegex },
          { email: searchRegex },
          { eps: searchRegex },
          { groupName: searchRegex },
          { ref: searchRegex },
        ],
      };
    }

    let query = Client.find(filter).sort({ createdAt: -1 });

    if (!returnAll) {
      query = query.limit(50);
    }

    const list = await query;
    res.json(list);
  } catch (error) {
    console.error("ERROR GET /clients", error);
    res.status(500).json({ error: "No se pudieron cargar los clientes" });
  }
});


// Listado paginado de clientes para ClientsList
router.get("/clients/paginated", auth, allow("ADMIN", "ASESOR"), async (req, res) => {
  try {
    const pageRequested = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = 50;

    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "TODOS").trim().toUpperCase();
    const clientType = String(req.query.clientType || "TODOS").trim().toUpperCase();
    const eps = String(req.query.eps || "TODOS").trim();
    const groupName = String(req.query.groupName || "TODOS").trim();

    const filter = {};

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(escapedSearch, "i");

      filter.$or = [
        { docNumber: searchRegex },
        { firstName: searchRegex },
        { secondName: searchRegex },
        { lastName: searchRegex },
        { secondLastName: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
        { eps: searchRegex },
        { groupName: searchRegex },
        { ref: searchRegex },
      ];
    }

    if (status !== "TODOS") {
      filter.status = status;
    }

    if (clientType !== "TODOS") {
      filter.clientType = clientType;
    }

    if (eps && eps.toUpperCase() !== "TODOS") {
      filter.eps = eps;
    }

    if (groupName && groupName.toUpperCase() !== "TODOS") {
      filter.groupName = groupName;
    }

    const total = await Client.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(pageRequested, totalPages);
    const skip = (page - 1) * limit;

    const [rows, epsOptions, groupOptions, statsResult] = await Promise.all([
      Client.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Client.distinct("eps", { eps: { $nin: ["", null] } }),

      Client.distinct("groupName", { groupName: { $nin: ["", null] } }),

      Client.aggregate([
        {
          $group: {
            _id: null,
            active: {
              $sum: {
                $cond: [{ $eq: [{ $toUpper: "$status" }, "ACTIVO"] }, 1, 0],
              },
            },
            retired: {
              $sum: {
                $cond: [{ $eq: [{ $toUpper: "$status" }, "RETIRADO"] }, 1, 0],
              },
            },
            grouped: {
              $sum: {
                $cond: [{ $eq: [{ $toUpper: "$clientType" }, "AGRUPADO"] }, 1, 0],
              },
            },
            independent: {
              $sum: {
                $cond: [{ $eq: [{ $toUpper: "$clientType" }, "INDEPENDIENTE"] }, 1, 0],
              },
            },
            companies: {
              $sum: {
                $cond: [{ $eq: [{ $toUpper: "$clientType" }, "EMPRESA"] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

    const stats = statsResult[0] || {
      active: 0,
      retired: 0,
      grouped: 0,
      independent: 0,
      companies: 0,
    };

    delete stats._id;

    res.json({
      rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      options: {
        eps: epsOptions.sort((a, b) => String(a).localeCompare(String(b), "es")),
        groups: groupOptions.sort((a, b) => String(a).localeCompare(String(b), "es")),
      },
      stats,
    });
  } catch (error) {
    console.error("ERROR GET /clients/paginated", error);
    res.status(500).json({ error: "No se pudieron cargar los clientes" });
  }
});

// Obtener un cliente por ID
router.get("/clients/:id", auth, allow("ADMIN", "ASESOR"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de cliente inválido" });
    }

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    res.json(client);
  } catch (error) {
    console.error("ERROR GET /clients/:id", error);
    res.status(500).json({ error: "No se pudo cargar el cliente" });
  }
});

// Editar cliente
router.put("/clients/:id", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ error: "ID de cliente inválido" });

   const c = await Client.findByIdAndUpdate(
    id,
    { $set: req.body },
    {
        new: true,
        runValidators: true,
    }
);

    if (!c) return res.status(404).json({ error: "Cliente no encontrado" });

    res.json(c);
  } catch (e) {
    console.error("ERROR PUT /clients/:id", e);
    res.status(500).json({ error: e.message || "Error interno" });
  }
});

// Eliminar cliente
router.delete("/clients/:id", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de cliente inválido" });
    }

    const deleted = await Client.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    res.json({ message: "Cliente eliminado correctamente" });
  } catch (err) {
    console.error("Error eliminando cliente:", err);
    res.status(500).json({ error: "Error eliminando cliente" });
  }
});
   
// ======================================================
// CARGA MASIVA DE TRABAJADORES POR EMPRESA DESDE EXCEL
// ======================================================

router.post(
  "/clients/import-company-excel",
  auth,
  allow("ADMIN", "ASESOR"),
  upload.single("file"),
  async (req, res) => {
    try {
      const companyId = String(req.body.companyId || "").trim();

      if (!companyId) {
        return res.status(400).json({
          error: "Debes seleccionar una empresa",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "Debes seleccionar un archivo Excel",
        });
      }

      const company = await Company.findById(companyId);

      if (!company) {
        return res.status(404).json({
          error: "Empresa no encontrada",
        });
      }

      const settings = await SystemSetting.findOne({
        key: "MAIN",
      });

      if (!settings) {
        return res.status(400).json({
          error: "No existe configuración del sistema",
        });
      }

      const workbook = XLSX.read(req.file.buffer, {
        type: "buffer",
      });

      const firstSheetName = workbook.SheetNames[0];

      const worksheet =
        workbook.Sheets[firstSheetName];

      const rows = XLSX.utils.sheet_to_json(
        worksheet,
        {
          defval: "",
          raw: false,
          range: 5,
        }
      );

      if (!rows.length) {
        return res.status(400).json({
          error:
            "El archivo no contiene trabajadores para importar",
        });
      }

      const normalize = (value) =>
        String(value || "")
          .trim()
          .toUpperCase();

      const findAdministrator = (
        type,
        value
      ) => {
        const search = normalize(value);

        if (!search) return null;

        const catalog =
          settings.catalogs?.[type] || [];

        return (
          catalog.find((item) => {
            const name = normalize(item.name);
            const code = normalize(item.code);

            const aliases = Array.isArray(
              item.aliases
            )
              ? item.aliases.map(normalize)
              : [];

            return (
              name === search ||
              code === search ||
              aliases.includes(search)
            );
          }) || null
        );
      };

      const result = {
        total: rows.length,
        created: 0,
        skipped: [],
      };

      for (
        let index = 0;
        index < rows.length;
        index++
      ) {
        const row = rows[index];
        const excelRow = index + 7;

        const docType =
          normalize(
            row["Tipo identificación"]
          ) || "CC";

        const docNumber = String(
          row["Número"] || ""
        ).trim();

        const fullName = normalize(
          row["Nombre"]
        );

        const salaryBase = String(
          row["Salario mensual"] || ""
        )
          .replace(/[^\d]/g, "")
          .trim();

        const subtype = String(
          row["Subtipo"] || ""
        ).trim();

        const epsValue = row["Salud"];
        const afpValue = row["Pensión"];

        const joinDate = String(
          row["Fecha inicio"] || ""
        ).trim();

        const leaveDate = String(
          row["Fecha fin"] || ""
        ).trim();

        if (!docNumber) {
          result.skipped.push({
            row: excelRow,
            docNumber: "",
            reason:
              "No tiene número de documento",
          });

          continue;
        }

        if (subtype) {
          result.skipped.push({
            row: excelRow,
            docNumber,
            reason:
              `Tiene subtipo de cotizante ${subtype}. Revisar manualmente.`,
          });

          continue;
        }

        const existing =
          await Client.findOne({
            docNumber,
          });

        if (existing) {
          result.skipped.push({
            row: excelRow,
            docNumber,
            reason:
              "Ya existe un cliente con este documento",
          });

          continue;
        }

        const eps =
          findAdministrator(
            "eps",
            epsValue
          );

        if (!eps) {
          result.skipped.push({
            row: excelRow,
            docNumber,
            reason:
              `EPS no reconocida: ${epsValue || "VACÍA"}`,
          });

          continue;
        }

        let afpName = "SIN AFP";

        if (
          String(afpValue || "").trim()
        ) {
          const afp =
            findAdministrator(
              "afp",
              afpValue
            );

          if (!afp) {
            result.skipped.push({
              row: excelRow,
              docNumber,
              reason:
                `AFP no reconocida: ${afpValue}`,
            });

            continue;
          }

          afpName = afp.name;
        }

        const nameParts =
          fullName
            .split(/\s+/)
            .filter(Boolean);

        if (nameParts.length < 2) {
          result.skipped.push({
            row: excelRow,
            docNumber,
            reason:
              "No se pudo separar nombre y apellido",
          });

          continue;
        }

        let firstName = "";
        let secondName = "";
        let lastName = "";
        let secondLastName = "";

        if (nameParts.length === 2) {
          firstName = nameParts[0];
          lastName = nameParts[1];
        } else if (nameParts.length === 3) {
          firstName = nameParts[0];
          secondName = nameParts[1];
          lastName = nameParts[2];
        } else {
          firstName = nameParts[0];
          secondName = nameParts[1];
          lastName =
            nameParts[nameParts.length - 2];
          secondLastName =
            nameParts[nameParts.length - 1];
        }

        await Client.create({
          docType,
          docNumber,

          firstName,
          secondName,
          lastName,
          secondLastName,

          phone: "0",

          clientType: "EMPRESA",
          companyName: company.name,
          companyNit: company.nit,

          groupName: "NO APLICA",

          eps: eps.name,
          afp: afpName,

          arl:
            company.arl ||
            "NO APLICA",

          ccf:
            company.ccf ||
            "NO APLICA",

          risk:
            company.risk || "1",

          salaryBase:
            salaryBase || "1750905",

          serviceValue:
            String(
              company.defaultServiceValue ||
                0
            ),

          plan: "4",
          over55: "NO",

          joinDate,
          leaveDate,

          status:
            leaveDate
              ? "RETIRADO"
              : "ACTIVO",

          ref: "CARGA MASIVA EXCEL",
        });

        result.created++;
      }

      res.json({
        message:
          "Carga masiva terminada",
        result,
      });
    } catch (e) {
      console.error(
        "ERROR POST /clients/import-company-excel",
        e
      );

      res.status(500).json({
        error:
          e.message ||
          "No se pudo importar el archivo de trabajadores",
      });
    }
  }
);

export default router;
