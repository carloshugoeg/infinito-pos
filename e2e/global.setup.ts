import path from "path";
import { test as setup, expect } from "@playwright/test";
import { assertNonProductionDatabase } from "../src/lib/test-guard";

const authFile = path.join(__dirname, ".auth/admin.json");

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? "qa@koi.local";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? "qatest12345";

setup("authenticate as the test account", async ({ page }) => {
  // Never let the E2E suite run against the production client database.
  assertNonProductionDatabase("playwright e2e");

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Koi POS" })).toBeVisible();

  await page.locator('input[name="email"]').fill(TEST_EMAIL);
  await page.locator('input[name="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  // The test account belongs to TESTS + TESTS2, so login lands on the branch picker.
  await expect(page).toHaveURL(/\/select-branch/);
  // Select the primary TESTS branch by its exact code (distinct from "TESTS2").
  await page.getByText("TESTS", { exact: true }).click();

  await expect(page).toHaveURL(/\/(kiosk|cash\/open)/);

  await page.context().storageState({ path: authFile });
});
