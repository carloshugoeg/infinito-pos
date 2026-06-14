# Checklist go-live — Piloto → Producción

Checklist priorizado para cerrar el piloto V1 y declarar Koi POS **listo para producción** en un entorno real (1 negocio, multisucursal).

**Referencias:** `docs/DEPLOY.md` (runbook deploy) · `docs/ERRORES_Y_HALLAZGOS.md` · `docs/E2E_AUDIT_REPORT.md` · `docs/security-audit.md` · `README.md`

**Entorno de producción (provisionado 10 jun 2026)**

| Recurso | Valor |
| --- | --- |
| URL prod | `https://koi-pos.vercel.app` |
| Vercel | proyecto `koi-pos` (team `hugos-projects-3379fa36`), branch prod = `main`, auto-deploy + previews ON |
| Supabase | `koi-pos-prod` · ref `htlcnzlhuqvcovaggzos` · us-east-1 · plan Pro (~$10/mes) |
| Conexión | app vía pooler transacción `:6543` (`?pgbouncer=true`); migraciones vía session pooler `:5432` |
| Admin inicial | `admin@infinitopos.com` (rol ADMIN, sucursal `Pradera`/`SUC-001`) |
| Pendiente seguridad | Desactivar **Data API** en Supabase (capa durable RLS); **rotar** la contraseña de la DB (definida fuera de git) antes de prod real |

**Convención de prioridad**

| Prioridad | Significado | Cuándo |
| --- | --- | --- |
| **P0** | Bloqueante | Antes del **primer día de piloto** en tienda |
| **P1** | Requerido para **prod** | Antes de operar sin supervisión técnica |
| **P2** | Calidad / confianza | Primera o segunda semana de piloto |
| **P3** | Post-prod / V2 | Después de estabilizar operación |

**Estado por ítem:** `[ ]` pendiente · `[~]` en progreso · `[x]` hecho

---

## Resumen de gates

| Gate | Criterio mínimo |
| --- | --- |
| **Gate A — Piloto día 1** | Todos los **P0** en `[x]` + smoke manual tablet OK |
| **Gate B — Piloto estable** | Todos los **P0 + P1** en `[x]` + E2E verde |
| **Gate C — Producción** | **P0 + P1 + P2** críticos en `[x]` + 1 semana sin incidentes P0 |

---

## P0 — Bloqueantes (antes del piloto en tienda)

### Infraestructura y deploy

| Estado | ID | Tarea | Verificación |
| --- | --- | --- | --- |
| `[x]` | P0-INF-01 | PostgreSQL de prod aprovisionado (Supabase) | ✅ Proyecto `koi-pos-prod` (ref `htlcnzlhuqvcovaggzos`, us-east-1) ACTIVE_HEALTHY |
| `[x]` | P0-INF-02 | `DATABASE_URL`, `DIRECT_URL` y `SESSION_SECRET` configurados en prod (nunca en git) | ✅ 3 vars en Vercel `koi-pos` (Production, encriptadas) vía pooler aws-1-us-east-1 |
| `[x]` | P0-INF-03 | `SESSION_SECRET` ≥ 32 caracteres aleatorios, único por entorno | ✅ 48 chars (`openssl rand -base64 36`) seteado en Vercel Production |
| `[x]` | P0-INF-04 | Ejecutar `npm run db:deploy` (`prisma migrate deploy`) en prod | ✅ 5 migraciones aplicadas; enum `OrderStatus` = `PENDING,PREPARING,DELIVERED,CANCELLED` |
| `[x]` | P0-INF-05 | **No** ejecutar `npm run db:seed` en prod con credenciales demo | ✅ DB fresca (0 demo); admin real vía `db:seed:admin` (sin `admin@koi.local`) |
| `[x]` | P0-INF-06 | `npm run build` exitoso contra DB de prod | ✅ Deploy READY (build 30s) en `koi-pos.vercel.app` |
| `[~]` | P0-INF-07 | Backups automáticos de PostgreSQL activos + restore probado una vez | Backups diarios incluidos en plan Pro; **restore de prueba pendiente** (manual, runbook §7) |
| `[x]` | P0-INF-08 | HTTPS activo; cookie `secure` en prod | ✅ HTTPS+HSTS; login real seteó `koi_session ... Secure; HttpOnly; SameSite=lax` |

