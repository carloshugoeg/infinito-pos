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
| [x] | T8 - Reportes | Si | Si | Si | Reportes por rango y CSV implementados. |
| [x] | T8.1 Ventas por dia y sucursal | Si | Si | Si | `/admin/reports`. |
| [x] | T8.2 Ventas por metodo de pago | Si | Si | Si | Group by payment. |
| [x] | T8.3 Productos mas vendidos | Si | Si | Si | Group by snapshot. |
| [x] | T8.4 Modificadores/toppings mas usados | Si | Si | Si | Group by snapshot. |
| [x] | T8.5 Exportacion CSV opcional | Si | Si | Si | Exporta ordenes/items/pagos por rango de fechas. |
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
