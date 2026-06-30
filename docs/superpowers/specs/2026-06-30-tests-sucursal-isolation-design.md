# TESTS sucursal + dedicated test account + prod guardrails

**Date:** 2026-06-30
**Status:** Approved (design), pending implementation plan
**Author:** Hugo Escobar (with Claude Code)

## Goal

Guarantee that **no test-originated data ever pollutes the production client's
database**. Test data comes from three vectors, all of which must be isolated:

1. **Manual smoke tests on prod** — a real sale / caja open-close on the live prod URL
   after a deploy, to confirm it works.
2. **Automated E2E (Playwright)** — orders and cash sessions created at runtime.
3. **Seed / demo data** — the demo and 30-day-history seeds that could accidentally run
   against prod.

All test-originated rows must live under a dedicated **TESTS sucursal**, operated by a
**dedicated test account**, so that the real client's *Corte diario*, reports, finance,
and inventory stay clean.

## Context (current state)

- **No multi-tenancy in V1** (AGENTS.md): there is no `tenant` / `business` / `organization`
  model. The organizational unit is **`Branch`** (sucursal). "TESTS tenant" therefore maps
  to a dedicated **TESTS branch + TESTS user**.
- **Reports are already scoped per-branch.** `getActiveBranch()` (`src/server/auth.ts`)
  pins every query to a single `branchId`; the reports page, CSV export, inventory, and
  finance all filter by the active branch. **Consequence:** data created under a TESTS
  branch is automatically excluded from the real client's numbers. The branch boundary does
  the heavy lifting; this spec only adds the fixtures, access wiring, and guardrails.
- **Vitest tests never touch a DB** — all pure/in-memory domain tests. No change needed.
- **Playwright E2E** starts `npm run dev` against whatever `DATABASE_URL` is set
  (`.env.local` → local Docker `localhost:5433/koi_pos`; CI → ephemeral Postgres). It logs
  in today as `admin@koi.local` (dev admin, branch CENTRO) and creates orders on CENTRO.
- **Seeds:** `seed.ts` (demo), `seed-demo.ts` (**destructive** — `deleteMany` of orders /
  payments / cash sessions, then 30 days of history), `seed-admin.ts` (env-gated prod
  bootstrap, already prod-guarded), `seed-infinito.ts` (loads the **real** catalog; legitimately
  run on prod).
- **Prod:** Supabase `koi-pos-prod`, ref `htlcnzlhuqvcovaggzos`, pooler host
  `aws-1-us-east-1.pooler.supabase.com`. Repo is **public** — no secrets in code.

## Non-goals

- No multi-tenancy / `business_id` (forbidden in V1).
- No change to Vitest tests (already DB-free).
- No cross-branch reporting changes (none exist in V1; per-branch scoping already isolates).

## Design

### 1. Schema — `Branch.isTest`

Add an additive boolean column:

```prisma
model Branch {
  // ...
  isTest Boolean @default(false)
}
```

Migration `add_branch_is_test`. Additive column on an existing table → does **not** trip
the Supabase RLS-relockdown gotcha (that only affects *new tables*). Run on local + prod.

`isTest` is the first-class enforcement hook: guardrails assert "the active branch is a
test branch" before E2E writes, and the branch-admin UI badges it.

### 2. Test fixtures — `prisma/seed-tests.ts` (new, idempotent)

Creates via `upsert`:

- **TESTS branch:** `code: "TESTS"`, `name: "Sucursal de Pruebas"`, `isTest: true`.
- **TESTS2 branch:** `code: "TESTS2"`, `name: "Sucursal de Pruebas 2"`, `isTest: true`
  — a throwaway second branch so `branch-selection.spec.ts` can exercise the multi-branch
  picker (see Decision A).
- **Test user:** email from `TEST_USER_EMAIL`, password from `TEST_USER_PASSWORD`,
  `role: ADMIN` (admins reach Kiosco + Caja + Reportes, so one account covers the full
  smoke flow), assigned via `UserBranch` to **both** TESTS and TESTS2 — and to **no real
  branch**.

Catalog is global (products are not per-branch), so the TESTS branch sells the real menu
with zero extra seeding. Only orders / cash / inventory are per-branch — exactly what we
isolate. Sales don't block on stock (negative allowed), so no inventory seeding is required.

New npm script: `"db:seed:tests": "tsx prisma/seed-tests.ts"`.

**Prod safety:** `seed-tests.ts` calls the guardrail (§3). It may run against prod only when
`ALLOW_PROD_SEED=true` AND `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` are provided (no
defaults on prod). It performs **only upserts — never `deleteMany`**.

### 3. Guardrail — `assertNonProductionDatabase()` (new shared helper)

A small module exporting `isProductionDatabase(url)` and `assertNonProductionDatabase()`.
It inspects `process.env.DATABASE_URL` (and `DIRECT_URL`) and **throws** if the host matches
the prod Supabase ref (`htlcnzlhuqvcovaggzos`) or pooler host, **unless**
`ALLOW_PROD_SEED === "true"`.

