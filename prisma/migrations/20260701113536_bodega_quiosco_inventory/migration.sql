-- 1. Nuevo enum + valor TRANSFER (no se usa dentro de esta migracion)
CREATE TYPE "StockLocationKind" AS ENUM ('BODEGA', 'QUIOSCO');
ALTER TYPE "InventoryMovementType" ADD VALUE 'TRANSFER';

-- 2. Tablas nuevas
CREATE TABLE "StockLocation" (
    "id" TEXT NOT NULL,
    "kind" "StockLocationKind" NOT NULL,
    "name" TEXT NOT NULL,
    "branchId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StockLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LocationInventory" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantityOnHand" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LocationInventory_pkey" PRIMARY KEY ("id")
);

-- 3. Indices y unicidad
CREATE UNIQUE INDEX "StockLocation_branchId_kind_key" ON "StockLocation"("branchId", "kind");
CREATE INDEX "StockLocation_branchId_idx" ON "StockLocation"("branchId");
CREATE UNIQUE INDEX "StockLocation_single_bodega" ON "StockLocation"("kind") WHERE "kind" = 'BODEGA';
CREATE UNIQUE INDEX "LocationInventory_locationId_ingredientId_key" ON "LocationInventory"("locationId", "ingredientId");
CREATE INDEX "LocationInventory_ingredientId_idx" ON "LocationInventory"("ingredientId");

-- 4. FKs de tablas nuevas
ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LocationInventory" ADD CONSTRAINT "LocationInventory_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LocationInventory" ADD CONSTRAINT "LocationInventory_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Ubicaciones: una bodega central + un quiosco por sucursal existente
INSERT INTO "StockLocation" ("id", "kind", "name", "branchId", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'BODEGA', 'Bodega central', NULL, true, now(), now());

INSERT INTO "StockLocation" ("id", "kind", "name", "branchId", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'QUIOSCO', 'Quiosco ' || b."name", b."id", true, now(), now()
FROM "Branch" b;

-- 6. InventoryMovement: nuevas columnas + backfill al quiosco de su sucursal
ALTER TABLE "InventoryMovement" ADD COLUMN "locationId" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN "transferId" TEXT;

UPDATE "InventoryMovement" m
SET "locationId" = sl."id"
FROM "StockLocation" sl
WHERE sl."branchId" = m."branchId" AND sl."kind" = 'QUIOSCO';

-- 7. Stock actual -> quiosco de cada sucursal (la bodega inicia vacia)
INSERT INTO "LocationInventory" ("id", "locationId", "ingredientId", "quantityOnHand", "updatedAt")
SELECT gen_random_uuid()::text, sl."id", bi."ingredientId", bi."quantityOnHand", now()
FROM "BranchInventory" bi
JOIN "StockLocation" sl ON sl."branchId" = bi."branchId" AND sl."kind" = 'QUIOSCO';

-- 8. Cerrar la transicion de InventoryMovement (branchId -> locationId)
ALTER TABLE "InventoryMovement" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "InventoryMovement" DROP CONSTRAINT "InventoryMovement_branchId_fkey";
DROP INDEX "InventoryMovement_branchId_createdAt_idx";
ALTER TABLE "InventoryMovement" DROP COLUMN "branchId";
CREATE INDEX "InventoryMovement_locationId_createdAt_idx" ON "InventoryMovement"("locationId", "createdAt");
CREATE INDEX "InventoryMovement_transferId_idx" ON "InventoryMovement"("transferId");
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 9. Eliminar la tabla vieja (sus FKs caen con ella)
DROP TABLE "BranchInventory";
