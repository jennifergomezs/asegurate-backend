// server.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const { isValidObjectId } = mongoose;
dotenv.config();

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;

  res.setHeader("Access-Control-Allow-Origin", "https://asegurate-frontend.vercel.app");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
}); 

app.use(express.json());

console.log("ENV MONGODB_URI:", process.env.MONGODB_URI ? "SI EXISTE" : "NO EXISTE");
// Logs extra opcionales
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB conectado");
// =========================
// 7) Iniciar servidor
// =========================
    app.listen(process.env.PORT || 8080, () => {
      console.log("API Asegurate escuchando en puerto", process.env.PORT || 8080);
    });
  })
  .catch((err) => {
    console.error("Error conectando MongoDB:", err.message);
  });
// =========================
// 2) Modelos (Schemas)
// =========================
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["ADMIN", "ASESOR"], required: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });

const companySchema = new mongoose.Schema({
  nit: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  address: { type: String, default: "" },
  city: { type: String, default: "" },
  phone: { type: String, default: "" },
  email: { type: String, default: "" },
  active: { type: Boolean, default: true },
}, { timestamps: true });

const expenseSchema = new mongoose.Schema({
  date: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, default: "" },
  paymentMethod: { type: String, required: true },
  amount: { type: Number, required: true },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  createdByName: { type: String, default: "" },
}, { timestamps: true });

const groupSchema = new mongoose.Schema({
  nit: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },

  documentType: { type: String, default: "NI" },
  dv: { type: String, default: "" },

  operatorCode: { type: String, default: "" },
  contributorType: { type: String, default: "" },
  presentationType: { type: String, default: "" },
  branchCode: { type: String, default: "1" },
  branchName: { type: String, default: "PRINCIPAL" },

  arl: { type: String, default: "POSITIVA" },
  arlCode: { type: String, default: "" },

  notes: { type: String, default: "" },
  active: { type: Boolean, default: true },
}, { timestamps: true });


const clientSchema = new mongoose.Schema({
  docType: { type: String, default: "CC" },
  docNumber: { type: String, required: true, index: true },

  firstName: { type: String, required: true },
  secondName: { type: String, default: "" },
  lastName: { type: String, required: true },
  secondLastName: { type: String, default: "" },

  birth: { type: String, default: "" },
  phone: { type: String, required: true },
  address: { type: String, default: "" },
  city: { type: String, default: "" },
  email: { type: String, default: "" },
  

clientType: { 
  type: String, 
 enum: ["INDEPENDIENTE", "EMPRESA", "AGRUPADO"],
  default: "AGRUPADO" 
},
exonerated: { type: String, default: "NO" },

companyName: { 
  type: String, 
  default: "" 
},

groupName: { 
  type: String, 
  default: "" 
},

companyNit: { 
  type: String, 
  default: "" 
},

groupNit: { 
  type: String, 
  default: "" 
},

  eps: { type: String, default: "SANITAS" },
  afp: { type: String, default: "PROTECCION" },
  arl: { type: String, default: "SEGUROS BOLIVAR" },
  ccf: { type: String, default: "NO APLICA" },

  plan: { type: String, default: "4" },
  risk: { type: String, default: "1" },
  salaryBase: { type: String, default: "1750905" },
  serviceValue: { type: String, default: "0" },
  over55: { type: String, default: "NO" },

  joinDate: { type: String, default: "" },
  leaveDate: { type: String, default: "" },
  status: { type: String, default: "ACTIVO" },
  ref: { type: String, default: "" },

  history: { type: Array, default: [] },
}, { timestamps: true });

