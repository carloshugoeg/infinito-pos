# Diseño: Inventario separado — bodega central y quiosco por sucursal

**Fecha:** 2026-06-30
**Estado:** Aprobado (pendiente de plan de implementación)

## Problema

Hoy el inventario es un único pool por sucursal: `BranchInventory` guarda un `quantityOnHand`
por `(branchId, ingredientId)`, y tanto las ventas como los movimientos manuales (compra, merma,
ajuste) afectan ese único pool. El cliente necesita ver **lo que realmente hay disponible en el
quiosco** (lo que se puede vender ahora) por separado de **lo que hay para surtir en la bodega**.

## Decisiones tomadas (brainstorming)

1. **Qué se cuenta:** los mismos insumos (ingredientes), en dos ubicaciones. No es inventario de
   producto terminado. Se mantiene el modelo actual de recetas/costeo a nivel ingrediente.
2. **Modelo de ubicaciones:** **una bodega central** (compartida por todas las sucursales) y
   **un quiosco por sucursal**. Modelo de comisariato.
3. **Flujo de stock:** las compras pueden ingresar a **cualquiera** de las dos ubicaciones
   (bodega o el quiosco de la sucursal). Los traslados mueven bodega → quiosco. Las ventas
   consumen **el quiosco de la sucursal que vende**. La merma/ajuste puede ocurrir en cualquiera.
4. **Migración del stock actual:** el on-hand actual de cada sucursal pasa al **quiosco** de esa
   sucursal. La bodega central inicia en cero.
5. **Enfoque de esquema:** **Approach A** — una entidad `StockLocation` generalizada.
6. **Traslados:** se permiten aunque dejen la bodega en negativo (se muestra en rojo, no se
   bloquea), consistente con la regla de AGENTS de "no bloquear por stock, solo visibilizar".
   Solo administradores los registran desde la página de inventario del admin.

## Modelo de datos (Approach A)

Nuevo enum y dos modelos nuevos; `BranchInventory` se elimina.

