# Issues abiertos — QA Koi POS V1

**Última actualización:** jun 2026  
**Auditoría E2E:** 9 jun 2026 — ver [`e2e-audit-2026-06-09.md`](e2e-audit-2026-06-09.md)  
**Seguridad:** ver [`security.md`](security.md)

Los IDs E-001..E-012 de la auditoría E2E quedaron **resueltos** (tests, UX, docs, migración enum). Este documento lista solo lo que sigue pendiente.

---

## Seguridad y escalabilidad (post-P0)

| ID | Título | Prioridad | Notas |
| --- | --- | --- | --- |
| A1 | Sesión 14 h sin refresh / timeout inactividad | Alto | V2 — reducir a 4–8 h |
| A2 | Sin tabla `AuditLog` para acciones admin | Alto | V2 |
| A3 | Sin rate limiting en export CSV | Alto | P2 en go-live checklist |
| E1 | Aislamiento sucursal solo en app (sin RLS Postgres) | Medio | V2 |
| E2 | `requireUser()` consulta DB en cada page load | Bajo | Evaluar caché TTL corto |
| E3 | Sin middleware centralizado de auth | Bajo | V2 |

Detalle en [`security.md`](security.md).

---

## Gaps de cobertura E2E (no verificados en browser)

| Área | Funciones sin E2E |
| --- | --- |
| Catálogo admin | CRUD grupos, modificadores, recetas; activar/desactivar/eliminar |
| Ingredientes | Editar, desactivar, eliminar |
| Inventario | Anular movimiento manual; alertas stock bajo/negativo en UI |
| Sucursales | Activar/desactivar/eliminar |
| Usuarios | Editar, desactivar, cambiar contraseña |
| Gastos | Eliminar gasto; filtros por categoría/fecha |
| Reportes | Validar contenido del CSV exportado |
| Finanzas | Filtro por rango de fechas |
| Ajustes | Colores, símbolo moneda, logo |
| Kiosco | Límite 60 líneas; sobrepago; pago duplicado mismo método |
| Permisos | Usuario multi-sucursal (2+ branches) |
| Integraciones | FEL real, correo diario (stub), import/export Excel |
| Viewport | Tablet 768×1024 (Playwright usa Desktop Chrome por defecto) |

---

## Reproducir auditoría

```bash
npx playwright install chromium
npm run test:e2e -- --reporter=list
npm run test:e2e -- e2e/full-audit.spec.ts --reporter=list
```
