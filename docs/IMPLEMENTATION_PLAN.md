# Koi POS V1 - Implementation Log

Este archivo es la fuente de verdad para agentes y progreso del V1. Cada agente debe leer `AGENTS.md`, `docs/requirements.md` y este archivo antes de tocar codigo.

## Reglas Obligatorias Para Agentes

- Cada cambio debe actualizar el task/subtask correspondiente en este archivo.
- Una subtask solo puede marcarse como completada cuando este codificada, revisada y testeada.
- No introducir multi-tenancy ni `business_id` en V1.
- No crear KDS separado; preparacion vive dentro de `/kiosk`.
- No agregar FEL real en V1 salvo placeholders de datos FEL. Costos (COGS), gastos operativos, finanzas y correo diario son parte del alcance (Fase 1).
- Mantener toda UI visible al usuario en espanol.
- Preferir funciones de dominio puras para totales, seleccion de modificadores e inventario.
- No duplicar logica de precios entre frontend y backend; el backend recalcula todo al cobrar.
- No bloquear ventas por stock insuficiente en V1.
- Preservacion de tokens: leer archivos especificos, evitar dumps largos, resumir hallazgos y consultar solo modulos tocados.
- Skills recomendadas: frontend/app implementation, database modeling, Playwright/browser testing para QA visual, spreadsheets solo si se exportan reportes avanzados.

## Convencion De Estado

Formato obligatorio por task/subtask: `Estado | Task | Codificado | Revisado | Testeado | Notas`.

- Estado: `[ ]` pendiente, `[~]` en progreso, `[x]` completo.
- Codificado/Revisado/Testeado: `No`, `Parcial`, `Si`.

## Tasks

