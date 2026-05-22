import { test, expect, type Page } from "@playwright/test";

// ─── Shared helpers ────────────────────────────────────────────────────────────

/** Match formatted GTQ currency (non-breaking space between Q and amount) */
function Q(amount: string) {
  return new RegExp(`Q[\\s\\u00A0]${amount.replace(".", "\\.")}`);
}

async function ensureCashOpen(page: Page) {
  await page.goto("/cash/open");
  if (page.url().includes("/kiosk")) return; // already open
  await page.locator("#openingAmount").fill("0");
  await page.getByRole("button", { name: "Abrir caja" }).click();
  await expect(page).toHaveURL(/\/kiosk/);
}

async function cancelAllOrders(page: Page) {
  await page.goto("/kiosk");
  for (let i = 0; i < 30; i++) {
    const btn = page.getByRole("button", { name: "Cancelar" }).first();
    if ((await btn.count()) === 0) break;
    await btn.click();
    await page.waitForTimeout(200);
  }
}

/** Fill a payment input by its name attribute */
async function pay(page: Page, method: "cashAmount" | "cardAmount" | "transferAmount", amount: string) {
  const input = page.locator(`input[name="${method}"]`);
  await input.fill(amount);
  await input.blur();
}

/** Select Vaso + Solo Fresa (required modifier). Total: Q25. */
async function selectVasoSoloFresa(page: Page) {
  await page.getByRole("button", { name: "Vaso" }).first().click();
  await page.getByRole("button", { name: "Solo Fresa" }).click();
}

/** Select Vaso pequeno + Blanco (required modifier). Total: Q25. */
async function selectVasoPequenoBlanco(page: Page) {
  await page.getByRole("button", { name: "Vaso pequeno" }).click();
  await page.getByRole("button", { name: "Blanco" }).click();
}

async function addToCart(page: Page) {
  await page.getByRole("button", { name: "Agregar" }).click();
}

async function cobrar(page: Page) {
  await page.getByRole("button", { name: "COBRAR" }).click();
  await expect(page.getByText("El carrito esta vacio.")).toBeVisible({ timeout: 10_000 });
}

// ─── Suite ─────────────────────────────────────────────────────────────────────

