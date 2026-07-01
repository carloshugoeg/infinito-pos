import { InventoryMovementType } from "@prisma/client";

export type ReversibleMovementLeg = {
  id: string;
  locationId: string;
  ingredientId: string;
  type: InventoryMovementType;
  quantityDelta: number;
  reason: string;
};

type ReversalTransactionClient = {
  inventoryMovement: {
    updateMany(input: {
      where: { id: { in: string[] }; reversedAt: null };
      data: { reversedAt: Date; reversedById: string };
    }): Promise<{ count: number }>;
    create(input: { data: unknown }): Promise<unknown>;
  };
  locationInventory: {
    upsert(input: { where: unknown; update: unknown; create: unknown }): Promise<unknown>;
  };
};

/**
 * Revierte una o varias piernas de un movimiento de inventario de forma idempotente.
 *
 * La guarda de idempotencia es un `updateMany` condicionado a `reversedAt: null`: marca
 * las piernas como anuladas solo si aun no lo estaban. Si otra solicitud (doble click,
 * doble submit o las dos piernas de un traslado) ya las anulo, `updateMany` afecta 0
 * filas y la funcion no crea nuevas anulaciones ni vuelve a mover el stock. Como todo
 * corre dentro de una transaccion, esto tambien es seguro ante envios concurrentes:
 * el segundo `UPDATE ... WHERE reversedAt IS NULL` se serializa y no encuentra filas.
 */
export async function reverseMovementLegsInTransaction(
  tx: ReversalTransactionClient,
  input: { legs: ReversibleMovementLeg[]; reversedById: string; reversedAt: Date }
): Promise<{ reversed: boolean; reversalCount: number }> {
  const legIds = input.legs.map((leg) => leg.id);
  const { count } = await tx.inventoryMovement.updateMany({
    where: { id: { in: legIds }, reversedAt: null },
    data: { reversedAt: input.reversedAt, reversedById: input.reversedById }
  });

  if (count === 0) return { reversed: false, reversalCount: 0 };

  for (const leg of input.legs) {
    const reversalDelta = Number(leg.quantityDelta) * -1;
    await tx.locationInventory.upsert({
      where: { locationId_ingredientId: { locationId: leg.locationId, ingredientId: leg.ingredientId } },
      update: { quantityOnHand: { increment: reversalDelta } },
      create: { locationId: leg.locationId, ingredientId: leg.ingredientId, quantityOnHand: reversalDelta }
    });
    await tx.inventoryMovement.create({
      data: {
        locationId: leg.locationId,
        ingredientId: leg.ingredientId,
        type: InventoryMovementType.ADJUSTMENT,
        quantityDelta: reversalDelta,
        reason: `Anulacion de movimiento ${leg.type}: ${leg.reason}`,
        createdById: input.reversedById
      }
    });
  }

  return { reversed: true, reversalCount: input.legs.length };
}
