# Auditoría de seguridad — Koi POS V1

**Auditoría original:** 2026-05-21  
**Última revisión:** jun 2026  
**Stack:** Next.js 16, React 19, Prisma 6, PostgreSQL, TypeScript 5.9

---

## Resumen

Postura **aceptable para piloto** tras remediar hallazgos críticos P0. Rutas protegidas, bcrypt (10 rondas), cookies `httpOnly`/`secure`, recálculo server-side de totales y Server Actions para mutaciones.

---

## Remediado (P0 — antes de prod)

| ID | Hallazgo | Estado | Verificación |
| --- | --- | --- | --- |
| C1 | Fallback hardcodeado en `SESSION_SECRET` | **Resuelto** | `session.ts` lanza error si falta env |
| C2 | Credenciales demo en `defaultValue` del login | **Resuelto** | Login sin `defaultValue`; credenciales solo en README local |
| C3 | Seed resetea admin en prod | **Resuelto** | Guard `NODE_ENV=production` en `seed.ts` |

---

## Pendiente (P1 / V2)

### A1 — Sesión de 14 horas sin refresh

**Archivo:** `src/lib/session.ts`  
Sesión válida 14 h sin renovación ni timeout por inactividad. Para POS financiero, considerar 4–8 h y refresh en páginas protegidas.

### A2 — Sin audit log administrativo

No existe `AuditLog`. Sin trazabilidad para CRUD usuarios, reversiones inventario, cancelaciones de caja, cambios en `AppSettings`.

### A3 — Sin rate limiting en export CSV

**Archivo:** `src/app/admin/reports/export/route.ts`  
Recomendación: ~10 req/min por usuario; límite de rango de fechas (ej. 31 días).

### E1 — Aislamiento de sucursal solo en aplicación

Sin PostgreSQL RLS. Defensa en profundidad a mediano plazo.

### E2 — Consulta DB en cada page load protegida

`requireUser()` valida usuario activo en cada request — correcto para revocación inmediata; evaluar caché TTL corto bajo carga alta.

### E3 — Sin middleware centralizado de auth

Auth por Server Component (`requireUser`, `getActiveBranch`) — auditable pero verboso al crecer rutas.

---

## Aspectos positivos confirmados

| Aspecto | Estado |
| --- | --- |
| Hashing bcryptjs (10 rondas) | OK |
| Cookies: `httpOnly`, `secure` en prod, `sameSite: lax` | OK |
| Error login genérico (sin enumeración) | OK |
| Rutas admin: `requireRole([ADMIN])` | OK |
| Rutas kiosk/caja: `getActiveBranch()` | OK |
| Prisma ORM (sin SQL crudo) | OK |
| Server Actions para mutaciones | OK |

---

## Matriz de rutas

| Ruta | Protección | Rol | Sucursal |
| --- | --- | --- | --- |
| `/login` | Pública | — | — |
| `/select-branch` | `requireUser()` | No | No |
| `/kiosk`, `/cash/*` | `getActiveBranch()` | No | Sí |
| `/admin/*` | `requireRole([ADMIN])` | Sí | Condicional |
| `GET /admin/reports/export` | `requireRole([ADMIN])` | Sí | Sí |

---

## Referencia histórica

Informe original sin revisar: [`../security-audit.md`](../security-audit.md) (redirige aquí).
