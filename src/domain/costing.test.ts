import { describe, expect, it } from "vitest";
import { calculateOrderItemCost } from "@/domain/costing";

describe("costing domain", () => {
  it("suma el costo del producto base y sus modificadores por unidad y por linea", () => {
    const cost = calculateOrderItemCost(
      { productId: "cup", quantity: 2, modifierIds: ["white", "oreo"] },
      [
        { productId: "cup", ingredientId: "strawberry", quantity: 200 },
        { modifierId: "white", ingredientId: "white-chocolate", quantity: 40 },
        { modifierId: "oreo", ingredientId: "oreo", quantity: 15 }
      ],
      { strawberry: 0.05, "white-chocolate": 0.1, oreo: 0.2 }
    );

    // unitCost = 200*0.05 + 40*0.1 + 15*0.2 = 10 + 4 + 3 = 17
    expect(cost.unitCost).toBe(17);
    expect(cost.lineCost).toBe(34);
  });

  it("trata como cero el costo de un ingrediente sin precio registrado", () => {
    const cost = calculateOrderItemCost(
      { productId: "cup", quantity: 1, modifierIds: [] },
      [{ productId: "cup", ingredientId: "strawberry", quantity: 200 }],
      {}
    );

    expect(cost.unitCost).toBe(0);
    expect(cost.lineCost).toBe(0);
  });

  it("ignora recetas de otros productos o modificadores no seleccionados", () => {
    const cost = calculateOrderItemCost(
      { productId: "cup", quantity: 1, modifierIds: ["white"] },
      [
        { productId: "cup", ingredientId: "strawberry", quantity: 100 },
        { productId: "other", ingredientId: "mango", quantity: 999 },
        { modifierId: "lotus", ingredientId: "lotus", quantity: 50 }
      ],
      { strawberry: 0.05, mango: 1, lotus: 1 }
    );

    expect(cost.unitCost).toBe(5);
    expect(cost.lineCost).toBe(5);
  });

  it("redondea el costo a 4 decimales", () => {
    const cost = calculateOrderItemCost(
      { productId: "cup", quantity: 3, modifierIds: [] },
      [{ productId: "cup", ingredientId: "queso", quantity: 0.333 }],
      { queso: 0.0498 }
    );

    // 0.333 * 0.0498 = 0.0165834 -> 0.0166
    expect(cost.unitCost).toBe(0.0166);
    // 0.0166 * 3 = 0.0498
    expect(cost.lineCost).toBe(0.0498);
  });
});