> **Nota:** la parte de repo/código (enforcement de `SESSION_SECRET`, guard del seed, migración
> enum commiteada, script `db:deploy`, `directUrl` en el datasource) está hecha. La ejecución
> ops en prod (Supabase + Vercel) se completa siguiendo `docs/DEPLOY.md`; cada ítem `[ ]`/`[~]`
> pasa a `[x]` al verificar el paso correspondiente del runbook.

### Seguridad (hallazgos críticos)

| Estado | ID | Tarea | Ref | Verificación |
| --- | --- | --- | --- | --- |
| `[x]` | P0-SEC-01 | `SESSION_SECRET` obligatorio: fallar si falta (sin fallback dev) | C1 | App no arranca sin env (`session.ts` lanza error; sin fallback) |
| `[x]` | P0-SEC-02 | Quitar `defaultValue` de email/password en `/login` | C2 | ✅ Quitado en `/login` y `/admin/users`; verificado en HTML de prod (sin credenciales) |
| `[x]` | P0-SEC-03 | Seed no resetea admin en prod (`NODE_ENV` guard) | C3 | Guard en `seed.ts` lanza antes de escribir si `NODE_ENV=production` |
| `[x]` | P0-SEC-04 | Crear usuario admin real con password fuerte | — | ✅ `admin@infinitopos.com` creado vía `db:seed:admin`; login real OK |
| `[x]` | P0-SEC-05 | Desactivar o eliminar `admin@koi.local` en prod | C3 | ✅ Nunca creado (DB fresca, sin seed demo); login demo falla |
| `[ ]` | P0-SEC-06 | Crear usuario(s) OPERATOR para caja; sin rol admin innecesario | E-003 | OPERATOR no accede `/admin` — **pendiente (Stream C, vía UI)** |
| `[x]` | P0-SEC-07 | **(Supabase) Cerrar Data API pública**: `anon` no debe leer tablas (`User.passwordHash`) | NUEVO | ✅ RLS habilitado + grants revocados a `anon`/`authenticated` → REST anon da 401. **Pendiente owner:** desactivar Data API en dashboard (capa durable) |

### Datos y configuración del negocio

| Estado | ID | Tarea | Verificación |
| --- | --- | --- | --- |
| `[x]` | P0-DATA-01 | Sucursal(es) reales creadas con código único | ✅ Sucursal `Pradera` (`SUC-001`) creada en bootstrap; agregar más en `/admin/branches` |
| `[ ]` | P0-DATA-02 | Catálogo real cargado (productos, grupos, modificadores, precios) | Venta de prueba con precios correctos |
| `[ ]` | P0-DATA-03 | Recetas vinculadas a productos/modificadores | Inventario descuenta al cobrar |
| `[ ]` | P0-DATA-04 | Ingredientes con `costPerUnit` para COGS/finanzas | `/admin/finance` muestra COGS > 0 tras venta |
| `[ ]` | P0-DATA-05 | Inventario inicial por sucursal | `/admin/inventory` stock coherente |
| `[ ]` | P0-DATA-06 | Ajustes: nombre empresa, moneda `Q`, retícula si usan tablet | Sidebar / kiosco visual OK |
| `[ ]` | P0-DATA-07 | Asignar usuarios a sucursales correctas | Operador solo ve su sucursal |

### Smoke manual en tablet (Gate A)

Ejecutar **una vez en el dispositivo real** (768×1024 o el tablet del piloto):

