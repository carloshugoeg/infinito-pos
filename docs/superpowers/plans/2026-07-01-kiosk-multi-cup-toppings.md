# Kiosk Multi-Cup Topping Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the kiosk customization modal's internal quantity stepper raises the cup count to N ≥ 2, walk the cashier through each cup ("Vaso 1 de N", "Vaso 2 de N", ...) with its own independent topping selection, then save all N as separate cart lines instead of one line with N units sharing a single topping set.

**Architecture:** Replace the modal's `selectedModifiers`/`quantity` state in `KioskClient` with a single `cupBuilder` object (`{ cups: string[][], currentIndex: number }`). The stepper `+`/`-` add/remove cups and jump focus to the edited cup; a small nav bar lets the cashier revisit an earlier cup. A new pure function `buildCupCartItems` (domain layer) turns the finished `cups` array into one cart line per cup. No database schema changes — the existing "one line = one modifier set" model already fits a cup-per-line result.

**Tech Stack:** Next.js App Router client component (`kiosk-client.tsx`), TypeScript, Vitest (domain), Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-07-01-kiosk-multi-cup-toppings-design.md`

---

## Task 1: Domain — `buildCupCartItems`

**Files:**
- Modify: `src/domain/cart.ts:207-213` (insert after `replaceCartItem`, before `buildSaleSuccessPath`)
- Test: `src/domain/cart.test.ts:1-16` (import list), `src/domain/cart.test.ts:160-162` (insert point)

- [ ] **Step 1: Write the failing tests**

In `src/domain/cart.test.ts`, add `buildCupCartItems` to the existing import block (currently lines 2-16):

```ts
import {
  calculateCartItemTotal,
  calculateCashPaymentFromReceived,
  calculateCashChange,
  calculateChangeBreakdown,
  calculateInferredCashPayment,
  calculateOrderTotals,
  buildCupCartItems,
  buildSaleSuccessPath,
  replaceCartItem,
  resolveProductUnitPrice,
  sanitizeOrderNote,
  validateCheckout,
  validateModifierSelections,
  validatePayments,
  type CatalogProduct
} from "@/domain/cart";
```

Then insert this new `describe` block right after the `describe("cart domain", ...)` block closes (it currently ends at line 160 with `});`, immediately before the `// Modela el menu del instructivo...` comment on line 163):

```ts

describe("buildCupCartItems", () => {
  it("crea una linea de carrito por vaso, cantidad 1 cada una", () => {
    expect(buildCupCartItems("cup", [["white"], ["dark", "oreo"]], "sin azucar")).toEqual([
      { productId: "cup", quantity: 1, modifierIds: ["white"], notes: "sin azucar" },
      { productId: "cup", quantity: 1, modifierIds: ["dark", "oreo"], notes: "sin azucar" }
    ]);
  });

  it("con un solo vaso devuelve un array de una sola linea", () => {
    expect(buildCupCartItems("cup", [["white"]], "")).toEqual([
      { productId: "cup", quantity: 1, modifierIds: ["white"], notes: "" }
    ]);
  });

  it("preserva vasos sin toppings como modifierIds vacio", () => {
    expect(buildCupCartItems("cup", [[], []], "")).toEqual([
      { productId: "cup", quantity: 1, modifierIds: [], notes: "" },
      { productId: "cup", quantity: 1, modifierIds: [], notes: "" }
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/domain/cart.test.ts`
Expected: FAIL — `buildCupCartItems` is not exported from `@/domain/cart` (TypeScript/import error).

- [ ] **Step 3: Implement `buildCupCartItems`**

In `src/domain/cart.ts`, insert this block right after `replaceCartItem` (which ends at line 209) and before `buildSaleSuccessPath` (line 211):

