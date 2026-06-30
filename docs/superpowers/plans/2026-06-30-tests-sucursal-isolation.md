# TESTS sucursal + dedicated test account + prod guardrails — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every test-originated row (manual prod smoke, Playwright E2E, seed/demo) into a dedicated TESTS sucursal operated by a test-only account, and hard-block destructive seeds and the E2E suite from ever touching the production client database.

**Architecture:** Add an additive `Branch.isTest` flag. A new idempotent `seed-tests.ts` creates two TEST branches (`TESTS`, `TESTS2`) and one ADMIN test user assigned only to them. A dependency-free guard module (`src/lib/test-guard.ts`) detects the prod Supabase host and throws (unless `ALLOW_PROD_SEED=true`); it is wired into the demo seeds and the E2E global setup. Per-branch query scoping (already in place) keeps the real client's reports clean automatically.

**Tech Stack:** Next.js 16 (App Router, RSC), Prisma 6 + PostgreSQL, TypeScript, Vitest (unit), Playwright (E2E), bcryptjs.

---

## Reference: current-state facts (verified against the code)

- `Branch` model: `prisma/schema.prisma:59-75`. `UserBranch` junction with `@@unique([userId, branchId])`: `prisma/schema.prisma:94-103`.
- Seeds run via `tsx prisma/<file>.ts` and import **only** from `node_modules` (no `@/` alias) — so the guard is imported by **relative path** `../src/lib/test-guard` to stay tsx-safe.
- `seed.ts` already has a `NODE_ENV==="production"` guard at `prisma/seed.ts:7-12` (we replace it with the shared guard). `seed-demo.ts` has **no** prod guard and does `deleteMany` of all transactional tables at `prisma/seed-demo.ts:33-40` (critical to guard).
- E2E auth: `e2e/global.setup.ts` logs in as `admin@koi.local` and relies on single-branch auto-select. Specs reuse the saved `storageState` (`.auth/admin.json`); only `auth.spec.ts`, `branch-selection.spec.ts`, and the operator block in `full-audit.spec.ts` log in explicitly.
- Vitest picks up `src/**/*.test.ts` and resolves the `@` alias (`vitest.config.ts`).
- Prod DB host contains `supabase.com` (ref `htlcnzlhuqvcovaggzos`); local/CI use `localhost`.

## File Structure

| File | Create/Modify | Responsibility |
| --- | --- | --- |
| `src/lib/test-guard.ts` | Create | Pure prod-DB detection + `assertNonProductionDatabase()`. Zero app imports. |
| `src/lib/test-guard.test.ts` | Create | Vitest unit tests for the guard. |
| `prisma/schema.prisma` | Modify | Add `Branch.isTest Boolean @default(false)`. |
| `prisma/migrations/<ts>_add_branch_is_test/` | Create (generated) | Additive column migration. |
| `prisma/seed-tests.ts` | Create | Idempotent TESTS/TESTS2 branches + test ADMIN user. |
| `prisma/seed.ts` | Modify | Replace ad-hoc prod check with the shared guard. |
| `prisma/seed-demo.ts` | Modify | Add the shared guard before `deleteMany`. |
| `package.json` | Modify | `db:seed:tests` script; append it to `dev:setup`. |
| `e2e/global.setup.ts` | Modify | Log in as the test account; select the TESTS branch; guard. |
| `e2e/branch-selection.spec.ts` | Modify | Assert the TEST branches instead of CENTRO. |
| `.github/workflows/ci.yml` | Modify | Run `db:seed:tests` in the E2E job. |
| `src/app/admin/branches/page.tsx` | Modify | "PRUEBAS" badge on `isTest` branches. |
| `.env.example` | Modify | Document `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`. |
| `docs/DEV_LOCAL.md` | Modify | Document the qa account + seed step. |
| `docs/GO_LIVE_CHECKLIST.md` | Modify | Prod-bootstrap item for the test fixtures. |
| `docs/IMPLEMENTATION_PLAN.md` | Modify | New task row. |

---

## Task 1: Guard module (`src/lib/test-guard.ts`)

