# Runbook operativo — Koi POS

Guía rápida para **incidentes en piloto/producción** y **rollback**. Pensada para que el
responsable técnico (o un operador con el contacto a la mano) resuelva o escale sin improvisar.

**Cubre:** P1-DOC-03 (runbook de incidentes) y P1-OPS-03 (procedimiento de rollback).
**Referencias:** `docs/DEPLOY.md` (provisión + deploy), `docs/GO_LIVE_CHECKLIST.md`.

---

## Entorno de producción (referencia rápida)

| Recurso | Valor |
| --- | --- |
| URL prod | `https://koi-pos.vercel.app` |
| Hosting | Vercel · proyecto `koi-pos` · team `hugos-projects-3379fa36` · branch prod = `main` (auto-deploy) |
| Base de datos | Supabase `koi-pos-prod` (ref `htlcnzlhuqvcovaggzos`, us-east-1, plan Pro) |
| Logs runtime/deploy | Vercel → proyecto `koi-pos` → Deployments / Logs |
| Estado servicios | Supabase status + Vercel status pages |

> **Contacto de soporte técnico (P1-OPS-04):** _<rellenar: nombre + teléfono/WhatsApp + horario>_
> Mantener estas credenciales y URLs **solo en canal seguro** (P1-DOC-04), nunca en chat público.

---

## Parte 1 — Rollback

### 1A. Rollback de la app (deploy) — el camino rápido

Síntoma: el último deploy rompió algo (pantalla en blanco, 500 generalizado, regresión funcional)
y **no hubo cambio de base de datos**.

1. Vercel → proyecto `koi-pos` → **Deployments**.
2. Ubicar el último deploy **READY** anterior al problemático (marcados como *rollback candidate*).
3. Menú `⋯` → **Promote to Production** (o **Instant Rollback**). El alias `koi-pos.vercel.app`
   apunta al deploy anterior en segundos. No requiere rebuild.
4. Confirmar: recargar la URL prod y validar login + una venta de prueba.
5. Revertir el código: `git revert <sha>` del commit/PR culpable y abrir PR (deja `main` sano).

> CLI alternativa: `vercel rollback <deployment-url> --scope hugos-projects-3379fa36`.

### 1B. Rollback con cambio de base de datos (migración)

Las migraciones **no se aplican en el build** (`npm run build` solo hace `prisma generate`); se
corren a mano con `npm run db:deploy`. Por eso un rollback de app casi nunca exige tocar la DB.

Si una migración ya se aplicó y causa el problema:

1. **Primero** rollback de app (1A) para detener el daño.
2. Evaluar si la migración es **aditiva** (agrega tabla/columna nueva, p. ej. `AuditLog`): suele
   ser inocua dejarla; el código viejo simplemente la ignora. **No** revertir la DB si la app
   anterior funciona con el esquema nuevo.
3. Si la migración es **destructiva** y hay que volver atrás:
   - Restaurar desde backup (sección 1C) al punto previo, **o**
   - Escribir una migración inversa y aplicarla con `npm run db:deploy` (preferir esto a editar
     tablas a mano).
4. Nunca editar datos directamente en el dashboard salvo emergencia documentada.

### 1C. Restaurar base de datos desde backup

1. Supabase → proyecto `koi-pos-prod` → **Database → Backups** (diarios, plan Pro).
2. Elegir el punto de restauración previo al incidente y restaurar (PITR si está disponible).
3. Tras restaurar: correr `npm run db:deploy` para reconciliar migraciones y validar con una
   venta de prueba.
4. **Pendiente go-live (P0-INF-07):** probar este restore al menos una vez antes del piloto.

---

## Parte 2 — Incidentes comunes

Para cada uno: **síntoma → diagnóstico → acción → escalar**.

### 2A. La base de datos está caída / la app da 500 al cargar datos

- **Síntoma:** errores 500 en `/kiosk`, `/admin/*`; el login puede fallar.
- **Diagnóstico:**
  1. Abrir Supabase → `koi-pos-prod` → ¿proyecto `ACTIVE_HEALTHY`? Revisar Supabase status.
  2. Vercel → Logs runtime: buscar errores de conexión Prisma (`P1001`, timeouts del pooler).
