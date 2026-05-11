import { describe, expect, it } from "vitest";
import { isLowOrNegativeStock, resolveOrderIngredientUsage } from "@/domain/inventory";

describe("inventory domain", () => {
  it("resuelve uso de ingredientes por producto y modificadores", () => {
    const usage = resolveOrderIngredientUsage(
      [{ productId: "cup", quantity: 2, modifierIds: ["white", "oreo"] }],
      [
        { productId: "cup", ingredientId: "strawberry", quantity: 200 },
        { modifierId: "white", ingredientId: "white-chocolate", quantity: 40 },
        { modifierId: "oreo", ingredientId: "oreo", quantity: 15 }
      ]
    );

    expect(usage).toEqual([
      { ingredientId: "strawberry", quantity: 400 },
      { ingredientId: "white-chocolate", quantity: 80 },
      { ingredientId: "oreo", quantity: 30 }
    ]);
  });

  it("marca stock bajo o negativo sin bloquear venta", () => {
    expect(isLowOrNegativeStock(-5, 10)).toBe(true);
    expect(isLowOrNegativeStock(8, 10)).toBe(true);
    expect(isLowOrNegativeStock(12, 10)).toBe(false);
  });
});