| Estado | Task | Codificado | Revisado | Testeado | Notas |
| --- | --- | --- | --- | --- | --- |
| [x] | T0 - Bootstrap | Si | Si | Si | Build y typecheck pasan. |
| [x] | T0.1 Inicializar repo Git | Si | Si | Si | `git init` ejecutado. |
| [x] | T0.2 Crear Next.js + TypeScript + Tailwind + shadcn/ui | Si | Si | Si | UI primitives locales estilo shadcn. |
| [x] | T0.3 Configurar Prisma + PostgreSQL | Si | Si | Si | Prisma generate OK. |
| [x] | T0.4 Crear `.env.example`, scripts y README basico | Si | Si | Si | Incluye credenciales demo. |
| [x] | T1 - Base de datos | Si | Si | Si | Schema, migracion SQL y seed creados. |
| [x] | T1.1 Crear schema Prisma con modelos V1 | Si | Si | Si | Modelos multisucursal sin multi-tenancy. |
| [x] | T1.2 Crear migracion inicial | Si | Si | Si | SQL generado con `prisma migrate diff`. |
| [x] | T1.3 Crear seed con sucursal, admin, productos demo, ingredientes y recetas | Si | Si | Si | Seed idempotente. |
| [x] | T1.4 Validar relaciones e indices criticos | Si | Si | Si | Prisma generate y build OK. |
| [x] | T2 - Auth, roles y sucursal | Si | Si | Si | Sesion cookie firmada. |
| [x] | T2.1 Login con email/password | Si | Si | Si | bcryptjs. |
| [x] | T2.2 Proteccion server-side por sesion | Si | Si | Si | Guards en server components/actions. |
| [x] | T2.3 Selector de sucursal activa | Si | Si | Si | `/select-branch`. |
| [x] | T2.4 Guards para admin y operator | Si | Si | Si | `requireRole`. |
| [x] | T3 - Caja | Si | Si | Si | Flujos server-side y pagina de cierre. |
| [x] | T3.1 Apertura obligatoria | Si | Si | Si | `/kiosk` redirige a `/cash/open`. |
| [x] | T3.2 Deteccion de caja abierta por sucursal/usuario | Si | Si | Si | Por sucursal activa. |
| [x] | T3.3 Cierre con efectivo esperado, contado y diferencia | Si | Si | Si | Dominio unit-tested. |
| [x] | T3.4 Resumen por metodo de pago | Si | Si | Si | Efectivo, tarjeta, transferencia. |
| [x] | T4 - Catalogo y recetas | Si | Si | Si | CRUD admin con edicion inline, activar/desactivar y eliminacion segura. |
| [x] | T4.1 CRUD productos | Si | Si | Si | Crear/listar/editar/activar/desactivar; elimina solo sin historial. |
| [x] | T4.2 CRUD grupos de modificadores | Si | Si | Si | Crear/listar/editar/activar/desactivar; elimina solo sin historial. |
| [x] | T4.3 CRUD modificadores | Si | Si | Si | Crear/listar/editar/activar/desactivar; elimina solo sin historial. |
| [x] | T4.4 CRUD ingredientes | Si | Si | Si | Crear/listar/editar/activar/desactivar; elimina solo sin dependencias. |
| [x] | T4.5 Editor simple de recetas por producto/modificador | Si | Si | Si | Agrega recetas desde admin. |
| [x] | T5 - Kiosco/POS | Si | Si | Si | Build OK; logica critica unit-tested. |
| [x] | T5.1 Catalogo tactil | Si | Si | Si | Cards tactiles. |
| [x] | T5.2 Constructor de producto con reglas min/max | Si | Si | Si | Validacion cliente y servidor. |
| [x] | T5.3 Carrito editable | Si | Si | Si | Remover items, configurar antes de cobrar y editar items ya agregados. |
| [x] | T5.4 Cobro con efectivo/tarjeta/transferencia | Si | Si | Si | Server action recalcula; submit usa estado nativo y limpia formulario tras venta. |
| [x] | T5.5 Pagos divididos y vuelto | Si | Si | Si | Unit-tested; vuelto recalcula si cambia el carrito tras capturar efectivo. |
| [x] | T5.6 CF por defecto y NIT/nombre opcionales | Si | Si | Si | Upsert customer si NIT no es CF. |
| [x] | T6 - Ordenes y preparacion | Si | Si | Si | Flujo integrado en `/kiosk`. |
| [x] | T6.1 Crear orden pagada | Si | Si | Si | Con transaccion, inventario y redirect unico por orden. |
| [x] | T6.2 Mostrar pedidos activos en `/kiosk` | Si | Si | Si | Estados activos. |
| [x] | T6.3 Cambiar estados pending -> preparing -> delivered | Si | Si | Si | Server action; migracion `20260609120000_update_order_status_enum` alinea enum DB (`PAID`/`READY` -> `PENDING`/`PREPARING`). |
| [x] | T6.4 Cancelar orden con razon y permisos | Si | Si | Si | Cancelacion limitada a sucursal activa; bloquea ordenes cerradas. |
| [x] | T7 - Inventario | Si | Si | Si | Descuento y movimientos. |
| [x] | T7.1 Descontar receta al pagar | Si | Si | Si | Unit-tested resolucion de uso. |
| [x] | T7.2 Registrar movimientos de venta | Si | Si | Si | Tipo SALE. |
| [x] | T7.3 Permitir stock negativo con alerta | Si | Si | Si | Vista marca bajo/negativo. |
| [x] | T7.4 Movimientos manuales de compra, merma y ajuste | Si | Si | Si | Form en inventario; anula movimientos manuales con ajuste inverso. |
| [x] | T7.5 Vista de stock por sucursal | Si | Si | Si | `/admin/inventory`. |
| [x] | T7.6 Inventario bodega central + quiosco por sucursal | Si | Si | Si | Modelo comisariato: una `StockLocation` BODEGA central (branchId null) + un QUIOSCO por sucursal; `LocationInventory` reemplaza `BranchInventory`; `InventoryMovement.locationId` (+ `transferId`) reemplaza `branchId`; nuevo tipo `TRANSFER`. Las ventas consumen el quiosco de la sucursal; compras/merma/ajuste apuntan a una ubicacion; traslados bodega->quiosco (dos piernas con `transferId`, se anulan juntas). Migracion `20260701113536_bodega_quiosco_inventory` conserva el stock actual moviendolo al quiosco de cada sucursal (bodega inicia vacia). UI en `/admin/inventory` con columnas Bodega/Quiosco, selector de ubicacion, formulario de traslado y columna de ubicacion en el historial. 114 tests + build OK; flujo compra->traslado->anular verificado en browser. Pendiente prod: correr `migrate deploy` sobre copia/backup de Supabase antes de produccion (ver spec/plan en `docs/superpowers/`). |
| [x] | T7.7 Anulacion de inventario idempotente | Si | Si | Si | `reverseInventoryMovementAction` ya no doble-revierte al enviar "Anular" dos veces (ni el par de piernas de un `TRANSFER`). Marcadores `InventoryMovement.reversedAt`/`reversedById` (migracion `20260701120000_add_inventory_movement_reversal`, pendiente `migrate deploy`). Logica extraida a `reverseMovementLegsInTransaction` (`src/server/services/inventory.ts`): guarda transaccional `updateMany({ where: { reversedAt: null } })` que solo crea las anulaciones si count>0, segura ante doble submit concurrente. UI muestra un solo "Anular" por grupo de traslado y lo oculta ("Anulado") una vez revertido. Test de doble submit en `inventory.test.ts`. SALE sigue sin ser reversible y se mantiene stock negativo permitido. Rama stacked sobre `feat/bodega-quiosco-inventory`. |
| [x] | T8 - Reportes | Si | Si | Si | Reportes por rango y CSV implementados. |
| [x] | T8.1 Ventas por dia y sucursal | Si | Si | Si | `/admin/reports`. |
| [x] | T8.2 Ventas por metodo de pago | Si | Si | Si | Group by payment. |
| [x] | T8.3 Productos mas vendidos | Si | Si | Si | Group by snapshot. |
| [x] | T8.4 Modificadores/toppings mas usados | Si | Si | Si | Group by snapshot. |
| [x] | T8.5 Exportacion CSV opcional | Si | Si | Si | Exporta ordenes/items/pagos por rango de fechas. |
| [x] | T8.6 Lista de ventas del dia para cuadre con el local | Si | Si | Parcial | `/admin/reports`: tabla cronologica con una fila por venta (No., hora GT, detalle de productos, metodo(s) de pago y total) mas pie con conteo y total para cotejar contra las ventas anotadas en el local. Reusa la query de `orders` (ahora con `include` de items/payments y `orderBy createdAt asc`); helpers de presentacion `describeOrderItems`/`describePaymentMethods` en la pagina. typecheck + lint OK; verificado el estado vacio en browser (sin ordenes en la DB de dev), camino con datos pendiente de QA. |
| [x] | T9 - QA y polish | Si | Si | Si | Tests, lint, typecheck, build y smoke browser tablet pasan. |
| [x] | T9.1 Pruebas unitarias de totales, modificadores e inventario | Si | Si | Si | 6 tests pasan. |
| [x] | T9.2 Pruebas de integracion para crear orden y cerrar caja | Si | Si | Si | Servicios de orden pagada/cierre cubren totales, pagos e inventario negativo. |
| [x] | T9.3 Prueba manual de flujo completo en tablet viewport | Si | Si | Si | Browser smoke 768x1024 verifica redirect a abrir caja y layout tablet. |
| [x] | T9.4 Revision de UI 100% espanol | Si | Si | Si | Enums visibles y etiquetas de ajustes traducidas. |
| [x] | T9.5 Verificacion de que no se puede vender sin caja abierta | Si | Si | Si | `/kiosk` redirige a `/cash/open` sin caja abierta. |
| [x] | T9.6 Suite logica de caos para pagos, sanitizacion y preparacion | Si | Si | Si | 9 tests de dominio; servidor/UI conectados a validaciones puras. |
| [x] | T9.7 Correccion de hidratacion en hora de caja | Si | Si | Si | Reemplaza `toLocaleTimeString` por formateo estable para Guatemala. |
| [x] | T9.8 Rediseño soft UI pastel azul para kiosco | Si | Si | Si | Sidebar, catalogo tactil, chips de personalizacion y panel de cobro/carrito verificados en Chrome headless. |
| [x] | T9.9 Correccion de vuelto e inputs monetarios nulos | Si | Si | Si | Recibido suma efectivo/tarjeta/transferencia; vuelto se recalcula contra efectivo recibido con cada cambio de carrito. Campos de pago usan `--` vacio/cero. |
| [x] | T9.10 Revamp visual pastel durazno | Si | Si | Si | Tokens durazno/mint/lila, tipografias Nunito/Fraunces, shell/login/kiosco y primitives actualizados; lint, typecheck, tests, build y QA browser movil OK. |
| [x] | T9.11 QA persistencia DB y limpieza lint | Si | Si | Si | Marcador de persistencia creado y verificado tras reinicio; lint/typecheck/tests/build OK. |
| [x] | T9.12 Ajustes dentro del shell principal | Si | Si | Si | `/admin/settings` usa `AppShell`; lint, typecheck, tests y `next build` OK. |
| [x] | T9.13 CRUD administrativo global | Si | Si | Si | Sucursales/usuarios con edicion inline y activar/desactivar; helpers unit-tested. |
| [x] | T9.14 Reticula tactil opcional para modificadores | Si | Si | Si | Ajuste global activa tarjetas grandes en kiosco; migracion, Prisma generate, lint/typecheck y QA browser OK. |
| [x] | T9.15 Robustez contra entradas y estados incoherentes | Si | Si | Si | Bloquea modificadores/pagos duplicados, sobrepagos sin efectivo, cantidades imposibles, montos invalidos de caja, estados invalidos y movimientos manuales incoherentes; tests, lint, typecheck y build OK. |
| [~] | T10 - Compatibilidad flujo Excel actual | Parcial | Si | Parcial | Basado en `Control ventas - Infinito .xlsx`. |
| [x] | T10.1 Inspeccionar hojas `Tabla datos` y `Diario ventas` | Si | Si | Si | 2 hojas, 41 columnas historicas y resumen diario. |
| [x] | T10.2 Agregar telefono de cliente a orden/cliente | Si | Si | Si | Campo `customerPhone` en orden y `phone` en cliente. |
| [x] | T10.3 Seed de catalogo empirico del kiosco | Si | Si | Si | Vaso, bases, toppings, extras y accesorios del Excel. |
| [x] | T10.4 Reporte diario estilo Excel | Si | Si | Si | Conteos por metodo y totales por seccion. |
| [ ] | T10.5 Exportacion/importacion historica Excel | No | No | No | Post-launch opcional; no bloquea piloto V1. |
| [x] | T11 - Pilot launch readiness | Si | Si | Si | Objetivo: piloto single-branch; verificado con Postgres local aislado. |
| [x] | T11.1 Permisos administrativos y navegacion por rol | Si | Si | Si | Operador conserva kiosco/caja/preparacion; admin ve back-office/reportes/ajustes. |
| [x] | T11.2 Documentar env, setup y checklist piloto | Si | Si | Si | README actualizado con variables, comandos, backups y rutina diaria. |
| [x] | T11.3 Verificar `next build` con base de datos real | Si | Si | Si | `npm run build` pasa contra Postgres local en `localhost:55432`. |
| [x] | T11.4 Smoke test browser tablet del piloto | Si | Si | Si | Login -> caja -> venta -> preparacion -> cierre -> reporte verificado. |

