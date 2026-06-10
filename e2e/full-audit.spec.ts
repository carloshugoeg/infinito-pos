/**
 * Auditoría E2E completa — cubre módulos admin no testeados en specs existentes.
 * Las ventas usan el catálogo real (producto "Crema", Q35). Los datos creados
 * llevan sufijo de timestamp; no modifican el catálogo sembrado.
 * Prerequisito de datos: `npm run db:seed && npm run db:seed:infinito`.
 */
import { test, expect, type Page } from "@playwright/test";

const stamp = () => Date.now().toString().slice(-6);

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
    await page.waitForTimeout(250);
  }
}

/** Read the "Efectivo vendido" amount from the open cash-close summary. */
async function readCashSold(page: Page) {
  await page.goto("/cash/close");
  const cell = page.locator("div.flex.justify-between").filter({ hasText: "Efectivo vendido" }).locator("strong");
  await expect(cell).toBeVisible();
  const text = (await cell.textContent()) ?? "";
  return Number(text.replace(/[^\d.]/g, ""));
}

// ─── ADMIN: Navegación y panel ───────────────────────────────────────────────

test.describe("Auditoría — Panel admin y navegación", () => {
  test("panel /admin muestra todos los módulos", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Administracion" })).toBeVisible();
    for (const title of ["Sucursales", "Usuarios", "Catalogo", "Ingredientes", "Inventario", "Reportes", "Gastos", "Finanzas"]) {
      await expect(page.locator("main").getByRole("link", { name: title })).toBeVisible();
    }
  });

  test("sidebar admin: enlaces Reportes, Gastos, Finanzas, Ajustes", async ({ page }) => {
    await page.goto("/kiosk");
    await expect(page.getByRole("link", { name: "Reportes" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Gastos" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Finanzas" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ajustes" })).toBeVisible();
  });

  test("flujo: admin → sucursales → usuarios → catálogo (sin error 500)", async ({ page }) => {
    const routes = ["/admin/branches", "/admin/users", "/admin/catalog", "/admin/ingredients", "/admin/inventory"];
    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status(), `${route} status`).toBeLessThan(500);
      await expect(page.locator("body")).not.toContainText("Application error");
      await expect(page.locator("body")).not.toContainText("PrismaClient");
    }
  });
});

// ─── ADMIN: Sucursales ───────────────────────────────────────────────────────

test.describe("Auditoría — Sucursales", () => {
  const code = `E2E${stamp()}`;

  test("crear sucursal → aparece en listado → editar nombre", async ({ page }) => {
    await page.goto("/admin/branches");
    const createForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Crear" }) }).first();
    await createForm.locator('input[name="name"]').fill(`Sucursal E2E ${code}`);
    await createForm.locator('input[name="code"]').fill(code);
    await createForm.locator('input[name="address"]').fill("Direccion prueba");
    await page.getByRole("button", { name: "Crear" }).click();
    // Listing renders the branch inside inputs (defaultValue), not plain text.
    const card = page.locator(".rounded-\\[1\\.5rem\\]").filter({ has: page.locator(`input[value="${code}"]`) });
    await expect(card.locator('input[name="name"]')).toHaveValue(`Sucursal E2E ${code}`, { timeout: 10_000 });

    await card.locator('input[name="name"]').fill(`Sucursal E2E Editada ${code}`);
    await card.getByRole("button", { name: "Guardar" }).click();
    await expect(card.locator('input[name="name"]')).toHaveValue(`Sucursal E2E Editada ${code}`, { timeout: 10_000 });
  });
});

// ─── ADMIN: Usuarios + rol OPERATOR ──────────────────────────────────────────

test.describe("Auditoría — Usuarios y permisos OPERATOR", () => {
  const email = `e2e.op.${stamp()}@koi.local`;

  test("crear operador → login → bloqueado en /admin", async ({ browser }) => {
    const adminContext = await browser.newContext({ storageState: "e2e/.auth/admin.json" });
    const adminPage = await adminContext.newPage();

    await adminPage.goto("/admin/users");
    await adminPage.locator('form:has(button:text("Crear")) input[name="name"]').fill(`Operador E2E ${stamp()}`);
    const createForm = adminPage.locator("form").filter({ has: adminPage.getByRole("button", { name: "Crear" }) }).first();
    await createForm.locator('input[name="email"]').fill(email);
    await createForm.locator('input[name="password"]').fill("operator12345");
    await createForm.locator('select[name="role"]').selectOption("OPERATOR");
    await createForm.locator('input[name="branchIds"]').first().check();
    await adminPage.getByRole("button", { name: "Crear" }).click();
    // Listing renders the email inside an input (defaultValue), not plain text.
    await expect(adminPage.locator(`input[value="${email}"]`)).toBeVisible({ timeout: 10_000 });
    await adminContext.close();

    const opContext = await browser.newContext();
    const opPage = await opContext.newPage();
    await opPage.goto("/login");
    await opPage.locator('input[name="email"]').fill(email);
    await opPage.locator('input[name="password"]').fill("operator12345");
    await opPage.getByRole("button", { name: "Entrar" }).click();
    await expect(opPage).toHaveURL(/\/(kiosk|cash\/open|select-branch)/);

    await opPage.goto("/admin");
    await expect(opPage).toHaveURL(/\/kiosk/);
    await expect(opPage.getByRole("link", { name: "Administracion" })).not.toBeVisible();
    await opContext.close();
  });
});

