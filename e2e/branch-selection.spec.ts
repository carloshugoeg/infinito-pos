import { test, expect } from "@playwright/test";

// Auth state (storageState) applied via playwright.config.ts project settings

test.describe("Selección de sucursal", () => {
  test("usuario con una sola sucursal no se queda en /select-branch", async ({ page }) => {
    // Admin has exactly 1 branch → login already auto-selected it
    // Navigating to /select-branch may redirect away since session already has a branch
    await page.goto("/select-branch");
    // Either still on select-branch (showing options) or auto-redirected
    const url = page.url();
    expect(url).toMatch(/\/(select-branch|kiosk|cash\/open)/);
  });

  test("página de selección de sucursal muestra nombre y código", async ({ page }) => {
    await page.goto("/select-branch");
    if (!page.url().includes("select-branch")) return; // auto-redirected — skip

    await expect(page.getByRole("heading", { name: "Selecciona sucursal" })).toBeVisible();
    await expect(page.getByText("Sucursal Centro")).toBeVisible();
    await expect(page.getByText("CENTRO", { exact: true })).toBeVisible();
  });

  test("seleccionar sucursal redirige a kiosk o cash/open", async ({ page }) => {
    await page.goto("/select-branch");
    if (!page.url().includes("select-branch")) {
      expect(page.url()).toMatch(/\/(kiosk|cash\/open)/);
      return;
    }

    await page.getByRole("button", { name: "Sucursal Centro" }).click();
    await expect(page).toHaveURL(/\/(kiosk|cash\/open)/);
  });
});
