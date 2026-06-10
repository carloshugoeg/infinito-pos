# Runbook de deploy — Koi POS (Supabase + Vercel)

Procedimiento ejecutable para llevar Koi POS a producción y cerrar los ítems
**P0-INF** de `docs/GO_LIVE_CHECKLIST.md`. Cada sección es copy-paste y termina con
una verificación concreta. Marca el `[x]` del checklist sólo cuando la verificación pase.

**Decisiones de infraestructura (fijadas con el negocio):**

- **Base de datos de prod:** Supabase Postgres.
- **Migraciones:** paso manual explícito (`npm run db:deploy`), **nunca** automático en el build.
- **Hosting:** Vercel (HTTPS y TLS automáticos).

**Convención de conexión Supabase:**

| Variable | Puerto | Modo | Uso |
| --- | --- | --- | --- |
| `DATABASE_URL` | `:6543` | Transaction (pgbouncer) | La app en runtime serverless |
| `DIRECT_URL` | `:5432` | Direct | `prisma migrate deploy` |

`schema.prisma` ya está cableado: `url = env("DATABASE_URL")` (pooled) y
`directUrl = env("DIRECT_URL")` (directo). Prisma usa `directUrl` automáticamente para migrar.

---

## Prerrequisitos (una sola vez)

```bash
npm install              # incluye prisma y el CLI de Vercel como dependencia opcional
npm i -g vercel          # o usar el panel web de Vercel
vercel login
vercel link              # vincula este repo al proyecto de Vercel
```

---

## 1. P0-INF-01 — Aprovisionar Supabase Postgres