// ─── ADMIN: Catálogo ─────────────────────────────────────────────────────────

test.describe("Auditoría — Catálogo", () => {
  const productName = `Producto E2E ${stamp()}`;

  test("crear producto → visible en kiosco tras activar", async ({ page }) => {
    await page.goto("/admin/catalog");
    const createForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Crear producto" }) });
    await createForm.locator('input[name="name"]').fill(productName);
    await createForm.locator('input[name="basePrice"]').fill("15");
    await createForm.getByRole("button", { name: "Crear producto" }).click();
    // "Productos configurados" renders the name inside an input; <option> copies would break getByText strict mode.
    await expect(page.locator(`input[name="name"][value="${productName}"]`)).toBeVisible({ timeout: 10_000 });

    await ensureCashOpen(page);
    await page.goto("/kiosk");
    await expect(page.getByRole("button", { name: productName })).toBeVisible();
  });
});

// ─── ADMIN: Ingredientes + Inventario ────────────────────────────────────────

test.describe("Auditoría — Ingredientes e inventario", () => {
  test("crear ingrediente → compra → merma (stock 100 → 80)", async ({ page }) => {
    const ingName = `Ingrediente E2E ${stamp()}`;
    await page.goto("/admin/ingredients");
    const createForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Crear" }) }).first();
    await createForm.locator('input[name="name"]').fill(ingName);
    await createForm.locator('input[name="unit"]').fill("g");
    await createForm.locator('input[name="costPerUnit"]').fill("1.5");
    await createForm.locator('input[name="lowStockThreshold"]').fill("10");
    await createForm.getByRole("button", { name: "Crear" }).click();
    // Listing renders the ingredient name inside an input (defaultValue), not plain text.
    await expect(page.locator(`input[value="${ingName}"]`)).toBeVisible({ timeout: 10_000 });

    await page.goto("/admin/inventory");
    await page.locator('select[name="ingredientId"]').selectOption({ label: `${ingName} (g)` });
    await page.locator('select[name="type"]').selectOption("PURCHASE");
    await page.locator('input[name="quantity"]').fill("100");
    await page.locator('input[name="reason"]').fill("Compra E2E");
    await page.getByRole("button", { name: "Registrar" }).click();
    // "Stock actual" cell renders quantity with unit ("100 g"); movement rows show the raw delta, so scope by unit to avoid strict-mode matches.
    await expect(page.locator("tr").filter({ hasText: ingName }).filter({ hasText: "100 g" })).toBeVisible({ timeout: 10_000 });

    await page.locator('select[name="ingredientId"]').selectOption({ label: `${ingName} (g)` });
    await page.locator('select[name="type"]').selectOption("WASTE");
    await page.locator('input[name="quantity"]').fill("20");
    await page.locator('input[name="reason"]').fill("Merma E2E");
    await page.getByRole("button", { name: "Registrar" }).click();
    await expect(page.locator("tr").filter({ hasText: ingName }).filter({ hasText: "80 g" })).toBeVisible({ timeout: 10_000 });
  });
});

// ─── ADMIN: Reportes y CSV ───────────────────────────────────────────────────

test.describe("Auditoría — Reportes", () => {
  test.beforeEach(async ({ page }) => {
    await ensureCashOpen(page);
    await cancelAllOrders(page);
  });

  test("venta genera datos en reportes y CSV descargable", async ({ page }) => {
    await page.goto("/kiosk");
    await page.getByRole("button", { name: "Crema" }).first().click();
    await page.getByRole("button", { name: "Agregar" }).click();
    const cash = page.locator('input[name="cashAmount"]');
    await cash.fill("35");
    await cash.blur();
    await page.getByRole("button", { name: "COBRAR" }).click();
    await expect(page.getByText("El carrito esta vacio.")).toBeVisible({ timeout: 10_000 });

    await page.goto("/admin/reports");
    await expect(page.getByText("Ventas")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Productos mas vendidos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Corte diario estilo Excel" })).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Exportar CSV" }).click()
    ]);
    expect(download.suggestedFilename()).toMatch(/reporte-.*\.csv/);
  });
});

// ─── ADMIN: Gastos y Finanzas ────────────────────────────────────────────────