**Files:**
- Create: `src/lib/test-guard.ts`
- Test: `src/lib/test-guard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/test-guard.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { assertNonProductionDatabase, isProductionDatabase } from "@/lib/test-guard";

const LOCAL = "postgresql://postgres:postgres@localhost:5433/koi_pos?schema=public";
const PROD = "postgresql://postgres.htlcnzlhuqvcovaggzos:pw@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

describe("isProductionDatabase", () => {
  it("is false for the local docker DB", () => {
    expect(isProductionDatabase(LOCAL)).toBe(false);
  });
  it("is true for the supabase prod host", () => {
    expect(isProductionDatabase(PROD)).toBe(true);
  });
  it("is false for undefined", () => {
    expect(isProductionDatabase(undefined)).toBe(false);
  });
});

describe("assertNonProductionDatabase", () => {
  const url = process.env.DATABASE_URL;
  const allow = process.env.ALLOW_PROD_SEED;
  afterEach(() => {
    process.env.DATABASE_URL = url;
    process.env.ALLOW_PROD_SEED = allow;
  });

  it("does not throw on the local DB", () => {
    process.env.DATABASE_URL = LOCAL;
    delete process.env.ALLOW_PROD_SEED;
    expect(() => assertNonProductionDatabase("test")).not.toThrow();
  });
  it("throws on the prod DB with no override", () => {
    process.env.DATABASE_URL = PROD;
    delete process.env.ALLOW_PROD_SEED;
    expect(() => assertNonProductionDatabase("test")).toThrow(/production database/);
  });
  it("allows the prod DB when ALLOW_PROD_SEED=true", () => {
    process.env.DATABASE_URL = PROD;
    process.env.ALLOW_PROD_SEED = "true";
    expect(() => assertNonProductionDatabase("test")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- test-guard`
Expected: FAIL — cannot resolve `@/lib/test-guard` (module not created yet).

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/test-guard.ts`:

```ts
// Keeps destructive seeds and the E2E suite away from the production database.
// Imported by prisma/*.ts (relative path, tsx-safe) and by e2e/global.setup.ts.
// MUST stay dependency-free (no app imports) so it is portable across runners.

const PROD_DB_MARKERS = ["supabase.com", "htlcnzlhuqvcovaggzos"];

/** True when the connection string points at the production Supabase database. */
export function isProductionDatabase(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;
  const value = databaseUrl.toLowerCase();
  return PROD_DB_MARKERS.some((marker) => value.includes(marker));
}

/**
 * Throws if `DATABASE_URL` points at production, unless `ALLOW_PROD_SEED=true`.
 * `context` names the caller (e.g. "db:seed:demo") for a clear error message.
 */