```ts
export type CupCartItemInput = {
  productId: string;
  quantity: 1;
  modifierIds: string[];
  notes: string;
};

// Convierte los toppings elegidos por vaso (uno por indice) en lineas de
// carrito independientes, cantidad 1 cada una, para que cada vaso conserve
// sus propios modificadores en vez de compartir un set entre N unidades.
export function buildCupCartItems(productId: string, cupModifiers: string[][], notes: string): CupCartItemInput[] {
  return cupModifiers.map((modifierIds) => ({ productId, quantity: 1 as const, modifierIds, notes }));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/domain/cart.test.ts`
Expected: PASS — all tests in the file green, including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/domain/cart.ts src/domain/cart.test.ts
git commit -m "feat(kiosk): add buildCupCartItems to split per-cup toppings into separate cart lines"
```

---

## Task 2: Component — cup-builder state and commit logic

**Files:**
- Modify: `src/components/kiosk/kiosk-client.tsx`

This task replaces the `selectedModifiers`/`quantity` state with a `cupBuilder` object and rewrites every function that reads or writes it. It does **not** yet add the "Vaso X de N" nav UI (that's Task 3) — after this task, the bug is already fixed functionally (each cup keeps independent toppings and lands on its own cart line), just without the visual step indicator.

- [ ] **Step 1: Update the domain import**

In the `@/domain/cart` import block (`src/components/kiosk/kiosk-client.tsx:14-28`), add `buildCupCartItems`. (Do not add a `lucide-react` icon import yet — Task 3 needs `ChevronLeft`, but adding it now with no usage would fail `npm run lint`'s unused-import check in Step 8 below.)

```ts
import {
  buildCupCartItems,
  calculateCartItemTotal,
  calculateCashPaymentFromReceived,
  calculateCashChange,
  calculateOrderTotals,
  MAX_CART_LINES,
  MAX_ITEM_QUANTITY,
  replaceCartItem,
  resolveModifierDelta,
  resolveProductUnitPrice,
  sanitizeOrderNote,
  validateCheckout,
  validateModifierSelections,
  type CatalogProduct
} from "@/domain/cart";
```

- [ ] **Step 2: Replace `selectedModifiers`/`quantity` state with `cupBuilder`**

Replace `src/components/kiosk/kiosk-client.tsx:59-65`:

```ts
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
```

with:

```ts
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");
  const [cupBuilder, setCupBuilder] = useState<{ cups: string[][]; currentIndex: number }>({ cups: [[]], currentIndex: 0 });
  const [notes, setNotes] = useState("");
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
```

- [ ] **Step 3: Add derived cup values**

Replace `src/components/kiosk/kiosk-client.tsx:77-80`:

```ts
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? products[0];
  const productSections = groupProductsByCategory(products);
  const editingCartItem = cart.find((item) => item.localId === editingCartItemId) ?? null;
  const selectedErrors = selectedProduct ? validateModifierSelections(selectedProduct, selectedModifiers) : [];
```

with:

```ts
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? products[0];
  const hasModifierGroups = (selectedProduct?.modifierGroups.length ?? 0) > 0;
  const { cups: cupModifiers, currentIndex: currentCupIndex } = cupBuilder;
  const selectedModifiers = cupModifiers[currentCupIndex] ?? [];
  const quantity = cupModifiers.length;
  const isLastCup = !hasModifierGroups || currentCupIndex === cupModifiers.length - 1;
  const showCupNav = hasModifierGroups && cupModifiers.length > 1;
  const productSections = groupProductsByCategory(products);
  const editingCartItem = cart.find((item) => item.localId === editingCartItemId) ?? null;
  const selectedErrors = selectedProduct ? validateModifierSelections(selectedProduct, selectedModifiers) : [];
```

- [ ] **Step 4: Fix the post-sale reset effect**

In `src/components/kiosk/kiosk-client.tsx:108-125`, replace these two lines:

```ts
    setCart([]);
    setSelectedModifiers([]);
    setQuantity(1);
    setNotes("");
```

with:

```ts
    setCart([]);
    setCupBuilder({ cups: [[]], currentIndex: 0 });
    setNotes("");
