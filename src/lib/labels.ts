import { ExpenseCategory, ExpenseFrequency, InventoryMovementType, PaymentMethod } from "@prisma/client";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Efectivo",
  [PaymentMethod.CARD]: "Tarjeta",
  [PaymentMethod.TRANSFER]: "Transferencia"
};

const inventoryMovementTypeLabels: Record<InventoryMovementType, string> = {
  [InventoryMovementType.PURCHASE]: "Compra",
  [InventoryMovementType.WASTE]: "Merma",
  [InventoryMovementType.ADJUSTMENT]: "Ajuste",
  [InventoryMovementType.SALE]: "Venta"
};

export function paymentMethodLabel(method: PaymentMethod | string) {
  return paymentMethodLabels[method as PaymentMethod] ?? String(method);
}

export function inventoryMovementTypeLabel(type: InventoryMovementType | string) {
  return inventoryMovementTypeLabels[type as InventoryMovementType] ?? String(type);
}

const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  [ExpenseCategory.LOCAL]: "Local",
  [ExpenseCategory.PERSONAL]: "Personal",
  [ExpenseCategory.SERVICIOS]: "Servicios",
  [ExpenseCategory.INSUMOS_EXTRA]: "Insumos extra",
  [ExpenseCategory.MARKETING]: "Marketing",
  [ExpenseCategory.EQUIPO]: "Equipo",
  [ExpenseCategory.IMPUESTOS]: "Impuestos",
  [ExpenseCategory.OTROS]: "Otros"
};

const expenseFrequencyLabels: Record<ExpenseFrequency, string> = {
  [ExpenseFrequency.MONTHLY]: "Mensual",
  [ExpenseFrequency.BIWEEKLY]: "Quincenal",
  [ExpenseFrequency.WEEKLY]: "Semanal"
};

export function expenseCategoryLabel(category: ExpenseCategory | string) {
  return expenseCategoryLabels[category as ExpenseCategory] ?? String(category);
}

export function expenseFrequencyLabel(frequency: ExpenseFrequency | string) {
  return expenseFrequencyLabels[frequency as ExpenseFrequency] ?? String(frequency);
}
