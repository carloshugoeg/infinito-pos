import { describe, expect, it } from "vitest";
import { calculateManualInventoryDelta, isLowOrNegativeStock, resolveOrderIngredientUsage, validateManualInventoryMovement } from "@/domain/inventory";

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

  it("valida movimientos manuales de inventario", () => {
    expect(validateManualInventoryMovement({ type: "PURCHASE", quantity: 5 })).toEqual([]);
    expect(calculateManualInventoryDelta("WASTE", 2)).toBe(-2);
    expect(validateManualInventoryMovement({ type: "SALE", quantity: 1 })).toContain("Tipo de movimiento invalido.");
    expect(validateManualInventoryMovement({ type: "WASTE", quantity: -1 })).toContain("Compra y merma requieren una cantidad mayor a cero.");
    expect(validateManualInventoryMovement({ type: "ADJUSTMENT", quantity: 0 })).toContain("El ajuste no puede ser cero.");
    expect(validateManualInventoryMovement({ type: "PURCHASE", quantity: 1.1234 })).toContain("La cantidad permite maximo 3 decimales.");
  });
});
