import express from "express";
import mongoose from "mongoose";
import {
  CollectionAccount,
  CollectionAccountPayroll,
  Client,
  Company,
  PayrollRecord,
} from "../models/index.js";
import { auth, allow } from "../middleware/auth.js";
import { ARL_RATES, roundToHundred, isNoAplica } from "../utils/helpers.js";
const { isValidObjectId } = mongoose;

const router = express.Router();

// Comprueba si existe otro retiro vigente del trabajador
// en planillas de cuentas de cobro.
const hasOtherActiveRetirement = async (clientId, excludedPayrollId, session) => {
  const payrolls = await CollectionAccountPayroll.find({
    _id: { $ne: excludedPayrollId },
    status: "REGISTRADA",
  }).session(session);

    let hasRetirementInCollectionAccounts = false;

for (const payroll of payrolls) {
  const selected = (payroll.employees || []).some(
    (employee) =>
      String(employee?.clientId || "") === String(clientId)
  );

  if (!selected) continue;

  const account = await CollectionAccount.findById(
    payroll.collectionAccountId
  ).session(session);

  const hasRet = (account?.items || []).some(
    (item) =>
      String(item?.itemType || "").toUpperCase() === "WORKER" &&
      item?.included !== false &&
      String(item?.clientId || "") === String(clientId) &&
      hasRetirementNovelty(item)
  );

  if (hasRet) {
    hasRetirementInCollectionAccounts = true;
    break;
  }
}

  if (hasRetirementInCollectionAccounts) {
    return true;
  }

  const retirementRecords = await PayrollRecord.find({
    type: "RETIRO",
    status: "REGISTRADA",
  }).session(session);

  return retirementRecords.some((record) =>
    (record.employees || []).some(
      (employee) =>
        String(employee?.clientId || "") === String(clientId)
    )
  );
};

// Identifica si un trabajador tiene novedad de retiro
// registrada en su cuenta de cobro.
const hasRetirementNovelty = (item) => {
  const novelty = String(item?.novelty || "").toUpperCase();

  return /\bRET\b/.test(novelty);
};

// Identifica los trabajadores cuyo retiro fue registrado
// específicamente por una planilla de cuenta de cobro.
const getRetiredClientsByPayroll = async (payrollId, session) => {
  const clients = await Client.find({
    status: "RETIRADO",
    "history.action": "RETIRO",
  }).session(session);

  return clients.filter((client) =>
   (() => {
  const statusChanges = (client.history || []).filter(
    (entry) =>
      entry?.action === "RETIRO" ||
      entry?.action === "REACTIVACION"
  );

  const lastChange = statusChanges[statusChanges.length - 1];

  return (
    lastChange?.action === "RETIRO" &&
    lastChange?.reason === "Planilla pagada de cuenta de cobro" &&
    String(lastChange?.payrollId || "") === String(payrollId) &&
    lastChange?.previousStatus === "ACTIVO"
  );
})()
  );
};

// ---- Planillas provenientes de cuentas de cobro
router.get("/collection-account-payrolls", auth, allow("ADMIN"), async (req, res) => {
  try {
    const filter = {};

    if (req.query.collectionAccountId) {
      if (!isValidObjectId(req.query.collectionAccountId)) {
        return res.status(400).json({ error: "ID de cuenta de cobro inválido" });
      }

      filter.collectionAccountId = req.query.collectionAccountId;
    }

    const payrolls = await CollectionAccountPayroll.find(filter).sort({
      paymentDate: -1,
      createdAt: -1,
    });

    res.json(payrolls);
  } catch (error) {
    console.error("ERROR GET /collection-account-payrolls", error);
    res.status(500).json({
      error: "No se pudieron cargar las planillas de cuentas de cobro",
    });
  }
});

router.get("/collection-account-payrolls/:id", auth, allow("ADMIN"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "ID de planilla inválido" });
    }

    const payroll = await CollectionAccountPayroll.findById(req.params.id);

    if (!payroll) {
      return res.status(404).json({ error: "Planilla no encontrada" });
    }

    res.json(payroll);
  } catch (error) {
    console.error("ERROR GET /collection-account-payrolls/:id", error);
    res.status(500).json({ error: "No se pudo cargar la planilla" });
  }
});