const receiptSchema = new mongoose.Schema({
  ticket: { type: Number, unique: true, index: true },

  publicCode: { type: String, unique: true, sparse: true, index: true },

  tempNumber: { type: String, default: "TEMP" },

  createdAt: { type: Date, default: Date.now },
  createdDate: { type: String, default: "" },
  createdTime: { type: String, default: "" },

  registeredBy: { type: String, default: "" },
  registeredRole: { type: String, default: "" },

  month: { type: String, default: "" },
  year: { type: String, default: "" },
  monthLabel: { type: String, required: true },

  receiptType: {
    type: String,
    enum: ["CLIENTE", "OCASIONAL"],
    default: "CLIENTE",
  },

  paymentMethod: { type: String, required: true },
  paymentBank: { type: String, default: "" },
  paymentReference: { type: String, default: "" },

  serviceType: { type: String, default: "MENSUALIDAD" },
  occasionalServiceType: { type: String, default: "" },
  independentServiceType: { type: String, default: "" },

  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: false, default: null },

  occasionalCustomer: {
    name: { type: String, default: "" },
    docType: { type: String, default: "CC" },
    docNumber: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
  },

  clientSnapshot: {
    fullName: String,
    docType: String,
    docNumber: String,
    phone: String,
    email: String,
    clientType: String,
    groupName: String,
    companyName: String,
    eps: String,
    afp: String,
    arl: String,
    ccf: String,
    plan: String,
    risk: String,
    over55: String,
  },

  planCode: { type: String, default: "" },

  amounts: {
    salaryBase: { type: Number, default: 0 },
    proportionalBase: { type: Number, default: 0 },
    daysWorked: { type: Number, default: 30 },
    eps: { type: Number, default: 0 },
    arl: { type: Number, default: 0 },
    afp: { type: Number, default: 0 },
    cofrem: { type: Number, default: 0 },
    service: { type: Number, default: 0 },
    planillaValue: { type: Number, default: 0 },
    totalSystem: { type: Number, default: 0 },
    received: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
  },

  status: {
    type: String,
    enum: ["PAGADO", "SALDO PENDIENTE", "ANULADO"],
    default: "PAGADO",
  },

  note: { type: String, default: "" },

  planillaStatus: { type: String, default: "PENDIENTE DE PLANILLA" },
  planillaNumber: { type: String, default: "" },
  planillaPaymentDate: { type: String, default: "" },

  operator: { type: String, default: "" },
  bank: { type: String, default: "" },

  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: String, default: "" },
}, { timestamps: true });


const counterSchema = new mongoose.Schema({ _id: String, seq: Number });

const User = mongoose.model("User", userSchema);
const Company = mongoose.model("Company", companySchema);
const Group = mongoose.model("Group", groupSchema);
const Client = mongoose.model("Client", clientSchema);
const Receipt = mongoose.model("Receipt", receiptSchema);
const Counter = mongoose.model("Counter", counterSchema);
const Expense = mongoose.model("Expense", expenseSchema);

// =========================
// 3) Tarifas (tu tabla)
// =========================
const tarifas = {
  1:{1:{eps:57000,arl:7500,afp:227800,cofrem:57000,imp:25000,admon:19100,total:393400},
     2:{eps:57000,arl:14900,afp:227800,cofrem:57000,imp:25000,admon:19100,total:400800},
     3:{eps:57000,arl:34700,afp:227800,cofrem:57000,imp:25000,admon:19100,total:420600},
     4:{eps:57000,arl:62000,afp:227800,cofrem:57000,imp:25000,admon:19100,total:447900},
     5:{eps:57000,arl:99100,afp:227800,cofrem:57000,imp:25000,admon:19100,total:485000}},
  2:{1:{eps:57000,arl:7500,afp:227800,cofrem:0,imp:25000,admon:19100,total:336400},
     2:{eps:57000,arl:14900,afp:227800,cofrem:0,imp:25000,admon:19100,total:343800},
     3:{eps:57000,arl:34700,afp:227800,cofrem:0,imp:25000,admon:19100,total:363600},
     4:{eps:57000,arl:62000,afp:227800,cofrem:0,imp:25000,admon:19100,total:390900},
     5:{eps:57000,arl:99100,afp:227800,cofrem:0,imp:25000,admon:19100,total:428000}},
  3:{1:{eps:57000,arl:7500,afp:0,cofrem:57000,imp:25000,admon:45000,total:191500},
     2:{eps:57000,arl:14900,afp:0,cofrem:57000,imp:25000,admon:45000,total:198900},
     3:{eps:57000,arl:34700,afp:0,cofrem:57000,imp:25000,admon:45000,total:218700},
     4:{eps:57000,arl:62000,afp:0,cofrem:57000,imp:25000,admon:45000,total:246000},
     5:{eps:57000,arl:99100,afp:0,cofrem:57000,imp:25000,admon:45000,total:283100}},
  4:{0:{eps:57000,arl:7500,afp:0,cofrem:0,imp:20000,admon:29350,total:113850}, // 4.0 mayores de 55
     1:{eps:57000,arl:7500,afp:0,cofrem:0,imp:25000,admon:45000,total:134500},
     2:{eps:57000,arl:14900,afp:0,cofrem:0,imp:25000,admon:45000,total:141900},
     3:{eps:57000,arl:34700,afp:0,cofrem:0,imp:25000,admon:45000,total:161700},
     4:{eps:57000,arl:62000,afp:0,cofrem:0,imp:25000,admon:45000,total:189000},
     5:{eps:57000,arl:99100,afp:0,cofrem:0,imp:25000,admon:45000,total:226100}}
};

