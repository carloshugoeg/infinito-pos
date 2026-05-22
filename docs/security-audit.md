# Koi POS — Reporte de Auditoría de Seguridad y Escalabilidad

**Fecha:** 2026-05-21  
**Revisado por:** QA Senior / Arquitecto Full-Stack  
**Stack:** Next.js 16, React 19, Prisma 6, PostgreSQL, TypeScript 5.9

---

## Resumen Ejecutivo

La postura de seguridad general es **buena para un entorno de desarrollo/piloto**, pero requiere correcciones antes de un despliegue en producción. Las rutas protegidas están correctamente aseguradas, el hashing de contraseñas usa bcryptjs con 10 rondas de sal y las cookies de sesión están bien configuradas. Sin embargo, hay tres hallazgos críticos que deben resolverse antes de ir a producción.

---

## Hallazgos Críticos (bloquear antes de producción)

### C1 — Fallback hardcodeado en `SESSION_SECRET`
**Archivo:** `src/lib/session.ts:13`  
**Código afectado:**
```typescript
function getSecret() {
  return process.env.SESSION_SECRET || "dev-only-koi-pos-secret";
}
```
**Riesgo:** Si la variable de entorno `SESSION_SECRET` no está seteada en el servidor de producción, todos los tokens de sesión se firman con la cadena pública `"dev-only-koi-pos-secret"`. Un atacante con acceso a este código fuente puede forjar tokens de sesión válidos para cualquier `userId`.

**Corrección recomendada:**
```typescript
function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET no está configurado");
  return secret;
}
```

---

### C2 — Credenciales por defecto visibles en el form de login
**Archivo:** `src/app/login/page.tsx:33-37`  
**Código afectado:**
```tsx
<Input id="email" name="email" type="email" defaultValue="admin@koi.local" required />
<Input id="password" name="password" type="password" defaultValue="admin12345" required />
```
**Riesgo:** Las credenciales del administrador están hardcodeadas como `defaultValue` en el HTML del form. Cualquier persona que abra el inspector del navegador o visualice el código fuente puede obtenerlas.

**Corrección:** Remover los atributos `defaultValue` de ambos inputs. Documentar las credenciales iniciales únicamente en el `README.md`.

---

### C3 — Admin con contraseña fija creado en seed
**Archivo:** `prisma/seed.ts:7-28`  
**Código afectado:**
```typescript
const passwordHash = await bcrypt.hash("admin12345", 10);
const admin = await prisma.user.upsert({
  where: { email: "admin@koi.local" },
  update: { passwordHash, role: UserRole.ADMIN, isActive: true },
  ...
});
```
**Riesgo:** Si el seed se re-ejecuta en producción (por error, durante un redeploy, o en scripts de CI/CD), la contraseña del usuario administrador queda reseteada a `admin12345`. Las credenciales son públicamente conocidas en el repositorio.

**Corrección:** Proteger la creación/actualización del admin con `if (process.env.NODE_ENV !== 'production')`. Para producción, implementar un flujo de configuración inicial separado.

---

## Hallazgos Altos

### A1 — Sesión de 14 horas sin mecanismo de refresh
**Archivo:** `src/lib/session.ts:45`
```typescript
const expiresAt = Date.now() + 1000 * 60 * 60 * 14; // 14 horas
```
Para un sistema financiero (POS), 14 horas es un período de expiración muy largo. No existe mecanismo de renovación de sesión ni timeout por inactividad. Una sesión robada permanece válida hasta su expiración natural.

**Recomendación:** Reducir a 4–8 horas. Implementar renovación automática en páginas protegidas.

---

### A2 — Sin audit log para acciones de administrador
No existe tabla `AuditLog` en el esquema. Las siguientes operaciones quedan sin trazabilidad:
- CRUD de usuarios (creación, desactivación, cambio de rol)
- Reversiones de movimientos de inventario
- Cancelaciones de sesiones de caja
- Cambios en configuración (`AppSettings`)

El modelo `InventoryMovement` sí registra movimientos de stock (positivo), pero las reversiones y acciones admin no tienen rastro.

**Recomendación:** Agregar tabla `AuditLog` con campos `userId`, `action`, `entityType`, `entityId`, `metadata`, `createdAt`.

---

### A3 — Sin rate limiting en el endpoint de export CSV
**Archivo:** `src/app/admin/reports/export/route.ts`