router.get("/collection-accounts/:id/payroll-data", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de cuenta de cobro inválido" });
    }

    const account = await CollectionAccount.findById(id);

    if (!account) {
      return res.status(404).json({ error: "Cuenta de cobro no encontrada" });
    }

    const accountType = String(
  account.accountType || ""
).toUpperCase();

if (
  accountType !== "AGRUPADOS" &&
  accountType !== "EMPRESA"
) {
  return res.status(400).json({
    error:
      "Esta cuenta de cobro no contiene trabajadores para planilla",
  });
}

let company = null;

if (accountType === "EMPRESA") {
  company = await Company.findOne({
    nit: String(account.companyNit || "").trim(),
  });
}

    const workerItems = (account.items || []).filter(
      (item) =>
        String(item?.itemType || "").toUpperCase() === "WORKER" &&
        item?.included !== false
    );

    const activePayrolls = await CollectionAccountPayroll.find({
      collectionAccountId: account._id,
      status: "REGISTRADA",
    }).select("employees");

    const processedKeys = new Set();

    activePayrolls.forEach((payroll) => {
      (payroll.employees || []).forEach((employee) => {
        const key =
          employee?.employeeKey ||
          employee?.clientId ||
          employee?._id ||
          employee?.docNumber ||
          employee?.documentNumber ||
          employee?.document;

        if (key) processedKeys.add(String(key));
      });
    });

    const clientIds = workerItems
      .map((item) => item?.clientId)
      .filter((value) => value && isValidObjectId(value));

    const clients = clientIds.length
      ? await Client.find({ _id: { $in: clientIds } })
      : [];

    const clientsById = new Map(
      clients.map((client) => [String(client._id), client])
    );

    const employees = workerItems.map((item, index) => {
      const client = item?.clientId
        ? clientsById.get(String(item.clientId))
        : null;

      const base = Number(
        item?.proportionalBase ||
          item?.monthlyBase ||
          client?.salaryBase ||
          0
      );

      const days = Number(item?.days || 30);
     const risk =
  accountType === "EMPRESA"
    ? String(company?.risk || client?.risk || item?.risk || "1")
    : String(client?.risk || item?.risk || "0");

const arlRate = ARL_RATES[risk] || 0;

      const eps = isNoAplica(client?.eps || item?.eps)
        ? 0
        : roundToHundred(base * 0.04);

      const afp = isNoAplica(client?.afp || item?.afp)
        ? 0
        : roundToHundred(base * 0.16);

      const arlName =
  accountType === "EMPRESA"
    ? (company?.arl || client?.arl || item?.arl || "")
    : (client?.arl || item?.arl || "");

const ccfName =
  accountType === "EMPRESA"
    ? (company?.ccf || client?.ccf || item?.ccf || "")
    : (client?.ccf || item?.ccf || "");

const arl = isNoAplica(arlName)
  ? 0
  : roundToHundred(base * arlRate);

const cofrem = isNoAplica(ccfName)
  ? 0
  : roundToHundred(base * 0.04);

      const employeeKey = String(
        item?.clientId ||
          item?._id ||
          item?.document ||
          `worker-${index}`
      );

      return {
        ...item,
        employeeKey,
        clientId: item?.clientId || client?._id || null,

        fullName:
          item?.description ||
          [
            client?.firstName,
            client?.secondName,
            client?.lastName,
            client?.secondLastName,
          ]
            .filter(Boolean)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim(),

        docType: client?.docType || item?.docType || "CC",
        docNumber: client?.docNumber || item?.document || "",

        firstName: client?.firstName || item?.firstName || "",
        secondName: client?.secondName || item?.secondName || "",
        lastName: client?.lastName || item?.lastName || "",
        secondLastName:
          client?.secondLastName || item?.secondLastName || "",

        epsName: client?.eps || item?.eps || "",
        afpName: client?.afp || item?.afp || "",
        arlName,
ccfName,

        risk,
        days,
        salaryBase: Number(client?.salaryBase || item?.monthlyBase || base),
        proportionalBase: base,

        eps,
        afp,
        arl,
        cofrem,

        serviceValue: Math.max(
          0,
          Number(item?.total || 0) - (eps + afp + arl + cofrem)
        ),
        planillaValue: eps + afp + arl + cofrem,
        total: eps + afp + arl + cofrem,
      };
    });

    const pendingEmployees = employees.filter(
      (employee) => !processedKeys.has(String(employee.employeeKey))
    );

    const processedEmployees = employees.filter((employee) =>
      processedKeys.has(String(employee.employeeKey))
    );

    res.json({
      account,
      totalEmployees: employees.length,
      pendingCount: pendingEmployees.length,
      processedCount: processedEmployees.length,
      pendingEmployees,
      processedEmployees,
    });
  } catch (error) {
    console.error("ERROR GET /collection-accounts/:id/payroll-data", error);
    res.status(500).json({
      error: error.message || "No se pudieron cargar los trabajadores de la cuenta",
    });
  }
});

