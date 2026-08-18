import express from "express";
import mongoose from "mongoose";
import { CollectionAccount, CollectionAccountPayroll, Client } from "../models/index.js";
import { auth, allow } from "../middleware/auth.js";
import { ARL_RATES, roundToHundred, isNoAplica } from "../utils/helpers.js";
const { isValidObjectId } = mongoose;

const router = express.Router();

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
      const risk = String(client?.risk || item?.risk || "0");
      const arlRate = ARL_RATES[risk] || 0;

      const eps = isNoAplica(client?.eps || item?.eps)
        ? 0
        : roundToHundred(base * 0.04);

      const afp = isNoAplica(client?.afp || item?.afp)
        ? 0
        : roundToHundred(base * 0.16);

      const arl = isNoAplica(client?.arl || item?.arl)
        ? 0
        : roundToHundred(base * arlRate);

      const cofrem = isNoAplica(client?.ccf || item?.ccf)
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
        arlName: client?.arl || item?.arl || "",
        ccfName: client?.ccf || item?.ccf || "",

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

    const safePlanillaValue = Number(planillaValue || 0);
    const safeLateFee = Number(lateFee || 0);
    const calculatedTotalPaid = safePlanillaValue + safeLateFee;
    const safeTotalPaid =
      Number(totalPaid || 0) > 0
        ? Number(totalPaid)
        : calculatedTotalPaid;

    const payroll = await CollectionAccountPayroll.create({
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
    });

    res.json(payroll);
  } catch (error) {
    console.error("ERROR POST /collection-account-payrolls", error);
    res.status(400).json({
      error: error.message || "No se pudo registrar la planilla",
    });
  }
});

router.delete("/collection-account-payrolls/:id", auth, allow("ADMIN"), async (req, res) => {
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

    payroll.status = "ANULADA";
    payroll.cancelledAt = new Date();
    payroll.cancelledBy = req.user.name;

    await payroll.save();

    res.json({
      message: "Planilla anulada correctamente",
      payroll,
    });
  } catch (error) {
    console.error("ERROR DELETE /collection-account-payrolls/:id", error);
    res.status(500).json({ error: "No se pudo anular la planilla" });
  }
});



export default router;
