import { describe, expect, it } from "vitest";
import { InventoryMovementType } from "@prisma/client";
import { reverseMovementLegsInTransaction, type ReversibleMovementLeg } from "@/server/services/inventory";

const FIXED_DATE = new Date("2026-07-01T00:00:00.000Z");

// Fake transaction client that actually holds `reversedAt` state, so the test
// exercises the real idempotency guard instead of asserting on mock return values.
function createFakeTx(initialLegs: ReversibleMovementLeg[]) {
  const movements = new Map(
    initialLegs.map((leg) => [leg.id, { ...leg, reversedAt: null as Date | null, reversedById: null as string | null }])
  );
  const inventory = new Map<string, number>();
  const created: Array<Record<string, unknown>> = [];

  const tx = {
    inventoryMovement: {
      async updateMany({ where, data }: { where: { id: { in: string[] }; reversedAt: null }; data: { reversedAt: Date; reversedById: string } }) {
        let count = 0;
        for (const id of where.id.in) {
          const move = movements.get(id);
          if (move && move.reversedAt === null) {
            move.reversedAt = data.reversedAt;
            move.reversedById = data.reversedById;
            count++;
          }
        }
        return { count };
      },
      async create({ data }: { data: Record<string, unknown> }) {
        created.push(data);
        return { id: `adj-${created.length}` };
      }
    },
    locationInventory: {
      async upsert({ where, update, create }: {
        where: { locationId_ingredientId: { locationId: string; ingredientId: string } };
        update: { quantityOnHand: { increment: number } };
        create: { locationId: string; ingredientId: string; quantityOnHand: number };
      }) {
        const key = `${where.locationId_ingredientId.locationId}::${where.locationId_ingredientId.ingredientId}`;
        if (inventory.has(key)) inventory.set(key, inventory.get(key)! + update.quantityOnHand.increment);
        else inventory.set(key, create.quantityOnHand);
        return {};
      }
    }
  };

  return { tx, movements, inventory, created };
}

describe("reverseMovementLegsInTransaction", () => {
  it("anula un movimiento simple una sola vez aunque se envie dos veces", async () => {
    const legs: ReversibleMovementLeg[] = [
      { id: "mv-1", locationId: "loc-quiosco", ingredientId: "ing-1", type: InventoryMovementType.PURCHASE, quantityDelta: 10, reason: "Compra" }
    ];
    const { tx, inventory, created, movements } = createFakeTx(legs);

    const first = await reverseMovementLegsInTransaction(tx, { legs, reversedById: "admin-1", reversedAt: FIXED_DATE });
    expect(first.reversed).toBe(true);
    expect(created).toHaveLength(1);
    expect(created[0].quantityDelta).toBe(-10);
    expect(inventory.get("loc-quiosco::ing-1")).toBe(-10);
    expect(movements.get("mv-1")?.reversedAt).toEqual(FIXED_DATE);
    expect(movements.get("mv-1")?.reversedById).toBe("admin-1");

    // Segundo envio (doble click / doble submit): no debe crear otra anulacion ni mover stock.
    const second = await reverseMovementLegsInTransaction(tx, { legs, reversedById: "admin-1", reversedAt: FIXED_DATE });
    expect(second.reversed).toBe(false);
    expect(created).toHaveLength(1);
    expect(inventory.get("loc-quiosco::ing-1")).toBe(-10);
  });

  it("revierte ambas piernas de un traslado una sola vez", async () => {
    const legs: ReversibleMovementLeg[] = [
      { id: "mv-a", locationId: "loc-bodega", ingredientId: "ing-1", type: InventoryMovementType.TRANSFER, quantityDelta: -5, reason: "Traslado" },
      { id: "mv-b", locationId: "loc-quiosco", ingredientId: "ing-1", type: InventoryMovementType.TRANSFER, quantityDelta: 5, reason: "Traslado" }
    ];
    const { tx, inventory, created } = createFakeTx(legs);

    const first = await reverseMovementLegsInTransaction(tx, { legs, reversedById: "admin-1", reversedAt: FIXED_DATE });
    expect(first.reversed).toBe(true);
    expect(created).toHaveLength(2);
    expect(inventory.get("loc-bodega::ing-1")).toBe(5);
    expect(inventory.get("loc-quiosco::ing-1")).toBe(-5);

    // Anular cualquiera de las dos piernas otra vez no debe re-revertir el traslado.
    const second = await reverseMovementLegsInTransaction(tx, { legs, reversedById: "admin-1", reversedAt: FIXED_DATE });
    expect(second.reversed).toBe(false);
    expect(created).toHaveLength(2);
    expect(inventory.get("loc-bodega::ing-1")).toBe(5);
    expect(inventory.get("loc-quiosco::ing-1")).toBe(-5);
  });
});