Wired into:

| Caller | Behavior |
| --- | --- |
| `seed.ts` (demo) | Hard-blocked from prod. |
| `seed-demo.ts` (destructive 30-day) | Hard-blocked from prod. |
| `e2e/global.setup.ts` | Refuses to start the E2E run against prod. |
| `seed-tests.ts` | Allowed on prod **only** with `ALLOW_PROD_SEED=true` (the one intentional prod write). |
| `seed-admin.ts` | Keeps its existing env-gated prod guard (optionally aligned to the shared helper). |
| `seed-infinito.ts` | **Not** blocked — it is the real-catalog loader, by design. |

Placement must be importable by both the `tsx`-run `prisma/*.ts` scripts and `e2e/`
(separate tsconfig). Resolve the exact path during planning (e.g. `prisma/lib/guard.ts`
imported relatively from e2e), keeping a single source of truth for the prod-host check.

### 4. E2E pinned to TESTS

- `e2e/global.setup.ts`: log in as the **test account** (`TEST_USER_EMAIL` /
  `TEST_USER_PASSWORD`); after login, assert the resolved active branch is a TESTS branch
  (`code` starts with `TESTS` / `isTest`). Every E2E order and cash session then lands on
  TESTS — even in the local/CI DB.
- The test account has two branches (TESTS, TESTS2) → it hits `/select-branch`, so the
  setup must select TESTS explicitly. `branch-selection.spec.ts` keeps testing the real
  picker against these two branches (Decision A).
- E2E prerequisite seeds gain `db:seed:tests`. Update `.github/workflows/ci.yml`.
- Specs that previously asserted "Sucursal Centro" / CENTRO are repointed to the TESTS
  branch as part of the plan.

### 5. Branch-admin UI

In `/admin/branches`, badge `isTest` branches as **"PRUEBAS"** so a real admin recognizes
them. No other UI change — the real admin isn't assigned to TESTS, so it never appears in
their kiosk/caja selector.

### 6. Secrets (public repo)

No test password is committed. `seed-tests.ts` reads `TEST_USER_EMAIL` /
`TEST_USER_PASSWORD` from env. A local-only default (e.g. `qa@koi.local` /
`qatest12345`) is used **only** when the guardrail confirms a non-prod DB. Documented in
`.env.example` and `docs/DEV_LOCAL.md`; CI receives them as env/secret.

### 7. Prod bootstrap (one controlled step)

Run once against prod, with the prod env + `ALLOW_PROD_SEED=true` + `TEST_USER_*` set:

```
npm run db:seed:tests
```

This is the single intentional prod write — it creates the TESTS/TESTS2 branches and the
qa account in prod. Tracked as a new item in `docs/GO_LIVE_CHECKLIST.md`.

## Decisions (defaults taken)

- **A.** Give the test account a second throwaway branch `TESTS2` so the multi-branch
  picker spec still has something to exercise.
- **B.** Local demo data (`seed-demo.ts`) **stays on the dev branch (CENTRO)** so local dev
  reports still show data. The "seed/demo → not in prod" goal is met by the guardrail (§3),
  not by relocating local demo data.

## Testing strategy

- **Unit (Vitest):** add tests for the guardrail — `isProductionDatabase()` returns true for
  the prod host, false for localhost/ephemeral; `assertNonProductionDatabase()` throws on
  prod host and is bypassed by `ALLOW_PROD_SEED=true`.
- **E2E (Playwright):** existing suite runs green against the local/CI DB with all data
  under TESTS; `global.setup.ts` asserts the active branch is a TESTS branch.
- **Manual:** after wiring, run `db:seed:tests` locally and confirm the qa account logs in,
  sees TESTS/TESTS2, sells under TESTS, and that CENTRO reports are unaffected.

## Files affected (anticipated)

- `prisma/schema.prisma` (+ `isTest`), new migration under `prisma/migrations/`.
- `prisma/seed-tests.ts` (new), `prisma/lib/guard.ts` (new, or chosen location).
- `seed.ts`, `seed-demo.ts` (wire guardrail), optionally `seed-admin.ts`.
- `e2e/global.setup.ts`, affected specs (`branch-selection.spec.ts`, any asserting CENTRO).
- `package.json` (`db:seed:tests`), `.github/workflows/ci.yml`.
- `.env.example`, `docs/DEV_LOCAL.md`, `docs/GO_LIVE_CHECKLIST.md`,
  `docs/IMPLEMENTATION_PLAN.md`.
- App: `/admin/branches` listing (PRUEBAS badge).

## Security notes

- Repo is public: never commit `TEST_USER_PASSWORD`. Defaults only on a guardrail-confirmed
  non-prod DB.
- The guardrail is defense-in-depth on top of per-branch scoping, not a replacement for it.
- Adding a column does not re-expose tables via the Supabase Data API (no new table), but
  the standing P0-SEC-07 (disable Data API) remains the durable fix.
