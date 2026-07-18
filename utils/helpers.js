import { Counter } from "../models/index.js";


// =========================
// 3) Tarifas (tu tabla)
// =========================
export const tarifas = {
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
export async function nextTicket(){
  const ret = await Counter.findOneAndUpdate(
    { _id: "receipt" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return ret.seq;
}


export async function nextCollectionAccountNumber() {
  const ret = await Counter.findOneAndUpdate(
    { _id: "collectionAccount" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return `CC-${String(ret.seq).padStart(6, "0")}`;
}

export function accountTotals(items = [], additionalValue = 0, discount = 0, payments = []) {
  const normalizedItems = items.map((item) => {
    const quantity = Number(item.quantity || 0);
    const unitValue = Number(item.unitValue || 0);
    const total = Number(item.total || quantity * unitValue || 0);
    return { ...item, quantity, unitValue, total };
  });
  const subtotal = normalizedItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const total = Math.max(0, subtotal + Number(additionalValue || 0) - Number(discount || 0));
  const paidTotal = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const balance = Math.max(0, total - paidTotal);
  const status = balance <= 0 ? "PAGADA" : paidTotal > 0 ? "ABONADA" : "PENDIENTE";
  return { normalizedItems, subtotal, total, paidTotal, balance, status };
}

export function makePublicCode(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

export function calcAmounts(planType, risk, isOver55){
  const key = (Number(planType)===4 && Boolean(isOver55)) ? 0 : Number(risk);
  const t = tarifas[Number(planType)]?.[key];
  if(!t) throw new Error("Plan/Riesgo no válido");
  return t;
}

export const ARL_RATES = {
  "0": 0,
  "1": 0.00522,
  "2": 0.01044,
  "3": 0.02436,
  "4": 0.0435,
  "5": 0.0696,
};

export function roundToHundred(value) {
  return Math.ceil(Number(value || 0) / 100) * 100;
}

export function isNoAplica(value) {
  const text = String(value || "").trim().toUpperCase();
  return !text || text === "NO APLICA" || text === "SIN AFP" || text === "SIN ARL" || text === "SIN CCF";
}

export function calculateReceiptAmounts(client, serviceValue = 0, independentServiceType = "") {
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
