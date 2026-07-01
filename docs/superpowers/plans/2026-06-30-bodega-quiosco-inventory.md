# Inventario bodega central + quiosco por sucursal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the single per-branch ingredient pool into one central **bodega** plus one **quiosco** per branch, so admins see kiosk-floor stock separately from warehouse reserve, with bodega→quiosco transfers.

**Architecture:** Introduce a `StockLocation` entity (one `BODEGA` with `branchId = null`, one `QUIOSCO` per branch). Inventory moves from `BranchInventory` to `LocationInventory(locationId, ingredientId)`; `InventoryMovement.branchId` becomes `locationId` plus a `transferId` grouping the two legs of a transfer. Sales consume the selling branch's quiosco; purchases/waste/adjustment target a chosen location; transfers are paired movements. Negative stock stays allowed and surfaced.

**Tech Stack:** Next.js (App Router, server actions), Prisma + PostgreSQL 16 (local) / Supabase Postgres (prod), TypeScript, Vitest, Tailwind, Preview MCP for UI verification.

**Spec:** `docs/superpowers/specs/2026-06-30-bodega-quiosco-inventory-design.md`

**Branch:** `feat/bodega-quiosco-inventory` (already created).

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `src/domain/inventory.ts` | Pure transfer validation + leg construction | Modify |
| `src/domain/inventory.test.ts` | Unit tests for transfer | Modify |
| `prisma/schema.prisma` | `StockLocation`, `LocationInventory`, `InventoryMovement.locationId/transferId`, `TRANSFER` | Modify |
| `prisma/migrations/<ts>_bodega_quiosco_inventory/migration.sql` | Hand-written data migration | Create |
| `src/server/inventory/locations.ts` | Resolve bodega / quiosco / manageable locations | Create |
| `src/server/services/orders.ts` | Sale consumes quiosco location | Modify |
| `src/server/services/orders.test.ts` | Mock `locationInventory`, assert quiosco target | Modify |
| `src/server/actions/order-actions.ts` | Resolve quiosco id, pass into tx | Modify |
| `src/server/actions/admin-actions.ts` | Movement target location, reverse, transfer, dep counts | Modify |
| `src/lib/labels.ts` | `TRANSFER` label | Modify |
| `src/server/services/notifications.ts` | Daily low-stock reads quiosco | Modify |
| `src/app/admin/inventory/page.tsx` | Two-location view, location picker, transfer form | Modify |
| `prisma/seed.ts`, `prisma/seed-demo.ts`, `prisma/seed-infinito.ts` | Create locations, seed into quiosco | Modify |

---

## Task 1: Domain — transfer validation (pure, TDD)

**Files:**
- Modify: `src/domain/inventory.ts`
- Test: `src/domain/inventory.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/inventory.test.ts` (inside the file, after the existing `describe` blocks). Also add the new imports to the existing import line at the top.

Change the top import to:

```ts
import {
  buildTransferLegs,
  calculateManualInventoryDelta,
  isLowOrNegativeStock,
  resolveOrderIngredientUsage,
  validateManualInventoryMovement,
  validateStockTransfer
} from "@/domain/inventory";
```

Append:

```ts
describe("stock transfer", () => {
  it("acepta un traslado valido", () => {
    expect(validateStockTransfer({ quantity: 5, fromLocationId: "bodega", toLocationId: "quiosco" })).toEqual([]);
  });

  it("rechaza origen igual a destino", () => {
    expect(validateStockTransfer({ quantity: 5, fromLocationId: "a", toLocationId: "a" })).toContain(
      "El origen y el destino deben ser distintos."
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/inventory.test.ts`
Expected: FAIL — `validateStockTransfer`/`buildTransferLegs` are not exported.

- [ ] **Step 3: Implement the functions**

Append to `src/domain/inventory.ts` (the constants `MAX_INVENTORY_QUANTITY` and the helper `hasQuantityPrecision` already exist in this file — reuse them):

```ts
export type StockTransferInput = {
  quantity: number;
  fromLocationId: string;
  toLocationId: string;
};

export type TransferMovementLeg = {
  locationId: string;
  quantityDelta: number;
};

export function validateStockTransfer(input: StockTransferInput) {
  const errors: string[] = [];
  if (!input.fromLocationId || !input.toLocationId) errors.push("Selecciona origen y destino.");
  if (input.fromLocationId && input.fromLocationId === input.toLocationId) {
    errors.push("El origen y el destino deben ser distintos.");
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) errors.push("La cantidad debe ser mayor a cero.");
  if (Number.isFinite(input.quantity) && Math.abs(input.quantity) > MAX_INVENTORY_QUANTITY) {
    errors.push("La cantidad es demasiado alta.");
  }
  if (Number.isFinite(input.quantity) && input.quantity > 0 && !hasQuantityPrecision(input.quantity)) {
    errors.push("La cantidad permite maximo 3 decimales.");
  }
  return errors;
}

export function buildTransferLegs(input: StockTransferInput): [TransferMovementLeg, TransferMovementLeg] {
  const amount = Math.abs(input.quantity);
  return [
    { locationId: input.fromLocationId, quantityDelta: -amount },
    { locationId: input.toLocationId, quantityDelta: amount }
  ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/domain/inventory.test.ts`