- **Acción:**
  - Si Supabase está caído: esperar restablecimiento; comunicar al negocio "sistema temporal".
  - Si es saturación del pooler: reintentar; verificar `DATABASE_URL` usa el pooler `:6543`
    (`?pgbouncer=true`) y `DIRECT_URL` el `:5432` (ver `docs/DEPLOY.md`).
  - Si empezó tras un deploy: **rollback (1A)**.
- **Operación manual mientras tanto:** cobrar en efectivo en papel y registrar las ventas en el
  POS al volver el servicio (no se pierde el corte si se ingresan después).
- **Escalar:** soporte técnico si no se recupera en ~15 min.

### 2B. No puedo iniciar sesión / "Credenciales incorrectas" / sesión expira sola

- **Síntoma:** login válido es rechazado, o se cierra sesión inesperadamente.
- **Diagnóstico:**
  1. ¿Contraseña correcta? El error es genérico a propósito (no enumera usuarios).
  2. ¿Sesión expiró? Duración por defecto **12 h** (`SESSION_TTL_HOURS`); tras ese tiempo hay
     que volver a entrar — es esperado, no un bug.
  3. Si **nadie** puede entrar tras un deploy: probablemente cambió/rotó `SESSION_SECRET`
     (invalida todas las sesiones) o falta la env var (la app no arranca sin ella).
- **Acción:**
  - Caso normal: volver a iniciar sesión.
  - Si rotaron `SESSION_SECRET`: es esperado que todos re-inicien sesión una vez.
  - Si falta `SESSION_SECRET` en Vercel: setearla (≥32 chars) y redeploy.
  - Admin bloqueado en prod: recrear/reset con `npm run db:seed:admin` (env-driven), ver DEPLOY.
- **Escalar:** soporte si persiste con credenciales correctas.

### 2C. La caja no abre / "no se puede vender"

- **Síntoma:** `/kiosk` redirige a `/cash/open`; o no deja abrir caja.
- **Diagnóstico:** solo puede haber **una sesión de caja OPEN por sucursal**. Si la caja anterior
  no se cerró, abrir otra puede confundir.
- **Acción:**
  1. Ir a `/cash/open` e ingresar el monto inicial → debería redirigir a `/kiosk`.
  2. Si dice que ya hay caja abierta: ir a `/cash/close`, cerrar con conteo físico, y abrir de
     nuevo el turno.
  3. Verificar que el usuario está en la **sucursal correcta** (selector de sucursal).
- **Escalar:** si el cierre no cuadra o no permite abrir, soporte técnico.

### 2D. Error 500 en una acción puntual (cobrar, guardar, reporte)

- **Diagnóstico:** Vercel → Logs runtime, filtrar por la ruta/acción y la hora del error.
- **Acción:**
  - Reintentar la operación una vez (las ventas son transaccionales: o se crea completa o no se
    crea, no quedan a medias).
  - Si es reproducible y empezó tras un deploy → **rollback (1A)**.
  - Capturar el mensaje del log y el paso exacto para soporte.

### 2E. Inventario en negativo / alertas "Bajo/negativo"

- **No es un error.** El sistema **permite stock negativo** a propósito (la venta nunca se
  bloquea por falta de stock). La alerta "Bajo/negativo" en `/admin/inventory` indica que hay que
  registrar **compras** para corregir el saldo. Registrar compra/ajuste cuando corresponda.

---

## Parte 3 — Ventana de mantenimiento (P1-OPS-05)

- Aplicar migraciones (`npm run db:deploy`) y cambios mayores **fuera de horario de venta**.
- Avisar al negocio antes de un mantenimiento planificado.
- Preferir deploys de bajo riesgo en horario pico; dejar lo riesgoso para el cierre.

---

## Checklist de respuesta a incidente (imprimible)

1. ¿Qué síntoma exacto y desde cuándo? ¿Empezó tras un deploy?
2. ¿Servicios arriba? (Supabase healthy, Vercel deploy READY).
3. ¿Es global o de un solo usuario/sucursal?
4. Si fue un deploy → **rollback (1A)** primero, investigar después.
5. Mientras tanto, **cobrar en efectivo en papel** y registrar al volver.
6. Documentar: hora, síntoma, causa, acción, y si hubo pérdida de datos.
7. Escalar a soporte técnico con el log si no se resuelve en ~15 min.