```

(the rest of the effect body is unchanged).

- [ ] **Step 5: Rewrite `toggleModifier`, `resetBuilder`, `saveItem`, `openCustomizeForProduct`, `startEditingItem`, `closeCustomize`**

Replace the whole block `src/components/kiosk/kiosk-client.tsx:127-182` with:

```ts
  function toggleModifier(product: CatalogProduct, modifierId: string) {
    const group = product.modifierGroups.find((candidate) => candidate.modifiers.some((modifier) => modifier.id === modifierId));
    if (!group) return;
    setCupBuilder((state) => {
      const cup = state.cups[state.currentIndex];
      const exists = cup.includes(modifierId);
      const sameGroup = group.modifiers.map((modifier) => modifier.id);
      const nextCup = exists
        ? cup.filter((id) => id !== modifierId)
        : [...(group.maxSelections === 1 ? cup.filter((id) => !sameGroup.includes(id)) : cup), modifierId];
      const cups = state.cups.map((candidate, index) => (index === state.currentIndex ? nextCup : candidate));
      return { ...state, cups };
    });
  }

  function resetBuilder() {
    setCupBuilder({ cups: [[]], currentIndex: 0 });
    setNotes("");
    setEditingCartItemId(null);
  }

  // "+" del stepper interno: agrega un vaso vacio y salta el foco a el (tope
  // MAX_ITEM_QUANTITY). Agregar y configurar un vaso nuevo son la misma accion.
  function addCup() {
    setCupBuilder((state) => {
      if (state.cups.length >= MAX_ITEM_QUANTITY) return state;
      const cups = [...state.cups, []];
      return { cups, currentIndex: cups.length - 1 };
    });
  }

  // "-" del stepper interno: quita el ultimo vaso (piso de 1 vaso).
  function removeLastCup() {
    setCupBuilder((state) => {
      if (state.cups.length <= 1) return state;
      const cups = state.cups.slice(0, -1);
      return { cups, currentIndex: Math.min(state.currentIndex, cups.length - 1) };
    });
  }

  // "Anterior"/"Siguiente vaso": revisita un vaso ya configurado sin cambiar
  // cuantos vasos hay en total.
  function goToPreviousCup() {
    setCupBuilder((state) => ({ ...state, currentIndex: Math.max(0, state.currentIndex - 1) }));
  }

  function goToNextCup() {
    setCupBuilder((state) => ({ ...state, currentIndex: Math.min(state.cups.length - 1, state.currentIndex + 1) }));
  }

  // Guarda el vaso actual. Solo se llama cuando es el ultimo vaso (ver el
  // boton "Agregar"/"Guardar" en el JSX); confirma todo el lote de una vez:
  // cada vaso queda como su propia linea de carrito (cantidad 1) para que
  // sus toppings nunca se mezclen con los de otro vaso.
  function commitCups() {
    if (!selectedProduct || selectedErrors.length) return;
    const trimmedNotes = sanitizeOrderNote(notes);

    if (!hasModifierGroups) {
      if (!editingCartItemId && cart.length >= MAX_CART_LINES) return;
      const nextItem = {
        localId: editingCartItemId ?? crypto.randomUUID(),
        productId: selectedProduct.id,
        quantity: cupModifiers.length,
        modifierIds: [] as string[],
        notes: trimmedNotes
      };
      setCart((current) => (editingCartItemId ? replaceCartItem(current, editingCartItemId, nextItem) : [...current, nextItem]));
      resetBuilder();
      setCustomizeOpen(false);
      return;
    }

    const newItems = buildCupCartItems(selectedProduct.id, cupModifiers, trimmedNotes);
    const extraLines = editingCartItemId ? newItems.length - 1 : newItems.length;
    if (cart.length + extraLines > MAX_CART_LINES) return;

    setCart((current) => {
      if (!editingCartItemId) {
        return [...current, ...newItems.map((item) => ({ ...item, localId: crypto.randomUUID() }))];
      }
      const [firstCup, ...restCups] = newItems;
      const replaced = replaceCartItem(current, editingCartItemId, { ...firstCup, localId: editingCartItemId });
      return [...replaced, ...restCups.map((item) => ({ ...item, localId: crypto.randomUUID() }))];
    });
    resetBuilder();
    setCustomizeOpen(false);
  }

  // Abre el pop-up para configurar UN vaso nuevo del producto (estado limpio),
  // de modo que los toppings no se mezclen entre vasos.
  function openCustomizeForProduct(product: CatalogProduct) {
    setSelectedProductId(product.id);
    resetBuilder();
    setCustomizeOpen(true);
  }

  // Reabre una linea guardada: el vaso 0 arranca con sus toppings actuales;
  // si la linea tenia cantidad > 1 (solo posible en productos sin toppings),
  // los vasos siguientes arrancan vacios, igual que un vaso nuevo.
  function startEditingItem(item: CartItem) {
    setSelectedProductId(item.productId);
    const cups: string[][] = Array.from({ length: Math.max(1, item.quantity) }, () => []);
    cups[0] = [...item.modifierIds];
    setCupBuilder({ cups, currentIndex: 0 });
    setNotes(item.notes);
    setEditingCartItemId(item.localId);
    setCustomizeOpen(true);
  }

  // Cierra el pop-up sin guardar y limpia el constructor (descarta TODOS los
  // vasos en progreso, no solo el que se estaba viendo).
  function closeCustomize() {
    setCustomizeOpen(false);
    resetBuilder();
  }