// =========================
// 4) Helpers de auth/tickets
// =========================
function sign(user){
  return jwt.sign(
    { uid: user._id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "10h" }
  );
}
function auth(req,res,next){
  try{
    const token = (req.headers.authorization||"").replace("Bearer ","");
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; next();
  }catch(e){ return res.status(401).json({error:"Unauthorized"}); }
}
function allow(...roles){
  return (req,res,next)=>{
    if(!roles.includes(req.user.role)) return res.status(403).json({error:"Forbidden"});
    next();
  }
}
async function nextTicket(){
  const ret = await Counter.findOneAndUpdate(
    { _id: "receipt" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return ret.seq;
}

function makePublicCode(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

function calcAmounts(planType, risk, isOver55){
  const key = (Number(planType)===4 && Boolean(isOver55)) ? 0 : Number(risk);
  const t = tarifas[Number(planType)]?.[key];
  if(!t) throw new Error("Plan/Riesgo no válido");
  return t;
}

const ARL_RATES = {
  "0": 0,
  "1": 0.00522,
  "2": 0.01044,
  "3": 0.02436,
  "4": 0.0435,
  "5": 0.0696,
};

function roundToHundred(value) {
  return Math.ceil(Number(value || 0) / 100) * 100;
}

function isNoAplica(value) {
  const text = String(value || "").trim().toUpperCase();
  return !text || text === "NO APLICA" || text === "SIN AFP" || text === "SIN ARL" || text === "SIN CCF";
}

function calculateReceiptAmounts(client, serviceValue = 0, independentServiceType = "") {
  const type = String(client.clientType || "").toUpperCase();
  const base = Number(client.salaryBase || 1750905);
  const service = Number(serviceValue || 0);
  const riskKey = String(client.risk || "0");
  const arlRate = ARL_RATES[riskKey] || 0;

  if (type === "INDEPENDIENTE" && independentServiceType === "SOLO_LIQUIDACION") {
    return {
      code: "INDEPENDIENTE-LIQUIDACION",
      amounts: {
        salaryBase: base,
        proportionalBase: base,
        daysWorked: 30,
        eps: 0,
        arl: 0,
        afp: 0,
        cofrem: 0,
        service,
        totalSystem: service,
      },
    };
  }
  
const isExonerated = String(client.exonerated || "").toUpperCase() === "SI";

let epsRate = 0.125;

if (type === "AGRUPADO") {
  epsRate = 0.04;
}

if (type === "EMPRESA" && isExonerated) {
  epsRate = 0.04;
}

const ccfRate = type === "INDEPENDIENTE" ? 0.02 : 0.04;

  const eps = isNoAplica(client.eps) ? 0 : roundToHundred(base * epsRate);
  const FOUR_SMMLV = 1750905 * 4;

const pensionRate =
  type === "INDEPENDIENTE" && base > FOUR_SMMLV
    ? 0.17
    : 0.16;

const afp = isNoAplica(client.afp)
  ? 0
  : roundToHundred(base * pensionRate);
  const arl = isNoAplica(client.arl) ? 0 : roundToHundred(base * arlRate);
  const cofrem = isNoAplica(client.ccf) ? 0 : roundToHundred(base * ccfRate);
  const totalSystem = eps + afp + arl + cofrem + service;

  return {
    code: `${type || "CLIENTE"}-IBC-${base}-R${riskKey}`,
    amounts: {
      salaryBase: base,
      proportionalBase: base,
      daysWorked: 30,
      eps,
      arl,
      afp,
      cofrem,
      service,
      totalSystem,
    },
  };
}


// =========================
// 5) Crear / actualizar admin
// =========================
(async () => {
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
})();

// =========================
/* 6) Rutas */
// =========================
app.get("/", (req,res)=> res.send("ASEGURATE API OK"));
app.get("/prueba", (req, res) => {
  res.send("FUNCIONA");
});

// ---- Auth
app.post("/auth/login", async (req,res)=>{
  const {email, password} = req.body;
  const u = await User.findOne({email});
  if(!u) return res.status(400).json({error:"Credenciales inválidas"});
  const ok = await bcrypt.compare(password, u.passwordHash);
  if(!ok) return res.status(400).json({error:"Credenciales inválidas"});
  res.json({ token: sign(u), user: {name:u.name, role:u.role, email:u.email} });
});

// ---- Usuarios (crear asesor) - solo ADMIN
app.post("/users", auth, allow("ADMIN"), async (req,res)=>{
  try{
    const {name,email,password,role} = req.body;
    const r = role || "ASESOR";
    const hash = await bcrypt.hash(password,10);
    const u = await User.create({name,email,passwordHash:hash,role:r});
    res.json({id:u._id, name:u.name, email:u.email, role:u.role});
  }catch(e){
    res.status(400).json({error:e.message || "No se pudo crear el usuario"});
  }
});

app.get("/users", auth, allow("ADMIN"), async (req, res) => {
  try {
    const list = await User.find()
      .select("-passwordHash")
      .sort({ createdAt: -1 });

    res.json(list);
  } catch (e) {
    res.status(500).json({ error: "No se pudieron cargar los usuarios" });
  }
});

app.put("/users/:id/status", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de usuario inválido" });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { active: Boolean(active) },
      { new: true }
    ).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(user);
  } catch (e) {
    res.status(500).json({ error: "No se pudo actualizar el estado del usuario" });
  }
});

