# koi-pos

Koi POS is a cloud-first, multisucursal kiosk POS for customizable products. V1 is a Next.js monolith with PostgreSQL/Prisma, TypeScript, Tailwind CSS, and shadcn-style local UI primitives.

## Required Reading

Before touching code, every agent must read:

- `AGENTS.md`
- `docs/requirements.md`
- `docs/IMPLEMENTATION_PLAN.md`

## V1 Boundaries

- No multi-tenancy and no `business_id` fields in V1.
- No separate kitchen/KDS module; preparation lives inside `/kiosk`.
- No real FEL integration in V1; keep only placeholder fields.
- Costing (COGS), operating expenses, finance reporting, and the daily summary email are in scope (Fase 1).
- Catalog/prices are global; inventory, cash sessions, and orders are per branch.
- UI visible to users must remain in Spanish.

## Progress Rules

- Update `docs/IMPLEMENTATION_PLAN.md` with every coded change.
- Mark a subtask complete only when it is coded, reviewed, and tested.
- Keep task notes short and useful.

## Checklist Discipline

Before touching code, **read the checklists that apply** to the task (see `docs/README.md`). After verified work, **update checklist state** — do not only report completion in chat.

| Task area | Checklist(s) |
| --- | --- |
| Any code change | `docs/IMPLEMENTATION_PLAN.md` |
| Deploy / infra / migrations / prod env | `docs/GO_LIVE_CHECKLIST.md` (P0-INF) + `docs/DEPLOY.md` |
| Auth / session / seed / security | `docs/GO_LIVE_CHECKLIST.md` (P0-SEC) + `docs/qa/security.md` |
| E2E / QA / test gaps | `docs/qa/open-issues.md` |
| Scope questions | `docs/requirements.md` + `docs/APP_CONTEXT.md` |

Workflow: (1) identify relevant item IDs at start, (2) respect open P0 gates, (3) update `IMPLEMENTATION_PLAN.md` always; update go-live or QA checklists when you directly close a tracked item. Grep by ID — do not read entire files unless needed.

Cursor rule: `.cursor/rules/checklist-discipline.mdc` (always applied).

## Engineering Rules

- Backend recalculates prices and totals before charging.
- Do not duplicate pricing logic between client and server.
- Do not block sales for insufficient stock; allow negative stock and surface it in inventory.
- Prefer pure domain functions for cart totals, modifier validation, cash summaries, and inventory usage.
- Preserve tokens: read specific files, summarize findings, avoid dumping large files, and inspect only touched modules.

## Costing, Expenses & Finance (Fase 1)

- Freeze cost at sale time, mirroring the existing price snapshots: `OrderItem.unitCostSnapshot`/`lineCostSnapshot` and `Order.costOfGoodsTotal`/`grossProfit`. They are computed in `preparePaidOrder()` and persisted inside the order transaction — never on the client.
- COGS derives from `Ingredient.costPerUnit` times the resolved recipe usage; `src/domain/costing.ts` and inventory usage share one recipe-matching rule (`recipeSourceMatchesItem`).
- Operating expenses (OPEX) are recipe-independent and live in `Expense`/`RecurringExpense`. Recurring templates are expanded on the fly within a date range, not materialized.
- Finance logic is pure and Vitest-tested (`src/domain/costing.ts`, `expenses.ts`, `finance.ts`); DB reads live in `src/server/reports/finance.ts`.
- The daily summary keeps content assembly (`buildDailySummary`/`renderDailySummaryHtml`) separate from sending. Sending is a deferred stub (console.log) guarded by `EmailLog` idempotency, triggered on cash close.

## Useful Skills

- Frontend/application implementation for kiosk and admin flows.
- Database modeling for Prisma schema and migrations.
- Browser/Playwright testing for visual QA and tablet workflows.
- Spreadsheets only if report exports become a concrete task.
