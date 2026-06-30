# Kiosk customization pop-up (per-cup modal) — design

**Date:** 2026-06-28
**Status:** Approved (verbal)
**Area:** `src/components/kiosk/kiosk-client.tsx`, new `src/components/ui/dialog.tsx`

## Problem

The product customization panel ("Personalizar …") renders inline at the bottom
of the kiosk. With the new `+`/`−` card steppers, adding cup after cup through one
shared inline panel risks mixing toppings between cups and is easy to lose track of.

## Goal

Move customization into a **centered pop-up modal scoped to a single cup**. Each
add gets its own isolated topping selection; confirming returns to the catalog.

## Decisions (confirmed with user)

1. **Always opens.** Tapping a product card *or* its `+` opens the modal for a
   fresh cup — for every product, including gourmet with no required topping.
   (Supersedes the gourmet "instant +1 add" from the previous change.)
2. **Separate lines.** Each modal confirmation appends its own cart line, even if
   toppings are identical. No merging. The modal's quantity stepper still allows
   N identical cups on one line.
3. **`−` stays instant.** The card's `−` removes one unit of that product directly
   from the cart (most-recently-added line first; removes the line at 0), no modal.
   The card count badge = total quantity of that product across all its lines.

## Approach

Add `src/components/ui/dialog.tsx` — a shadcn-style wrapper over the already
installed `@radix-ui/react-dialog` (v1.1.15). Radix provides focus trap,
ESC-to-close, scroll lock, and an accessible backdrop. Move the existing
customization JSX (modifier groups, qty stepper, notes, error, Agregar/Guardar/
Cancelar) into the dialog body verbatim.

Rejected: hand-rolled fixed overlay (re-implements a11y Radix already gives);
floating the inline panel (doesn't isolate one cup per pop-up).

## Mechanics

- New `customizeOpen` boolean state in `KioskClient`.
- Open for add: `setSelectedProductId(id)` + `resetBuilder()` + `setCustomizeOpen(true)`.
  Triggered by the card body click and the card `+`.
- Open for edit: `startEditingItem(item)` + `setCustomizeOpen(true)` (pencil in cart).
- `saveItem()` appends/replaces the line then closes the modal.
- Cancel / X / ESC / backdrop close and `resetBuilder()`.
- Post-sale reset effect also sets `customizeOpen(false)`.
- Card `active` highlight is tied to `customizeOpen && selectedProductId === id`
  so no card stays stuck-highlighted after closing.
- `−` keeps the existing instant `quickRemoveProduct`; `+`/card-tap no longer add
  directly — they open the modal.

## Validation & required toppings

`validateModifierSelections` already gates the Agregar button via `selectedErrors`;
clásicas' required courtesy topping must be chosen before Agregar enables. Server
re-validation in `orders.ts` is unchanged.

## Visual

Reuse the warm palette / `--primary` / `rounded-[2rem]` styling. Centered card,
`max-w-2xl`, `max-h-[85vh]` with internal scroll for long topping lists, generous
touch targets. No glassmorphism / AI-slop per house front-end rules.

## Verification

- `tsc`, `eslint`, `vitest` (106 tests — domain untouched).
- Browser QA in the local dev env (port 3000, seeded Infinito menu): gourmet →
  modal → Agregar lands a line; clásica → modal forces topping then Agregar;
  `−` removes; ESC/backdrop close; post-sale reset closes modal.
- E2E selectors preserved: the suite opens the panel via `selectProduct` then
  clicks toppings / "Agregar" — same button labels, present in the DOM when the
  dialog is open.
