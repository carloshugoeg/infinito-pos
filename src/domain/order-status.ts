export type OrderStatusValue = "PENDING" | "PREPARING" | "DELIVERED" | "CANCELLED";

const orderStatuses: OrderStatusValue[] = ["PENDING", "PREPARING", "DELIVERED", "CANCELLED"];

const nextStatusByCurrent: Partial<Record<OrderStatusValue, OrderStatusValue>> = {
  PENDING: "PREPARING",
  PREPARING: "DELIVERED"
};

export function validateOrderStatusTransition(currentStatus: OrderStatusValue, nextStatus: OrderStatusValue) {
  if (!isOrderStatusValue(currentStatus) || !isOrderStatusValue(nextStatus)) {
    return ["Estado de orden invalido."];
  }

  if (currentStatus === "CANCELLED" || currentStatus === "DELIVERED") {
    return ["No se puede cambiar una orden cerrada."];
  }

  if (nextStatus === "DELIVERED" && currentStatus !== "PREPARING") {
    return ["La orden debe estar en preparacion antes de entregarse."];
  }

  if (nextStatusByCurrent[currentStatus] !== nextStatus) {
    return ["La orden debe avanzar al siguiente estado permitido."];
  }

  return [];
}

export function isOrderStatusValue(value: unknown): value is OrderStatusValue {
  return orderStatuses.includes(value as OrderStatusValue);
}