| Estado | ID | Paso | Verificación |
| --- | --- | --- | --- |
| `[ ]` | P0-SMOKE-01 | Login con usuario real | Entra sin error |
| `[ ]` | P0-SMOKE-02 | Abrir caja con monto inicial | Redirect a `/kiosk`, "Caja abierta" visible |
| `[ ]` | P0-SMOKE-03 | Venta: producto + modificador obligatorio + cobro efectivo | Carrito vacío; orden en panel |
| `[ ]` | P0-SMOKE-04 | Estado **Pendiente** → **Preparar** → **Preparando** → **Entregar** | Orden desaparece de activos |
| `[ ]` | P0-SMOKE-05 | Segunda venta con tarjeta o transferencia | Totales y cierre coherentes |
| `[ ]` | P0-SMOKE-06 | Cerrar caja con conteo físico | Redirect a abrir caja; resumen cuadra |
| `[ ]` | P0-SMOKE-07 | Admin: reporte del día + descargar CSV | Archivo CSV abre en Excel/Sheets |
| `[ ]` | P0-SMOKE-08 | `/kiosk` sin caja abierta redirige a `/cash/open` | Guard de caja OK |

---

## P1 — Requerido para producción (sin supervisión técnica)

### Calidad y regresiones

| Estado | ID | Tarea | Ref | Verificación |
| --- | --- | --- | --- | --- |
| `[x]` | P1-QA-01 | Actualizar `e2e/kiosk.spec.ts`: "Pagado" → "Pendiente" | E-004 | Verificado 2026-06-10: 70/70 e2e verdes |
| `[x]` | P1-QA-02 | Actualizar ciclo de estados: quitar READY/"Listo"; usar Preparar→Entregar | E-005 | Verificado 2026-06-10: ciclo PENDING→PREPARING→DELIVERED |
| `[x]` | P1-QA-03 | Corregir aserciones admin en `full-audit.spec.ts` (`toHaveValue` en inputs) | E-002, E-006, E-007 | Verificado 2026-06-10: `full-audit.spec` verde |
| `[x]` | P1-QA-04 | Aislar sesión de caja entre tests E2E | E-008 | Test de persistencia de sesión (`auth.spec.ts`) ya no fija ruta exacta (carrera /kiosk→/cash/open); kiosk usa `ensureCashOpen`/`cancelAllOrders` en beforeEach. Suite 67/67 estable en DB fresca/CI |
| `[x]` | P1-QA-05 | Suite completa verde: `npm test && npm run typecheck && npm run lint && npm run test:e2e && npm run build` | — | unit/typecheck/lint/build verdes; **e2e 67/67** contra DB fresca 2026-06-13 (correr contra DB dedicada, no `koi_pos`: el seed upsert arrastra grupos obsoletos). Lo gatea CI (P1-QA-08) |
| `[x]` | P1-QA-06 | Playwright viewport tablet `768×1024` en config o proyecto dedicado | GAP | `e2e/tablet-smoke.spec.ts` (`test.use` viewport 768×1024); smoke de venta efectivo verde 2026-06-13 |
| `[x]` | P1-QA-07 | Verificar permisos OPERATOR end-to-end (crear user → login → bloqueo admin) | E-003 | Cubierto por `full-audit.spec.ts` ("crear operador → login → bloqueado en /admin"); verde 2026-06-13 |
| `[x]` | P1-QA-08 | CI en GitHub Actions: lint/typecheck/test/build + e2e (Postgres efímero, ambos seeds) | NUEVO | `.github/workflows/ci.yml` en push/PR; ambos jobs bloquean. DB fresca evita el estado sucio de dev; e2e 67/67 |

### Seguridad alta

