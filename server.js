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
app.use(cors());
app.use(express.json());

// =========================
// 1) Conexión a MongoDB
// =========================
try {
  if (!process.env.MONGODB_URI) {
    console.error("❌ MONGODB_URI no está definido en .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI /*, { serverSelectionTimeoutMS: 10000 }*/);

  console.log("✅ Conectado a MongoDB");
} catch (err) {
  console.error("❌ Error conectando a MongoDB:", err?.message || err);
  process.exit(1);
}

// Logs extra opcionales
mongoose.connection.on("error", (e) => {
  console.error("❌ Error de conexión Mongo:", e?.message || e);
});

// =========================
// 2) Modelos (Schemas)
// =========================
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["ADMIN", "ASESOR"], required: true },
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

  clientType: { type: String, default: "AGRUPADO" },
  groupName: { type: String, default: "" },
  companyName: { type: String, default: "" },

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
  date: { type: Date, default: Date.now },
  monthLabel: { type: String, required: true },  // p.ej. "AGOSTO-2025"
  paymentMethod: { type: String, required: true },
  operator: { type: String, required: true },
  planilla: { type: String, default: "" },
  company: { type: String, default: process.env.COMPANY_NAME },
  note: { type: String, default: "" },
  status: { type: String, enum:["PAGADO","ANULADO"], default: "PAGADO" },

  planType: { type: Number, enum:[1,2,3,4], required: true },
  isOver55: { type: Boolean, default: false },
  risk: { type: Number, enum:[0,1,2,3,4,5], required: true }, // 0 para plan 4.0

  amounts: {
    eps: Number, arl: Number, afp: Number, cofrem: Number, imp: Number, admon: Number, total: Number
  },

  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
  clientSnapshot: {
    fullName: String, docType: String, docNumber: String,
    affiliateType: String, eps: String, afp: String, arl: String, ccf: String,
    risk: Number, address: String, phone: String
  }
}, { timestamps: true });

const counterSchema = new mongoose.Schema({ _id: String, seq: Number });

const User = mongoose.model("User", userSchema);
const Client = mongoose.model("Client", clientSchema);
const Receipt = mongoose.model("Receipt", receiptSchema);
const Counter = mongoose.model("Counter", counterSchema);

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
function calcAmounts(planType, risk, isOver55){
  const key = (Number(planType)===4 && Boolean(isOver55)) ? 0 : Number(risk);
  const t = tarifas[Number(planType)]?.[key];
  if(!t) throw new Error("Plan/Riesgo no válido");
  return t;
}

// =========================
// 5) Crear admin si no existe
// =========================
(async ()=>{
  const anyUser = await User.findOne();
  if(!anyUser){
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD,10);
    await User.create({
      name:"Administrador",
      email:process.env.ADMIN_EMAIL,
      passwordHash:hash,
      role:"ADMIN"
    });
    console.log("Admin creado:", process.env.ADMIN_EMAIL);
  }
})();

// =========================
/* 6) Rutas */
// =========================
app.get("/", (req,res)=> res.send("ASEGURATE API OK"));

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
        { lastName: new RegExp(q,"i") }
      ]
    };
  }
  const list = await Client.find(filter).sort({createdAt:-1}).limit(50);
  res.json(list);
});

// Editar cliente (solo admin) con validación de ObjectId
app.put("/clients/:id", auth, allow("ADMIN"), async (req,res)=>{
  try{
    const { id } = req.params;
    if(!isValidObjectId(id)) return res.status(400).json({error:"ID de cliente inválido"});
    const c = await Client.findByIdAndUpdate(id, req.body, {new:true});
    if(!c) return res.status(404).json({error:"Cliente no encontrado"});
    res.json(c);
  }catch(e){
    console.error("ERROR PUT /clients/:id", e);
    res.status(500).json({error:e.message || "Error interno"});
  }
});

// ---- Recibos (acepta _id o cédula)
app.post("/receipts", auth, allow("ADMIN","ASESOR"), async (req,res)=>{
  try {
    const {
      clientId,        // opcional: _id de Mongo
      docNumber,       // opcional: cédula
      planType, risk,
      isOver55 = false,
      monthLabel, paymentMethod,
      planilla = "", note = ""
    } = req.body;

    // Buscar cliente por _id válido o por cédula
    let client = null;
    if (clientId && isValidObjectId(clientId)) {
      client = await Client.findById(clientId);
    }
    if (!client && docNumber) {
      client = await Client.findOne({ docNumber: String(docNumber) });
    }
    if (!client) {
      return res.status(404).json({ error: "Cliente no encontrado (envía 'clientId' válido o 'docNumber' = cédula)" });
    }

    const amounts = calcAmounts(Number(planType), Number(risk), Boolean(isOver55));
    const ticket = await nextTicket();

    const snapshot = {
      fullName: `${client.firstName} ${client.secondName||""} ${client.lastName} ${client.secondLastName||""}`.replace(/\s+/g," ").trim(),
      docType: client.docType, docNumber: client.docNumber,
      affiliateType: client.affiliateType,
      eps: client.eps, afp: client.afp, arl: client.arl, ccf: client.ccf,
      risk: client.risk, address: client.address, phone: client.phone
    };

    const r = await Receipt.create({
      ticket,
      date: new Date(),
      monthLabel,
      paymentMethod,
      operator: req.user.name,
      planilla,
      company: process.env.COMPANY_NAME,
      note,
      status: "PAGADO",
      planType: Number(planType),
      isOver55: Boolean(isOver55),
      risk: Number(risk),
      amounts,
      clientId: client._id,
      clientSnapshot: snapshot
    });

    res.json(r);
  } catch (e) {
    console.error("ERROR /receipts:", e);
    res.status(500).json({ error: e.message || "Error interno" });
  }
});

// Listar recibos (por mes opcional)
app.get("/receipts", auth, allow("ADMIN","ASESOR"), async (req,res)=>{
  const { month } = req.query; // ej: "AGOSTO-2025" o "2025-08"
  const filter = month ? { monthLabel: new RegExp(month,"i") } : {};
  const list = await Receipt.find(filter).sort({date:-1});
  res.json(list);
});

// =========================
// 7) Iniciar servidor
// =========================
const port = process.env.PORT || 8080;
app.listen(port, ()=> console.log("API Asegurate escuchando en puerto", port));
