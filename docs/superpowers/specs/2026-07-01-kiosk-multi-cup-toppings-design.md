# Kiosk multi-cup topping wizard — design

**Date:** 2026-07-01
**Status:** Approved (verbal)
**Area:** `src/components/kiosk/kiosk-client.tsx`, `src/domain/cart.ts`

## Problem

The customization modal (see `2026-06-28-kiosk-customize-modal-design.md`) has an
internal quantity stepper (`qty-plus`/`qty-minus` next to the dialog title). Today,
raising that quantity to N keeps a single shared `selectedModifiers` selection and
saves **one cart line with quantity N and one set of toppings for all N cups**.

There is no way, inside that stepper flow, to give cup 1 different toppings than
cup 2 or cup 3. (The card-level `+` button already opens a fresh, empty modal per
click — that path already supports distinct toppings per cup. This spec is only
about the modal's *internal* stepper.)

## Goal

When the internal stepper raises the cup count to N ≥ 2, walk the cashier through
each cup one at a time ("Vaso 1 de 3", "Vaso 2 de 3", ...), each with its own
independent topping selection, then save all N as separate cart lines.

## Decisions (confirmed with user)

1. **Scope confirmed.** The reported issue is specifically the modal's internal
   stepper, not the product-card `+` (which already isolates toppings per cup).
2. **Wizard, not tabs.** One cup visible at a time; a "Siguiente vaso" button
   advances. No tab bar.
3. **New cup starts empty.** Cup 2, 3, ... never pre-fill from a previous cup's
   selection — forces a deliberate choice, avoids accidental duplicate toppings.
4. **Batch commit at the end.** Nothing is written to the cart until the last cup
   is confirmed via "Agregar". Cancelling mid-wizard discards all in-progress cups
   (matches today's single-cup Cancelar behavior).
5. **Shared notes.** The "Notas especiales" field stays a single field for the
   whole batch; the same text is copied onto all N resulting cart lines. Per-cup
   notes are out of scope for this change.
6. **No products-without-toppings regression.** If a product has zero
   `modifierGroups`, the stepper keeps today's behavior exactly: one line,
   quantity N, no wizard UI (there is nothing to differentiate per cup).

## Interaction model

State in `KioskClient` changes from `selectedModifiers: string[]` + `quantity:
number` to:

- `cupModifiers: string[][]` — one entry per cup being configured, in order.
  `quantity` is no longer separate state; it is `cupModifiers.length`.
- `currentCupIndex: number` — which cup's selection is currently shown/edited.

Behavior:

- **Stepper `+`** appends an empty array to `cupModifiers` and sets
  `currentCupIndex` to the new last index (focus always jumps to the newly added,
  empty cup — "add a cup" and "configure a cup" are the same action).
- **Stepper `-`** removes the last cup and clamps `currentCupIndex` to the new
  last index; floored at 1 cup, same as today's minimum.
- **"← Anterior"** (visible only when `cupModifiers.length > 1`, enabled when
  `currentCupIndex > 0`) moves back one cup without changing the count, to revisit
  an already-configured cup.
- **Primary button label:**
  - `currentCupIndex < cupModifiers.length - 1` → **"Siguiente vaso"**: validates
    the current cup with the existing `validateModifierSelections` (same rules as
    today, e.g. required Chocolate group) and advances `currentCupIndex + 1`. The
    button stays disabled while the current cup fails validation, exactly like
    "Agregar" is disabled today.
  - `currentCupIndex === cupModifiers.length - 1` (last cup) → **"Agregar"** (or
    **"Guardar"** when editing): validates the current cup, then commits all cups.
- **"Vaso X de N" indicator**: shown only when `cupModifiers.length > 1`. Hidden
  entirely for the common single-cup case, so the modal looks unchanged from today
  when nobody is using the stepper.
- **Toggling a modifier** always mutates `cupModifiers[currentCupIndex]` (reuses
  the existing `toggleModifier` logic, retargeted).
- **Cancelar / ESC / backdrop** discard the whole in-progress `cupModifiers` array,
  same as today's single-cup discard.

## Commit step

New pure function in `src/domain/cart.ts`:

```ts
function buildCupCartItems(productId: string, cupModifiers: string[][], notes: string):
  Array<{ productId: string; quantity: 1; modifierIds: string[]; notes: string }>
```

Maps each cup to its own line, quantity always 1, notes copied to every line.
Unit-tested with Vitest (1 cup, N cups, notes propagation).

In the component:

- **Add mode:** append all `buildCupCartItems(...)` results to `cart`.
- **Edit mode** (`editingCartItemId` set — pencil in the cart): cup 0 replaces the
  original line via the existing `replaceCartItem` (keeps its `localId`); cups
  1..N-1 append as brand-new lines. This lets a cashier reopen an existing single
  cup and grow it into several without losing the original line's identity.
- **Capacity check:** before committing, verify the cart has room for all N new
  lines against `MAX_CART_LINES` (today's check only accounts for 1 new line). If
  it doesn't fit, block "Agregar" with the same style of message the app already
  uses for the existing single-line limit.

## Edge cases already covered above

- Product with no `modifierGroups` → stepper behaves exactly as today (no wizard).
- Cart line capacity → checked for all N lines, not just one.
- Editing an existing line while growing its quantity → first cup replaces,
  rest append.

## Non-goals

- No changes to `OrderItem`/`OrderItemModifier`/`ModifierGroup` schema — the
  existing "one line = one modifier set" model already fits a cup-per-line
  result. No migration.
- No per-cup notes.
- No changes to the card-level `+`/`-` behavior (`openCustomizeForProduct`,
  `quickRemoveProduct`) — already correct per the 2026-06-28 design.

## Testing

- Vitest: `buildCupCartItems` (1 cup; N cups with different `modifierIds` per
  cup; notes propagated to every resulting line).
- E2E (`e2e/kiosk.spec.ts`):
  - Update `"cantidad × 2 con botón + → total se duplica"` — clicking `qty-plus`
    now moves focus to an empty cup 2, so the test must choose cup 2's required
    topping before "Agregar" is enabled, and then assert **two** separate cart
    lines (not one line with quantity 2).
  - New test: two cups of the same product, different toppings each → cart shows
    2 lines with distinct topping text and the correct summed total.
  - New test (optional): hitting `MAX_CART_LINES` while adding N cups blocks
    "Agregar" with the existing limit message.
