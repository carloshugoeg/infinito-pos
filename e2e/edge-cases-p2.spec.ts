import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";

// Casos de borde P2-QA-03/04/05 (docs/GO_LIVE_CHECKLIST.md). Corre bajo el proyecto "kiosk"
// (storageState admin). P2-QA-01 (límite 60 líneas) y P2-QA-02 (pago duplicado por método)
// se cubren en src/domain/cart.test.ts: son guardas de dominio que la UI no puede expresar
// (un solo input por método de pago).

const stamp = () => Date.now().toString(36);

async function ensureCashOpen(page: Page) {
  await page.goto("/cash/open");
  if (page.url().includes("/kiosk")) return;
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

/** Vende una Fresas con Crema (Q36) en efectivo y espera a que el carrito quede vacío. */
async function sellCrema(page: Page) {
  // "Crema" resuelve a "Fresas con Crema" (clásica): exige 1 topping gratis de cortesía.
  await page.getByRole("button", { name: "Crema" }).first().click();
  const agregar = page.getByRole("button", { name: "Agregar" });
  if (!(await agregar.isEnabled())) {
    await page.getByRole("button", { name: "Oreo", exact: true }).first().click();
  }
  await agregar.click();
  const cash = page.locator('input[name="cashAmount"]');
  await cash.fill("36");
  await cash.blur();
  await page.getByRole("button", { name: "COBRAR" }).click();
  await expect(page.getByText("El carrito esta vacio.")).toBeVisible({ timeout: 10_000 });
}

async function downloadCsv(page: Page) {
  await page.goto("/admin/reports");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Exportar CSV" }).click()
  ]);
  const path = await download.path();
  return readFile(path, "utf8");
}

test.describe("Edge cases P2", () => {
  test.beforeEach(async ({ page }) => {
    await ensureCashOpen(page);
    await cancelAllOrders(page);
    await page.goto("/kiosk");
  });

  // P2-QA-03
  test("orden cancelada se excluye del CSV de reportes", async ({ page }) => {
    const customer = `Cliente E2E ${stamp()}`;
    await page.locator('input[name="customerName"]').fill(customer);
    await sellCrema(page);

    // La orden no cancelada aparece en el CSV.
    expect(await downloadCsv(page)).toContain(customer);

    // Cancelarla y reexportar: ya no debe aparecer (export filtra status != CANCELLED).
    await cancelAllOrders(page);
    expect(await downloadCsv(page)).not.toContain(customer);
  });

  // P2-QA-04
  test("venta con stock insuficiente se permite y alerta en inventario", async ({ page }) => {
    // El catálogo Infinito se siembra sin inventario, así que la venta deja stock negativo.
    await sellCrema(page);
    await page.goto("/admin/inventory");
    await expect(page.getByText("Bajo/negativo").first()).toBeVisible({ timeout: 10_000 });
  });

  // P2-QA-05
  test("10 ventas seguidas sin error ni órdenes duplicadas", async ({ page }) => {
    for (let i = 0; i < 10; i++) {
      await sellCrema(page);
    }
    const orderCards = page.locator(".rounded-3xl.border.border-\\[var\\(--border\\)\\]");
    await expect(orderCards).toHaveCount(10, { timeout: 10_000 });
  });
});