router.post("/collection-account-payrolls", auth, allow("ADMIN"), async (req, res) => {
  const session = await mongoose.startSession();


  try {
    const {
      collectionAccountId,
      planillaNumber,
      paymentDate,
      operator = "",
      bank = "",
      planillaValue = 0,
      lateFee = 0,
      totalPaid = 0,
      employees = [],
      notes = "",
    } = req.body;

    if (!collectionAccountId || !isValidObjectId(collectionAccountId)) {
      return res.status(400).json({ error: "Cuenta de cobro inválida" });
    }

    if (!String(planillaNumber || "").trim()) {
      return res.status(400).json({ error: "Debes ingresar el número de planilla" });
    }

    if (!paymentDate) {
      return res.status(400).json({ error: "Debes ingresar la fecha de pago" });
    }

    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({
        error: "Debes seleccionar al menos un trabajador",
      });
    }

    const account = await CollectionAccount.findById(collectionAccountId);

    if (!account) {
      return res.status(404).json({ error: "Cuenta de cobro no encontrada" });
    }

    const selectedKeys = employees.map((employee, index) =>
      String(
        employee?.employeeKey ||
          employee?.clientId ||
          employee?._id ||
          employee?.docNumber ||
          employee?.documentNumber ||
          employee?.document ||
          `worker-${index}`
      )
    );

    const previousPayrolls = await CollectionAccountPayroll.find({
      collectionAccountId,
      status: "REGISTRADA",
    }).select("employees");

    const alreadyProcessed = new Set();

    previousPayrolls.forEach((payroll) => {
      (payroll.employees || []).forEach((employee, index) => {
        const key = String(
          employee?.employeeKey ||
            employee?.clientId ||
            employee?._id ||
            employee?.docNumber ||
            employee?.documentNumber ||
            employee?.document ||
            `worker-${index}`
        );

        alreadyProcessed.add(key);
      });
    });

    const duplicatedKey = selectedKeys.find((key) =>
      alreadyProcessed.has(key)
    );

    if (duplicatedKey) {
      return res.status(400).json({
        error:
          "Uno de los trabajadores seleccionados ya pertenece a una planilla registrada",
      });
    }

    // Identificar únicamente los trabajadores seleccionados
// que tienen novedad RET en la cuenta de cobro.
const retirementClientIds = [
  ...new Set(
    (account.items || [])
      .filter(
        (item) =>
          String(item?.itemType || "").toUpperCase() === "WORKER" &&
          item?.included !== false &&
          hasRetirementNovelty(item) &&
          item?.clientId &&
          isValidObjectId(item.clientId) &&
          employees.some(
  (employee) =>
    String(employee?.clientId || "") === String(item.clientId)
)
      )
      .map((item) => String(item.clientId))
  ),
];

    const safePlanillaValue = Number(planillaValue || 0);
    const safeLateFee = Number(lateFee || 0);
    const calculatedTotalPaid = safePlanillaValue + safeLateFee;
    const safeTotalPaid =
      Number(totalPaid || 0) > 0
        ? Number(totalPaid)
        : calculatedTotalPaid;

       session.startTransaction();

    const [payroll] = await CollectionAccountPayroll.create([{
      collectionAccountId: account._id,
      collectionAccountNumber: account.number || "",
      accountType: account.accountType || "",
      companyName: account.companyName || "",
      groupName: account.groupName || "",
      periodLabel: account.periodLabel || "",

      planillaNumber: String(planillaNumber).trim(),
      paymentDate: String(paymentDate),
      operator: String(operator || ""),
      bank: String(bank || ""),

      planillaValue: safePlanillaValue,
      lateFee: safeLateFee,
      totalPaid: safeTotalPaid,

      employees: employees.map((employee, index) => ({
        ...employee,
        employeeKey: selectedKeys[index],
      })),

      notes: String(notes || ""),
      status: "REGISTRADA",
            registeredBy: req.user.name,
    }], { session });

   for (const clientId of retirementClientIds) {
  const client = await Client.findById(clientId).session(session);

  if (!client || client.status === "RETIRADO") {
    continue;
  }

  const previousStatus = client.status;

  client.status = "RETIRADO";

  client.history.push({
    date: new Date(),
    action: "RETIRO",
    reason: "Planilla pagada de cuenta de cobro",
    previousStatus,
    planillaNumber: String(planillaNumber).trim(),
    payrollId: payroll._id,
    registeredBy: req.user.name,
  });

  await client.save({ session });
}

await session.commitTransaction();

    res.json(payroll);
    } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("ERROR POST /collection-account-payrolls", error);

    res.status(400).json({
      error: error.message || "No se pudo registrar la planilla",
    });
  } finally {
    await session.endSession();
  }
});