// ---- Empresas
app.post("/companies", auth, allow("ADMIN"), async (req, res) => {
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

app.get("/companies", auth, allow("ADMIN", "ASESOR"), async (req, res) => {
  try {
    const list = await Company.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (e) {
    console.error("ERROR GET /companies", e);
    res.status(500).json({ error: "No se pudieron cargar las empresas" });
  }
});

// ---- Agrupadoras
app.post("/groups", auth, allow("ADMIN"), async (req, res) => {
  try {
    const group = await Group.create(req.body);
    res.json(group);
  } catch (e) {
    res.status(400).json({ error: e.message || "No se pudo crear la agrupadora" });
  }
});

app.get("/groups", auth, async (req, res) => {
  try {
    const groups = await Group.find({})
      .sort({ createdAt: -1 });

    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: "No se pudieron cargar las agrupadoras" });
  }
});

// Obtener una agrupadora por ID
app.get("/groups/:id", auth, allow("ADMIN", "ASESOR"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const group = await Group.findById(id);

    if (!group) {
      return res.status(404).json({ error: "Agrupadora no encontrada" });
    }

    res.json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo agrupadora" });
  }
});

// Editar agrupadora
app.put("/groups/:id", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const group = await Group.findByIdAndUpdate(
      id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!group) {
      return res.status(404).json({ error: "Agrupadora no encontrada" });
    }

    res.json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo actualizar la agrupadora" });
  }
});

// Eliminar agrupadora
app.delete("/groups/:id", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const group = await Group.findByIdAndDelete(id);

    if (!group) {
      return res.status(404).json({ error: "Agrupadora no encontrada" });
    }

    res.json({ message: "Agrupadora eliminada correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo eliminar la agrupadora" });
  }
});

// prueba agrupadora sin ver
app.get("/groups-debug", auth, allow("ADMIN"), async (req, res) => {
  try {
    const groups = await Group.find({}).sort({ createdAt: -1 });

    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: "Error revisando agrupadoras" });
  }
});

app.delete("/receipts/:id", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de recibo inválido" });
    }

    const deleted = await Receipt.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Recibo no encontrado" });
    }

    res.json({ message: "Recibo eliminado correctamente" });
  } catch (e) {
    res.status(500).json({ error: "No se pudo eliminar el recibo" });
  }
});


// Anular recibo
app.put("/receipts/:id/cancel", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de recibo inválido" });
    }

    const receipt = await Receipt.findByIdAndUpdate(
      id,
      {
  status: "ANULADO",
  cancelledAt: new Date(),
  cancelledBy: req.user.name,
},
      {
        new: true,
      }
    );

    if (!receipt) {
      return res.status(404).json({ error: "Recibo no encontrado" });
    }

    res.json(receipt);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo anular el recibo" });
  }
});