| Estado | ID | Tarea | Ref | Verificación |
| --- | --- | --- | --- | --- |
| `[x]` | P1-SEC-01 | Reducir sesión a 4–8 h o documentar política de 14 h | A1 | TTL configurable vía `SESSION_TTL_HOURS` (default 12 h, acotado 1–24 h); `getSessionTtlMs` con unit test; documentado en `.env.example` |
| `[x]` | P1-SEC-02 | Rate limit en `GET /admin/reports/export` (ej. 10/min) | A3 | 10/min por usuario en el route → 429 con `Retry-After`; `createRateLimiter` con unit test |
| `[x]` | P1-SEC-03 | Límite de rango CSV (ej. máx. 31 días) | A3 | `reportRangeDays` > 31 → 400; unit test del límite |
| `[x]` | P1-SEC-04 | Revisar que `.env` / secretos no estén en repo ni logs Vercel públicos | — | Auditado 2026-06-13: solo `.env.example` trackeado; `.env`/`.env*.local` en .gitignore; sin secretos en fuente ni en historial git. **Pendiente owner:** rotar password DB (compartido en chat) |
| `[x]` | P1-SEC-05 | Cabeceras de seguridad base (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) | NUEVO | En `next.config.ts`; verificado en runtime sobre `/login`. CSP estricta queda pendiente (CSS de marca inline) |

### Funcionalidad admin no auditada

Verificar manualmente o con E2E ampliado:

| Estado | ID | Tarea | Verificación |
| --- | --- | --- | --- |
| `[ ]` | P1-FUNC-01 | CRUD sucursal: crear, editar, desactivar | Operación en staging |
| `[ ]` | P1-FUNC-02 | CRUD usuario: crear operador, editar, cambiar password, desactivar | Re-login con password nueva |
| `[ ]` | P1-FUNC-03 | CRUD catálogo: grupo, modificador, receta; desactivar con historial | Producto inactivo no en kiosco |
| `[ ]` | P1-FUNC-04 | Inventario: compra, merma, ajuste, **anular** movimiento manual | Stock revierte correctamente |
| `[ ]` | P1-FUNC-05 | Gastos: registrar, eliminar, filtro por categoría/fecha | Finanzas refleja cambio |
| `[ ]` | P1-FUNC-06 | Finanzas: filtro por rango de fechas | P&L cambia con filtro |
| `[ ]` | P1-FUNC-07 | Validar contenido CSV (columnas, montos, teléfono) | Spot-check vs orden en DB |
| `[ ]` | P1-FUNC-08 | Multi-sucursal: usuario con 2 branches → selector funciona | Cambio de sucursal OK |

### UX / bugs conocidos

| Estado | ID | Tarea | Ref | Verificación |
| --- | --- | --- | --- | --- |
| `[x]` | P1-UX-01 | Sidebar: mostrar nombre empresa cuando está colapsado (`title` / tooltip) | E-009 | Ya implementado: logo con `title`+`aria-label={companyName}` (app-sidebar.tsx:54); cubierto por full-audit.spec |
| `[x]` | P1-UX-02 | Modificadores en retícula: `aria-label` con nombre completo | E-012 | Ya implementado: `aria-label={modifier.name}` por tile (kiosk-client.tsx:260) |
| `[ ]` | P1-UX-03 | Probar retícula on/off en tablet real del piloto | — | Selección táctil cómoda — **pendiente (tablet físico)** |

### Documentación operativa

| Estado | ID | Tarea | Ref | Verificación |
| --- | --- | --- | --- | --- |
| `[x]` | P1-DOC-01 | Actualizar `README.md` checklist diario: Pendiente→Preparar→Entregar | E-010 | Hecho 2026-06-10: README sin "listo"/"pagado" |
| `[x]` | P1-DOC-02 | Actualizar `docs/APP_CONTEXT.md`: estados, gastos/finanzas en alcance V1 | E-010 | Agregados módulos Gastos (6.9) y Finanzas (6.10), rutas/nav, TTL sesión 12 h, ref RUNBOOK |
| `[x]` | P1-DOC-03 | Runbook de incidentes: DB caída, sesión expirada, caja no abre | — | `docs/RUNBOOK.md` (DB caída, login/sesión, caja, 500, inventario negativo). Falta rellenar contacto soporte (P1-OPS-04) |
| `[ ]` | P1-DOC-04 | Credenciales y URLs de prod solo en canal seguro (no WhatsApp público) | — | — |

