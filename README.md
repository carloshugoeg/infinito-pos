# Koi POS

Monolito web para kioscos POS multisucursal.

## Inicio rapido

1. Copia `.env.example` a `.env` y ajusta `DATABASE_URL`.
2. Instala dependencias con `npm install`.
3. Genera Prisma con `npm run db:generate`.
4. Ejecuta migraciones con `npm run db:migrate`.
5. Carga datos demo con `npm run db:seed`.
6. Inicia la app con `npm run dev`.

Usuario demo:

- Email: `admin@koi.local`
- Password: `admin12345`

## Variables requeridas

- `DATABASE_URL`: conexion PostgreSQL (pooled en prod) usada por la app.
- `DIRECT_URL`: conexion directa para `prisma migrate deploy`. En local usa el mismo valor que `DATABASE_URL` (Postgres local no tiene pooler); en Supabase es la cadena directa `:5432` (ver `docs/DEPLOY.md`).
- `SESSION_SECRET`: secreto para firmar la sesion. Obligatorio —la app falla si falta— y >= 32 caracteres aleatorios en prod, unico por entorno. Genera con `openssl rand -base64 36`.

Para build de produccion, carga estas variables antes de ejecutar `npm run build`; Next.js prerenderiza rutas que leen ajustes desde la base de datos.

## Setup primer piloto

Para el deploy de produccion sigue el runbook completo en `docs/DEPLOY.md` (Supabase + Vercel). Resumen:

1. Aprovisiona la base de prod (Supabase) y configura `DATABASE_URL`, `DIRECT_URL` y `SESSION_SECRET` en Vercel (nunca en git).
2. Aplica migraciones con `npm run db:deploy` (`prisma migrate deploy`), no `db:migrate`.
3. **No** ejecutes `npm run db:seed` en prod: el seed demo esta bloqueado por guard. Crea el usuario admin real y el catalogo desde la UI de `Administracion`, y desactiva `admin@koi.local`.
4. Revisa sucursal, catalogo, recetas, inventario inicial y ajustes del sistema.
5. Verifica HTTPS y que la cookie `koi_session` tenga los flags Secure + HttpOnly en prod.
6. Antes de operar, corre `npm test`, `npm run typecheck`, `npm run lint` y `npm run build`.

## Checklist diario del piloto

1. Seleccionar sucursal.
2. Abrir caja con monto inicial.
3. Vender desde kiosco y revisar pedidos activos.
4. Avanzar pedidos: pendiente -> preparar -> entregar.
5. Registrar compras, mermas o ajustes de inventario si aplica.
6. Cerrar caja con conteo fisico.
7. Revisar reportes y exportar CSV.

## Operacion y respaldo

- Runbook de deploy y operacion: `docs/DEPLOY.md` (provision DB, env, migraciones, backups, HTTPS).
- Mantener backups automaticos de PostgreSQL (Supabase) y probar un restore antes del piloto real.
- Guardar `DATABASE_URL`, `DIRECT_URL` y `SESSION_SECRET` fuera del repositorio.
- La importacion historica desde Excel es post-launch opcional; el piloto puede iniciar con datos nuevos del POS.