// ---- Planillas
app.put("/payrolls/register", auth, allow("ADMIN" , "ASESOR" ), async (req, res) => {
  try {
    const { receiptIds, planillaNumber, paymentDate, operator, bank } = req.body;

    if (!receiptIds || !Array.isArray(receiptIds) || receiptIds.length === 0) {
      return res.status(400).json({ error: "Debes seleccionar al menos un recibo" });
    }

    if (!planillaNumber) {
      return res.status(400).json({ error: "Debes ingresar el número de planilla" });
    }

    const invalidId = receiptIds.find((id) => !isValidObjectId(id));

    if (invalidId) {
      return res.status(400).json({ error: "Hay un ID de recibo inválido" });
    }

    await Receipt.updateMany(
      { _id: { $in: receiptIds } },
      {
        $set: {
          planillaStatus: "PLANILLA PAGADA",
          planillaNumber: String(planillaNumber || ""),
          planillaPaymentDate: String(paymentDate || ""),
          operator: String(operator || ""),
          bank: String(bank || ""),
        },
      }
    );

    const updatedReceipts = await Receipt.find({
      _id: { $in: receiptIds },
    }).sort({ createdAt: -1 });

    res.json({
      message: "Planilla registrada correctamente",
      count: updatedReceipts.length,
      receipts: updatedReceipts,
    });
  } catch (err) {
    console.error("ERROR PUT /payrolls/register", err);
    res.status(500).json({ error: "No se pudo registrar la planilla" });
  }
});

app.get("/payrolls", auth, allow("ADMIN", "ASESOR"), async (req, res) => {
  try {
    const query = {
      planillaStatus: "PLANILLA PAGADA",
    };

    if (req.user.role !== "ADMIN") {
      query.registeredBy = req.user.name;
    }

    const payrolls = await Receipt.find(query).sort({
      planillaPaymentDate: -1,
      createdAt: -1,
    });

    res.json(payrolls);
  } catch (e) {
    console.error("ERROR GET /payrolls", e);
    res.status(500).json({ error: "No se pudieron cargar las planillas" });
  }
});

app.put("/payrolls/remove-receipt", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { receiptId } = req.body;

    if (!receiptId || !isValidObjectId(receiptId)) {
      return res.status(400).json({ error: "ID de recibo inválido" });
    }

    const receipt = await Receipt.findByIdAndUpdate(
      receiptId,
      {
        $set: {
          planillaStatus: "PENDIENTE DE PLANILLA",
          planillaNumber: "",
          planillaPaymentDate: "",
          operator: "",
          bank: "",
        },
      },
      { new: true }
    );

    if (!receipt) {
      return res.status(404).json({ error: "Recibo no encontrado" });
    }

    res.json(receipt);
  } catch (err) {
    console.error("ERROR PUT /payrolls/remove-receipt", err);
    res.status(500).json({ error: "No se pudo quitar el recibo de la planilla" });
  }
});

// ---- Gastos
app.post("/expenses", auth, async (req, res) => {
  try {
    const expense = await Expense.create({
      ...req.body,
      createdBy: req.user.id,
      createdByName: req.user.name,
    });

    res.json(expense);
  } catch (e) {
    res.status(400).json({ error: e.message || "No se pudo crear el gasto" });
  }
});

app.get("/expenses", auth, async (req, res) => {
  try {
    const query = {};

    if (req.user.role !== "ADMIN") {
      query.createdByName = req.user.name;
    }

    const expenses = await Expense.find(query).sort({ date: -1, createdAt: -1 });

    res.json(expenses);
  } catch (e) {
    res.status(500).json({ error: "No se pudieron cargar los gastos" });
  }
});

app.delete("/expenses/:id", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const expense = await Expense.findByIdAndDelete(id);

    if (!expense) {
      return res.status(404).json({ error: "Gasto no encontrado" });
    }

    res.json({ message: "Gasto eliminado correctamente" });
  } catch (e) {
    res.status(500).json({ error: "No se pudo eliminar el gasto" });
  }
});

