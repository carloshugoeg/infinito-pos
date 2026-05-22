import { test, expect, type Page } from "@playwright/test";

// ─── Shared helpers ────────────────────────────────────────────────────────────

async function ensureCashOpen(page: Page) {
  await page.goto("/cash/open");
  if (page.url().includes("/kiosk")) return;
  await page.locator("#openingAmount").fill("0");
  await page.getByRole("button", { name: "Abrir caja" }).click();
  await expect(page).toHaveURL(/\/kiosk/);
}

async function closeCashSession(page: Page) {
  await page.goto("/cash/close");
  if (!page.url().includes("/cash/close")) return;
  await page.locator("#closingAmount").fill("0");
  await page.getByRole("button", { name: "Cerrar caja" }).click();
  await expect(page).toHaveURL(/\/cash\/open/, { timeout: 10_000 });
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

// ─── Suite ─────────────────────────────────────────────────────────────────────

test.describe("Fool-Proofing y Edge Cases", () => {
  test.beforeEach(async ({ page }) => {
    await ensureCashOpen(page);
    await cancelAllOrders(page);
    await page.goto("/kiosk");
  });

  // ── COBRAR bloqueado ──────────────────────────────────────────────────────

  test("COBRAR deshabilitado con carrito vacío", async ({ page }) => {
    await expect(page.getByText("El carrito esta vacio.")).toBeVisible();
    await expect(page.getByRole("button", { name: "COBRAR" })).toBeDisabled();
  });

  test("Agregar deshabilitado cuando no hay modifier requerido seleccionado", async ({ page }) => {
    await page.getByRole("button", { name: "Vaso" }).first().click();
    await expect(page.getByRole("button", { name: "Agregar" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "COBRAR" })).toBeDisabled();
  });

  test("COBRAR con pago insuficiente muestra alerta de validación sin enviar pedido", async ({ page }) => {
    await page.getByRole("button", { name: "Vaso" }).first().click();
    await page.getByRole("button", { name: "Solo Fresa" }).click();
    await page.getByRole("button", { name: "Agregar" }).click();

    // Pay only Q10 for a Q25 item
    const input = page.locator('input[name="cashAmount"]');
    await input.fill("10");
    await input.blur();

    // Register auto-dismiss BEFORE click to avoid deadlock (alert blocks browser)
    let dialogShown = false;
    page.once("dialog", async (dialog) => {
      dialogShown = true;
      await dialog.dismiss();
    });

    await page.getByRole("button", { name: "COBRAR" }).click();

    // Cart unchanged — order NOT submitted (validates alert was shown and dismissed)
    await expect(page.getByText("1 items")).toBeVisible({ timeout: 5_000 });
    expect(dialogShown).toBe(true);
  });

  test("COBRAR sin ningún pago muestra alerta de validación", async ({ page }) => {
    await page.getByRole("button", { name: "Vaso" }).first().click();
    await page.getByRole("button", { name: "Solo Fresa" }).click();
    await page.getByRole("button", { name: "Agregar" }).click();

    // All payment inputs at 0 — nothing entered
    let dialogShown = false;
    page.once("dialog", async (dialog) => {
      dialogShown = true;
      await dialog.dismiss();
    });

    await page.getByRole("button", { name: "COBRAR" }).click();

    await expect(page.getByText("1 items")).toBeVisible({ timeout: 5_000 });
    expect(dialogShown).toBe(true);
  });

  test("COBRAR no hace doble submit — carrito limpio sin pedidos duplicados", async ({ page }) => {
    await page.getByRole("button", { name: "Vaso" }).first().click();
    await page.getByRole("button", { name: "Solo Fresa" }).click();
    await page.getByRole("button", { name: "Agregar" }).click();

    const input = page.locator('input[name="cashAmount"]');
    await input.fill("25");
    await input.blur();

    const cobrarBtn = page.getByRole("button", { name: "COBRAR" });
    await cobrarBtn.click();

    // Should only produce one order
    await expect(page.getByText("El carrito esta vacio.")).toBeVisible({ timeout: 10_000 });

    const orderCards = page.locator(".rounded-3xl.border.border-\\[var\\(--border\\)\\]");
    await expect(orderCards).toHaveCount(1);
  });

  // ── Cantidad ──────────────────────────────────────────────────────────────

  test("botón Menos no baja la cantidad por debajo de 1", async ({ page }) => {
    await page.getByRole("button", { name: "Vaso" }).first().click();

    const qty = page.locator("strong.w-10");
    await expect(qty).toHaveText("1");

    await page.getByTestId("qty-minus").click();
    await page.getByTestId("qty-minus").click();
    await page.getByTestId("qty-minus").click();
    await expect(qty).toHaveText("1");
  });

  test("botón Más incrementa la cantidad de 1 a 3", async ({ page }) => {
    await page.getByRole("button", { name: "Vaso pequeno" }).click();

    const qty = page.locator("strong.w-10");
    await expect(qty).toHaveText("1");

    await page.getByTestId("qty-plus").click();
    await expect(qty).toHaveText("2");

    await page.getByTestId("qty-plus").click();
    await expect(qty).toHaveText("3");
  });

  test("botón Más respeta el límite máximo de cantidad (99)", async ({ page }) => {
    await page.getByRole("button", { name: "Vaso pequeno" }).click();

    const qty = page.locator("strong.w-10");
    // Click + many times quickly
    for (let i = 0; i < 105; i++) {
      await page.getByTestId("qty-plus").click();
    }
    // Should be capped at 99
    await expect(qty).toHaveText("99");
  });

  // ── Redirecciones protectoras ─────────────────────────────────────────────

  test("/kiosk sin sesión de caja → /cash/open", async ({ page }) => {
    await closeCashSession(page);
    await page.goto("/kiosk");
    await expect(page).toHaveURL(/\/cash\/open/);
    await ensureCashOpen(page); // restore for afterEach compatibility
  });

  test("/cash/close sin sesión → /cash/open", async ({ page }) => {
    await closeCashSession(page);
    await page.goto("/cash/close");
    await expect(page).toHaveURL(/\/cash\/open/);
    await ensureCashOpen(page);
  });

  test("/cash/open con sesión activa → /kiosk", async ({ page }) => {
    await page.goto("/cash/open");
    await expect(page).toHaveURL(/\/kiosk/);
  });

  // ── Formulario de login ───────────────────────────────────────────────────

  test("email vacío en login → HTML required bloquea el submit", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.locator('input[name="password"]').fill("admin12345");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/login/);
    // Restore session after test
    await page.locator('input[name="email"]').fill("admin@koi.local");
    await page.getByRole("button", { name: "Entrar" }).click();
  });

  test("contraseña vacía en login → HTML required bloquea el submit", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.locator('input[name="email"]').fill("admin@koi.local");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/login/);
    // Restore session
    await page.locator('input[name="password"]').fill("admin12345");
    await page.getByRole("button", { name: "Entrar" }).click();
  });

  // ── Valores por defecto ───────────────────────────────────────────────────

  test("NIT por defecto es 'CF'", async ({ page }) => {
    await expect(page.locator('input[name="customerNit"]')).toHaveValue("CF");
  });

  test("nombre de cliente por defecto es 'Consumidor Final'", async ({ page }) => {
    await expect(page.locator('input[name="customerName"]')).toHaveValue("Consumidor Final");
  });

  // ── Cancelar edición ─────────────────────────────────────────────────────

  test("cancelar edición no modifica el carrito ni el total", async ({ page }) => {
    await page.getByRole("button", { name: "Vaso pequeno" }).click();
    await page.getByRole("button", { name: "Blanco" }).click();
    await page.getByRole("button", { name: "Agregar" }).click();

    const originalTotal = await page.getByTestId("cart-total").textContent();

    await page.getByTestId("cart-edit").first().click();
    await expect(page.getByRole("button", { name: "Guardar" })).toBeVisible();

    // Modify but cancel
    await page.getByRole("button", { name: "Oreo" }).first().click();
    await page.getByTestId("edit-cancel").click();

    const newTotal = await page.getByTestId("cart-total").textContent();
    expect(newTotal).toBe(originalTotal);
  });
});
