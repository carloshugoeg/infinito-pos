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

- `DATABASE_URL`: conexion PostgreSQL usada por Prisma.
- `SESSION_SECRET`: secreto largo para firmar la sesion de usuario.

Para build de produccion, carga estas variables antes de ejecutar `npm run build`; Next.js prerenderiza rutas que leen ajustes desde la base de datos.

## Setup primer piloto

1. Crea la base PostgreSQL.
2. Configura `.env` con `DATABASE_URL` y `SESSION_SECRET`.
3. Ejecuta `npm install`.
4. Ejecuta `npm run db:migrate`.
5. Ejecuta `npm run db:seed`.
6. Entra con el usuario demo y cambia/crea usuarios reales desde `Administracion -> Usuarios`.
7. Revisa sucursal, catalogo, recetas, inventario inicial y ajustes del sistema.
8. Ejecuta `npm test`, `npm run typecheck`, `npm run lint` y `npm run build`.

## Checklist diario del piloto

1. Seleccionar sucursal.
2. Abrir caja con monto inicial.
3. Vender desde kiosco y revisar pedidos activos.
4. Avanzar pedidos: pagado -> preparando -> listo -> entregado.
5. Registrar compras, mermas o ajustes de inventario si aplica.
6. Cerrar caja con conteo fisico.
7. Revisar reportes y exportar CSV.

## Operacion y respaldo

- Mantener backups automaticos de PostgreSQL antes del piloto real.
- Guardar `DATABASE_URL` y `SESSION_SECRET` fuera del repositorio.
- La importacion historica desde Excel es post-launch opcional; el piloto puede iniciar con datos nuevos del POS.
