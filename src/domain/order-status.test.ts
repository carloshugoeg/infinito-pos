import { describe, expect, it } from "vitest";
import { validateOrderStatusTransition } from "@/domain/order-status";

describe("order status domain", () => {
  it("solo permite avanzar preparacion en orden", () => {
    expect(validateOrderStatusTransition("PENDING", "PREPARING")).toEqual([]);
    expect(validateOrderStatusTransition("PREPARING", "DELIVERED")).toEqual([]);
  });

  it("bloquea entregar antes de estar listo o cambiar ordenes cerradas", () => {
    expect(validateOrderStatusTransition("PENDING", "DELIVERED")).toContain("La orden debe estar en preparacion antes de entregarse.");
    expect(validateOrderStatusTransition("CANCELLED", "PREPARING")).toContain("No se puede cambiar una orden cerrada.");
  });

  it("rechaza estados que no pertenecen al flujo", () => {
    expect(validateOrderStatusTransition("PENDING", "REFUNDED" as "PENDING")).toContain("Estado de orden invalido.");
  });
});
