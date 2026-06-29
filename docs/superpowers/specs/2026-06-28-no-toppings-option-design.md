# "Sin topping" option for Clásicas — design

Date: 2026-06-28
Status: Approved (design)

## Problem

The three *Fresas Clásicas* that include a free courtesy topping —
`Fresas con Crema`, `Fresas con Chocolate con Leche`, `Fresas con Chocolate Blanco` —
expose a required `"Topping de cortesia"` modifier group (`isRequired: true`,
`minSelections: 1`, `maxSelections: 1`). The customer **must** pick one of the 8
toppings; there is currently no way to order a Clásica with **no** topping.

## Goal

Let the customer explicitly decline the free courtesy topping via a `"Sin topping"`
choice, without weakening the "must make a choice" UX or losing the signal for the
kitchen.

## Approach (chosen)

Add a single modifier `"Sin topping"` to the `"Topping de cortesia"` group:

- `priceDelta: 0`
- **no recipe** (no ingredient usage)
- placed **last**, after the 8 real toppings, so the opt-out reads as the exception

Because the group is single-select (`maxSelections: 1`), selecting `"Sin topping"`
deselects any real topping and counts as one selection, so the existing
`isRequired` / `minSelections: 1` validation is satisfied. The choice is recorded on
the order line as `modifierNameSnapshot: "Sin topping"` (cost 0), giving the kitchen
an explicit "no topping" instruction instead of a blank.

### Why not the alternatives

- **Make the group optional** (`isRequired: false`, `min 0`): customer just selects
  nothing — no visible opt-out affordance (cashier can forget to confirm), and the
  kitchen receives an empty selection rather than a clear signal. Rejected.
- **UI-only synthetic button** that clears the group and special-cases validation:
  touches the shared client/server validation, toggle, and pricing code for no
  benefit over the data-only change, and leaves no trail on the order. Rejected.

## Scope

- **In scope:** the 3 Clásicas with `courtesyTopping: true`.
- **Out of scope:** the global `"Extras"` list (already optional — zero extras is
  valid and the UI already shows "Sin extras") and the Gourmet products.

## Implementation

Single change in `prisma/seed-infinito.ts`: after the loop that upserts the 8
`COURTESY_TOPPINGS` for each `courtesyTopping` product, upsert one more modifier
`"Sin topping"` with `priceDelta: 0` and an empty recipe.

- `upsertModifier` is find-or-update by `(group, name)`, so the seed stays idempotent.
- No changes to UI (`src/components/kiosk/kiosk-client.tsx`), domain validation /
  pricing (`src/domain/cart.ts`), order persistence (`src/server/services/orders.ts`),
  or the Prisma schema.

## COGS / costing

Empty recipe → zero resolved ingredient usage → `lineCostSnapshot` unchanged,
consistent with no topping being served.

## Rollout

- **Dev:** re-run the Infinito seed.
- **Prod:** the catalog was already loaded (2026-06-15) and the seed is guarded; the
  option goes live only after a deliberate re-seed with `ALLOW_PROD_SEED=true`. This
  spec does **not** trigger that — it's a separate, explicitly authorized step.

## Tracking

Update `docs/IMPLEMENTATION_PLAN.md` per AGENTS.md when the change lands.

## Verification

- Seed runs without error and is idempotent on a second run (no duplicate
  `"Sin topping"` modifier).
- In `/kiosk`, opening a Clásica shows `"Sin topping"` as a selectable option in
  `"Topping de cortesia"`; selecting it deselects any topping, leaves the price at
  base, and lets the item be added to the cart (validation passes).