// ======================================================
// EDITAR PLANILLA DE CUENTA DE COBRO
// ======================================================

router.put(
  "/collection-account-payrolls/:id",
  auth,
  allow("ADMIN"),
   async (req, res) => {
    const session = await mongoose.startSession();

    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return res.status(400).json({
          error: "ID de planilla inválido",
        });
      }

      const payroll = await CollectionAccountPayroll.findById(id);

      if (!payroll) {
        return res.status(404).json({
          error: "Planilla no encontrada",
        });
      }

      if (payroll.status === "ANULADA") {
        return res.status(400).json({
          error: "No puedes editar una planilla anulada",
        });
      }

      const {
        planillaNumber,
        paymentDate,
        operator = "",
        bank = "",
        lateFee = 0,
        employees = [],
        notes = "",
      } = req.body;

      // ------------------------------------------
      // VALIDACIONES BÁSICAS
      // ------------------------------------------

      if (!String(planillaNumber || "").trim()) {
        return res.status(400).json({
          error: "Debes ingresar el número de planilla",
        });
      }

      if (!paymentDate) {
        return res.status(400).json({
          error: "Debes ingresar la fecha de pago",
        });
      }

      if (!Array.isArray(employees) || employees.length === 0) {
        return res.status(400).json({
          error: "La planilla debe tener al menos un trabajador",
        });
      }

      // ------------------------------------------
      // IDENTIFICAR LOS TRABAJADORES SELECCIONADOS
      // ------------------------------------------

      const selectedKeys = employees.map((employee, index) =>
        String(
          employee?.employeeKey ||
            employee?.clientId ||
            employee?._id ||
            employee?.docNumber ||
            employee?.documentNumber ||
            employee?.document ||
            `worker-${index}`
        )
      );

      // Evitar trabajadores repetidos dentro de
      // la misma planilla que estamos editando
      const uniqueKeys = new Set(selectedKeys);

      if (uniqueKeys.size !== selectedKeys.length) {
        return res.status(400).json({
          error:
            "Hay un trabajador repetido dentro de la planilla",
        });
      }

      // ------------------------------------------
      // REVISAR OTRAS PLANILLAS REGISTRADAS
      // DE LA MISMA CUENTA
      // ------------------------------------------

      const otherPayrolls =
        await CollectionAccountPayroll.find({
          collectionAccountId: payroll.collectionAccountId,
          status: "REGISTRADA",
          _id: { $ne: payroll._id },
        }).select("employees");

      const alreadyProcessed = new Set();

      otherPayrolls.forEach((otherPayroll) => {
        (otherPayroll.employees || []).forEach(
          (employee, index) => {
            const key = String(
              employee?.employeeKey ||
                employee?.clientId ||
                employee?._id ||
                employee?.docNumber ||
                employee?.documentNumber ||
                employee?.document ||
                `worker-${index}`
            );

            alreadyProcessed.add(key);
          }
        );
      });

      const duplicatedKey = selectedKeys.find((key) =>
        alreadyProcessed.has(key)
      );

      if (duplicatedKey) {
        return res.status(400).json({
          error:
            "Uno de los trabajadores seleccionados ya pertenece a otra planilla registrada",
        });
      }

      // ------------------------------------------
      // RECALCULAR VALOR DE LA PLANILLA
      // ------------------------------------------

     const calculatedPlanillaValue = employees.reduce(
  (sum, employee) => {
    const eps = Number(employee?.eps || 0);
    const afp = Number(employee?.afp || 0);
    const arl = Number(employee?.arl || 0);

    const ccfName = String(
      employee?.ccfName || employee?.ccf || ""
    )
      .trim()
      .toUpperCase();

    let ccf = 0;

    if (
      ccfName === "SIN CCF" ||
      ccfName === "NO APLICA"
    ) {
      ccf = 100;
    } else {
      const rawCcf =
        employee?.cofrem ??
        employee?.ccf ??
        0;

      const numericCcf = Number(rawCcf);

      ccf = Number.isNaN(numericCcf)
        ? 0
        : numericCcf;
    }

    return sum + eps + arl + afp + ccf;
  },
  0
);

      const safeLateFee = Math.max(
        0,
        Number(lateFee || 0)
      );

      const calculatedTotalPaid =
        calculatedPlanillaValue + safeLateFee;

      // ------------------------------------------
      // GUARDAR CAMBIOS
      // ------------------------------------------

            // Guardar los trabajadores originales antes de editar.
      const previousEmployees = [...(payroll.employees || [])];

      // Consultar la cuenta de cobro original para verificar
      // qué trabajadores tienen novedad RET.
      const account = await CollectionAccount.findById(
        payroll.collectionAccountId
      );

      if (!account) {
        return res.status(404).json({
          error: "Cuenta de cobro no encontrada",
        });
      }

      // Identificar los trabajadores con novedad RET
// según la cuenta de cobro original.
const retirementClientIds = new Set(
  (account.items || [])
    .filter(
      (item) =>
        String(item?.itemType || "").toUpperCase() === "WORKER" &&
        item?.included !== false &&
        hasRetirementNovelty(item) &&
        item?.clientId &&
        isValidObjectId(item.clientId)
    )
    .map((item) => String(item.clientId))
);

// Comparar trabajadores anteriores y actuales.
const previousClientIds = new Set(
  previousEmployees
    .map((employee) => String(employee?.clientId || ""))
    .filter(Boolean)
);

const currentClientIds = new Set(
  employees
    .map((employee) => String(employee?.clientId || ""))
    .filter(Boolean)
);

// Trabajadores con RET que fueron quitados de la planilla.
const removedRetirementClientIds = [...previousClientIds].filter(
  (clientId) =>
    retirementClientIds.has(clientId) &&
    !currentClientIds.has(clientId)
);

// Trabajadores con RET que fueron agregados a la planilla.
const addedRetirementClientIds = [...currentClientIds].filter(
  (clientId) =>
    retirementClientIds.has(clientId) &&
    !previousClientIds.has(clientId)
);



// Iniciar la transacción antes de modificar la planilla
// y los estados de los trabajadores.
session.startTransaction();

      payroll.planillaNumber =
        String(planillaNumber).trim();

      payroll.paymentDate = String(paymentDate);

      payroll.operator = String(operator || "");

      payroll.bank = String(bank || "");

      payroll.planillaValue =
        calculatedPlanillaValue;

      payroll.lateFee = safeLateFee;

      payroll.totalPaid = calculatedTotalPaid;

      payroll.employees = employees.map(
        (employee, index) => ({
          ...employee,
          employeeKey: selectedKeys[index],
        })
      );

      payroll.notes = String(notes || "");

      payroll.updatedBy = req.user.name;
      payroll.updatedAt = new Date();

      await payroll.save({ session });

     // Registrar el retiro de trabajadores agregados a la planilla.
for (const clientId of addedRetirementClientIds) {
  const client = await Client.findById(clientId).session(session);

  if (!client || client.status === "RETIRADO") {
    continue;
  }

  const previousStatus = client.status;

  client.status = "RETIRADO";

  client.history.push({
    date: new Date(),
    action: "RETIRO",
    reason: "Planilla pagada de cuenta de cobro",
    previousStatus,
    planillaNumber: String(planillaNumber).trim(),
    payrollId: payroll._id,
    registeredBy: req.user.name,
  });

  await client.save({ session });
}

// Revisar los retiros de trabajadores quitados de la planilla.
for (const clientId of removedRetirementClientIds) {
  const client = await Client.findById(clientId).session(session);

  if (!client || client.status !== "RETIRADO") {
    continue;
  }

 const statusChanges = (client.history || []).filter(
  (entry) =>
    entry?.action === "RETIRO" ||
    entry?.action === "REACTIVACION"
);

const lastChange = statusChanges[statusChanges.length - 1];

const retirementEntry =
  lastChange?.action === "RETIRO" &&
  lastChange?.reason === "Planilla pagada de cuenta de cobro" &&
  String(lastChange?.payrollId || "") === String(payroll._id) &&
  lastChange?.previousStatus === "ACTIVO";

  if (!retirementEntry) {
    continue;
  }

  const hasOtherRetirement = await hasOtherActiveRetirement(
    client._id,
    payroll._id,
    session
  );

  if (hasOtherRetirement) {
    continue;
  }

  client.status = "ACTIVO";

  client.history.push({
    date: new Date(),
    action: "REACTIVACION",
    reason: "Trabajador retirado de planilla durante edición",
    payrollId: payroll._id,
    planillaNumber: payroll.planillaNumber,
    registeredBy: req.user.name,
  });

  await client.save({ session });
}

await session.commitTransaction();
      res.json({
        message: "Planilla actualizada correctamente",
        payroll,
      });
        } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      console.error(
        "ERROR PUT /collection-account-payrolls/:id",
        error
      );

      res.status(400).json({
        error:
          error.message ||
          "No se pudo actualizar la planilla",
      });
    } finally {
      await session.endSession();
    }
  }
);