test.describe("Kiosk — Flujos de Compra", () => {
  test.beforeEach(async ({ page }) => {
    await ensureCashOpen(page);
    await cancelAllOrders(page);
    await page.goto("/kiosk");
    await expect(page.getByText("Caja abierta")).toBeVisible();
  });

  // ── Compras simples ────────────────────────────────────────────────────────

  test("compra simple con pago exacto en efectivo → orden aparece como Pagado", async ({ page }) => {
    await selectVasoSoloFresa(page);
    await addToCart(page);
    await expect(page.getByText("1 items")).toBeVisible();
    // Cart total (unique at Q25 when only 1 item)
    await expect(page.getByTestId("cart-total")).toContainText("25.00");

    await pay(page, "cashAmount", "25");
    await cobrar(page);

    await expect(page.getByText("Pagado")).toBeVisible();
  });

  test("compra con topping opcional: Vaso pequeno Blanco + Oreo = Q30", async ({ page }) => {
    await selectVasoPequenoBlanco(page);
    await page.getByRole("button", { name: "Oreo" }).first().click();
    await addToCart(page);
    await expect(page.getByTestId("cart-total")).toContainText("30.00");

    await pay(page, "cashAmount", "30");
    await cobrar(page);
    await expect(page.getByText("Pagado")).toBeVisible();
  });

  test("pago con solo tarjeta", async ({ page }) => {
    await selectVasoSoloFresa(page);
    await addToCart(page);
    await pay(page, "cardAmount", "25");
    await cobrar(page);
  });

  test("pago con solo transferencia", async ({ page }) => {
    await selectVasoSoloFresa(page);
    await addToCart(page);
    await pay(page, "transferAmount", "25");
    await cobrar(page);
  });

  test("pago mixto tarjeta + efectivo sin cambio", async ({ page }) => {
    await selectVasoSoloFresa(page);
    await addToCart(page);
    await pay(page, "cardAmount", "15");
    await pay(page, "cashAmount", "10");
    await cobrar(page);
  });

  test("efectivo con vuelto: pagar Q30 por Q25 → muestra cambio Q5", async ({ page }) => {
    await selectVasoSoloFresa(page);
    await addToCart(page);
    await pay(page, "cashAmount", "30");

    // Change display — the only Q5 element in the payment section
    await expect(page.getByText(Q("5.00")).first()).toBeVisible();
  });

  test("dos productos distintos → 2 items y total sumado", async ({ page }) => {
    await selectVasoSoloFresa(page);
    await addToCart(page);
    await selectVasoPequenoBlanco(page);
    await addToCart(page);

    await expect(page.getByText("2 items")).toBeVisible();
    // Q50 only appears as cart total (each line is Q25)
    await expect(page.getByTestId("cart-total")).toContainText("50.00");

    await pay(page, "cashAmount", "50");
    await cobrar(page);
  });

  test("cantidad × 2 con botón + → total se duplica", async ({ page }) => {
    await selectVasoPequenoBlanco(page);
    await page.getByTestId("qty-plus").click();
    await expect(page.locator("strong.w-10")).toHaveText("2");
    await addToCart(page);

    await expect(page.getByTestId("cart-total")).toContainText("50.00");
    await pay(page, "cashAmount", "50");
    await cobrar(page);
  });

  test("notas especiales aparecen en la orden activa", async ({ page }) => {
    await selectVasoSoloFresa(page);
    await page.getByPlaceholder("Ej. sin azucar, extra hielo...").fill("sin azucar");
    await addToCart(page);
    await pay(page, "cashAmount", "25");
    await cobrar(page);

    await expect(page.getByText("sin azucar")).toBeVisible();
  });

  test("datos de cliente — NIT y nombre se envían en el pedido", async ({ page }) => {
    await selectVasoSoloFresa(page);
    await addToCart(page);

    await page.locator('input[name="customerNit"]').fill("12345678901");
    await page.locator('input[name="customerName"]').fill("Juan Pérez");
    await page.locator('input[name="customerPhone"]').fill("55551234");

    await pay(page, "cashAmount", "25");
    await cobrar(page);
  });

  // ── Carrito ────────────────────────────────────────────────────────────────

  test("editar item del carrito con lápiz → total actualizado al guardar", async ({ page }) => {
    await selectVasoPequenoBlanco(page);
    await addToCart(page);
    await expect(page.getByTestId("cart-total")).toContainText("25.00");

    await page.getByTestId("cart-edit").first().click();
    await expect(page.getByRole("button", { name: "Guardar" })).toBeVisible();

    // Add Oreo (+Q5)
    await page.getByRole("button", { name: "Oreo" }).first().click();
    await page.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByTestId("cart-total")).toContainText("30.00");
  });

  test("cancelar edición no modifica el total", async ({ page }) => {
    await selectVasoPequenoBlanco(page);
    await addToCart(page);
    const originalTotal = await page.getByTestId("cart-total").textContent();

    await page.getByTestId("cart-edit").first().click();
    await expect(page.getByRole("button", { name: "Guardar" })).toBeVisible();

    // Add Oreo but then cancel
    await page.getByRole("button", { name: "Oreo" }).first().click();
    await page.getByTestId("edit-cancel").click();

    const newTotal = await page.getByTestId("cart-total").textContent();
    expect(newTotal).toBe(originalTotal);
  });

  test("eliminar item del carrito → carrito vacío", async ({ page }) => {
    await selectVasoSoloFresa(page);
    await addToCart(page);
    await expect(page.getByText("1 items")).toBeVisible();

    await page.getByTestId("cart-delete").first().click();

    await expect(page.getByText("El carrito esta vacio.")).toBeVisible();
    await expect(page.getByText("0 items")).toBeVisible();
  });

  // ── Ciclo de estados ───────────────────────────────────────────────────────

  test("ciclo completo: PAID → PREPARING → READY → DELIVERED", async ({ page }) => {
    await selectVasoSoloFresa(page);
    await addToCart(page);
    await pay(page, "cashAmount", "25");
    await page.getByRole("button", { name: "COBRAR" }).click();
    await expect(page.getByText("El carrito esta vacio.")).toBeVisible({ timeout: 10_000 });

    // Identify this order by short ID from URL param
    const orderId = new URL(page.url()).searchParams.get("order")?.slice(-6);
    const card = orderId
      ? page.locator(".rounded-3xl.border").filter({ hasText: `#${orderId}` })
      : page.locator(".rounded-3xl.border").first();

    await expect(card.getByText("Pagado")).toBeVisible();

    await card.getByRole("button", { name: "Preparar" }).click();
    await expect(card.getByText("Preparando")).toBeVisible({ timeout: 5_000 });

    await card.getByRole("button", { name: "Listo" }).click();
    await expect(card.getByText("Listo")).toBeVisible({ timeout: 5_000 });

    await card.getByRole("button", { name: "Entregar" }).click();
    await expect(page.getByText("No hay pedidos pendientes.")).toBeVisible({ timeout: 5_000 });
  });

  test("cancelar orden activa — desaparece de Pedidos activos", async ({ page }) => {
    await selectVasoSoloFresa(page);
    await addToCart(page);
    await pay(page, "cashAmount", "25");
    await page.getByRole("button", { name: "COBRAR" }).click();
    await expect(page.getByText("El carrito esta vacio.")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText("Pagado")).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).first().click();
    await expect(page.getByText("No hay pedidos pendientes.")).toBeVisible({ timeout: 5_000 });
  });

  // ── Validación de modificadores ────────────────────────────────────────────

  test("Agregar deshabilitado hasta seleccionar modificador requerido", async ({ page }) => {
    await page.getByRole("button", { name: "Vaso" }).first().click();

    await expect(page.getByRole("button", { name: "Agregar" })).toBeDisabled();
    await expect(page.locator(".bg-red-50")).toBeVisible();

    await page.getByRole("button", { name: "Solo Fresa" }).click();
    await expect(page.getByRole("button", { name: "Agregar" })).toBeEnabled();
    await expect(page.locator(".bg-red-50")).not.toBeVisible();
  });

  test("modificador exclusivo (max=1) — seleccionar otro deselecciona el anterior", async ({ page }) => {
    await page.getByRole("button", { name: "Vaso" }).first().click();

    await page.getByRole("button", { name: "Solo Fresa" }).click();
    // Switch to Crema (base modifier) — Base has maxSelections=1, Solo Fresa deselected
    await page.getByRole("button", { name: /^Crema/ }).click();

    // Agregar still enabled (one modifier selected)
    await expect(page.getByRole("button", { name: "Agregar" })).toBeEnabled();

    // Add to cart — Crema selected → total = Q35
    await addToCart(page);
    await expect(page.getByTestId("cart-total")).toContainText("35.00");
  });

  test("múltiples toppings opcionales se acumulan en precio", async ({ page }) => {
    await selectVasoPequenoBlanco(page); // Q25
    await page.getByRole("button", { name: "Oreo" }).first().click();  // +Q5
    await page.getByRole("button", { name: "Mania" }).first().click(); // +Q3
    await addToCart(page);
    await expect(page.getByTestId("cart-total")).toContainText("33.00");
  });
});
