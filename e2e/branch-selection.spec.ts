import { test, expect } from "@playwright/test";

// Auth state (storageState) applied via playwright.config.ts project settings.
// The test account belongs to two TEST branches (TESTS, TESTS2).

test.describe("Selección de sucursal", () => {
  test("el selector muestra las sucursales de prueba", async ({ page }) => {
    await page.goto("/select-branch");
    if (!page.url().includes("select-branch")) return; // already has an active branch → redirected

    await expect(page.getByRole("heading", { name: "Selecciona sucursal" })).toBeVisible();
    await expect(page.getByText("Sucursal de Pruebas", { exact: true })).toBeVisible();
    await expect(page.getByText("TESTS", { exact: true })).toBeVisible();
    await expect(page.getByText("TESTS2", { exact: true })).toBeVisible();
  });

  test("seleccionar la sucursal de pruebas redirige a kiosk o cash/open", async ({ page }) => {
    await page.goto("/select-branch");
    if (!page.url().includes("select-branch")) {
      expect(page.url()).toMatch(/\/(kiosk|cash\/open)/);
      return;
    }

    await page.getByText("TESTS", { exact: true }).click();
    await expect(page).toHaveURL(/\/(kiosk|cash\/open)/);
  });
});
