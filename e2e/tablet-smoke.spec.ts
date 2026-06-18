import { test, expect, type Page } from "@playwright/test";

// P1-QA-06: smoke del kiosco en viewport tablet (768×1024, el del piloto). Corre bajo el
// proyecto "kiosk" (storageState admin); test.use sobrescribe el viewport a tablet.
test.use({ viewport: { width: 768, height: 1024 } });

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

test.describe("Smoke kiosko en tablet (768×1024)", () => {
  test("venta simple en efectivo desde tablet", async ({ page }) => {
    await ensureCashOpen(page);
    await cancelAllOrders(page);
    await page.goto("/kiosk");
    await expect(page.getByText("Caja abierta")).toBeVisible();

    // "Crema" → "Fresas con Crema" (clásica): exige 1 topping gratis de cortesía.
    await page.getByRole("button", { name: "Crema" }).first().click();
    const agregar = page.getByRole("button", { name: "Agregar" });
    if (!(await agregar.isEnabled())) {
      await page.getByRole("button", { name: "Oreo", exact: true }).first().click();
    }
    await expect(agregar).toBeEnabled();
    await agregar.click();

    const cash = page.locator('input[name="cashAmount"]');
    await cash.fill("36");
    await cash.blur();
    await page.getByRole("button", { name: "COBRAR" }).click();

    await expect(page.getByText("El carrito esta vacio.")).toBeVisible({ timeout: 10_000 });
    // La orden recién cobrada aparece en el panel de preparación.
    await expect(page.getByRole("button", { name: "Cancelar" }).first()).toBeVisible();
  });
});