app.put("/payrolls/update", auth, allow("ADMIN") , async (req, res) => {
  try {
    const {
      oldPlanillaNumber,
      oldPaymentDate,
      oldOperator,
      oldBank,
      planillaNumber,
      paymentDate,
      operator,
      bank,
    } = req.body;

    if (!oldPlanillaNumber) {
      return res.status(400).json({ error: "Falta la planilla original" });
    }

    if (!planillaNumber) {
      return res.status(400).json({ error: "Debes ingresar el número de planilla" });
    }

    const result = await Receipt.updateMany(
      {
        planillaStatus: "PLANILLA PAGADA",
        planillaNumber: oldPlanillaNumber,
        planillaPaymentDate: oldPaymentDate || "",
        operator: oldOperator || "",
        bank: oldBank || "",
      },
      {
        $set: {
          planillaNumber: String(planillaNumber || ""),
          planillaPaymentDate: String(paymentDate || ""),
          operator: String(operator || ""),
          bank: String(bank || ""),
        },
      }
    );

    res.json({
      message: "Planilla actualizada correctamente",
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("ERROR PUT /payrolls/update", err);
    res.status(500).json({ error: "No se pudo actualizar la planilla" });
  }
});

// ---- Clientes
app.post("/clients", auth, allow("ADMIN","ASESOR"), async (req,res)=>{
  try {
    const c = await Client.create(req.body);
    res.json(c);
  } catch (e) {
    console.error("ERROR POST /clients", e);
    res.status(400).json({ error: e.message || "Datos inválidos" });
  }
});

app.get("/clients", auth, allow("ADMIN","ASESOR"), async (req,res)=>{
  const q = (req.query.search||"").trim();
  let filter = {};
  if(q){
    filter = {
      $or:[
        { docNumber: new RegExp(q,"i") },
        { firstName: new RegExp(q,"i") },
        { lastName: new RegExp(q,"i") },
        { ref:   new RegExp(q, "i") }
      ]
    };
  }
  const list = await Client.find(filter).sort({createdAt:-1}).limit(50);
  res.json(list);
});

// Editar cliente
app.put("/clients/:id", auth, allow("ADMIN"), async (req, res) => {
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
app.delete("/clients/:id", auth, allow("ADMIN"), async (req, res) => {
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
   
// ---- Recibos
app.post("/receipts", auth, allow("ADMIN", "ASESOR"), async (req, res) => {
  try {
    const {
      receiptType = "CLIENTE",
      clientId,
      month,
      year,
      monthLabel,
      paymentMethod,
      paymentBank,
      paymentReference,
      serviceType,
      occasionalServiceType,
      independentServiceType,
      occasionalCustomer,
      clientSnapshot,
      planCode,
      amounts,
      status,
      note,
      planillaStatus,
      planillaNumber,
      planillaPaymentDate,
      operator,
      bank,
    } = req.body;

    const normalizedReceiptType = String(receiptType || "CLIENTE").toUpperCase();

    if (!month || !year || !monthLabel) {
      return res.status(400).json({ error: "Debes seleccionar mes y año" });
    }

    if (!paymentMethod) {
      return res.status(400).json({ error: "Debes seleccionar una forma de pago" });
    }

    const ticket = await nextTicket();
    const now = new Date();

    let publicCode = makePublicCode();

    while (await Receipt.findOne({ publicCode })) {
      publicCode = makePublicCode();
    }

    if (normalizedReceiptType === "OCASIONAL") {
      const customerName = String(occasionalCustomer?.name || "").trim();
      const received = Number(amounts?.received || 0);
      const planillaValue = Number(amounts?.planillaValue || 0);
      const service = Number(amounts?.service || 0);
      const totalSystem = Number(amounts?.totalSystem ?? (planillaValue + service));
      const balance = totalSystem - received;

      if (!customerName) {
        return res.status(400).json({ error: "Debes escribir el nombre o empresa del servicio ocasional" });
      }

      if (received <= 0) {
        return res.status(400).json({ error: "El valor recibido debe ser mayor a cero" });
      }

      const receipt = await Receipt.create({
        ticket,
        tempNumber: String(ticket),
        publicCode,

        createdAt: now,
        createdDate: now.toLocaleDateString("es-CO"),
        createdTime: now.toLocaleTimeString("es-CO"),

        registeredBy: req.user.name,
        registeredRole: req.user.role,

        receiptType: "OCASIONAL",

        month,
        year,
        monthLabel,

        paymentMethod,
        paymentBank: paymentBank || "",
        paymentReference: paymentReference || "",

        serviceType: "SERVICIO_OCASIONAL",
        occasionalServiceType: occasionalServiceType || "PAGO_PLANILLA",
        independentServiceType: "",

        clientId: null,

        occasionalCustomer: {
          name: customerName,
          docType: occasionalCustomer?.docType || "CC",
          docNumber: occasionalCustomer?.docNumber || "",
          phone: occasionalCustomer?.phone || "",
          email: occasionalCustomer?.email || "",
        },

        clientSnapshot: {
          fullName: customerName,
          docType: occasionalCustomer?.docType || "CC",
          docNumber: occasionalCustomer?.docNumber || "",
          phone: occasionalCustomer?.phone || "",
          email: occasionalCustomer?.email || "",
          clientType: "OCASIONAL",
          groupName: "",
          companyName: "",
          eps: "",
          afp: "",
          arl: "",
          ccf: "",
          plan: "",
          risk: "",
          over55: "",
        },

        planCode: "SERVICIO-OCASIONAL",

        amounts: {
          salaryBase: 0,
          proportionalBase: 0,
          daysWorked: 0,
          eps: 0,
          arl: 0,
          afp: 0,
          cofrem: 0,
          planillaValue,
          service,
          totalSystem,
          received,
          balance,
        },

        status: balance > 0 ? "SALDO PENDIENTE" : (status || "PAGADO"),

        note: note || "",

        // Si es servicio ocasional de PAGO DE PLANILLA, debe aparecer en el módulo Planillas
        // y sumar en los informes como planilla pagada.
        planillaStatus:
          String(occasionalServiceType || "").toUpperCase() === "PAGO_PLANILLA"
            ? "PLANILLA PAGADA"
            : (planillaStatus || "NO APLICA"),
        planillaNumber: planillaNumber || "",
        planillaPaymentDate: planillaPaymentDate || now.toISOString().slice(0, 10),
        operator: operator || "",
        bank: bank || "",
      });

      return res.json(receipt);
    }

    if (!clientId || !isValidObjectId(clientId)) {
      return res.status(400).json({ error: "Cliente inválido" });
    }

    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const existingReceipt = await Receipt.findOne({
      clientId,
      monthLabel,
      status: { $ne: "ANULADO" },
    });

    if (existingReceipt) {
      return res.status(400).json({
        error: `Este cliente ya tiene un recibo registrado para ${monthLabel}`,
      });
    }

    const received = Number(amounts?.received || 0);

    const safeAmounts = {
      ...amounts,
      received,
      balance: Number(amounts?.totalSystem || 0) - received,
    };

    const calculated = {
      code: planCode,
    };

    const receipt = await Receipt.create({
      ticket,
      tempNumber: String(ticket),
      publicCode,

      createdAt: now,
      createdDate: now.toLocaleDateString("es-CO"),
      createdTime: now.toLocaleTimeString("es-CO"),

      registeredBy: req.user.name,
      registeredRole: req.user.role,

      receiptType: "CLIENTE",

      month,
      year,
      monthLabel,

      paymentMethod,
      paymentBank: paymentBank || "",
      paymentReference: paymentReference || "",

      serviceType,
      independentServiceType,

      clientId: client._id,

      clientSnapshot: clientSnapshot || {
        fullName: `${client.firstName || ""} ${client.secondName || ""} ${client.lastName || ""} ${client.secondLastName || ""}`.replace(/\s+/g, " ").trim(),
        docType: client.docType,
        docNumber: client.docNumber,
        phone: client.phone,
        email: client.email,
        clientType: client.clientType,
        groupName: client.groupName,
        companyName: client.companyName,
        eps: client.eps,
        afp: client.afp,
        arl: client.arl,
        ccf: client.ccf,
        plan: client.plan,
        risk: client.risk,
        over55: client.over55,
      },

      planCode: calculated.code,
      amounts: safeAmounts,

      status: safeAmounts.balance > 0 ? "SALDO PENDIENTE" : (status || "PAGADO"),
      note: note || "",
      planillaStatus: planillaStatus || "PENDIENTE DE PLANILLA",
      planillaNumber: planillaNumber || "",
      planillaPaymentDate: planillaPaymentDate || "",
      operator: operator || "",
      bank: bank || "",
    });

    res.json(receipt);
  } catch (e) {
    console.error("ERROR POST /receipts", e);
    res.status(500).json({ error: e.message || "No se pudo crear el recibo" });
  }
});

app.get("/receipts", auth, allow("ADMIN", "ASESOR"), async (req, res) => {
  try {
    const list = await Receipt.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: "No se pudieron cargar los recibos" });
  }
});

app.get("/receipts/client/:clientId", auth, allow("ADMIN", "ASESOR"), async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!isValidObjectId(clientId)) {
      return res.status(400).json({ error: "ID de cliente inválido" });
    }

    const list = await Receipt.find({ clientId }).sort({ createdAt: -1 });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: "No se pudieron cargar los recibos del cliente" });
  }
});