### Operación y monitoreo

| Estado | ID | Tarea | Verificación |
| --- | --- | --- | --- |
| `[ ]` | P1-OPS-01 | Dominio/custom URL configurado (si aplica) | HTTPS válido |
| `[ ]` | P1-OPS-02 | Acceso a logs de deploy (Vercel/hosting) | Error 500 investigable |
| `[x]` | P1-OPS-03 | Procedimiento de rollback documentado (deploy anterior + DB) | `docs/RUNBOOK.md` Parte 1 (Vercel Instant Rollback/promote + restore Supabase + migración inversa). Falta simularlo una vez |
| `[ ]` | P1-OPS-04 | Contacto de soporte técnico primeras 2 semanas definido | — |
| `[ ]` | P1-OPS-05 | Plan de ventana de mantenimiento (migraciones fuera de horario pico) | — |

---

## P2 — Calidad y confianza (primera semana de piloto)

### Producto y negocio

| Estado | ID | Tarea | Ref | Notas |
| --- | --- | --- | --- | --- |
| `[ ]` | P2-PROD-01 | Decidir si correo diario es requerido en prod | T13.4 | Si sí → integrar Resend/SMTP; si no → documentar omisión |
| `[ ]` | P2-PROD-02 | Capacitar operadores: flujo caja + kiosco + cancelar orden | — | 30 min presencial |
| `[ ]` | P2-PROD-03 | Capacitar admin: inventario, gastos, reportes, finanzas | — | 1 h |
| `[ ]` | P2-PROD-04 | Conciliar primer cierre de caja con Excel/contabilidad manual | T10 | Diferencias documentadas |
| `[ ]` | P2-PROD-05 | Revisar stock negativo tras 3–5 días de venta | — | Compras/mermas registradas |

### Seguridad y auditoría

| Estado | ID | Tarea | Ref | Esfuerzo |
| --- | --- | --- | --- | --- |
| `[ ]` | P2-SEC-01 | Tabla `AuditLog` para acciones admin críticas | A2 | 2–4 h |
| `[ ]` | P2-SEC-02 | Re-auditar `docs/security-audit.md` tras fixes C1–C3 | — | Checklist C/A cerrados |

### Tests y edge cases

| Estado | ID | Tarea | Verificación |
| --- | --- | --- | --- |
| `[x]` | P2-QA-01 | Límite 60 líneas carrito | Unit test en `cart.test.ts` (`validateCheckout` rechaza >60). La UI no puede expresar el caso 1-a-1 → guarda de dominio |
| `[x]` | P2-QA-02 | Pago duplicado mismo método | Ya cubierto en `cart.test.ts` (`validatePayments` → "Usa un solo registro por metodo de pago"). La UI tiene un input por método |
| `[x]` | P2-QA-03 | E2E: cancelar orden y verificar excluida de reportes | `e2e/edge-cases-p2.spec.ts`: orden con cliente único ausente del CSV tras cancelar |
| `[x]` | P2-QA-04 | E2E: venta con stock insuficiente (negativo permitido) | `e2e/edge-cases-p2.spec.ts`: venta deja stock negativo + alerta "Bajo/negativo" en `/admin/inventory` |
| `[x]` | P2-QA-05 | Prueba de carga ligera: 10 ventas seguidas sin error | `e2e/edge-cases-p2.spec.ts`: 10 ventas → 10 órdenes, sin duplicados ni 500 |

### Escalabilidad (solo si multisucursal activo en piloto)

| Estado | ID | Tarea | Ref |
| --- | --- | --- | --- |
| `[ ]` | P2-SCALE-01 | Validar aislamiento: orden/inventario/caja no cruzan `branchId` | E1 |
| `[ ]` | P2-SCALE-02 | Dos tablets en misma sucursal simultáneas | Sin conflicto de caja |

---

## P3 — Post-prod / fuera de V1 (no bloquean Gate C)