router.delete("/collection-account-payrolls/:id", auth, allow("ADMIN"), async (req, res) => {
  const session = await mongoose.startSession();

  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "ID de planilla inválido" });
    }

    const payroll = await CollectionAccountPayroll.findById(req.params.id);

    if (!payroll) {
      return res.status(404).json({ error: "Planilla no encontrada" });
    }

    if (payroll.status === "ANULADA") {
      return res.status(400).json({ error: "La planilla ya está anulada" });
    }
    // Identificar trabajadores cuyo retiro fue generado
// por esta planilla antes de anularla.
session.startTransaction();

// Consultar dentro de la transacción a los trabajadores
// cuyo retiro fue generado por esta planilla.
const clientsToReview = await getRetiredClientsByPayroll(
  payroll._id,
  session
);

payroll.status = "ANULADA";
    payroll.cancelledAt = new Date();
    payroll.cancelledBy = req.user.name;

   await payroll.save({ session });

for (const client of clientsToReview) {
  const hasOtherRetirement = await hasOtherActiveRetirement(
    client._id,
    payroll._id,
    session
  );

  if (hasOtherRetirement) {
    continue;
  }

  client.status = "ACTIVO";

  client.history.push({
    date: new Date(),
    action: "REACTIVACION",
    reason: "Anulación de planilla de cuenta de cobro",
    payrollId: payroll._id,
    planillaNumber: payroll.planillaNumber,
    registeredBy: req.user.name,
  });

  await client.save({ session });
}

await session.commitTransaction();

res.json({
  message: "Planilla anulada correctamente",
  payroll,
});
    } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("ERROR DELETE /collection-account-payrolls/:id", error);

    res.status(500).json({
      error: error.message || "No se pudo anular la planilla",
    });
  } finally {
    await session.endSession();
  }
});



export default router;