| [x] | T12 - Documentacion de contexto completo | Si | Si | No | `docs/APP_CONTEXT.md` describe modulos, dominio, rutas, flujos y reglas V1. |
| [x] | T13 - Costos reales, gastos, finanzas y correo (Fase 1) | Si | Si | Si | Basado en `docs/APP_CONTEXT.md`. 49 tests, typecheck, lint y `next build` OK. |
| [x] | T13.1 Snapshot de costo (COGS) en la orden | Si | Si | Si | `OrderItem.unitCostSnapshot`/`lineCostSnapshot` y `Order.costOfGoodsTotal`/`grossProfit`; `domain/costing.ts` puro; persistido en la transaccion de venta; usa `Ingredient.costPerUnit`. |
| [x] | T13.2 Modulo de gastos (OPEX) | Si | Si | Si | `Expense`/`RecurringExpense`; `domain/expenses.ts` (validacion, expansion recurrente al vuelo, suma por categoria); `/admin/expenses`. |
| [x] | T13.3 Modulo financiero | Si | Si | Si | `domain/finance.ts` (P&L puro) + `server/reports/finance.ts`; `/admin/finance` con UB/UN, margenes y rentabilidad por producto. |
| [~] | T13.4 Correo diario al cerrar caja | Si | Si | Parcial | `services/notifications.ts` build/render unit-tested + `EmailLog` idempotente; enganchado en cierre de caja. Envio es stub (console.log); falta integrar proveedor (Resend/SMTP). |
| [~] | T14 - Go-live piloto → prod | Parcial | Si | Parcial | `docs/GO_LIVE_CHECKLIST.md` (P0/P1/P2/P3); QA en `docs/qa/`; E2E 58/70. Gate A/B/C pendientes de ejecucion. |
| [x] | T14 - Remediacion auditoria E2E (E-001..E-012) | Si | Si | Si | Ver `docs/qa/e2e-audit-2026-06-09.md`. A11y: `aria-label` empresa en sidebar colapsado y `aria-label` en botones de modificador. Tests: labels `Pendiente`, ciclo `PENDING->PREPARING->DELIVERED`, asserts por `input[value]`/`toHaveValue`, scope a `main`, delta de caja. Docs `APP_CONTEXT.md` sincronizados. Migracion `OrderStatus` aplicada (`migrate status` OK). |
| [x] | T14.1 Limpieza y consolidacion de docs | Si | Si | No | `docs/README.md` indice; `docs/qa/` (E2E snapshot, open-issues, security); redirects legacy; matriz caos en APP_CONTEXT §14; `.docx` ventas fuera de git; `QA_CHAOS_TESTS.md` eliminado. `GO_LIVE_CHECKLIST.md` no tocado (agentes activos). |
| [x] | T14.2 Regla agentes — checklist discipline | Si | Si | No | `AGENTS.md` + `.cursor/rules/checklist-discipline.mdc` (alwaysApply): consultar checklists relevantes al inicio; actualizar al cerrar items. |
| [x] | T15 Metodo de pago Delivery (Pedidos Ya) | Si | Si | Parcial | Nuevo valor `PaymentMethod.DELIVERY` (migracion `20260616120000_add_delivery_payment_method`, pendiente de `migrate deploy` en cada entorno). Switch "Pedido por delivery" en kiosco: registra todo el total como Delivery con la plataforma en `Payment.reference` (default "Pedidos Ya"); oculta efectivo/tarjeta/transferencia. **No descuadra caja**: `calculateCashSessionSummary` solo cuenta `CASH`, asi que Delivery no entra al efectivo esperado. Categoria separada en cierre de caja, reportes (finance, empirico, export CSV) y resumen diario. Unit tests dominio + notifications OK (typecheck/lint/test verdes). Falta E2E del flujo delivery. |
| [x] | T16 Sidebar tablet-ready (menu hamburguesa) | Si | Si | Si | `app-sidebar.tsx`: el rail `lg` se expandia solo con hover (inservible en tablets tactiles). Se detecta capacidad con `matchMedia("(hover: hover) and (pointer: fine)")`: en escritorio se conserva el hover sin cambios; en tactiles se muestra boton hamburguesa que fija el panel abierto (`pinned`), con scrim `Cerrar menu` tap-to-close y autocierre al navegar (onClick en links + logo). Verificado en Chrome headless 1194x834 tactil: colapsado 88px, abierto 256px, scrim cierra. typecheck + lint OK. |
| [x] | T17 Layout tablet del kiosco (cobro fijo, tarjetas cuadradas, sidebar ocultable) | Si | Si | Parcial | `kiosk-client.tsx`: panel de "cobro total" fijo a la derecha desde `md` (768px) con ancho responsivo (`md` 300-340px / `lg` 360px / `xl` 400px) y sticky desde `lg`; tarjetas de catalogo `aspect-square` (1:1). `app-sidebar.tsx` + `globals.css`: en tactil el sidebar pasa a overlay (drawer que sale fuera de pantalla con `lg:-translate-x-[140%]`) lanzado por un boton hamburguesa flotante (`Abrir menu`), y `.app-main` ya no reserva los 7.5rem del rail salvo en escritorio (`(hover: hover) and (pointer: fine)`), de modo que el contenido usa todo el ancho. typecheck + lint + 99 unit tests OK; HTML SSR de `/kiosk` y CSS compilado verificados (markers de grid/sticky/aspect-square y media queries de `.app-main`). Falta QA visual con browser tactil (descarga de Chromium bloqueada en el entorno). |
| [x] | T18 Logica de menu del instructivo (clasicas + gourmet + extras globales) | Si | Si | Parcial | Aplica el `Instructivo_menu_.pdf`. **Esquema**: `Product.category` y `ModifierGroup.isGlobal` + `productId` nullable (migracion `20260618120000_menu_categories_global_modifier_groups`, pendiente `migrate deploy` por entorno). **Query** `listSellableProducts`: fusiona los grupos globales (`isGlobal`) en cada producto, primero los propios y luego los extras. **Kiosco**: catalogo seccionado por categoria (Fresas Clasicas / Fresas Gourmet). **Admin** `catalog`: campo categoria en producto, opcion "(Global)" al crear grupo y seccion "Extras globales" reutilizable. **Seed** `seed-infinito.ts` reescrito al menu nuevo: 3 clasicas (Q36/Q39/Q39) con grupo requerido "Topping de cortesia" (8 toppings gratis, max 1); 5 gourmet (Ferrero/Raffaello/Lotus Q55, Oreo Q50, Parfait Q45 con miel gratis opcional); 1 lista global "Extras" (8 toppings +Q6, crema clasica +Q15, chocolate +Q20, cremas gourmet +Q25). Costos reusan ingredientes existentes; nuevos (Marshmallow/Kataifi/Granola/Miel/Crema Ferrero) con costo placeholder `REVISAR costo` y gramajes estimados. Reglas: cada extra una sola vez (sin cantidad por extra). typecheck + lint + 102 unit tests OK (3 nuevos de menu en `cart.test.ts`). Falta `migrate deploy`/`db:seed:infinito` y QA en browser (sin DB en el entorno). |
| [x] | T20 Entorno de dev local reproducible (Docker DB + QA en browser) | Si | Si | Si | `docker-compose.yml` (Postgres 16 en puerto host **5433** para no chocar con el Postgres nativo en 5432) + scripts npm `db:up`/`db:down`/`db:reset`/`dev:setup`. `.env`/`.env.local` (gitignored) apuntan a `localhost:5433/koi_pos`. `dev:setup` = up + `migrate deploy` (9 migraciones) + `db:seed` (admin `admin@koi.local`/`admin12345` + sucursal CENTRO) + `db:seed:infinito` (8 productos: 3 clasicas + 5 gourmet). `docs/DEV_LOCAL.md` documenta el flujo; `.claude/launch.json` para el preview MCP. QA en vivo del T19 hecho en este entorno (1194x834): gourmet `+/-` agrega/incrementa/decrementa directo (Ferrero 1->2->1, total Q55/Q110/Q55); clasica `+` abre el personalizador con "Topping de cortesia" sin meter linea invalida. Prod (`.env.production.local`) intacto. |
| [x] | T22 Personalizador como pop-up modal por vaso (no menu inferior) | Si | Si | Si | El panel "Personalizar" deja de ser un menu inferior y pasa a un **modal centrado** que se abre al tocar la tarjeta o el `+`, para que los toppings no se mezclen entre vasos. Nuevo primitive `src/components/ui/dialog.tsx` (wrapper sobre `@radix-ui/react-dialog` ya instalado: focus-trap, ESC, scroll-lock, backdrop). `kiosk-client.tsx`: estado `customizeOpen`; `openCustomizeForProduct` (tarjeta + `+`) abre con estado limpio; `startEditingItem` (lapiz del carrito) abre en modo edicion; `saveItem`/`closeCustomize`/ESC/backdrop cierran; el reset post-venta tambien. Decisiones del usuario: el modal abre **siempre** (todo producto), cada confirmacion es **linea separada** (sin fusionar), y el `-` de la tarjeta **sigue quitando al instante** sin modal. Se eliminaron `quickAddProduct`/`productRequiresChoice` (el `+` ahora abre el modal). El topping requerido sigue bloqueando "Agregar" via `validateModifierSelections`. **E2E**: la tarjeta sigue siendo `div role=button` (selectores `getByRole`+`.first()` intactos); el test "souffle" cierra el modal con ESC entre dos productos. **Drift de catalogo detectado y corregido en los helpers E2E** (no causado por este cambio): el menu actual exige elegir **Chocolate (Blanco/Oscuro, gratis)** en TODOS los productos (ademas del topping de cortesia en clasicas); se actualizaron `selectProduct`/`pickClasica`/`sellClasica`/inline (kiosk, foolproofing, full-audit, tablet-smoke, edge-cases-p2) para elegir Chocolate. Spec: `docs/superpowers/specs/2026-06-28-kiosk-customize-modal-design.md`. typecheck + lint + **108 unit + 33 E2E** (kiosk+foolproofing+tablet-smoke) verdes; QA visual del modal en browser (1194x834). |
| [x] | T19 Stepper +/- en tarjetas del catalogo (acceso rapido tablet) | Si | Si | Si | `kiosk-client.tsx`: cada tarjeta muestra un stepper junto al precio. Con 0 unidades solo el boton `+`; con unidades en carrito aparece `[-] cantidad [+]` (cuenta = total del producto en el carrito). **Gourmet (sin grupo requerido)**: `+`/`-` agregan/quitan una linea simple (sin extras, sin notas) sin abrir el personalizador. **Clasicas (topping de cortesia obligatorio)**: `+` abre el personalizador para elegir el topping (una linea vacia la rechazaria `validateModifierSelections` en `orders.ts`); `-` descuenta la ultima linea del producto. La tarjeta paso de `<button>` a `<div role="button">` (tabIndex/aria-pressed/onKeyDown Enter-Space) para anidar los botones reales del stepper sin HTML invalido; labels `Sumar/Quitar uno de <producto>` no chocan con el boton `Agregar` ni con selectores E2E (todos los clics de producto usan `.first()`). Topes `MAX_ITEM_QUANTITY`/`MAX_CART_LINES` respetados. typecheck + lint + 106 unit tests OK. **QA visual en browser OK** (entorno local T20, 1194x834): gourmet agrega/incrementa/decrementa directo; clasica abre personalizador. |
| [x] | T21 Precio de delivery por producto y por extra (auto al activar el switch) | Si | Si | Parcial | Cada producto y cada extra tienen ahora **dos precios independientes**: local y delivery. **Esquema**: `Product.deliveryPrice` y `Modifier.deliveryPriceDelta` (`Decimal(12,2)`, NOT NULL) — migracion `20260628120000_add_delivery_prices` (add nullable -> backfill `= basePrice`/`= priceDelta` -> set NOT NULL; **pendiente `migrate deploy` por entorno**). **Dominio** (`cart.ts`, fuente unica): `resolveProductUnitPrice`/`resolveModifierDelta` eligen precio segun canal; `calculateCartItemTotal(..., isDelivery)`. **Backend** (`orders.ts`): `preparePaidOrder` deriva `isDelivery = payments.some(DELIVERY)`, recalcula totales y **congela los snapshots** (`basePriceSnapshot`/`priceDeltaSnapshot`) al precio de delivery; no se confia en el total del cliente. **Kiosco**: al activar el switch "Pedido por delivery", las tarjetas, los chips de extras y el carrito muestran/cobran precios de delivery automaticamente. **Admin** `catalog`: campos "Precio local" + "Precio delivery" en producto y "Extra local" + "Extra delivery" en modificador (si se deja vacio arranca igual al local). **Query** `listSellableProducts` expone ambos. **Seed**: `seed-infinito.ts` extras con delivery (toppings Q6, Pistacho Q8, chocolates Q20, crema clasica Q15, cremas gourmet Q25); `deliveryPrice` de producto pendiente de cargar (default = local). typecheck + lint + 108 unit tests OK (nuevos casos delivery en `cart.test.ts` y `orders.test.ts`). Falta `migrate deploy`, precios de delivery reales por producto y QA en browser. |
| [x] | T23 Opcion "Sin topping" para declinar el topping de cortesia | Si | Si | Si | Las 3 clasicas con grupo requerido "Topping de cortesia" (`Fresas con Crema`, `Fresas con Chocolate con Leche`, `Fresas con Chocolate Blanco`) ya permiten declinar el topping gratis. **Solo data**: en `seed-infinito.ts` se agrega un modificador `"Sin topping"` (priceDelta 0, **sin receta** -> COGS 0) al final de cada grupo de cortesia. Como el grupo es `maxSelections: 1`, seleccionarlo deselecciona cualquier topping y satisface el requerido (`isRequired`/`min 1`); se registra en la linea (`modifierNameSnapshot: "Sin topping"`) para que cocina lo vea explicito. **Sin cambios** de UI (`kiosk-client.tsx`), dominio/validacion (`cart.ts`), orden (`orders.ts`) ni esquema. Idempotente (`upsertModifier` find-or-update por `(grupo, name)`). QA en browser OK (entorno local T20): "Sin topping" aparece como ultima opcion en "Topping de cortesia"; al elegirla -> "Seleccionado 1 de 1" y "Agregar" pasa de deshabilitado a habilitado; precio se queda en base. 3 filas creadas en dev DB verificadas. Spec: `docs/superpowers/specs/2026-06-28-no-toppings-option-design.md`. Falta `db:seed:infinito` en prod (`ALLOW_PROD_SEED=true`) para que la opcion exista en produccion. |
| [x] | T24 Wizard de toppings por vaso en el stepper interno del modal | Si | Si | Si | El stepper interno del modal de personalizacion (`+`/`-` junto al titulo) compartia un solo set de toppings entre las N unidades de una linea. Ahora cada `+` agrega un vaso vacio y salta el foco a el; con 2+ vasos aparece "Vaso X de N" + "Anterior" para revisar un vaso ya configurado, y el boton principal alterna entre "Siguiente vaso" (valida y avanza) y "Agregar"/"Guardar" (valida y confirma TODO el lote) segun si es el ultimo vaso. Al confirmar, cada vaso se guarda como su propia linea de carrito (cantidad 1) via la nueva funcion pura `buildCupCartItems` (`src/domain/cart.ts`) — sin cambios de esquema, ya que "una linea = un set de modificadores" ya encajaba con este resultado. Productos sin `modifierGroups` mantienen el comportamiento anterior exacto (una linea, cantidad N, sin wizard). El boton `+` de la tarjeta del catalogo (fuera del modal) no cambia — ya abria un modal limpio por vaso. **E2E**: se reescribieron 2 tests de `kiosk.spec.ts` que asumian que subir cantidad no pedia toppings de nuevo, y se agrego un test que verifica 2 lineas con toppings distintos en el mismo modal (usando los toppings reales del catalogo seedeado — "Oreo"/"Lotus" del grupo "Topping de cortesia" — no un grupo "Chocolate" que no existe); `foolproofing.spec.ts` no necesito cambios (verificado que sus tests de `qty-plus`/`qty-minus` no llegan a click en "Agregar"/"Guardar"). Spec: `docs/superpowers/specs/2026-07-01-kiosk-multi-cup-toppings-design.md`. |
| [x] | T25 Aislamiento de datos de prueba (sucursal TESTS) | Si | Si | Si | `Branch.isTest` (migracion `add_branch_is_test`, aditiva). `prisma/seed-tests.ts` crea sucursales TESTS/TESTS2 + cuenta de prueba ADMIN (`qa@koi.local` local; env en prod) asignada SOLO a ellas. Guard `src/lib/test-guard.ts` (unit-tested) bloquea `db:seed`/`db:seed:demo`/E2E contra la DB de prod (host `supabase.com`) salvo `ALLOW_PROD_SEED=true`. `global.setup.ts` entra como la cuenta de prueba y selecciona TESTS, asi todo dato E2E cae en TESTS. CI siembra `db:seed:tests`. Badge "PRUEBAS" en `/admin/branches`. Bootstrap prod pendiente (P1-QA-TESTS). |