app.get("/public/receipts/:publicCode", async (req, res) => {
  try {
    const { publicCode } = req.params;

    let receipt = await Receipt.findOne({ publicCode });

    if (!receipt && publicCode.startsWith("R-")) {
      const ticket = Number(publicCode.replace("R-", ""));
      receipt = await Receipt.findOne({ ticket });
    }

    if (!receipt) {
      return res.status(404).json({ error: "Recibo no encontrado" });
    }

    res.json(receipt);
  } catch (e) {
    console.error("ERROR GET /public/receipts/:publicCode", e);
    res.status(500).json({ error: "No se pudo cargar el recibo público" });
  }
});

app.get("/receipts/:id", auth, allow("ADMIN", "ASESOR"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de recibo inválido" });
    }

    const receipt = await Receipt.findById(id);

    if (!receipt) {
      return res.status(404).json({ error: "Recibo no encontrado" });
    }

    res.json(receipt);
  } catch (e) {
    res.status(500).json({ error: "No se pudo cargar el recibo" });
  }
});

app.put("/receipts/:id", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de recibo inválido" });
    }

    const receipt = await Receipt.findById(id);

    if (!receipt) {
      return res.status(404).json({ error: "Recibo no encontrado" });
    }

    if (receipt.status === "ANULADO") {
      return res.status(400).json({ error: "No se puede editar un recibo anulado" });
    }

    const paymentMethod = req.body.paymentMethod || receipt.paymentMethod;
    const note = req.body.note ?? receipt.note;

    const received = Number(
      req.body.amounts?.received ??
      req.body.received ??
      receipt.amounts?.received ??
      0
    );

    const service = Number(
      req.body.amounts?.service ??
      req.body.service ??
      receipt.amounts?.service ??
      0
    );

    const planillaValue = Number(
      req.body.amounts?.planillaValue ??
      receipt.amounts?.planillaValue ??
      0
    );

    const isOccasional = String(receipt.receiptType || "").toUpperCase() === "OCASIONAL";

    const totalSystem = isOccasional
      ? planillaValue + service
      : Number(receipt.amounts?.eps || 0) +
        Number(receipt.amounts?.arl || 0) +
        Number(receipt.amounts?.afp || 0) +
        Number(receipt.amounts?.cofrem || 0) +
        service;

    const balance = totalSystem - received;

    const updated = await Receipt.findByIdAndUpdate(
      id,
      {
        paymentMethod,
        paymentBank: req.body.paymentBank ?? receipt.paymentBank,
        paymentReference: req.body.paymentReference ?? receipt.paymentReference,
        note,
        planillaNumber: req.body.planillaNumber ?? receipt.planillaNumber,
        planillaPaymentDate: req.body.planillaPaymentDate ?? receipt.planillaPaymentDate,
        operator: req.body.operator ?? receipt.operator,
        bank: req.body.bank ?? receipt.bank,
        "amounts.planillaValue": planillaValue,
        "amounts.service": service,
        "amounts.totalSystem": totalSystem,
        "amounts.received": received,
        "amounts.balance": balance,
        status: balance > 0 ? "SALDO PENDIENTE" : "PAGADO",
      },
      { new: true, runValidators: true }
    );

    res.json(updated);
  } catch (e) {
    console.error("ERROR PUT /receipts/:id", e);
    res.status(500).json({ error: e.message || "No se pudo actualizar el recibo" });
  }
});

app.delete("/receipts/:id", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de recibo inválido" });
    }

    const deleted = await Receipt.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Recibo no encontrado" });
    }

    res.json({ message: "Recibo eliminado correctamente" });
  } catch (e) {
    console.error("ERROR DELETE /receipts/:id", e);
    res.status(500).json({ error: "No se pudo eliminar el recibo" });
  }
});


// =========================
// 7) Iniciar servidor
// =========================

