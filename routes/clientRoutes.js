import express from "express";
import mongoose from "mongoose";
import { Client } from "../models/index.js";
import { auth, allow } from "../middleware/auth.js";
const { isValidObjectId } = mongoose;

const router = express.Router();

// ---- Clientes
router.post("/clients", auth, allow("ADMIN","ASESOR"), async (req,res)=>{
  try {
    const c = await Client.create(req.body);
    res.json(c);
  } catch (e) {
    console.error("ERROR POST /clients", e);
    res.status(400).json({ error: e.message || "Datos inválidos" });
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
   

export default router;