```prisma
enum StockLocationKind {
  BODEGA
  QUIOSCO
}

model StockLocation {
  id        String              @id @default(cuid())
  kind      StockLocationKind
  name      String
  branchId  String?             // null = bodega central; con valor = quiosco de esa sucursal
  isActive  Boolean             @default(true)
  createdAt DateTime            @default(now())
  updatedAt DateTime            @updatedAt
  branch    Branch?             @relation(fields: [branchId], references: [id], onDelete: Cascade)
  inventory LocationInventory[]
  movements InventoryMovement[]

  @@unique([branchId, kind])    // un solo quiosco por sucursal
  @@index([branchId])
}

model LocationInventory {       // reemplaza a BranchInventory
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

Cambios sobre modelos existentes:

- `InventoryMovement`: `branchId` → **`locationId`**; nuevo campo nullable **`transferId`** para
  agrupar las dos piernas de un traslado. Índices: `@@index([locationId, createdAt])`,
  `@@index([transferId])` (más los existentes de `ingredientId`/`orderId`).
- `InventoryMovementType`: agregar **`TRANSFER`**.
- `Branch`: quitar `inventory BranchInventory[]` e `inventoryMovements InventoryMovement[]`;
  agregar `stockLocations StockLocation[]`.
- `Ingredient`: `branchInventory BranchInventory[]` → `locationInventory LocationInventory[]`.
- Eliminar el modelo `BranchInventory`.

**Bodega central singleton:** como `branchId` es null para la bodega, `@@unique([branchId, kind])`
no garantiza unicidad (Postgres trata los NULL como distintos). Se agrega un índice único parcial
en la migración: `CREATE UNIQUE INDEX "StockLocation_single_bodega" ON "StockLocation"(kind) WHERE kind = 'BODEGA';`

## Operaciones

| Operación | Efecto |
|---|---|
| **Compra / Merma / Ajuste** | Apuntan a una ubicación elegida (bodega **o** el quiosco de la sucursal seleccionada). Un solo `InventoryMovement`. |
| **Traslado** | Bodega → quiosco de la sucursal. Una transacción: decrementa bodega, incrementa quiosco, dos `InventoryMovement` (piernas) que comparten `transferId` y tipo `TRANSFER`. |
| **Venta** | Consume **el quiosco de la sucursal que vende** automáticamente, vía uso de receta. Misma lógica de hoy, pero el destino es la ubicación quiosco. |
| **Reversa** | Un traslado revierte ambas piernas (por `transferId`); los movimientos simples se revierten como hoy. `SALE` sigue sin ser reversible. |

Stock negativo permitido y visibilizado (regla AGENTS), incluidos los traslados que dejen la
bodega en negativo (se muestran en rojo, no se bloquean).

## Cambios de código

- **`src/server/services/orders.ts`** (~línea 183): resolver el `locationId` del quiosco de la
  sucursal y hacer `upsert` en `locationInventory` + crear el movimiento `SALE` ahí. El
  `locationId` del quiosco se resuelve dentro de la transacción a partir del `branchId`.
- **`src/server/actions/admin-actions.ts`:**
  - `recordInventoryMovementAction`: recibe `locationId`; valida que la ubicación sea la bodega
    o el quiosco de la sucursal en alcance.
  - Nueva `transferStockAction(formData)`: `ingredientId`, `quantity`, origen (bodega) y destino
    (quiosco de la sucursal). Transacción con dos movimientos `TRANSFER` y `transferId` compartido.
  - `reverseInventoryMovementAction`: si el movimiento tiene `transferId`, revierte ambas piernas;
    si no, revierte el movimiento simple. Sigue bloqueando reversar `SALE`.
  - Conteos de dependencias de ingrediente (`countIngredientDependencies`) pasan a
    `locationInventory` y `inventoryMovement` por `ingredientId`.
- **`src/domain/inventory.ts`:** agregar `validateStockTransfer({ quantity, fromLocationId, toLocationId })`
  (cantidad > 0, ≤ máximo, ≤ 3 decimales, origen ≠ destino). Las funciones puras existentes
  (`resolveOrderIngredientUsage`, `recipeSourceMatchesItem`, `isLowOrNegativeStock`,
  `validateManualInventoryMovement`, `calculateManualInventoryDelta`) no cambian.
- **`src/app/admin/inventory/page.tsx`:** la tabla muestra **Ingrediente | Bodega | Quiosco({sucursal})
  | unidad**, con bandera de bajo stock por ubicación. Formularios: registrar movimiento (con
  selector de ubicación) y traslado (bodega → quiosco de la sucursal seleccionada). El historial
  muestra la ubicación y las piernas de traslado. La bodega es global; el quiosco sigue al
  selector de sucursal existente del admin.
- **`src/server/services/notifications.ts`** (~línea 99, resumen diario): la alerta de bajo stock
  lee la ubicación **quiosco** de la sucursal en lugar de `branchInventory`.
- **`src/lib/labels.ts`:** agregar etiqueta para `TRANSFER` ("Traslado").

## Migración (una migración Prisma con SQL de backfill)

Orden de pasos dentro de la migración:

1. Crear enum `StockLocationKind`; agregar `TRANSFER` a `InventoryMovementType`.
2. Crear tablas `StockLocation` y `LocationInventory` + índice único parcial de bodega singleton.
3. Insertar una ubicación **BODEGA** (branchId null). Insertar un **QUIOSCO** por cada `Branch`
   existente (`name = 'Quiosco ' || branch.name`).
4. Agregar columnas `locationId` (nullable temporal) y `transferId` a `InventoryMovement`.
   Backfill `locationId` = quiosco de la sucursal del movimiento (`InventoryMovement.branchId`).
5. Copiar `BranchInventory` → `LocationInventory` con `locationId` = quiosco de esa sucursal y el
   mismo `quantityOnHand`. **El on-hand actual queda en el quiosco; la bodega inicia en cero.**
6. Volver `locationId` NOT NULL; quitar FK y columna `branchId` de `InventoryMovement`.
7. Eliminar la tabla `BranchInventory`.

Validar la migración sobre una copia de la base de producción antes de aplicarla (hay datos
reales cargados según `prod-deploy-supabase-vercel` e `infinito-real-catalog-seed`).

Seeds a actualizar:

- `prisma/seed.ts` (línea ~69): crear BODEGA + QUIOSCO por sucursal, luego `LocationInventory`.
- `prisma/seed-demo.ts`: movimientos y stock demo pasan a usar ubicaciones.
- `prisma/seed-infinito.ts`: crear las ubicaciones BODEGA + QUIOSCO (sin stock, como hoy) para que
  prod tenga las ubicaciones listas.

## Costeo, pruebas y alcance

- **Costeo/finanzas sin cambios:** COGS usa `Ingredient.costPerUnit`, independiente de la
  ubicación; los reportes no leen las tablas de inventario directamente. Verificar que
  `src/server/reports/finance.ts` y `empirical-daily.ts` no dependan de `branchInventory`.
- **Pruebas:**
  - Unitarias de dominio: `validateStockTransfer`, bajo stock por ubicación.
  - Servicio: extender `orders.test.ts` para afirmar que la venta consume el quiosco.
  - Playwright (opcional): flujo de traslado en la página de inventario.
- **Fuera de alcance (YAGNI):** múltiples bodegas o estaciones, umbrales de bajo stock por
  ubicación, sugerencias de reorden/traslado automático, aprobaciones de traslado, bloqueo de
  ventas o traslados por stock insuficiente (se permite negativo, solo se visibiliza).
- **Defaults confirmados:** un único `lowStockThreshold` global por ingrediente, evaluado por
  ubicación en la vista; bajo stock del resumen diario = solo quiosco; acceso solo admin (gating
  existente).

## Modelo de aislamiento y responsabilidades

- `StockLocation` es la única fuente de verdad sobre "qué ubicaciones existen" (bodega central +
  quioscos). Su interfaz: resolver el quiosco de una sucursal y listar la bodega.
- `LocationInventory` responde "cuánto hay" por `(ubicación, ingrediente)`.
- `InventoryMovement` es el libro mayor inmutable de cambios; los traslados se agrupan por
  `transferId`.
- El dominio (`src/domain/inventory.ts`) mantiene funciones puras y testeables; la persistencia
  vive en acciones/servicios. No se duplica lógica de precios ni de costeo.
