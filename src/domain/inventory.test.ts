import { describe, expect, it } from "vitest";
import {
  buildTransferLegs,
  calculateManualInventoryDelta,
  isLowOrNegativeStock,
  resolveOrderIngredientUsage,
  validateManualInventoryMovement,
  validateStockTransfer
} from "@/domain/inventory";

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

describe("stock transfer", () => {
  it("acepta un traslado valido", () => {
    expect(validateStockTransfer({ quantity: 5, fromLocationId: "bodega", toLocationId: "quiosco" })).toEqual([]);
  });

  it("rechaza origen igual a destino", () => {
    expect(validateStockTransfer({ quantity: 5, fromLocationId: "a", toLocationId: "a" })).toContain(
      "El origen y el destino deben ser distintos."
    );
  });

  it("rechaza ids de ubicacion vacios", () => {
    expect(validateStockTransfer({ quantity: 5, fromLocationId: "", toLocationId: "quiosco" })).toContain(
      "Selecciona origen y destino."
    );
  });

  it("rechaza cantidad no positiva", () => {
    expect(validateStockTransfer({ quantity: 0, fromLocationId: "a", toLocationId: "b" })).toContain(
      "La cantidad debe ser mayor a cero."
    );
  });

  it("rechaza mas de 3 decimales", () => {
    expect(validateStockTransfer({ quantity: 1.2345, fromLocationId: "a", toLocationId: "b" })).toContain(
      "La cantidad permite maximo 3 decimales."
    );
  });

  it("construye dos piernas opuestas", () => {
    expect(buildTransferLegs({ quantity: 5, fromLocationId: "bodega", toLocationId: "quiosco" })).toEqual([
      { locationId: "bodega", quantityDelta: -5 },
      { locationId: "quiosco", quantityDelta: 5 }
    ]);
  });
});
