import mongoose from "mongoose";

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
  defaultServiceValue: {  type: Number,  default: 0,  min: 0,},
  exonerated: {
    type: String,
    enum: ["SI", "NO"],
    default: "SI",
  },
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

const reminderSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  category: {
    type: String,
    enum: ["ARRIENDO", "SERVICIOS", "INTERNET", "IMPUESTOS", "NOMINA", "BANCOS", "PLANILLAS", "OTROS"],
    default: "OTROS",
  },
  amount: { type: Number, default: 0 },
  recurrence: {
    type: String,
    enum: ["UNA_VEZ", "MENSUAL", "ANUAL"],
    default: "MENSUAL",
  },
  dueDate: { type: String, default: "" },
  dayOfMonth: { type: Number, min: 1, max: 31, default: 1 },
  visibleToAdvisors: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  completionPeriods: { type: [String], default: [] },
  completionRecords: {
    type: [{
      period: { type: String, required: true },
      completedBy: { type: String, default: "" },
      completedAt: { type: Date, default: Date.now },
    }],
    default: [],
  },
  createdByName: { type: String, default: "" },
}, { timestamps: true });


const collectionAccountPaymentSchema = new mongoose.Schema({
  date: { type: String, required: true },
  amount: { type: Number, required: true, min: 1 },
  method: { type: String, default: "TRANSFERENCIA" },
  bank: { type: String, default: "" },
  reference: { type: String, default: "" },
  note: { type: String, default: "" },
  registeredBy: { type: String, default: "" },
  registeredAt: { type: Date, default: Date.now },
}, { _id: true });

const collectionAccountSchema = new mongoose.Schema({
  number: { type: String, unique: true, index: true },
  accountType: { type: String, enum: ["AGRUPADOS", "EMPRESA"], required: true },
  companyName: { type: String, required: true, trim: true },
  companyNit: { type: String, default: "" },
  companyClientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", default: null },
  groupName: { type: String, default: "" },
  periodMonth: { type: String, required: true },
  periodYear: { type: String, required: true },
  periodLabel: { type: String, required: true },
  issueDate: { type: String, required: true },
  dueDate: { type: String, default: "" },
  items: { type: Array, default: [] },
  subtotal: { type: Number, default: 0 },
  additionalValue: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  payments: { type: [collectionAccountPaymentSchema], default: [] },
  paidTotal: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  status: { type: String, enum: ["PENDIENTE", "ABONADA", "PAGADA"], default: "PENDIENTE" },
  notes: { type: String, default: "" },
  createdByName: { type: String, default: "" },
}, { timestamps: true });


const collectionAccountPayrollSchema = new mongoose.Schema({
  collectionAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CollectionAccount",
    required: true,
    index: true,
  },

  collectionAccountNumber: { type: String, default: "" },
  accountType: { type: String, default: "" },
  companyName: { type: String, default: "" },
  groupName: { type: String, default: "" },
  periodLabel: { type: String, default: "" },

  planillaNumber: { type: String, required: true, trim: true },
  paymentDate: { type: String, required: true },
  operator: { type: String, default: "" },
  bank: { type: String, default: "" },

  planillaValue: { type: Number, default: 0 },
  lateFee: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },

  employees: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },

  notes: { type: String, default: "" },

  status: {
    type: String,
    enum: ["REGISTRADA", "ANULADA"],
    default: "REGISTRADA",
    index: true,
  },

  registeredBy: { type: String, default: "" },
  cancelledBy: { type: String, default: "" },
  cancelledAt: { type: Date, default: null },
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
    excludePensionFromReceipt: {    type: Boolean,    default: false,  },

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

const receiptPaymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      required: true,
      trim: true,
    },

    bank: {
      type: String,
      default: "",
      trim: true,
    },

    reference: {
      type: String,
      default: "",
      trim: true,
    },

    paymentDate: {
      type: String,
      default: "",
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    _id: true,
  }
);  

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

  paymentDetails: {
  type: [receiptPaymentSchema],
  default: [],
},

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
    exonerated: {
    type: String,
    enum: ["SI", "NO"],
    default: "NO",
  },
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
    parafiscales: { type: Number, default: 0 },
    mora: { type: Number, default: 0 },
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
  planillaLateFee: { type: Number, default: 0 },
  planillaTotalPaid: { type: Number, default: 0 },

  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: String, default: "" },
}, { timestamps: true });

const settingItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    code: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },

    active: {
      type: Boolean,
      default: true,
    },

    order: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    _id: true,
  }
);

const systemSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "MAIN",
      trim: true,
      uppercase: true,
    },

    general: {
      minimumSalary: {
        type: Number,
        default: 1750905,
        min: 0,
      },

      currentYear: {
        type: Number,
        default: 2026,
        min: 2020,
        max: 2100,
      },
    },

    catalogs: {
      eps: {
        type: [settingItemSchema],
        default: [],
      },

      afp: {
        type: [settingItemSchema],
        default: [],
      },

      arl: {
        type: [settingItemSchema],
        default: [],
      },

      ccf: {
        type: [settingItemSchema],
        default: [],
      },

      operators: {
        type: [settingItemSchema],
        default: [],
      },

      banks: {
        type: [settingItemSchema],
        default: [],
      },

      paymentMethods: {
        type: [settingItemSchema],
        default: [],
      },
    },
  },
  {
    timestamps: true,
  }
);

const counterSchema = new mongoose.Schema({ _id: String, seq: Number });

export const User = mongoose.model("User", userSchema);
export const Company = mongoose.model("Company", companySchema);
export const Group = mongoose.model("Group", groupSchema);
export const Client = mongoose.model("Client", clientSchema);
export const Receipt = mongoose.model("Receipt", receiptSchema);
export const Counter = mongoose.model("Counter", counterSchema);
export const Expense = mongoose.model("Expense", expenseSchema);
export const Reminder = mongoose.model("Reminder", reminderSchema);
export const CollectionAccount = mongoose.model("CollectionAccount", collectionAccountSchema);
export const CollectionAccountPayroll = mongoose.model("CollectionAccountPayroll", collectionAccountPayrollSchema);
export const SystemSetting = mongoose.model(  "SystemSetting",  systemSettingSchema);