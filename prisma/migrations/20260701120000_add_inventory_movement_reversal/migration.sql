-- Idempotent reversal markers for inventory movements.
-- `reversedAt`/`reversedById` stamp a movement (and, for transfers, each leg) as anulled
-- so a repeated "Anular" submit becomes a no-op instead of double-reversing the stock.
ALTER TABLE "InventoryMovement" ADD COLUMN "reversedAt" TIMESTAMP(3);
ALTER TABLE "InventoryMovement" ADD COLUMN "reversedById" TEXT;
