import healthRoutes from "./healthRoutes.js";
import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import collectionAccountRoutes from "./collectionAccountRoutes.js";
import collectionAccountPayrollRoutes from "./collectionAccountPayrollRoutes.js";
import companyRoutes from "./companyRoutes.js";
import groupRoutes from "./groupRoutes.js";
import receiptAdminRoutes from "./receiptAdminRoutes.js";
import payrollRoutes from "./payrollRoutes.js";
import reminderRoutes from "./reminderRoutes.js";
import expenseRoutes from "./expenseRoutes.js";
import payrollUpdateRoutes from "./payrollUpdateRoutes.js";
import clientRoutes from "./clientRoutes.js";
import receiptRoutes from "./receiptRoutes.js";
import settingsRoutes from "./settingsRoutes.js";

export function registerRoutes(app) {
  app.use(healthRoutes);
  app.use(authRoutes);
  app.use(userRoutes);
  app.use(settingsRoutes);
  app.use(collectionAccountRoutes);
  app.use(collectionAccountPayrollRoutes);
  app.use(companyRoutes);
  app.use(groupRoutes);
  app.use(receiptAdminRoutes);
  app.use(payrollRoutes);
  app.use(reminderRoutes);
  app.use(expenseRoutes);
  app.use(payrollUpdateRoutes);
  app.use(clientRoutes);
  app.use(receiptRoutes);
}