1. En [supabase.com](https://supabase.com) crea un proyecto nuevo. Elige la **región más
   cercana** al negocio (ej. `East US` para Guatemala) y guarda la contraseña de la base.
2. Ve a **Project Settings → Database → Connection string**.
3. Copia las **dos** cadenas de conexión:
   - **Pooled** (modo *Transaction*, host `...pooler.supabase.com`, puerto `:6543`).
     Agrégale `?pgbouncer=true` al final si no lo trae.
   - **Direct** (host `db.<ref>.supabase.co`, puerto `:5432`).
4. Sustituye `[YOUR-PASSWORD]` por la contraseña real en ambas cadenas.

**Verificación — conexión OK:** desde el **SQL Editor** de Supabase ejecuta `SELECT 1;`
o, localmente con la cadena directa exportada:

```bash
psql "$DIRECT_URL" -c "SELECT 1;"
```

Debe devolver `1` sin error de conexión.

---

## 2. P0-INF-03 — Generar `SESSION_SECRET`

```bash
openssl rand -base64 36
```

Produce ~48 caracteres aleatorios (≥ 32, requisito que `src/lib/session.ts` ahora **exige**
en prod). Usa un valor **único por entorno**: nunca reutilices el de `.env.example` ni el de
otro proyecto. Guárdalo en un gestor de secretos, no en git ni WhatsApp.

**Verificación:** el valor mide ≥ 32 caracteres y es distinto al placeholder de `.env.example`.

---

## 3. P0-INF-02 — Configurar variables de entorno en Vercel

Carga las tres variables en el scope **Production** (y **Preview** si lo usas). Nunca las
commitees al repo.

```bash
vercel env add DATABASE_URL production      # pega la cadena pooled (:6543, ?pgbouncer=true)
vercel env add DIRECT_URL production        # pega la cadena direct (:5432)
vercel env add SESSION_SECRET production     # pega el secreto del paso 2
```

(O usa **Vercel → Project → Settings → Environment Variables** en el panel.)

**Verificación:** `vercel env ls` lista las tres variables en `Production` sin valores vacíos.

---

## 4. P0-INF-04 — Aplicar migraciones a prod

Las migraciones son un **paso manual**, no corren en el build. Trae el entorno de prod
localmente y ejecuta el deploy de Prisma (usa `DIRECT_URL` automáticamente):

```bash
vercel env pull .env.production.local        # descarga DATABASE_URL, DIRECT_URL, SESSION_SECRET
npx dotenv -e .env.production.local -- npm run db:deploy
# o, si prefieres exportar a mano:
#   export $(grep -v '^#' .env.production.local | xargs) && npm run db:deploy
```

`db:deploy` → `prisma migrate deploy` aplica todas las migraciones pendientes, incluida
`20260609120000_update_order_status_enum` (mapea `PAID→PENDING`, `READY→PREPARING`).

**Verificación — enum correcto (ver E-011):** en el SQL Editor de Supabase:

```sql
SELECT enum_range(NULL::"OrderStatus");
```

Debe incluir `PENDING`, `PREPARING`, `DELIVERED`, `CANCELLED` (y **no** `PAID` ni `READY`).

> Borra `.env.production.local` cuando termines: `rm .env.production.local`. Está en
> `.gitignore`, pero no lo dejes en disco más de lo necesario.

---

## 5. P0-INF-05 — NO sembrar datos demo en prod

El seed demo (`npm run db:seed`) crea `admin@koi.local` / `admin12345` y catálogo de ejemplo;
es **sólo para desarrollo**. `prisma/seed.ts` ahora **bloquea** su ejecución cuando
`NODE_ENV=production` (lanza error salvo que pongas `ALLOW_PROD_SEED=true` deliberadamente).

En prod, crea los datos reales por la UI de admin:

1. Crea el **usuario admin real** con contraseña fuerte (cruza con P0-SEC-04).
2. Desactiva/elimina `admin@koi.local` (P0-SEC-05) — no debe existir en prod.
3. Crea operador(es) sin rol admin (P0-SEC-06), sucursal(es), catálogo, recetas e inventario
   inicial (bloque P0-DATA).

**Verificación:** correr `npm run db:seed` con `NODE_ENV=production` falla con el mensaje del
guard; el login con la credencial demo no funciona en prod.

---

## 6. P0-INF-06 — Build contra la DB de prod

Next.js prerenderiza rutas que leen ajustes desde la base, así que el build necesita un
`DATABASE_URL` alcanzable y `SESSION_SECRET` presente.

```bash
npx dotenv -e .env.production.local -- npm run build
# o exportar las vars como en el paso 4 y luego: npm run build
```

**Verificación:** el build termina sin error (`✓ Compiled` / `Generating static pages`).
En Vercel, el deploy de producción muestra **Ready** sin fallos de build.

---

## 7. P0-INF-07 — Backups + restore probado

1. En Supabase ve a **Database → Backups**. Confirma que los **backups automáticos diarios**
   están activos (o habilita **PITR** si el plan lo permite).
2. Documenta la cadencia (ej. "diario 03:00, retención 7 días") en el registro de cierre del
   checklist.
3. Prueba **una** restauración: crea un proyecto/branch desechable en Supabase, restaura el
   snapshot más reciente y confirma que los datos llegaron. Registra la **fecha** del test.

**Verificación:** existe al menos un backup listado y un restore de prueba completado con
fecha anotada.

---

## 8. P0-INF-08 — HTTPS + cookie segura

Vercel sirve HTTPS por defecto (TLS automático, también en dominio propio). La cookie
`koi_session` ya usa `secure: process.env.NODE_ENV === "production"` y `httpOnly: true`
(`src/lib/session.ts`).

**Verificación:** en la URL de prod abre **DevTools → Application → Cookies** y confirma que
`koi_session` tiene los flags **Secure** y **HttpOnly** activos. La URL carga sobre `https://`.

---

## Resumen de ejecución

| Paso | Ítem | Acción | Verificación |
| --- | --- | --- | --- |
| 1 | P0-INF-01 | Crear proyecto Supabase, copiar pooled + direct | `SELECT 1;` OK |
| 2 | P0-INF-03 | `openssl rand -base64 36` | ≥ 32 chars, único |
| 3 | P0-INF-02 | `vercel env add` × 3 | `vercel env ls` sin vacíos |
| 4 | P0-INF-04 | `npm run db:deploy` | `enum_range` con `PENDING` |
| 5 | P0-INF-05 | Crear admin real por UI, no seed | Demo login falla |
| 6 | P0-INF-06 | `npm run build` con env prod | Build Ready |
| 7 | P0-INF-07 | Activar backups + 1 restore | Fecha registrada |
| 8 | P0-INF-08 | Confirmar HTTPS + cookie | Secure + HttpOnly |

Al completar los 8 con su verificación, los P0-INF de `docs/GO_LIVE_CHECKLIST.md` quedan en
`[x]` y **Gate A (infraestructura)** está cubierto.
