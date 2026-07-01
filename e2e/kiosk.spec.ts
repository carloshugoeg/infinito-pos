import { test, expect, type Page } from "@playwright/test";

/**
 * Suite del kiosco contra el catálogo REAL de Infinito (instructivo de menú).
 * Prerequisito de datos: `npm run db:seed && npm run db:seed:infinito`
 *   - db:seed crea el admin (admin@koi.local) y la sucursal CENTRO.
 *   - db:seed:infinito carga el menú: 3 clásicas + 5 gourmet + lista global de
 *     extras, y desactiva el resto, así que el kiosco solo muestra el menú real.
 * Las Fresas Clásicas exigen 1 topping gratis de cortesía (grupo requerido);
 * las Gourmet son de receta fija. "Para llevar" (tapadera / porta vasos /
 * souffle en chocolate) y los "Extras" son opcionales.
 */

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

/**
 * Selecciona un producto del menú. Las Fresas Clásicas exigen 1 topping gratis
 * de cortesía; si "Agregar" queda deshabilitado, elegimos el topping "Oreo"
 * (gratis) para satisfacer el grupo requerido. Las Gourmet no requieren nada.
 */
async function selectProduct(page: Page, name: string) {
  await page.getByRole("button", { name }).first().click();
  const agregar = page.getByRole("button", { name: "Agregar" });
  // Todo el menú exige elegir Chocolate (Blanco/Oscuro, gratis).
  const blanco = page.getByRole("button", { name: "Blanco", exact: true });
  if (await blanco.count()) await blanco.first().click();
  // Las clásicas además exigen 1 topping gratis de cortesía (Oreo).
  if (!(await agregar.isEnabled())) {
    await page.getByRole("button", { name: "Oreo", exact: true }).first().click();
  }
  await expect(agregar).toBeEnabled();
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

  test("compra simple con pago exacto en efectivo → orden aparece como Pendiente", async ({ page }) => {
    await selectProduct(page, "Fresas con Crema"); // Q36
    await addToCart(page);
    await expect(page.getByText("1 items")).toBeVisible();
    await expect(page.getByTestId("cart-total")).toContainText("36.00");

    await pay(page, "cashAmount", "36");
    await cobrar(page);

    await expect(page.getByText("Pendiente")).toBeVisible();
  });

  test("add-ons 'Para llevar' son gratis: no cambian el precio", async ({ page }) => {
    await selectProduct(page, "Fresas con Chocolate con Leche"); // Q39
    await page.getByRole("button", { name: "Tapadera" }).click();
    await page.getByRole("button", { name: "Porta vasos" }).click();
    await addToCart(page);
    // Los add-ons son priceDelta 0 → el total sigue siendo Q39.
    await expect(page.getByTestId("cart-total")).toContainText("39.00");

    await pay(page, "cashAmount", "39");
    await cobrar(page);
    await expect(page.getByText("Pendiente")).toBeVisible();
  });

  test("souffle de chocolate solo aparece en productos con chocolate", async ({ page }) => {
    await selectProduct(page, "Fresas con Chocolate con Leche");
    await expect(page.getByRole("button", { name: "Souffle de chocolate" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tapadera" })).toBeVisible();

    // El personalizador es un pop-up modal: cerrarlo antes de elegir otro vaso.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Agregar" })).toHaveCount(0);

    // Yogurt no es de chocolate → sin souffle, pero sí con tapadera/porta vasos.
    await selectProduct(page, "Parfait de Yogurt");
    await expect(page.getByRole("button", { name: "Souffle de chocolate" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Tapadera" })).toBeVisible();
  });

  test("pago con solo tarjeta", async ({ page }) => {
    await selectProduct(page, "Fresas con Crema");
    await addToCart(page);
    await pay(page, "cardAmount", "36");
    await cobrar(page);
  });

  test("pago con solo transferencia", async ({ page }) => {
    await selectProduct(page, "Fresas con Crema");
    await addToCart(page);
    await pay(page, "transferAmount", "36");
    await cobrar(page);
  });

  test("pago mixto tarjeta + efectivo sin cambio", async ({ page }) => {
    await selectProduct(page, "Fresas con Crema"); // Q36
    await addToCart(page);
    await pay(page, "cardAmount", "20");
    await pay(page, "cashAmount", "16");
    await cobrar(page);
  });

  test("efectivo con vuelto: pagar Q41 por Q36 → muestra cambio Q5", async ({ page }) => {
    await selectProduct(page, "Fresas con Crema"); // Q36
    await addToCart(page);
    await pay(page, "cashAmount", "41");

    // Change display — the only Q5 element in the payment section
    await expect(page.getByText(Q("5.00")).first()).toBeVisible();
  });

  test("dos productos distintos → 2 items y total sumado", async ({ page }) => {
    await selectProduct(page, "Fresas con Crema"); // Q36
    await addToCart(page);
    await selectProduct(page, "Gourmet Lotus"); // Q55
    await addToCart(page);

    await expect(page.getByText("2 items")).toBeVisible();
    await expect(page.getByTestId("cart-total")).toContainText("91.00");

    await pay(page, "cashAmount", "91");
    await cobrar(page);
  });

  test("stepper interno +1 → pide toppings del vaso 2 antes de habilitar Agregar", async ({ page }) => {
    await selectProduct(page, "Fresas con Crema"); // vaso 1 con sus toppings ya elegidos
    await page.getByTestId("qty-plus").click();
    await expect(page.locator("strong.w-10")).toHaveText("2");
    await expect(page.getByText("Vaso 2 de 2")).toBeVisible();

    const agregar = page.getByRole("button", { name: "Agregar" });
    await expect(agregar).toBeDisabled();

    await page.getByRole("button", { name: "Lotus", exact: true }).click();
    await expect(agregar).toBeEnabled();
    await agregar.click();

    await expect(page.getByText("2 items")).toBeVisible();
    await expect(page.getByTestId("cart-total")).toContainText("72.00");
    await pay(page, "cashAmount", "72");
    await cobrar(page);
  });

  test("vaso 1 y vaso 2 con toppings distintos en el mismo modal → 2 líneas separadas", async ({ page }) => {
    await selectProduct(page, "Fresas con Crema"); // vaso 1 → Oreo (via selectProduct's fallback)
    await page.getByTestId("qty-plus").click();
    await page.getByRole("button", { name: "Lotus", exact: true }).click(); // vaso 2 → Lotus
    await page.getByRole("button", { name: "Agregar" }).click();

    await expect(page.getByText("2 items")).toBeVisible();
    const modifiers = page.getByTestId("cart-line-modifiers");
    await expect(modifiers.nth(0)).toContainText("Oreo");
    await expect(modifiers.nth(1)).toContainText("Lotus");
  });

  test("notas especiales aparecen en la orden activa", async ({ page }) => {
    await selectProduct(page, "Fresas con Crema");
    await page.getByPlaceholder("Ej. sin azucar, extra hielo...").fill("sin azucar");
    await addToCart(page);
    await pay(page, "cashAmount", "36");
    await cobrar(page);

    await expect(page.getByText("sin azucar")).toBeVisible();
  });

  test("datos de cliente — NIT y nombre se envían en el pedido", async ({ page }) => {
    await selectProduct(page, "Fresas con Crema");
    await addToCart(page);

    await page.locator('input[name="customerNit"]').fill("12345678901");
    await page.locator('input[name="customerName"]').fill("Juan Pérez");
    await page.locator('input[name="customerPhone"]').fill("55551234");

    await pay(page, "cashAmount", "36");
    await cobrar(page);
  });

  // ── Carrito ────────────────────────────────────────────────────────────────

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

    await page.getByRole("button", { name: "Lotus", exact: true }).click();
    await expect(guardar).toBeEnabled();
    await guardar.click();

    await expect(page.getByText("2 items")).toBeVisible();
    await expect(page.getByTestId("cart-total")).toContainText("72.00");
  });

  test("cancelar edición no modifica el total", async ({ page }) => {
    await selectProduct(page, "Fresas con Crema");
    await addToCart(page);
    const originalTotal = await page.getByTestId("cart-total").textContent();

    await page.getByTestId("cart-edit").first().click();
    await expect(page.getByRole("button", { name: "Guardar" })).toBeVisible();

    // Cambiar cantidad pero cancelar.
    await page.getByTestId("qty-plus").click();
    await page.getByTestId("edit-cancel").click();

    const newTotal = await page.getByTestId("cart-total").textContent();
    expect(newTotal).toBe(originalTotal);
  });

  test("eliminar item del carrito → carrito vacío", async ({ page }) => {
    await selectProduct(page, "Fresas con Crema");
    await addToCart(page);
    await expect(page.getByText("1 items")).toBeVisible();

    await page.getByTestId("cart-delete").first().click();

    await expect(page.getByText("El carrito esta vacio.")).toBeVisible();
    await expect(page.getByText("0 items")).toBeVisible();
  });

  // ── Ciclo de estados ───────────────────────────────────────────────────────

  test("ciclo completo: PENDING → PREPARING → DELIVERED", async ({ page }) => {
    await selectProduct(page, "Fresas con Crema");
    await addToCart(page);
    await pay(page, "cashAmount", "36");
    await page.getByRole("button", { name: "COBRAR" }).click();
    await expect(page.getByText("El carrito esta vacio.")).toBeVisible({ timeout: 10_000 });

    // Identify this order by short ID from URL param
    const orderId = new URL(page.url()).searchParams.get("order")?.slice(-6);
    const card = orderId
      ? page.locator(".rounded-3xl.border").filter({ hasText: `#${orderId}` })
      : page.locator(".rounded-3xl.border").first();

    await expect(card.getByText("Pendiente")).toBeVisible();

    await card.getByRole("button", { name: "Preparar" }).click();
    await expect(card.getByText("Preparando")).toBeVisible({ timeout: 5_000 });

    await card.getByRole("button", { name: "Entregar" }).click();
    await expect(page.getByText("No hay pedidos pendientes.")).toBeVisible({ timeout: 5_000 });
  });

  test("cancelar orden activa — desaparece de Pedidos activos", async ({ page }) => {
    await selectProduct(page, "Fresas con Crema");
    await addToCart(page);
    await pay(page, "cashAmount", "36");
    await page.getByRole("button", { name: "COBRAR" }).click();
    await expect(page.getByText("El carrito esta vacio.")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText("Pendiente")).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).first().click();
    await expect(page.getByText("No hay pedidos pendientes.")).toBeVisible({ timeout: 5_000 });
  });
});
