import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Autenticación", () => {
  test("login válido redirige fuera de /login", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill("admin@koi.local");
    await page.locator('input[name="password"]').fill("admin12345");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/(kiosk|cash\/open|select-branch)/);
  });

  test("contraseña incorrecta muestra error genérico", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill("admin@koi.local");
    await page.locator('input[name="password"]').fill("wrongpassword");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Credenciales incorrectas.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("email inexistente muestra el mismo error genérico (sin enumerar usuarios)", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill("noexiste@koi.local");
    await page.locator('input[name="password"]').fill("admin12345");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Credenciales incorrectas.")).toBeVisible();
  });

  test("acceso directo a /kiosk sin sesión → /login", async ({ page }) => {
    await page.goto("/kiosk");
    await expect(page).toHaveURL(/\/login/);
  });

  test("acceso directo a /cash/open sin sesión → /login", async ({ page }) => {
    await page.goto("/cash/open");
    await expect(page).toHaveURL(/\/login/);
  });

  test("acceso directo a /admin sin sesión → /login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("logout limpia la sesión y bloquea acceso posterior", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill("admin@koi.local");
    await page.locator('input[name="password"]').fill("admin12345");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/(kiosk|cash\/open|select-branch)/);

    // Desktop sidebar logout button
    await page.getByRole("button", { name: "Salir del sistema" }).click();
    await expect(page).toHaveURL(/\/login/);

    // Session is gone — protected routes redirect to login
    await page.goto("/kiosk");
    await expect(page).toHaveURL(/\/login/);
  });

  test("sesión persiste tras recargar la página", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill("admin@koi.local");
    await page.locator('input[name="password"]').fill("admin12345");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/(kiosk|cash\/open|select-branch)/);

    const urlBefore = page.url();
    await page.reload();
    // Should stay on the same protected page, not redirect to login
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(new RegExp(new URL(urlBefore).pathname));
  });
});
