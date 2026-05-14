import { describe, expect, it } from "vitest";
import { InventoryMovementType, PaymentMethod } from "@prisma/client";
import { createPaidOrderInTransaction, preparePaidOrder } from "@/server/services/orders";
import type { CatalogProduct } from "@/domain/cart";

const catalog: CatalogProduct[] = [
  {
    id: "product-vaso",
    name: "Vaso",
    basePrice: 25,
    modifierGroups: [
      {
        id: "group-base",
        name: "Base",
        isRequired: true,
        minSelections: 1,
        maxSelections: 1,
        modifiers: [{ id: "modifier-chocolate", name: "Chocolate", priceDelta: 10 }]
      }
    ]
  }
];

describe("paid order service", () => {
  it("prepara una orden pagada con totales, pagos y uso de inventario", async () => {
    const prepared = preparePaidOrder({
      catalog,
      items: [{ productId: "product-vaso", quantity: 2, modifierIds: ["modifier-chocolate"], notes: "<b>sin bolsa</b>" }],
      payments: [{ method: PaymentMethod.CASH, amount: 70, receivedAmount: 100 }],
      recipeItems: [
        { productId: "product-vaso", ingredientId: "ingredient-vaso", quantity: 1 },
        { modifierId: "modifier-chocolate", ingredientId: "ingredient-chocolate", quantity: 40 }
      ]
    });
    const writes: Array<{ model: string; input: unknown }> = [];
    const tx = {
      order: {
        create: async (input: { data: unknown }) => {
          writes.push({ model: "order", input });
          return { id: "order-1" };
        }
      },
      branchInventory: {
        upsert: async (input: { where: unknown; update: unknown; create: unknown }) => {
          writes.push({ model: "branchInventory", input });
          return {};
        }
      },
      inventoryMovement: {
        create: async (input: { data: unknown }) => {
          writes.push({ model: "inventoryMovement", input });
          return {};
        }
      }
    };

    const orderId = await createPaidOrderInTransaction(tx, {
      branchId: "branch-1",
      cashSessionId: "cash-1",
      customerNit: "CF",
      customerName: "Consumidor Final",
      createdById: "user-1",
      prepared
    });

    expect(orderId).toBe("order-1");
    expect(prepared.totals.total).toBe(70);
    expect(prepared.usage).toEqual([
      { ingredientId: "ingredient-vaso", quantity: 2 },
      { ingredientId: "ingredient-chocolate", quantity: 80 }
    ]);
    expect(writes).toHaveLength(5);
    expect(writes[0].input).toMatchObject({
      data: {
        total: 70,
        items: {
          create: [
            {
              productNameSnapshot: "Vaso",
              lineTotal: 70,
              notes: "sin bolsa"
            }
          ]
        },
        payments: {
          create: [
            {
              method: PaymentMethod.CASH,
              amount: 70,
              receivedAmount: 100,
              changeAmount: 30
            }
          ]
        }
      }
    });
    expect(writes[1].input).toMatchObject({
      create: { branchId: "branch-1", ingredientId: "ingredient-vaso", quantityOnHand: -2 }
    });
    expect(writes[2].input).toMatchObject({
      data: { type: InventoryMovementType.SALE, quantityDelta: -2, orderId: "order-1" }
    });
  });

  it("rechaza pagos insuficientes antes de escribir la orden", () => {
    expect(() =>
      preparePaidOrder({
        catalog,
        items: [{ productId: "product-vaso", quantity: 1, modifierIds: ["modifier-chocolate"] }],
        payments: [{ method: PaymentMethod.CARD, amount: 20 }],
        recipeItems: []
      })
    ).toThrow("El monto pagado es menor al total.");
  });

  it("rechaza sobrepagos sin efectivo aplicado", () => {
    expect(() =>
      preparePaidOrder({
        catalog,
        items: [{ productId: "product-vaso", quantity: 1, modifierIds: ["modifier-chocolate"] }],
        payments: [{ method: PaymentMethod.CARD, amount: 40 }],
        recipeItems: []
      })
    ).toThrow("El monto pagado no debe superar el total.");
  });

  it("rechaza cantidades imposibles y modificadores duplicados", () => {
    expect(() =>
      preparePaidOrder({
        catalog,
        items: [{ productId: "product-vaso", quantity: 100, modifierIds: ["modifier-chocolate"] }],
        payments: [{ method: PaymentMethod.CARD, amount: 3500 }],
        recipeItems: []
      })
    ).toThrow("La cantidad maxima por linea es 99.");

    expect(() =>
      preparePaidOrder({
        catalog,
        items: [{ productId: "product-vaso", quantity: 1, modifierIds: ["modifier-chocolate", "modifier-chocolate"] }],
        payments: [{ method: PaymentMethod.CARD, amount: 35 }],
        recipeItems: []
      })
    ).toThrow("No repitas el mismo modificador.");
  });
});
