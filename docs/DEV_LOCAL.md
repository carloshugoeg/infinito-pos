# Local Dev Environment

A self-contained local stack for building and QA'ing features before they touch
the live register. The database runs in Docker (isolated from any other Postgres
on your machine); the app runs with `next dev`.

- **Database**: Postgres 16 in Docker, exposed on host port **5433** (not 5432, to
  avoid clashing with Postgres.app or other local instances).
- **Login**: `admin@koi.local` / `admin12345` (demo admin from `db:seed`).
- **Test login**: `qa@koi.local` / `qatest12345` — assigned only to the **TESTS**
  and **TESTS2** sucursales (`db:seed:tests`). All E2E and smoke-test data lands here,
  never on a real branch.
- **Catalog**: the real Infinito menu (`db:seed:infinito`) — the same data the
  E2E suite expects (Fresas Clásicas with required courtesy topping + Gourmet).

> Prod (Supabase/Vercel) lives in `.env.production.local` and is never touched by
> any of this. See `docs/DEPLOY.md` for production.

## Prerequisites

- Docker Desktop running.
- `.env` and `.env.local` (gitignored) pointing at the local DB:
  ```
  DATABASE_URL="postgresql://postgres:postgres@localhost:5433/koi_pos?schema=public"
  DIRECT_URL="postgresql://postgres:postgres@localhost:5433/koi_pos?schema=public"
  SESSION_SECRET="dev-local-koi-pos-secret-change-for-prod"
  ```

## First-time setup

```bash
npm install
npm run dev:setup     # starts the DB container, applies migrations, seeds demo admin + Infinito menu
npm run dev           # http://localhost:3000  → log in with admin@koi.local / admin12345
```

`dev:setup` is idempotent — re-run it any time to re-apply migrations and re-seed.

## Daily use

```bash
npm run db:up         # start the DB container (docker compose up -d db)
npm run dev           # start Next.js
npm run db:down       # stop the DB (keeps data)
```

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev:setup` | DB up + `migrate deploy` + `db:seed` + `db:seed:infinito` |
| `npm run db:up` / `db:down` | Start / stop the DB container (data persists) |
| `npm run db:reset` | **Wipe** the DB volume and start fresh (then re-run `dev:setup`) |
| `npm run db:studio` | Prisma Studio (browse/edit data) |
| `npm run db:seed:demo` | Add randomized demo orders/history on top of the seed |
| `npm run db:seed:tests` | Create the TESTS/TESTS2 sucursales + qa test account |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:e2e` | Playwright E2E (needs DB seeded + dev server; webServer auto-starts) |

## Notes

- The kiosk redirects to `/cash/open` until you open a cash session — open one
  in the UI to start selling.
- Sales are allowed with negative stock by design; inventory isn't a blocker for
  QA. New Infinito ingredients seed with placeholder costs (`REVISAR costo`).
- To completely reset state: `npm run db:reset && npm run dev:setup`.