export function assertNonProductionDatabase(context: string): void {
  if (!isProductionDatabase(process.env.DATABASE_URL)) return;
  if (process.env.ALLOW_PROD_SEED === "true") {
    console.warn(`[test-guard] ${context}: production database detected but ALLOW_PROD_SEED=true — proceeding.`);
    return;
  }
  throw new Error(
    `[test-guard] ${context}: refusing to run against the production database. ` +
      `This command writes test/demo data and must never touch the live client DB. ` +
      `If you truly intend this, set ALLOW_PROD_SEED=true.`
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- test-guard`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/test-guard.ts src/lib/test-guard.test.ts
git commit -m "feat(test-guard): block seeds/E2E from the production database"
```

---

## Task 2: `Branch.isTest` schema + migration

**Files:**
- Modify: `prisma/schema.prisma:59-75`
- Create: `prisma/migrations/<timestamp>_add_branch_is_test/migration.sql` (generated)

**Prerequisite:** local DB running (`npm run db:up`).

- [ ] **Step 1: Add the column to the schema**

In `prisma/schema.prisma`, inside `model Branch`, add the `isTest` line just after `isActive`:

```prisma
model Branch {
  id                 String              @id @default(cuid())
  name               String
  code               String              @unique
  address            String?
  isActive           Boolean             @default(true)
  isTest             Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  users              UserBranch[]
  cashSessions       CashSession[]
  inventory          BranchInventory[]
  inventoryMovements InventoryMovement[]
  orders             Order[]
  expenses           Expense[]
  recurringExpenses  RecurringExpense[]
  emailLogs          EmailLog[]
}
```

- [ ] **Step 2: Generate + apply the migration**

Run: `npx prisma migrate dev --name add_branch_is_test`
Expected: a new migration folder is created and applied; Prisma Client regenerates.

- [ ] **Step 3: Verify the generated SQL is additive only**

Run: `cat prisma/migrations/*_add_branch_is_test/migration.sql`
Expected (exactly one additive statement):

```sql
ALTER TABLE "Branch" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;
```

If the diff contains anything other than this `ADD COLUMN`, stop and investigate before committing.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS (the regenerated client now knows `isTest`).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(schema): add additive Branch.isTest flag"
```

---

## Task 3: `seed-tests.ts` fixtures + npm scripts

**Files:**
- Create: `prisma/seed-tests.ts`
- Modify: `package.json` (scripts block)

- [ ] **Step 1: Create the seed script**

Create `prisma/seed-tests.ts`:

```ts
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { assertNonProductionDatabase, isProductionDatabase } from "../src/lib/test-guard";

const prisma = new PrismaClient();

// Two TEST branches: TESTS is the primary smoke/E2E sucursal; TESTS2 exists only so the
// multi-branch picker (branch-selection.spec.ts) has something to exercise.
const TEST_BRANCHES = [
  { code: "TESTS", name: "Sucursal de Pruebas" },
  { code: "TESTS2", name: "Sucursal de Pruebas 2" }
];

async function main() {
  // May run on prod ONLY with ALLOW_PROD_SEED=true (the one intentional prod write).
  assertNonProductionDatabase("db:seed:tests");

  const onProd = isProductionDatabase(process.env.DATABASE_URL);
  const email = (process.env.TEST_USER_EMAIL ?? (onProd ? "" : "qa@koi.local")).trim().toLowerCase();
  const password = process.env.TEST_USER_PASSWORD ?? (onProd ? "" : "qatest12345");
  if (!email || !password) {
    throw new Error("Set TEST_USER_EMAIL and TEST_USER_PASSWORD (required on production).");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const branches = [];
  for (const def of TEST_BRANCHES) {
    const branch = await prisma.branch.upsert({
      where: { code: def.code },
      update: { name: def.name, isTest: true, isActive: true },
      create: { name: def.name, code: def.code, isTest: true }
    });
    branches.push(branch);
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: UserRole.ADMIN, isActive: true },
    create: { name: "QA Pruebas", email, passwordHash, role: UserRole.ADMIN }
  });

  for (const branch of branches) {
    await prisma.userBranch.upsert({
      where: { userId_branchId: { userId: user.id, branchId: branch.id } },
      update: {},
      create: { userId: user.id, branchId: branch.id }
    });
  }

  console.log(`Seeded test account "${user.email}" → branches ${branches.map((b) => b.code).join(", ")}.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Add the npm script and wire it into dev:setup**

In `package.json`, add `db:seed:tests` next to the other seed scripts and append it to `dev:setup`. The two lines become:

```json
    "dev:setup": "docker compose up -d db && prisma migrate deploy && npm run db:seed && npm run db:seed:infinito && npm run db:seed:tests",
    "db:seed:tests": "tsx prisma/seed-tests.ts",
```

- [ ] **Step 3: Run the seed against the local DB**

Run: `npm run db:seed:tests`
Expected: `Seeded test account "qa@koi.local" → branches TESTS, TESTS2.`

- [ ] **Step 4: Verify idempotency**

Run: `npm run db:seed:tests`
Expected: same success line, no errors (upserts only).

- [ ] **Step 5: Commit**

```bash
git add prisma/seed-tests.ts package.json
git commit -m "feat(seed): TESTS/TESTS2 branches + dedicated test account"
```

---

## Task 4: Wire the guard into the demo seeds

**Files:**
- Modify: `prisma/seed.ts:1-12`
- Modify: `prisma/seed-demo.ts:1-14`

- [ ] **Step 1: Guard `seed.ts`**

In `prisma/seed.ts`, add the import after the existing imports:

```ts
import { assertNonProductionDatabase } from "../src/lib/test-guard";
```

Then replace the existing ad-hoc block (`prisma/seed.ts:7-12`):

```ts
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
    throw new Error(
      "Refusing to run the demo seed in production. Create real data via the admin UI, " +
        "or set ALLOW_PROD_SEED=true only if you truly intend to seed."
    );
  }
```

with:

```ts
  assertNonProductionDatabase("db:seed");
```

- [ ] **Step 2: Guard `seed-demo.ts`**

In `prisma/seed-demo.ts`, add the import after the existing imports:

```ts
import { assertNonProductionDatabase } from "../src/lib/test-guard";
```

Then add the guard as the first statement inside `main()`, before the `console.log("Starting demo seed...")` line:

```ts
async function main() {
  assertNonProductionDatabase("db:seed:demo");

  console.log("Starting demo seed...");
```

- [ ] **Step 3: Verify the guards do not break the local run**

Run: `npm run db:seed`
Expected: completes normally (localhost ⇒ guard is a no-op).

- [ ] **Step 4: Verify the guard blocks a simulated prod URL**

Run: `DATABASE_URL="postgresql://u:p@aws-1-us-east-1.pooler.supabase.com:6543/postgres" npx tsx prisma/seed-demo.ts`
Expected: throws `[test-guard] db:seed:demo: refusing to run against the production database` and exits non-zero. (No DB writes occur.)

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts prisma/seed-demo.ts
git commit -m "feat(seed): guard demo seeds against the production database"
```

---

## Task 5: Pin Playwright E2E to the TESTS branch

**Files:**
- Modify: `e2e/global.setup.ts`
- Modify: `e2e/branch-selection.spec.ts`

**Prerequisite:** local DB seeded with `npm run db:seed && npm run db:seed:infinito && npm run db:seed:tests`.

- [ ] **Step 1: Rewrite the global setup to use the test account**

Replace the entire contents of `e2e/global.setup.ts` with:

```ts
import path from "path";
import { test as setup, expect } from "@playwright/test";
import { assertNonProductionDatabase } from "../src/lib/test-guard";

const authFile = path.join(__dirname, ".auth/admin.json");

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? "qa@koi.local";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? "qatest12345";

setup("authenticate as the test account", async ({ page }) => {
  // Never let the E2E suite run against the production client database.
  assertNonProductionDatabase("playwright e2e");

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Koi POS" })).toBeVisible();

  await page.locator('input[name="email"]').fill(TEST_EMAIL);
  await page.locator('input[name="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  // The test account is assigned to TESTS + TESTS2, so login lands on the picker.
  await expect(page).toHaveURL(/\/select-branch/);
  // \bTESTS\b matches the TESTS code but NOT TESTS2 (no word boundary before "2").
  await page.getByRole("button", { name: /\bTESTS\b/ }).click();

  await expect(page).toHaveURL(/\/(kiosk|cash\/open)/);

  await page.context().storageState({ path: authFile });
});
```

- [ ] **Step 2: Update the branch-selection spec for the TEST branches**

Replace the entire contents of `e2e/branch-selection.spec.ts` with:

```ts
import { test, expect } from "@playwright/test";

// Auth state (storageState) applied via playwright.config.ts project settings.
// The test account belongs to two TEST branches (TESTS, TESTS2).

test.describe("Selección de sucursal", () => {
  test("el selector muestra las sucursales de prueba", async ({ page }) => {
    await page.goto("/select-branch");
    if (!page.url().includes("select-branch")) return; // already has an active branch → redirected

    await expect(page.getByRole("heading", { name: "Selecciona sucursal" })).toBeVisible();
    await expect(page.getByText("Sucursal de Pruebas", { exact: true })).toBeVisible();
    await expect(page.getByText("TESTS", { exact: true })).toBeVisible();
    await expect(page.getByText("TESTS2", { exact: true })).toBeVisible();
  });

  test("seleccionar la sucursal de pruebas redirige a kiosk o cash/open", async ({ page }) => {
    await page.goto("/select-branch");
    if (!page.url().includes("select-branch")) {
      expect(page.url()).toMatch(/\/(kiosk|cash\/open)/);
      return;
    }

    await page.getByRole("button", { name: /\bTESTS\b/ }).click();
    await expect(page).toHaveURL(/\/(kiosk|cash\/open)/);
  });
});
```

- [ ] **Step 3: Run the E2E suite locally**

Run: `npm run test:e2e`
Expected: setup authenticates as `qa@koi.local`, selects TESTS, and the suite passes. All orders/cash sessions created by the run belong to the TESTS branch.

- [ ] **Step 4: Confirm isolation**

Run: `npm run db:studio` (or a quick query) and confirm new `Order` rows reference the TESTS branch id, and the CENTRO branch has no new test orders.

- [ ] **Step 5: Commit**

```bash
git add e2e/global.setup.ts e2e/branch-selection.spec.ts
git commit -m "test(e2e): pin the suite to the TESTS branch via the test account"
```

---

## Task 6: CI — seed the test fixtures before E2E

**Files:**
- Modify: `.github/workflows/ci.yml` (the `e2e` job steps)

- [ ] **Step 1: Add the seed step**

In `.github/workflows/ci.yml`, in the `e2e` job, add a `db:seed:tests` step immediately after the `db:seed:infinito` step:

```yaml
      - run: npm run db:seed
      - run: npm run db:seed:infinito
      - run: npm run db:seed:tests
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

(The job's `DATABASE_URL` is `localhost`, so the guard is a no-op and the default `qa@koi.local` / `qatest12345` credentials match `global.setup.ts`.)

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(e2e): seed the TESTS fixtures before Playwright"
```

---

## Task 7: "PRUEBAS" badge in the branch admin

**Files:**
- Modify: `src/app/admin/branches/page.tsx:42-43`

- [ ] **Step 1: Add the badge next to the Activa/Inactiva status**

In `src/app/admin/branches/page.tsx`, replace the status line (`page.tsx:43`):

```tsx
                    <span className="text-sm font-black text-[var(--muted-foreground)]">{branch.isActive ? "Activa" : "Inactiva"}</span>
```

with a flex wrapper that adds the PRUEBAS badge for test branches:

```tsx
                    <span className="flex items-center gap-2 text-sm font-black text-[var(--muted-foreground)]">
                      {branch.isActive ? "Activa" : "Inactiva"}
                      {branch.isTest ? (
                        <span className="rounded-full bg-[var(--soft-lilac)] px-2 py-0.5 text-xs font-black text-[var(--accent-2)]">
                          PRUEBAS
                        </span>
                      ) : null}
                    </span>
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/app/admin/branches/page.tsx`
Expected: PASS, no warnings.

- [ ] **Step 3: Verify in the browser**

With the dev server running and seeded, open `/admin/branches` as an admin who can see the TEST branches (e.g. log in as `qa@koi.local`) and confirm the TESTS / TESTS2 rows show the **PRUEBAS** badge while real branches do not.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/branches/page.tsx
git commit -m "feat(admin): badge test branches as PRUEBAS"
```

---

## Task 8: Docs + checklists

**Files:**
- Modify: `.env.example`
- Modify: `docs/DEV_LOCAL.md`
- Modify: `docs/GO_LIVE_CHECKLIST.md`
- Modify: `docs/IMPLEMENTATION_PLAN.md`

- [ ] **Step 1: Document the test credentials in `.env.example`**

Append to `.env.example`:

```bash
# Dedicated test account for the TESTS sucursal (prisma/seed-tests.ts).
# REQUIRED on production (with ALLOW_PROD_SEED=true). Locally these default to
# qa@koi.local / qatest12345 — do NOT commit a real password (this repo is public).
# TEST_USER_EMAIL="qa@infinitopos.com"
# TEST_USER_PASSWORD="change-me-strong-password"
```

- [ ] **Step 2: Document the qa account + seed step in `docs/DEV_LOCAL.md`**

In `docs/DEV_LOCAL.md`, under the `Login:` bullet (line 9), add a second line:

```markdown
- **Test login**: `qa@koi.local` / `qatest12345` — assigned only to the **TESTS**
  and **TESTS2** sucursales (`db:seed:tests`). All E2E and smoke-test data lands here,
  never on a real branch.
```

And add a row to the "Useful commands" table:

```markdown
| `npm run db:seed:tests` | Create the TESTS/TESTS2 sucursales + qa test account |
```

- [ ] **Step 3: Add the prod-bootstrap item to `docs/GO_LIVE_CHECKLIST.md`**

Run: `grep -n "Pendiente\|P0-INF\|Streams\|Entorno de producción" docs/GO_LIVE_CHECKLIST.md` to find the production-items section, then add this line there:

```markdown
- [ ] **P1-QA-TESTS** — Bootstrap the test fixtures in prod once: with the prod env loaded,
  `ALLOW_PROD_SEED=true TEST_USER_EMAIL=… TEST_USER_PASSWORD=… npm run db:seed:tests`.
  Creates the TESTS/TESTS2 sucursales + qa account so post-deploy smoke tests never touch
  the real client's data. Apply the `add_branch_is_test` migration first (`prisma migrate deploy`).
```

- [ ] **Step 4: Add the task row to `docs/IMPLEMENTATION_PLAN.md`**

Add a new row at the end of the Tasks table (use the next free task number — `T20` unless a higher one already exists):

```markdown
| [x] | T20 Aislamiento de datos de prueba (sucursal TESTS) | Si | Si | Si | `Branch.isTest` (migracion `add_branch_is_test`, aditiva). `prisma/seed-tests.ts` crea sucursales TESTS/TESTS2 + cuenta de prueba ADMIN (`qa@koi.local` local; env en prod) asignada SOLO a ellas. Guard `src/lib/test-guard.ts` (unit-tested) bloquea `db:seed`/`db:seed:demo`/E2E contra la DB de prod (host `supabase.com`) salvo `ALLOW_PROD_SEED=true`. `global.setup.ts` entra como la cuenta de prueba y selecciona TESTS, asi todo dato E2E cae en TESTS. CI siembra `db:seed:tests`. Badge "PRUEBAS" en `/admin/branches`. Bootstrap prod pendiente (P1-QA-TESTS). |
```

- [ ] **Step 5: Final full verification**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all PASS (guard unit tests included).

- [ ] **Step 6: Commit**

```bash
git add .env.example docs/DEV_LOCAL.md docs/GO_LIVE_CHECKLIST.md docs/IMPLEMENTATION_PLAN.md
git commit -m "docs: document the TESTS sucursal, test account, and prod bootstrap"
```

---

## Final verification checklist

- [ ] `npm test` green (includes `test-guard` unit tests).
- [ ] `npm run typecheck` and `npm run lint` green.
- [ ] `npm run test:e2e` green; new orders belong to the TESTS branch, CENTRO untouched.
- [ ] `DATABASE_URL=…supabase.com… npx tsx prisma/seed-demo.ts` throws and writes nothing.
- [ ] `/admin/branches` shows the PRUEBAS badge on TESTS/TESTS2 only.
- [ ] Migration SQL is a single additive `ADD COLUMN`.

## Notes / known limitations

- The E2E-runner guard reads `process.env.DATABASE_URL` in the Playwright **runner** process. CI sets it explicitly, so the guard is effective there. Locally, `.env.local` already points at `localhost`; the guard is defense-in-depth on top of that, not the only protection.
- `auth.spec.ts` keeps using `admin@koi.local` (still created by `db:seed`) — it tests login mechanics, not branch isolation, so it needs no change.
- Local demo data (`seed-demo.ts`) intentionally stays on CENTRO so local dev reports show data (Decision B). The guard prevents it reaching prod.
- Prod requires running the `add_branch_is_test` migration (`prisma migrate deploy`) before `db:seed:tests` (tracked in P1-QA-TESTS).
```