El endpoint `GET /admin/reports/export` no tiene rate limiting ni límites de tamaño de respuesta. Un administrador puede generar dumps masivos repetidamente, causando carga elevada en la base de datos.

**Recomendación:** Implementar rate limiting (ej. 10 requests/minuto por usuario) y limitar el rango de fechas del export a un máximo de 31 días.

---

## Hallazgos de Escalabilidad / Multi-Sucursal

### E1 — Aislamiento de sucursal sólo en capa de aplicación
Todo el aislamiento de datos entre sucursales se aplica en la capa de código (Prisma + auth guards). No hay PostgreSQL Row-Level Security (RLS). Un bug en Prisma o en los guards podría exponer datos de todas las sucursales.

**Recomendación a mediano plazo:** Implementar RLS en PostgreSQL para defensa en profundidad.

---

### E2 — DB call en cada page load protegida
`requireUser()` realiza una consulta a la base de datos en cada carga de página protegida:
```typescript
const user = await prisma.user.findFirst({
  where: { id: session.userId, isActive: true },
  include: { branches: { include: { branch: true } } }
});
```
Esto es correcto para garantizar que usuarios desactivados pierdan acceso inmediatamente, pero puede convertirse en un cuello de botella con alto tráfico (muchos kioscos simultáneos).

**Recomendación:** Evaluar caché de sesión con TTL corto (60 segundos) para reducir carga en DB manteniendo seguridad razonable.

---

### E3 — Sin middleware centralizado de autenticación
La autenticación se verifica en cada página mediante llamadas a `requireUser()` o `getActiveBranch()` en los Server Components. Esto es correcto y seguro, pero con el crecimiento de rutas puede volverse difícil de auditar.

**Recomendación a futuro:** Evaluar middleware de Next.js para validación de sesión a nivel de edge, con las verificaciones de DB manteniéndose en los server components.

---

## Aspectos Positivos Confirmados

| Aspecto | Estado |
|---------|--------|
| Hashing de contraseñas con bcryptjs (10 rondas) | ✅ Correcto |
| Cookies: `httpOnly`, `secure` en producción, `sameSite: lax` | ✅ Correcto |
| Error de login genérico (sin enumeración de usuarios) | ✅ Correcto |
| Singleton Prisma con hot-reload safety | ✅ Correcto |
| Recálculo de totales y precios en el servidor | ✅ Cumple regla AGENTS.md |
| Todas las rutas admin protegidas con `requireRole([ADMIN])` | ✅ Correcto |
| Rutas de kiosk protegidas con `getActiveBranch()` | ✅ Correcto |
| Queries via Prisma ORM (previene SQL injection) | ✅ Correcto |
| Server Actions para todas las mutaciones (no API routes expuestas) | ✅ Correcto |

---

## Matriz de Rutas y Protección

| Ruta | Protección | Verificación de Rol | Verificación de Sucursal |
|------|-----------|-------------------|------------------------|
| `/login` | Pública | — | — |
| `/select-branch` | `requireUser()` | No | No |
| `/kiosk` | `getActiveBranch()` | No | Sí |
| `/cash/open` | `getActiveBranch()` | No | Sí |
| `/cash/close` | `getActiveBranch()` | No | Sí |
| `/admin/*` | `requireRole([ADMIN])` | Sí | Condicional |
| `GET /admin/reports/export` | `requireRole([ADMIN])` | Sí | Sí |

---

## Plan de Remediación Priorizado

| Prioridad | ID | Acción | Esfuerzo estimado |
|-----------|-----|--------|------------------|
| Crítico | C1 | Hacer `SESSION_SECRET` obligatorio (lanzar error si falta) | 15 min |
| Crítico | C2 | Remover `defaultValue` del form de login | 5 min |
| Crítico | C3 | Proteger creación de admin en seed con `NODE_ENV` check | 10 min |
| Alto | A1 | Reducir expiración de sesión a 4-8 horas | 30 min |
| Alto | A2 | Diseñar e implementar tabla `AuditLog` | 2-4 horas |
| Alto | A3 | Agregar rate limiting al endpoint de export | 1-2 horas |
| Medio | E1 | Investigar implementación de PostgreSQL RLS | 4-8 horas |
| Bajo | E2 | Evaluar caché de sesión con Redis/in-memory | 2-4 horas |