Explícitamente **fuera de alcance V1** según `AGENTS.md` y plan de implementación:

| Estado | ID | Tarea | Notas |
| --- | --- | --- | --- |
| `[ ]` | P3-01 | Integración FEL real | Placeholders existen |
| `[ ]` | P3-02 | Import/export Excel histórico | T10.5 |
| `[ ]` | P3-03 | Multi-tenancy / `business_id` | Visión futura |
| `[ ]` | P3-04 | KDS separado | Preparación vive en `/kiosk` |
| `[ ]` | P3-05 | PostgreSQL Row-Level Security | E1 mediano plazo |
| `[ ]` | P3-06 | API REST pública | Server Actions hoy |
| `[ ]` | P3-07 | Caché de sesión / Redis | E2 |
| `[ ]` | P3-08 | Heatmaps / analytics avanzados | PRD futuro |

---

## Matriz de trazabilidad (hallazgo → ítem checklist)

| Hallazgo | Ítems checklist |
| --- | --- |
| E-011 enum OrderStatus | P0-INF-04 |
| C1 SESSION_SECRET | P0-INF-03, P0-SEC-01 |
| C2 login defaultValue | P0-SEC-02 |
| C3 seed admin | P0-INF-05, P0-SEC-03, P0-SEC-05 |
| E-003 OPERATOR | P0-SEC-06, P1-QA-07 |
| E-004 Pagado | P1-QA-01 |
| E-005 READY/Listo | P1-QA-02, P0-SMOKE-04, P1-DOC-01 |
| E-009 sidebar nombre | P1-UX-01 |
| E-012 retícula Crema | P1-UX-02, P1-UX-03 |
| A1 sesión 14h | P1-SEC-01 |
| A2 audit log | P2-SEC-01 |
| A3 CSV export | P1-SEC-02, P1-SEC-03 |
| T13.4 correo stub | P2-PROD-01 |

---

## Orden de ejecución recomendado

### Semana pre-piloto (3–5 días)

1. **P0-INF** (deploy, migrate, backups, build)
2. **P0-SEC** (C1, C2, C3, usuarios reales)
3. **P0-DATA** (catálogo, recetas, inventario, ajustes)
4. **P0-SMOKE** en tablet real
5. Paralelo: **P1-QA-01/02** (desbloquear CI)

### Día 0 piloto

- Gate A completo
- Soporte técnico on-call
- No deploys salvo hotfix P0

### Semana 1 piloto

- **P1-FUNC**, **P1-UX**, **P1-DOC**, **P1-OPS**
- **P2-PROD** capacitación y conciliación
- Cierre Gate B al final de semana

### Semana 2+ 

- **P2** restante
- Gate C tras 7 días sin incidentes P0
- Evaluar **P3** según feedback del negocio

---

## Definición de "listo para prod" (Gate C)

Se puede declarar **producción** cuando se cumplan **todas** estas condiciones:

1. **100% P0** y **100% P1** marcados `[x]`
2. **P1-QA-05** verde (tests + build)
3. **P0-SMOKE** repetido en tablet de prod post-deploy
4. **P2-PROD-04** primer cierre conciliado con contabilidad real
5. **P2-SEC-02** re-auditoría sin hallazgos Críticos abiertos
6. **7 días** de operación sin incidentes clasificados P0
7. Backups verificados al menos una vez en el periodo
8. Operadores capacitados y runbook entregado

---

## Registro de cierre (rellenar al go-live)

| Campo | Valor |
| --- | --- |
| Fecha Gate A (piloto día 1) | |
| Fecha Gate B | |
| Fecha Gate C (prod) | |
| Entorno prod URL | |
| Responsable técnico | |
| Responsable negocio | |
| P0 completados | /18 |
| P1 completados | /35 |
| Incidentes P0 en semana 1 | |
| Notas | |

---

*Generado a partir de auditoría E2E (9 jun 2026) y `docs/security-audit.md`. Actualizar este archivo al cerrar cada ítem.*