```

- [ ] **Step 6: Wire the quantity stepper buttons to `addCup`/`removeLastCup`**

Replace `src/components/kiosk/kiosk-client.tsx:319-327`:

```tsx
                  <div className="flex shrink-0 items-center rounded-full bg-[var(--muted)] p-1">
                    <Button data-testid="qty-minus" type="button" size="icon" variant="ghost" className="rounded-full" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>
                      <Minus size={16} />
                    </Button>
                    <strong className="w-10 text-center text-lg">{quantity}</strong>
                    <Button data-testid="qty-plus" type="button" size="icon" variant="ghost" className="rounded-full" onClick={() => setQuantity((value) => Math.min(MAX_ITEM_QUANTITY, value + 1))}>
                      <Plus size={16} />
                    </Button>
                  </div>
```

with:

```tsx
                  <div className="flex shrink-0 items-center rounded-full bg-[var(--muted)] p-1">
                    <Button data-testid="qty-minus" type="button" size="icon" variant="ghost" className="rounded-full" onClick={removeLastCup}>
                      <Minus size={16} />
                    </Button>
                    <strong className="w-10 text-center text-lg">{quantity}</strong>
                    <Button data-testid="qty-plus" type="button" size="icon" variant="ghost" className="rounded-full" onClick={addCup}>
                      <Plus size={16} />
                    </Button>
                  </div>
```

- [ ] **Step 7: Point the primary action button at `commitCups`**

This is a temporary, minimal change (Task 3 adds the "Siguiente vaso" branch). Replace `src/components/kiosk/kiosk-client.tsx:417-419`:

```tsx
                <Button type="button" size="lg" onClick={saveItem} disabled={selectedErrors.length > 0}>
                  {editingCartItem ? "Guardar" : "Agregar"}
                </Button>
```

with:

```tsx
                <Button type="button" size="lg" onClick={commitCups} disabled={selectedErrors.length > 0}>
                  {editingCartItem ? "Guardar" : "Agregar"}
                </Button>
