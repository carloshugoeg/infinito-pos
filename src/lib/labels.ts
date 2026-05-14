import { InventoryMovementType, PaymentMethod } from "@prisma/client";

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