Expected: PASS (all existing + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/domain/inventory.ts src/domain/inventory.test.ts
git commit -m "feat(inventory): pure stock-transfer validation and leg builder

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Schema + data migration + cut-over to location-based inventory

This is a single cohesive cut-over. The schema change removes `BranchInventory`, so every consumer must switch in the same commit to keep the build green. **Commit once, at the end, only after `npm run build` and `npx vitest run` pass.** Do not commit a half-migrated tree.

**Prerequisite:** local Postgres running (`docker compose up -d` per `docs/DEV_LOCAL.md`), `DATABASE_URL` pointing at it.

**Files:** `prisma/schema.prisma`, new migration, `src/server/inventory/locations.ts`, `src/server/services/orders.ts`, `src/server/services/orders.test.ts`, `src/server/actions/order-actions.ts`, `src/server/actions/admin-actions.ts`, `src/lib/labels.ts`, `src/server/services/notifications.ts`, `src/app/admin/inventory/page.tsx`, `prisma/seed.ts`, `prisma/seed-demo.ts`, `prisma/seed-infinito.ts`.

### Schema

- [ ] **Step 1: Add the `TRANSFER` enum value**

In `prisma/schema.prisma`, edit `enum InventoryMovementType` to add `TRANSFER`:

```prisma
enum InventoryMovementType {
  PURCHASE
  WASTE
  ADJUSTMENT
  SALE
  TRANSFER
}
```

- [ ] **Step 2: Add the `StockLocationKind` enum**

Add directly below the `InventoryMovementType` enum:

```prisma
enum StockLocationKind {
  BODEGA
  QUIOSCO
}
```

- [ ] **Step 3: Update `Branch` relations**

In `model Branch`, remove these two lines:

```prisma
  inventory          BranchInventory[]
  inventoryMovements InventoryMovement[]
```

and add:

```prisma
  stockLocations     StockLocation[]
```

- [ ] **Step 4: Update `Ingredient` relations**

In `model Ingredient`, replace:

```prisma
  branchInventory    BranchInventory[]
```

with:

```prisma
  locationInventory  LocationInventory[]
```

(Leave `inventoryMovements InventoryMovement[]` as is.)

- [ ] **Step 5: Replace `BranchInventory` with `LocationInventory` and add `StockLocation`**

Delete the entire `model BranchInventory { ... }` block and replace it with:

```prisma
model StockLocation {
  id        String              @id @default(cuid())
  kind      StockLocationKind
  name      String
  branchId  String?
  isActive  Boolean             @default(true)
  createdAt DateTime            @default(now())
  updatedAt DateTime            @updatedAt
  branch    Branch?             @relation(fields: [branchId], references: [id], onDelete: Cascade)
  inventory LocationInventory[]
  movements InventoryMovement[]

  @@unique([branchId, kind])
  @@index([branchId])
}

model LocationInventory {
  id             String        @id @default(cuid())
  locationId     String
  ingredientId   String
  quantityOnHand Decimal       @default(0) @db.Decimal(12, 3)
  updatedAt      DateTime      @updatedAt
  location       StockLocation @relation(fields: [locationId], references: [id], onDelete: Cascade)
  ingredient     Ingredient    @relation(fields: [ingredientId], references: [id], onDelete: Cascade)

  @@unique([locationId, ingredientId])
  @@index([ingredientId])
}
```

- [ ] **Step 6: Rework `InventoryMovement`**

Replace the entire `model InventoryMovement { ... }` block with:

```prisma
model InventoryMovement {
  id            String                @id @default(cuid())
  locationId    String
  ingredientId  String
  type          InventoryMovementType
  quantityDelta Decimal               @db.Decimal(12, 3)
  reason        String
  orderId       String?
  transferId    String?
  createdById   String
  createdAt     DateTime              @default(now())
  location      StockLocation         @relation(fields: [locationId], references: [id])
  ingredient    Ingredient            @relation(fields: [ingredientId], references: [id])
  order         Order?                @relation(fields: [orderId], references: [id])
  createdBy     User                  @relation(fields: [createdById], references: [id])

  @@index([locationId, createdAt])
  @@index([ingredientId])
  @@index([orderId])
  @@index([transferId])
}
```

### Migration

- [ ] **Step 7: Generate the migration skeleton (create-only)**

Run: `npx prisma migrate dev --create-only --name bodega_quiosco_inventory`
Expected: a new folder `prisma/migrations/<timestamp>_bodega_quiosco_inventory/migration.sql` with Prisma's naive (destructive) diff. You will **replace its entire contents** in the next step.

- [ ] **Step 8: Replace the migration SQL with the ordered, data-preserving version**

Overwrite the generated `migration.sql` with exactly this (table/constraint names verified against `prisma/migrations/00000000000000_init/migration.sql`):

```sql
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
-- Garantiza una unica bodega central (branchId NULL no lo cubre el unique compuesto)
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
```

- [ ] **Step 9: Apply the migration and regenerate the client**

Run: `npx prisma migrate dev`
Expected: "The following migration(s) have been applied" with no errors, and Prisma Client regenerates. If it reports drift, the schema (Steps 1-6) and SQL (Step 8) do not match — reconcile before continuing.

- [ ] **Step 10: Verify the data landed correctly**

Run:

```bash
npx prisma db execute --stdin <<'SQL'
SELECT kind, COUNT(*) FROM "StockLocation" GROUP BY kind;
SELECT COUNT(*) AS quiosco_inventory_rows FROM "LocationInventory";
SELECT COUNT(*) AS movements_without_location FROM "InventoryMovement" WHERE "locationId" IS NULL;
SQL
```

Expected: exactly 1 `BODEGA`, one `QUIOSCO` per branch; `LocationInventory` row count equals the old `BranchInventory` count; `movements_without_location` = 0.

### Locations helper

- [ ] **Step 11: Create the location resolver module**

Create `src/server/inventory/locations.ts`:

```ts
import { StockLocationKind, type StockLocation } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function getBodegaLocation(): Promise<StockLocation> {
  const bodega = await prisma.stockLocation.findFirst({ where: { kind: StockLocationKind.BODEGA } });
  if (!bodega) throw new Error("No existe la bodega central.");
  return bodega;
}

export async function getQuioscoLocation(branchId: string): Promise<StockLocation> {
  const quiosco = await prisma.stockLocation.findUnique({
    where: { branchId_kind: { branchId, kind: StockLocationKind.QUIOSCO } }
  });
  if (!quiosco) throw new Error("La sucursal no tiene quiosco configurado.");
  return quiosco;
}

/** Ubicaciones que un admin de esta sucursal puede gestionar: bodega central + su quiosco. */
export async function getManageableLocations(branchId: string): Promise<[StockLocation, StockLocation]> {
  const [bodega, quiosco] = await Promise.all([getBodegaLocation(), getQuioscoLocation(branchId)]);
  return [bodega, quiosco];
}
```

### Order consumption

- [ ] **Step 12: Point the sale at the quiosco location**

In `src/server/services/orders.ts`:

Replace the `branchInventory` member of `PaidOrderTransactionClient` (around line 40-42):

```ts
  branchInventory: {
    upsert(input: { where: unknown; update: unknown; create: unknown }): Promise<unknown>;
  };
```

with:

```ts
  locationInventory: {
    upsert(input: { where: unknown; update: unknown; create: unknown }): Promise<unknown>;
  };
```

In `createPaidOrderInTransaction`, add `quioscoLocationId` to the input type (right after `branchId: string;`):

```ts
    branchId: string;
    quioscoLocationId: string;
```

Replace the consumption loop (currently lines 195-212) with:

```ts
  for (const item of input.prepared.usage) {
    await tx.locationInventory.upsert({
      where: { locationId_ingredientId: { locationId: input.quioscoLocationId, ingredientId: item.ingredientId } },
      update: { quantityOnHand: { decrement: item.quantity } },
      create: { locationId: input.quioscoLocationId, ingredientId: item.ingredientId, quantityOnHand: -item.quantity }
    });
    await tx.inventoryMovement.create({
      data: {
        locationId: input.quioscoLocationId,
        ingredientId: item.ingredientId,
        type: InventoryMovementType.SALE,
        quantityDelta: -item.quantity,
        reason: "Venta",
        orderId: order.id,
        createdById: input.createdById
      }
    });
  }
```

- [ ] **Step 13: Resolve the quiosco id in the order action**

In `src/server/actions/order-actions.ts`, add the import near the other `@/server` imports:

```ts
import { getQuioscoLocation } from "@/server/inventory/locations";
```

Then, just before `const orderId = await prisma.$transaction(...)` (line ~60), resolve the quiosco, and pass it into the call:

```ts
  const quiosco = await getQuioscoLocation(branch.id);

  const orderId = await prisma.$transaction(async (tx) => {
    return createPaidOrderInTransaction(tx, {
      branchId: branch.id,
      quioscoLocationId: quiosco.id,
      cashSessionId: cashSession.id,
      customerId: customer?.id,
      customerNit,
      customerName,
      customerPhone,
      createdById: user.id,
      prepared
    });
  });
```

- [ ] **Step 14: Update the order service test mock**

In `src/server/services/orders.test.ts`:

Replace the `branchInventory` mock (lines 45-50) with:

```ts
      locationInventory: {
        upsert: async (input: { where: unknown; update: unknown; create: unknown }) => {
          writes.push({ model: "locationInventory", input });
          return {};
        }
      },
```

Add `quioscoLocationId` to the `createPaidOrderInTransaction` call (after `branchId: "branch-1",`):

```ts
      branchId: "branch-1",
      quioscoLocationId: "quiosco-1",
```

Replace the two trailing assertions (lines 106-111) with:

```ts
    expect(writes[1].input).toMatchObject({
      create: { locationId: "quiosco-1", ingredientId: "ingredient-vaso", quantityOnHand: -2 }
    });
    expect(writes[2].input).toMatchObject({
      data: { locationId: "quiosco-1", type: InventoryMovementType.SALE, quantityDelta: -2, orderId: "order-1" }
    });
```

### Admin actions

- [ ] **Step 15: Movement action targets a chosen location**

In `src/server/actions/admin-actions.ts`, add to the imports:

```ts
import { StockLocationKind } from "@prisma/client";
import { getManageableLocations } from "@/server/inventory/locations";
```

(Add `StockLocationKind` to the existing `@prisma/client` import line that already brings in `InventoryMovementType, UserRole`.)

Replace the body of `recordInventoryMovementAction` (the `$transaction` block, lines 431-447) so the movement targets a validated location, defaulting to the quiosco:

```ts
  const [bodega, quiosco] = await getManageableLocations(branch.id);
  const requestedLocationId = normalizeFormText(formData.get("locationId"));
  const location = [bodega, quiosco].find((loc) => loc.id === requestedLocationId) ?? quiosco;

  await prisma.$transaction(async (tx) => {
    await tx.locationInventory.upsert({
      where: { locationId_ingredientId: { locationId: location.id, ingredientId } },
      update: { quantityOnHand: { increment: quantityDelta } },
      create: { locationId: location.id, ingredientId, quantityOnHand: quantityDelta }
    });
    await tx.inventoryMovement.create({
      data: {
        locationId: location.id,
        ingredientId,
        type: type as InventoryMovementType,
        quantityDelta,
        reason: normalizeFormText(formData.get("reason"), type),
        createdById: user.id
      }
    });
  });
```

- [ ] **Step 16: Reverse action scoped by location**

Replace `reverseInventoryMovementAction` (lines 452-486) with this location-scoped version (transfer-pair handling is added in Task 3):

```ts
export async function reverseInventoryMovementAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  const { user, branch } = await getActiveBranch();
  const id = normalizeFormText(formData.get("id"));
  const locations = await getManageableLocations(branch.id);
  const locationIds = locations.map((loc) => loc.id);

  const movement = await prisma.inventoryMovement.findFirst({
    where: { id, locationId: { in: locationIds } }
  });

  if (!movement || movement.type === InventoryMovementType.SALE) {
    revalidatePath("/admin/inventory");
    return;
  }

  const reversalDelta = Number(movement.quantityDelta) * -1;
  await prisma.$transaction(async (tx) => {
    await tx.locationInventory.upsert({
      where: { locationId_ingredientId: { locationId: movement.locationId, ingredientId: movement.ingredientId } },
      update: { quantityOnHand: { increment: reversalDelta } },
      create: { locationId: movement.locationId, ingredientId: movement.ingredientId, quantityOnHand: reversalDelta }
    });
    await tx.inventoryMovement.create({
      data: {
        locationId: movement.locationId,
        ingredientId: movement.ingredientId,
        type: InventoryMovementType.ADJUSTMENT,
        quantityDelta: reversalDelta,
        reason: `Anulacion de movimiento ${movement.type}: ${movement.reason}`,
        createdById: user.id
      }
    });
  });

  revalidatePath("/admin/inventory");
}
```

- [ ] **Step 17: Fix dependency counts**

In `countBranchDependencies` (lines 521-530), replace the `branchInventory`/`inventoryMovement` counts with a `stockLocation` count (movements and inventory cascade through the location):

```ts
async function countBranchDependencies(branchId: string) {
  const [users, cashSessions, locations, orders] = await Promise.all([
    prisma.userBranch.count({ where: { branchId } }),
    prisma.cashSession.count({ where: { branchId } }),
    prisma.stockLocation.count({ where: { branchId } }),
    prisma.order.count({ where: { branchId } })
  ]);
  return users + cashSessions + locations + orders;
}
```

In `countIngredientDependencies` (lines 532-539), swap `branchInventory` → `locationInventory`:

```ts
async function countIngredientDependencies(ingredientId: string) {
  const [recipes, inventory, movements] = await Promise.all([
    prisma.recipeItem.count({ where: { ingredientId } }),
    prisma.locationInventory.count({ where: { ingredientId } }),
    prisma.inventoryMovement.count({ where: { ingredientId } })
  ]);
  return recipes + inventory + movements;
}
```

### Labels + notifications

- [ ] **Step 18: Add the `TRANSFER` label**

In `src/lib/labels.ts`, add to `inventoryMovementTypeLabels`:

```ts
  [InventoryMovementType.SALE]: "Venta",
  [InventoryMovementType.TRANSFER]: "Traslado"
```

(Replace the existing `SALE` line's trailing comma situation so both entries are present.)

- [ ] **Step 19: Daily-summary low-stock reads the quiosco**

In `src/server/services/notifications.ts`, add `StockLocationKind` to the `@prisma/client` import, then replace the inventory query (line ~99):

```ts
    prisma.locationInventory.findMany({
      where: { location: { branchId, kind: StockLocationKind.QUIOSCO } },
      include: { ingredient: true }
    }),
```

The downstream `.filter`/`.map` already use `item.quantityOnHand` and `item.ingredient` — no further change.

### Inventory page (minimal compile fix; full UI in Task 4)

- [ ] **Step 20: Source the page from locations**

In `src/app/admin/inventory/page.tsx`, add the import:

```ts
import { getManageableLocations } from "@/server/inventory/locations";
```

Replace the data loading block (lines 17-31) with:

```ts
  const { branch } = await getActiveBranch();
  const [bodega, quiosco] = await getManageableLocations(branch.id);
  const [ingredients, inventory, movements] = await Promise.all([
    prisma.ingredient.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.locationInventory.findMany({
      where: { locationId: quiosco.id },
      include: { ingredient: true },
      orderBy: { ingredient: { name: "asc" } }
    }),
    prisma.inventoryMovement.findMany({
      where: { locationId: { in: [bodega.id, quiosco.id] } },
      include: { ingredient: true },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);
```

The rest of the JSX is unchanged for now (it reads `item.quantityOnHand`, `item.ingredient`, `move.*`).

### Seeds

- [ ] **Step 21: `seed.ts` — create locations, seed into quiosco**

In `prisma/seed.ts`, add `StockLocationKind` to the `@prisma/client` import. Replace the `branchInventory` loop (lines 68-78) with:

```ts
  let bodega = await prisma.stockLocation.findFirst({ where: { kind: StockLocationKind.BODEGA } });
  if (!bodega) {
    bodega = await prisma.stockLocation.create({ data: { kind: StockLocationKind.BODEGA, name: "Bodega central" } });
  }
  const quiosco = await prisma.stockLocation.upsert({
    where: { branchId_kind: { branchId: branch.id, kind: StockLocationKind.QUIOSCO } },
    update: {},
    create: { kind: StockLocationKind.QUIOSCO, name: `Quiosco ${branch.name}`, branchId: branch.id }
  });

  for (const ingredient of ingredients) {
    await prisma.locationInventory.upsert({
      where: { locationId_ingredientId: { locationId: quiosco.id, ingredientId: ingredient.id } },
      update: {},
      create: {
        locationId: quiosco.id,
        ingredientId: ingredient.id,
        quantityOnHand: ingredient.unit === "unidad" ? 50 : 5000
      }
    });
  }
```

- [ ] **Step 22: `seed-infinito.ts` — create the two locations (no stock)**

In `prisma/seed-infinito.ts`, add `StockLocationKind` to the `@prisma/client` import (it currently imports `Prisma`). Capture the upserted branch and create the locations. Replace the branch upsert (lines 320-324) with:

```ts
  const branch = await prisma.branch.upsert({
    where: { code: branchCode },
    update: { name: branchName, isActive: true },
    create: { name: branchName, code: branchCode, address: "Guatemala" }
  });

  let bodega = await prisma.stockLocation.findFirst({ where: { kind: StockLocationKind.BODEGA } });
  if (!bodega) {
    bodega = await prisma.stockLocation.create({ data: { kind: StockLocationKind.BODEGA, name: "Bodega central" } });
  }
  await prisma.stockLocation.upsert({
    where: { branchId_kind: { branchId: branch.id, kind: StockLocationKind.QUIOSCO } },
    update: {},
    create: { kind: StockLocationKind.QUIOSCO, name: `Quiosco ${branch.name}`, branchId: branch.id }
  });
```

- [ ] **Step 23: `seed-demo.ts` — moves target the quiosco location**

In `prisma/seed-demo.ts`:

After the `admin` lookup (line 21), resolve the branch's quiosco:

```ts
  const quiosco = await prisma.stockLocation.findFirst({
    where: { branchId: branch.id, kind: "QUIOSCO" }
  });
  if (!quiosco) throw new Error("Quiosco no encontrado. Corre el seed estandar primero.");
```

In the two `inventoryMoves.push({ ... })` blocks (lines ~125 and ~142), replace `branchId: branch.id,` with `locationId: quiosco.id,`.

Replace the inventory write-back block (lines 208-221) with:

```ts
      if (!isCancelled && inventoryMoves.length > 0) {
        await prisma.inventoryMovement.createMany({
          data: inventoryMoves.map((m) => ({ ...m, orderId: order.id }))
        });

        for (const move of inventoryMoves) {
          await prisma.locationInventory.upsert({
            where: { locationId_ingredientId: { locationId: quiosco.id, ingredientId: move.ingredientId } },
            update: { quantityOnHand: { increment: move.quantityDelta } },
            create: { locationId: quiosco.id, ingredientId: move.ingredientId, quantityOnHand: move.quantityDelta }
          });
        }
      }
```

### Verify + commit

- [ ] **Step 24: Build and test**

Run: `npx prisma generate && npm run build && npx vitest run`
Expected: type-check/build pass; all Vitest suites pass (including the updated `orders.test.ts`). Fix any `branchInventory`/`branchId` reference the compiler flags until green.

- [ ] **Step 25: Reseed locally and sanity-check**

Run: `npm run dev:setup` (or the project's seed command per `docs/DEV_LOCAL.md`).
Expected: seeds complete with no errors; `StockLocation` has one bodega + one quiosco.

- [ ] **Step 26: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/server/inventory/locations.ts \
  src/server/services/orders.ts src/server/services/orders.test.ts \
  src/server/actions/order-actions.ts src/server/actions/admin-actions.ts \
  src/lib/labels.ts src/server/services/notifications.ts \
  src/app/admin/inventory/page.tsx prisma/seed.ts prisma/seed-demo.ts prisma/seed-infinito.ts
git commit -m "feat(inventory): cut over to central bodega + per-branch quiosco locations

StockLocation/LocationInventory replace BranchInventory; sales consume the
selling branch's quiosco; data migration preserves on-hand into each quiosco.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Transfer action + transfer-aware reversal

**Files:**
- Modify: `src/server/actions/admin-actions.ts`

- [ ] **Step 1: Add `transferStockAction`**

In `src/server/actions/admin-actions.ts`, add `validateStockTransfer` and `buildTransferLegs` to the existing `@/domain/inventory` import, and `cuid`-free id generation via Prisma is not available, so group legs with a shared `transferId` built from `crypto.randomUUID()`. Add the action below `reverseInventoryMovementAction`:

```ts
export async function transferStockAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  const { user, branch } = await getActiveBranch();
  const ingredientId = normalizeFormText(formData.get("ingredientId"));
  const quantity = parseNumberField(formData.get("quantity"), "Cantidad", { min: 0.001, max: 999_999.999, decimals: 3 });

  const [bodega, quiosco] = await getManageableLocations(branch.id);
  const transferErrors = validateStockTransfer({
    quantity,
    fromLocationId: bodega.id,
    toLocationId: quiosco.id
  });
  if (transferErrors.length) throw new Error(transferErrors.join(" "));

  const legs = buildTransferLegs({ quantity, fromLocationId: bodega.id, toLocationId: quiosco.id });
  const transferId = crypto.randomUUID();
  const reason = normalizeFormText(formData.get("reason"), `Traslado bodega -> ${quiosco.name}`);

  await prisma.$transaction(async (tx) => {
    for (const leg of legs) {
      await tx.locationInventory.upsert({
        where: { locationId_ingredientId: { locationId: leg.locationId, ingredientId } },
        update: { quantityOnHand: { increment: leg.quantityDelta } },
        create: { locationId: leg.locationId, ingredientId, quantityOnHand: leg.quantityDelta }
      });
      await tx.inventoryMovement.create({
        data: {
          locationId: leg.locationId,
          ingredientId,
          type: InventoryMovementType.TRANSFER,
          quantityDelta: leg.quantityDelta,
          reason,
          transferId,
          createdById: user.id
        }
      });
    }
  });

  revalidatePath("/admin/inventory");
}
```

(`crypto.randomUUID()` is available in the Node runtime used by server actions — no import needed.)

- [ ] **Step 2: Make reversal transfer-aware**

In `reverseInventoryMovementAction`, after fetching `movement` and the SALE guard, replace the single-movement reversal with a loop over the transfer's legs (so reversing either leg of a transfer undoes both). Replace everything from `const reversalDelta = ...` through the end of the `$transaction` with:

```ts
  const legs = movement.transferId
    ? await prisma.inventoryMovement.findMany({ where: { transferId: movement.transferId } })
    : [movement];

  await prisma.$transaction(async (tx) => {
    for (const leg of legs) {
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
          createdById: user.id
        }
      });
    }
  });
```

- [ ] **Step 3: Build + test**

Run: `npm run build && npx vitest run`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/server/actions/admin-actions.ts
git commit -m "feat(inventory): bodega->quiosco transfer action with paired-leg reversal

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Inventory admin UI — two locations + transfer

**Files:**
- Modify: `src/app/admin/inventory/page.tsx`

- [ ] **Step 1: Load both locations' stock and join by ingredient**

Replace the data block from Task 2 Step 20 with a version that loads bodega stock too and builds a merged-by-ingredient view. Replace lines (the `Promise.all` block) with:

```ts
  const { branch } = await getActiveBranch();
  const [bodega, quiosco] = await getManageableLocations(branch.id);
  const [ingredients, bodegaInv, quioscoInv, movements] = await Promise.all([
    prisma.ingredient.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.locationInventory.findMany({ where: { locationId: bodega.id } }),
    prisma.locationInventory.findMany({ where: { locationId: quiosco.id } }),
    prisma.inventoryMovement.findMany({
      where: { locationId: { in: [bodega.id, quiosco.id] } },
      include: { ingredient: true, location: true },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);

  const bodegaByIngredient = new Map(bodegaInv.map((row) => [row.ingredientId, toNumber(row.quantityOnHand)]));
  const quioscoByIngredient = new Map(quioscoInv.map((row) => [row.ingredientId, toNumber(row.quantityOnHand)]));
  const stockRows = ingredients.map((ingredient) => ({
    ingredient,
    bodega: bodegaByIngredient.get(ingredient.id) ?? 0,
    quiosco: quioscoByIngredient.get(ingredient.id) ?? 0,
    threshold: toNumber(ingredient.lowStockThreshold)
  }));
```

- [ ] **Step 2: Import the transfer action and a location-aware stock table**

Add to the imports:

```ts
import { recordInventoryMovementAction, reverseInventoryMovementAction, transferStockAction } from "@/server/actions/admin-actions";
```

(extend the existing import — `transferStockAction` is the new one).

- [ ] **Step 3: Add a location picker to the manual-movement form**

Inside the "Movimiento manual" `<form>`, add a location `<select>` before the ingredient select:

```tsx
              <div>
                <Label>Ubicacion</Label>
                <select name="locationId" className="touch-target w-full rounded-md border border-[var(--border)] bg-white px-3">
                  <option value={quiosco.id}>Quiosco ({branch.name})</option>
                  <option value={bodega.id}>Bodega central</option>
                </select>
              </div>
```

- [ ] **Step 4: Add the transfer form**

Add a second `Card` below the "Movimiento manual" card, inside the left column:

```tsx
        <Card>
          <CardHeader><CardTitle>Traslado a quiosco</CardTitle></CardHeader>
          <CardContent>
            <form action={transferStockAction} className="space-y-3">
              <p className="text-sm text-[var(--muted-foreground)]">Mueve stock de la bodega central al quiosco de {branch.name}.</p>
              <div>
                <Label>Ingrediente</Label>
                <select name="ingredientId" className="touch-target w-full rounded-md border border-[var(--border)] bg-white px-3">
                  {ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>)}
                </select>
              </div>
              <div><Label>Cantidad</Label><Input name="quantity" type="number" step="0.001" min="0.001" required /></div>
              <div><Label>Razon</Label><Input name="reason" placeholder="Surtido de quiosco" /></div>
              <Button type="submit">Trasladar</Button>
            </form>
          </CardContent>
        </Card>
```

Wrap the two left-column cards in a `<div className="space-y-4">` if they are not already siblings under one.

- [ ] **Step 5: Replace the "Stock actual" table with two columns**

Replace the `Stock actual` table body to render `stockRows` with both locations and per-location low-stock coloring:

```tsx
              <Table>
                <thead><tr><Th>Ingrediente</Th><Th>Bodega</Th><Th>Quiosco</Th></tr></thead>
                <tbody>
                  {stockRows.map((row) => {
                    const bodegaLow = row.bodega <= row.threshold;
                    const quioscoLow = row.quiosco <= row.threshold;
                    return (
                      <tr key={row.ingredient.id}>
                        <Td><span className="inline-flex items-center gap-2"><IngredientIcon name={row.ingredient.name} size={16} />{row.ingredient.name}</span></Td>
                        <Td className={bodegaLow ? "font-bold text-red-700" : undefined}>{row.bodega} {row.ingredient.unit}</Td>
                        <Td className={quioscoLow ? "font-bold text-red-700" : undefined}>{row.quiosco} {row.ingredient.unit}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
```

- [ ] **Step 6: Show the location in the movements history**

In the "Ultimos movimientos" table, add a `Ubicacion` header after `Tipo` and a cell rendering `move.location.name`:

```tsx
                <thead><tr><Th>Fecha</Th><Th>Tipo</Th><Th>Ubicacion</Th><Th>Ingrediente</Th><Th>Cantidad</Th><Th>Razon</Th><Th>Accion</Th></tr></thead>
```

and inside the row, after the `Tipo` cell:

```tsx
                      <Td>{move.location.name}</Td>
```

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: pass.

- [ ] **Step 8: Verify in the browser (Preview MCP)**

Start the dev server (`preview_start`), log in as `admin@koi.local` / `admin12345`, go to `/admin/inventory`. Verify:
1. Stock table shows separate **Bodega** and **Quiosco** columns.
2. Record a **Compra** into Bodega → bodega column increases, quiosco unchanged.
3. **Trasladar** that ingredient → bodega decreases, quiosco increases by the same amount; history shows two `Traslado` rows (bodega negative leg, quiosco positive leg).
4. **Anular** one transfer leg → both legs reversed (bodega and quiosco return to pre-transfer values).
5. Make a sale in `/kiosk`, return to inventory → only the **quiosco** column dropped.

Capture a `preview_screenshot` of the two-column table for the user. Fix any issue by editing the source and re-checking before moving on.

- [ ] **Step 9: Commit**

```bash
git add src/app/admin/inventory/page.tsx
git commit -m "feat(inventory): admin UI for bodega/quiosco stock and transfers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Checklist + docs

**Files:**
- Modify: `docs/IMPLEMENTATION_PLAN.md`

- [ ] **Step 1: Record the change**

Per `AGENTS.md`, append a short entry to `docs/IMPLEMENTATION_PLAN.md` noting: central bodega + per-branch quiosco inventory shipped (StockLocation/LocationInventory, transfers, migration `bodega_quiosco_inventory`), and the prod migration caveat (run against a Supabase copy/backup first — existing on-hand lands in each branch's quiosco, bodega starts empty).

- [ ] **Step 2: Commit**

```bash
git add docs/IMPLEMENTATION_PLAN.md
git commit -m "docs: log bodega/quiosco inventory in implementation plan

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Production rollout note (not a code task)

The Supabase prod DB already holds the real Infinito catalog and stock. Before `prisma migrate deploy` in prod:
1. Take a Supabase backup / snapshot.
2. Run the migration against a branch/copy first and confirm the three verification queries (Task 2 Step 10) return the expected counts.
3. Then deploy. Existing on-hand moves into each branch's quiosco; the central bodega starts empty and is filled via the first purchase/transfer.

---

## Self-review notes

- **Spec coverage:** StockLocation entity (Task 2) · LocationInventory replacing BranchInventory (Task 2) · InventoryMovement.locationId + transferId + TRANSFER (Task 2) · purchases/waste/adjustment into either location (Task 2 Step 15 + Task 4 Step 3) · sales consume quiosco (Task 2 Steps 12-14) · transfers bodega→quiosco (Task 3) · paired-leg reversal (Task 3 Step 2) · migration with on-hand→quiosco backfill (Task 2 Step 8) · daily-summary low-stock = quiosco (Task 2 Step 19) · TRANSFER label (Task 2 Step 18) · seeds (Task 2 Steps 21-23) · two-location UI (Task 4) · prod caveat (rollout note + Task 5).
- **Negative stock:** transfers and sales never block; negative surfaces in red (Task 4 Step 5). Matches the AGENTS rule.
- **Type consistency:** `getQuioscoLocation`/`getBodegaLocation`/`getManageableLocations`, `validateStockTransfer`/`buildTransferLegs`, and the `quioscoLocationId` field are used with identical names across tasks. The `locationInventory` Prisma model and `locationId_ingredientId` compound unique are referenced consistently in service, actions, page, and seeds.
