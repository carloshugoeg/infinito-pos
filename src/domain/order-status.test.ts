import { describe, expect, it } from "vitest";
import { validateOrderStatusTransition } from "@/domain/order-status";

describe("order status domain", () => {
  it("solo permite avanzar preparacion en orden", () => {
    expect(validateOrderStatusTransition("PAID", "PREPARING")).toEqual([]);
    expect(validateOrderStatusTransition("PREPARING", "READY")).toEqual([]);
    expect(validateOrderStatusTransition("READY", "DELIVERED")).toEqual([]);
  });

  it("bloquea entregar antes de estar listo o cambiar ordenes cerradas", () => {
    expect(validateOrderStatusTransition("PAID", "DELIVERED")).toContain("La orden debe estar lista antes de entregarse.");
    expect(validateOrderStatusTransition("CANCELLED", "PREPARING")).toContain("No se puede cambiar una orden cerrada.");
    expect(validateOrderStatusTransition("DELIVERED", "READY")).toContain("No se puede cambiar una orden cerrada.");
  });
});
