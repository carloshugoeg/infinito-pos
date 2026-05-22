import { test, expect, type Page } from "@playwright/test";

async function closeAnyOpenSession(page: Page) {
  await page.goto("/cash/open");
  if (!page.url().includes("/cash/open")) {
    // Redirected to /kiosk → session is open, close it
    await page.goto("/cash/close");
    await page.locator("#closingAmount").fill("0");
    await page.getByRole("button", { name: "Cerrar caja" }).click();
    await expect(page).toHaveURL(/\/cash\/open/);
  }
}

test.describe("Gestión de sesión de caja", () => {
  test.beforeEach(async ({ page }) => {
    await closeAnyOpenSession(page);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: close any session opened during the test
    await page.goto("/cash/close");
    if (page.url().includes("/cash/close")) {
      await page.locator("#closingAmount").fill("0");
      await page.getByRole("button", { name: "Cerrar caja" }).click();
    }
  });

  test("abrir caja con Q0.00 — estado 'Caja abierta' visible en kiosk", async ({ page }) => {
    await expect(page.locator("#openingAmount")).toBeVisible();
    await page.locator("#openingAmount").fill("0");
    await page.getByRole("button", { name: "Abrir caja" }).click();

    await expect(page).toHaveURL(/\/kiosk/);
    await expect(page.getByText("Caja abierta")).toBeVisible();
    await expect(page.getByText(/Desde/)).toBeVisible();
  });

  test("abrir caja con Q500.00 — monto aparece en resumen de cierre", async ({ page }) => {
    await page.locator("#openingAmount").fill("500");
    await page.getByRole("button", { name: "Abrir caja" }).click();
    await expect(page).toHaveURL(/\/kiosk/);

    await page.goto("/cash/close");
    await expect(page.getByText(/Q[\s ]500\.00/).first()).toBeVisible();
  });

  test("campo monto inicial vacío es bloqueado por HTML required", async ({ page }) => {
    await page.locator("#openingAmount").fill("");
    await page.getByRole("button", { name: "Abrir caja" }).click();
    // Stays on /cash/open — HTML required prevents submit
    await expect(page).toHaveURL(/\/cash\/open/);
  });

  test("/cash/open con sesión activa redirige a /kiosk", async ({ page }) => {
    // Open a session first
    await page.locator("#openingAmount").fill("0");
    await page.getByRole("button", { name: "Abrir caja" }).click();
    await expect(page).toHaveURL(/\/kiosk/);

    // Navigate back to /cash/open — should redirect
    await page.goto("/cash/open");
    await expect(page).toHaveURL(/\/kiosk/);
  });

  test("/kiosk sin sesión de caja redirige a /cash/open", async ({ page }) => {
    // No session open (guaranteed by beforeEach)
    await page.goto("/kiosk");
    await expect(page).toHaveURL(/\/cash\/open/);
  });

  test("/cash/close sin sesión de caja redirige a /cash/open", async ({ page }) => {
    // No session open
    await page.goto("/cash/close");
    await expect(page).toHaveURL(/\/cash\/open/);
  });

  test("cerrar caja muestra resumen del turno con etiquetas correctas", async ({ page }) => {
    await page.locator("#openingAmount").fill("100");
    await page.getByRole("button", { name: "Abrir caja" }).click();
    await expect(page).toHaveURL(/\/kiosk/);

    await page.goto("/cash/close");
    await expect(page.getByRole("heading", { name: "Resumen del turno" })).toBeVisible();
    await expect(page.getByText("Monto inicial")).toBeVisible();
    await expect(page.getByText("Efectivo vendido")).toBeVisible();
    await expect(page.getByText("Efectivo esperado")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Conteo fisico" })).toBeVisible();
  });

  test("cerrar caja con conteo exacto al monto esperado", async ({ page }) => {
    await page.locator("#openingAmount").fill("100");
    await page.getByRole("button", { name: "Abrir caja" }).click();
    await expect(page).toHaveURL(/\/kiosk/);

    await page.goto("/cash/close");
    // No sales → expected = opening amount (Q100)
    await page.locator("#closingAmount").fill("100");
    await page.getByRole("button", { name: "Cerrar caja" }).click();
    await expect(page).toHaveURL(/\/cash\/open/);
  });

  test("cerrar caja con conteo mayor al esperado", async ({ page }) => {
    await page.locator("#openingAmount").fill("100");
    await page.getByRole("button", { name: "Abrir caja" }).click();
    await expect(page).toHaveURL(/\/kiosk/);

    await page.goto("/cash/close");
    await page.locator("#closingAmount").fill("150");
    await page.getByRole("button", { name: "Cerrar caja" }).click();
    await expect(page).toHaveURL(/\/cash\/open/);
  });

  test("cerrar caja con conteo menor al esperado", async ({ page }) => {
    await page.locator("#openingAmount").fill("100");
    await page.getByRole("button", { name: "Abrir caja" }).click();
    await expect(page).toHaveURL(/\/kiosk/);

    await page.goto("/cash/close");
    await page.locator("#closingAmount").fill("80");
    await page.getByRole("button", { name: "Cerrar caja" }).click();
    await expect(page).toHaveURL(/\/cash\/open/);
  });
});