## Hallazgos Del Excel Operativo

El archivo `Control ventas - Infinito .xlsx` contiene:

- `Tabla datos`: bitacora historica tipo formulario con timestamp, cantidades por base/topping/extra, forma de pago, NIT, nombre, telefono y notas.
- `Diario ventas`: corte diario por fecha con secciones `VASOS`, `TOPPINGS`, `EXTRA TOPPING`, `EXTRA BASES`, `EXTRAS` y totales por efectivo/tarjeta.

Brechas detectadas contra el POS antes de T10:

- Faltaba telefono del cliente.
- Faltaba catalogo exacto del kiosco actual: `Vaso`, bases `Con leche`, `Blanco`, `Solo Fresa`, `Solo Mango`, `Crema`, toppings/extra toppings, extra bases, tapadera y tenedor.
- El reporte generico no replicaba la lectura mental de `Diario ventas`.
- El POS soporta transferencia adicional; el Excel solo separa efectivo y tarjeta. El reporte nuevo agrega columna transferencia.

## V2 backlog (post Gate C)

Pendiente hasta cerrar go-live y estabilizar `GO_LIVE_CHECKLIST.md`:

| ID | Item | Ref |
| --- | --- | --- |
| V2-DOC-01 | Archivar `GO_LIVE_CHECKLIST.md` → `docs/qa/go-live-checklist-2026.md` | Gate C + checklist estable |
| V2-DOC-02 | Recortar log T0–T14 a resumen + backlog | Tras V2-DOC-01 |
| V2-FEAT-01 | Import/export Excel historico (T10.5) | Post-launch opcional |
| V2-FEAT-02 | Correo diario con proveedor real (T13.4) | Resend/SMTP |
| V2-SEC-01 | AuditLog, rate limit CSV, sesion 4–8 h | `docs/qa/security.md` A1–A3 |
| V2-QA-01 | Ampliar E2E: CRUD admin, viewport tablet | `docs/qa/open-issues.md` |