test.describe("Auditoría — Gastos y finanzas", () => {
  test("registrar gasto → visible en listado y finanzas", async ({ page }) => {
    const desc = `Gasto E2E ${stamp()}`;
    await page.goto("/admin/expenses");
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Guardar gasto" }) });
    await form.locator('input[name="description"]').fill(desc);
    await form.locator('input[name="amount"]').fill("150");
    await form.getByRole("button", { name: "Guardar gasto" }).click();
    await expect(page.getByText(desc)).toBeVisible({ timeout: 10_000 });

    await page.goto("/admin/finance");
    await expect(page.getByText("Gastos (OPEX)")).toBeVisible();
    await expect(page.getByText("Utilidad neta")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rentabilidad por producto" })).toBeVisible();
  });

  test("crear gasto recurrente y activar/desactivar", async ({ page }) => {
    const desc = `Recurrente E2E ${stamp()}`;
    await page.goto("/admin/expenses");
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Crear recurrente" }) });
    await form.locator('input[name="description"]').fill(desc);
    await form.locator('input[name="amount"]').fill("500");
    await form.getByRole("button", { name: "Crear recurrente" }).click();
    await expect(page.getByText(desc)).toBeVisible({ timeout: 10_000 });

    const row = page.locator("tr").filter({ hasText: desc });
    await row.getByRole("button", { name: "Desactivar" }).click();
    await expect(row.getByText("Inactivo")).toBeVisible({ timeout: 10_000 });
  });
});

// ─── ADMIN: Ajustes ──────────────────────────────────────────────────────────

test.describe("Auditoría — Ajustes", () => {
  test("cambiar nombre empresa se refleja en sidebar", async ({ page }) => {
    const name = `E2E Co ${stamp()}`;
    await page.goto("/admin/settings");
    await page.locator('input[name="companyName"]').fill(name);
    // Wait for the server action POST so the new name is persisted/revalidated before navigating.
    await Promise.all([
      page.waitForResponse((res) => res.url().includes("/admin/settings") && res.request().method() === "POST"),
      page.getByRole("button", { name: "Guardar Ajustes" }).click()
    ]);
    await page.goto("/kiosk");
    // Desktop sidebar collapses the name visually; it stays identifiable via the link aria-label (E-009).
    await expect(page.locator(`aside a[aria-label="${name}"]`)).toBeVisible({ timeout: 10_000 });
  });

  test("activar retícula táctil de modificadores", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.locator('input[name="modifierGridEnabled"]').check();
    await page.getByRole("button", { name: "Guardar Ajustes" }).click();
    await ensureCashOpen(page);
    await page.goto("/kiosk");
    await page.getByRole("button", { name: "Crema" }).first().click();
    // Grid mode uses larger layout classes — page should not error
    await expect(page.getByRole("button", { name: "Tapadera" })).toBeVisible();
  });
});

// ─── KIOSCO: Flujo de estados actualizado (PENDING → PREPARING → DELIVERED) ─

test.describe("Auditoría — Ciclo de preparación (estados actuales)", () => {
  test.beforeEach(async ({ page }) => {
    await ensureCashOpen(page);
    await cancelAllOrders(page);
    await page.goto("/kiosk");
  });

  test("Pendiente → Preparar → Preparando → Entregar → desaparece", async ({ page }) => {
    await page.getByRole("button", { name: "Crema" }).first().click();
    await page.getByRole("button", { name: "Agregar" }).click();
    const cash = page.locator('input[name="cashAmount"]');
    await cash.fill("35");
    await cash.blur();
    await page.getByRole("button", { name: "COBRAR" }).click();
    await expect(page.getByText("El carrito esta vacio.")).toBeVisible({ timeout: 10_000 });

    const card = page.locator(".rounded-3xl.border").first();
    await expect(card.getByText("Pendiente")).toBeVisible();
    await card.getByRole("button", { name: "Preparar" }).click();
    await expect(card.getByText("Preparando")).toBeVisible({ timeout: 5_000 });
    await card.getByRole("button", { name: "Entregar" }).click();
    await expect(page.getByText("No hay pedidos pendientes.")).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Caja: venta reflejada en cierre ─────────────────────────────────────────

test.describe("Auditoría — Caja con ventas", () => {
  test("venta en efectivo incrementa resumen de cierre", async ({ page }) => {
    await ensureCashOpen(page);

    // Baseline before the sale — the session is shared across the suite, so assert a delta.
    const before = await readCashSold(page);

    await page.goto("/kiosk");
    await page.getByRole("button", { name: "Crema" }).first().click();
    await page.getByRole("button", { name: "Agregar" }).click();
    const cash = page.locator('input[name="cashAmount"]');
    await cash.fill("35");
    await cash.blur();
    await page.getByRole("button", { name: "COBRAR" }).click();
    await expect(page.getByText("El carrito esta vacio.")).toBeVisible({ timeout: 10_000 });

    const after = await readCashSold(page);
    expect(after - before).toBeCloseTo(35, 2);
  });
});