```

- [ ] **Step 8: Typecheck, lint, and run the unit suite**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

Run: `npm test`
Expected: PASS — all existing domain tests unaffected (this task only touches the component).

- [ ] **Step 9: Commit**

```bash
git add src/components/kiosk/kiosk-client.tsx
git commit -m "feat(kiosk): give each cup its own topping selection instead of sharing one across quantity"
```

---

## Task 3: Component — "Vaso X de N" nav UI and Siguiente/Agregar branching

**Files:**
- Modify: `src/components/kiosk/kiosk-client.tsx`

- [ ] **Step 1: Add the `ChevronLeft` icon import**

In `src/components/kiosk/kiosk-client.tsx:6`, replace:

```ts
import { Check, Minus, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
```

with:

```ts
import { Check, ChevronLeft, Minus, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
```

- [ ] **Step 2: Add the cup nav bar inside the dialog header**

In `src/components/kiosk/kiosk-client.tsx`, the `DialogHeader` currently looks like this (lines 311-329):

```tsx
              <DialogHeader className="pr-10">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <DialogTitle>{editingCartItem ? "Editar" : "Personalizar"} {selectedProduct.name}</DialogTitle>
                    <DialogDescription>
                      {editingCartItem ? "Ajusta tu pedido y guarda los cambios." : "Personaliza este vaso con ingredientes extras."}
                    </DialogDescription>
                  </div>
                  <div className="flex shrink-0 items-center rounded-full bg-[var(--muted)] p-1">
                    <Button data-testid="qty-minus" type="button" size="icon" variant="ghost" className="rounded-full" onClick={removeLastCup}>
                      <Minus size={16} />
                    </Button>
                    <strong className="w-10 text-center text-lg">{quantity}</strong>
                    <Button data-testid="qty-plus" type="button" size="icon" variant="ghost" className="rounded-full" onClick={addCup}>
                      <Plus size={16} />
                    </Button>
                  </div>
                </div>
              </DialogHeader>
```

Add the nav bar right after the `</div>` that closes the `flex flex-wrap` row, still inside `DialogHeader`:

```tsx
              <DialogHeader className="pr-10">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <DialogTitle>{editingCartItem ? "Editar" : "Personalizar"} {selectedProduct.name}</DialogTitle>
                    <DialogDescription>
                      {editingCartItem ? "Ajusta tu pedido y guarda los cambios." : "Personaliza este vaso con ingredientes extras."}
                    </DialogDescription>
                  </div>
                  <div className="flex shrink-0 items-center rounded-full bg-[var(--muted)] p-1">
                    <Button data-testid="qty-minus" type="button" size="icon" variant="ghost" className="rounded-full" onClick={removeLastCup}>
                      <Minus size={16} />
                    </Button>
                    <strong className="w-10 text-center text-lg">{quantity}</strong>
                    <Button data-testid="qty-plus" type="button" size="icon" variant="ghost" className="rounded-full" onClick={addCup}>
                      <Plus size={16} />
                    </Button>
                  </div>
                </div>
                {showCupNav ? (
                  <div className="flex items-center justify-center gap-3 rounded-2xl bg-[var(--muted)]/60 px-4 py-2">
                    <Button
                      data-testid="cup-prev"
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full"
                      onClick={goToPreviousCup}
                      disabled={currentCupIndex === 0}
                    >
                      <ChevronLeft size={16} />
                      Anterior
                    </Button>
                    <span className="text-sm font-bold text-[var(--foreground)]">
                      Vaso {currentCupIndex + 1} de {cupModifiers.length}
                    </span>
                  </div>
                ) : null}
              </DialogHeader>
```

- [ ] **Step 3: Branch the primary action button between "Siguiente vaso" and "Agregar"/"Guardar"**

Replace `src/components/kiosk/kiosk-client.tsx:413-420` (the footer button row, already has `commitCups` wired from Task 2):

```tsx
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button data-testid="edit-cancel" type="button" variant="ghost" onClick={closeCustomize}>
                  Cancelar
                </Button>
                <Button type="button" size="lg" onClick={commitCups} disabled={selectedErrors.length > 0}>
                  {editingCartItem ? "Guardar" : "Agregar"}
                </Button>
              </div>
```

with:

```tsx
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button data-testid="edit-cancel" type="button" variant="ghost" onClick={closeCustomize}>
                  Cancelar
                </Button>
                {isLastCup ? (
                  <Button type="button" size="lg" onClick={commitCups} disabled={selectedErrors.length > 0}>
                    {editingCartItem ? "Guardar" : "Agregar"}
                  </Button>
                ) : (
                  <Button type="button" size="lg" onClick={goToNextCup} disabled={selectedErrors.length > 0}>
                    Siguiente vaso
                  </Button>
                )}
              </div>
```

- [ ] **Step 4: Add a stable test id to the cart line's topping text**

Replace `src/components/kiosk/kiosk-client.tsx:485-487`:

```tsx
                      <p className="mt-1 text-xs font-medium text-[var(--muted-foreground)]">
                        {item.modifierNames.length > 0 ? item.modifierNames.join(", ") : "Sin extras"}
                      </p>
```

with:

```tsx
                      <p data-testid="cart-line-modifiers" className="mt-1 text-xs font-medium text-[var(--muted-foreground)]">
                        {item.modifierNames.length > 0 ? item.modifierNames.join(", ") : "Sin extras"}
                      </p>
```

- [ ] **Step 5: Typecheck, lint, and run the unit suite**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no errors (no unused imports — `ChevronLeft` is now used).

Run: `npm test`
Expected: PASS — unaffected domain tests still green.

- [ ] **Step 6: Commit**

```bash
git add src/components/kiosk/kiosk-client.tsx
git commit -m "feat(kiosk): add Vaso X de N nav bar and Siguiente vaso/Agregar step button"
```

---

## Task 4: E2E — cover the new multi-cup wizard

**Files:**
- Modify: `e2e/kiosk.spec.ts:168-178` (existing test breaks under the new behavior)
- Modify: `e2e/kiosk.spec.ts:204-216` (existing test breaks under the new behavior)
- No changes needed in `e2e/foolproofing.spec.ts` — verified its `qty-plus`/`qty-minus` tests (lines 129-156, 218-231) never click "Agregar"/"Guardar" after incrementing quantity, so they stay green as-is.

- [ ] **Step 1: Replace the "cantidad × 2" test**

In `e2e/kiosk.spec.ts`, replace the test at lines 168-178:

```ts
  test("cantidad × 2 con botón + → total se duplica", async ({ page }) => {
    await selectProduct(page, "Fresas con Crema"); // Q36
    await page.getByTestId("qty-plus").click();
    await expect(page.locator("strong.w-10")).toHaveText("2");
    await addToCart(page);

    await expect(page.getByTestId("cart-total")).toContainText("72.00");
    await pay(page, "cashAmount", "72");
    await cobrar(page);
  });
```

with these two tests:

```ts
  test("stepper interno +1 → pide toppings del vaso 2 antes de habilitar Agregar", async ({ page }) => {
    await selectProduct(page, "Fresas con Crema"); // vaso 1 con sus toppings ya elegidos
    await page.getByTestId("qty-plus").click();
    await expect(page.locator("strong.w-10")).toHaveText("2");
    await expect(page.getByText("Vaso 2 de 2")).toBeVisible();

    const agregar = page.getByRole("button", { name: "Agregar" });
    await expect(agregar).toBeDisabled();

    await page.getByRole("button", { name: "Oscuro", exact: true }).click();
    if (!(await agregar.isEnabled())) {
      await page.getByRole("button", { name: "Oreo", exact: true }).first().click();
    }
    await agregar.click();

    await expect(page.getByText("2 items")).toBeVisible();
    await expect(page.getByTestId("cart-total")).toContainText("72.00");
    await pay(page, "cashAmount", "72");
    await cobrar(page);
  });

  test("vaso 1 y vaso 2 con toppings distintos en el mismo modal → 2 líneas separadas", async ({ page }) => {
    await selectProduct(page, "Fresas con Crema"); // vaso 1 → Blanco (+ Oreo si aplica)
    await page.getByTestId("qty-plus").click();
    await page.getByRole("button", { name: "Oscuro", exact: true }).click(); // vaso 2 → Oscuro
    const agregar = page.getByRole("button", { name: "Agregar" });
    if (!(await agregar.isEnabled())) {
      await page.getByRole("button", { name: "Oreo", exact: true }).first().click();
    }
    await agregar.click();

    await expect(page.getByText("2 items")).toBeVisible();
    const modifiers = page.getByTestId("cart-line-modifiers");
    await expect(modifiers.nth(0)).toContainText("Blanco");
    await expect(modifiers.nth(1)).toContainText("Oscuro");
  });
```

- [ ] **Step 2: Fix the cart-edit test that also breaks**

In `e2e/kiosk.spec.ts`, replace the test at lines 204-216:

```ts
  test("editar item del carrito con lápiz → total actualizado al guardar", async ({ page }) => {
    await selectProduct(page, "Fresas con Crema"); // Q36
    await addToCart(page);
    await expect(page.getByTestId("cart-total")).toContainText("36.00");

    await page.getByTestId("cart-edit").first().click();
    await expect(page.getByRole("button", { name: "Guardar" })).toBeVisible();

    // Subir cantidad a 2 dentro del editor → Q70.
    await page.getByTestId("qty-plus").click();
    await page.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByTestId("cart-total")).toContainText("72.00");
  });
```

with:

```ts
  test("editar item del carrito con lápiz → subir cantidad pide toppings del vaso 2", async ({ page }) => {
    await selectProduct(page, "Fresas con Crema"); // Q36
    await addToCart(page);
    await expect(page.getByTestId("cart-total")).toContainText("36.00");

    await page.getByTestId("cart-edit").first().click();
    await expect(page.getByRole("button", { name: "Guardar" })).toBeVisible();

    // Subir cantidad a 2 dentro del editor → el vaso 2 arranca vacío.
    await page.getByTestId("qty-plus").click();
    await expect(page.getByText("Vaso 2 de 2")).toBeVisible();
    const guardar = page.getByRole("button", { name: "Guardar" });
    await expect(guardar).toBeDisabled();

    await page.getByRole("button", { name: "Oscuro", exact: true }).click();
    if (!(await guardar.isEnabled())) {
      await page.getByRole("button", { name: "Oreo", exact: true }).first().click();
    }
    await guardar.click();

    await expect(page.getByText("2 items")).toBeVisible();
    await expect(page.getByTestId("cart-total")).toContainText("72.00");
  });
```

(The test right after this one, `"cancelar edición no modifica el total"` at lines 219-231, is unaffected — it clicks `qty-plus` then `edit-cancel` directly, never touching the disabled "Guardar". Leave it as-is.)

- [ ] **Step 3: Bring up the local dev environment**

Run: `npm run dev:setup`
Expected: Postgres container up on port 5433, migrations applied, base seed + Infinito menu seed loaded (admin@koi.local / admin12345).

(Skip this step if the local Postgres container is already running and seeded from a previous session.)

- [ ] **Step 4: Run the kiosk E2E suite**

Run: `npx playwright test e2e/kiosk.spec.ts`
Expected: PASS — all tests in the file, including the 3 touched above. Playwright's `webServer` config starts `npm run dev` automatically if it isn't already running.

- [ ] **Step 5: Run the fool-proofing E2E suite to confirm no regression**

Run: `npx playwright test e2e/foolproofing.spec.ts`
Expected: PASS — confirms the untouched `qty-plus`/`qty-minus` tests still behave correctly under the new cup-builder state.

- [ ] **Step 6: Commit**

```bash
git add e2e/kiosk.spec.ts
git commit -m "test(kiosk): cover per-cup topping wizard and update quantity-stepper E2E flows"
```

---

## Task 5: Docs and full verification

**Files:**
- Modify: `docs/IMPLEMENTATION_PLAN.md`

- [ ] **Step 1: Run the full verification suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all three pass (0 type errors, 0 lint errors, all Vitest tests green — should be the previous unit test count + 3 for `buildCupCartItems`).

Run: `npx playwright test`
Expected: full E2E suite passes (kiosk, foolproofing, and any other spec files unaffected by this change).

- [ ] **Step 2: Add the task row to `docs/IMPLEMENTATION_PLAN.md`**

Add a new row to the task table (after the `T23` row, following the existing table format `| Estado | Task | Codificado | Revisado | Testeado | Notas |`):

```markdown
| [x] | T24 Wizard de toppings por vaso en el stepper interno del modal | Si | Si | Si | El stepper interno del modal de personalizacion (`+`/`-` junto al titulo) compartia un solo set de toppings entre las N unidades de una linea. Ahora cada `+` agrega un vaso vacio y salta el foco a el; con 2+ vasos aparece "Vaso X de N" + "Anterior" para revisar un vaso ya configurado, y el boton principal alterna entre "Siguiente vaso" (valida y avanza) y "Agregar"/"Guardar" (valida y confirma TODO el lote) segun si es el ultimo vaso. Al confirmar, cada vaso se guarda como su propia linea de carrito (cantidad 1) via la nueva funcion pura `buildCupCartItems` (`src/domain/cart.ts`) — sin cambios de esquema, ya que "una linea = un set de modificadores" ya encajaba con este resultado. Productos sin `modifierGroups` mantienen el comportamiento anterior exacto (una linea, cantidad N, sin wizard). El boton `+` de la tarjeta del catalogo (fuera del modal) no cambia — ya abria un modal limpio por vaso. **E2E**: se reescribieron 2 tests de `kiosk.spec.ts` que asumian que subir cantidad no pedia toppings de nuevo, y se agrego un test que verifica 2 lineas con toppings distintos en el mismo modal; `foolproofing.spec.ts` no necesito cambios (verificado que sus tests de `qty-plus`/`qty-minus` no llegan a click en "Agregar"/"Guardar"). Spec: `docs/superpowers/specs/2026-07-01-kiosk-multi-cup-toppings-design.md`. |
```

- [ ] **Step 3: Commit**

```bash
git add docs/IMPLEMENTATION_PLAN.md
git commit -m "docs: log kiosk multi-cup topping wizard in implementation plan"
```

- [ ] **Step 4: Browser QA (manual, before opening a PR)**

With the dev server running (`npm run dev`) and logged in as `admin@koi.local` / `admin12345` at `/kiosk`:

1. Click a product card once → modal opens on "Vaso 1" (no nav bar, single cup — looks identical to before this change).
2. Click the internal `+` (next to the dialog title) → nav bar appears showing "Vaso 2 de 2"; the topping buttons reset to unselected; "Agregar" is disabled until a required group is satisfied.
3. Pick different toppings than vaso 1, click "Agregar" → cart shows 2 separate lines, each with its own topping text.
4. Repeat, click `+` twice to reach vaso 3, click "Anterior" twice to go back to vaso 1, confirm its previously-chosen toppings are still shown (not lost).
5. Add a product with no `modifierGroups` (if one exists in the seeded catalog) and confirm its stepper still behaves like before (no "Vaso X de N", one line with the full quantity).
6. Edit an existing single-cup line via the pencil icon, bump its quantity, confirm vaso 2 starts empty and saving produces 2 lines (first keeps the original line's identity/edits, second is new).

---

## Notes for the executing agent

- Do not touch `src/server/services/orders.ts`, `src/server/services/orders.test.ts`, or `prisma/schema.prisma` — this change is entirely client-side cart construction; the server already accepts one modifier set per line, which is what every cup now produces.
- Do not add per-cup notes — the spec explicitly keeps `notes` shared across the whole batch.
- Do not pre-fill a new cup's toppings from the previous cup — the spec explicitly requires empty starts to force a deliberate choice.
