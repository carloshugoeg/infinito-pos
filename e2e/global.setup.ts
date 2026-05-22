import path from "path";
import { test as setup, expect } from "@playwright/test";

const authFile = path.join(__dirname, ".auth/admin.json");

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Koi POS" })).toBeVisible();

  await page.locator('input[name="email"]').fill("admin@koi.local");
  await page.locator('input[name="password"]').fill("admin12345");
  await page.getByRole("button", { name: "Entrar" }).click();

  // Single-branch user auto-selects branch and lands on /kiosk or /cash/open
  await expect(page).toHaveURL(/\/(kiosk|cash\/open|select-branch)/);

  await page.context().storageState({ path: authFile });
});
