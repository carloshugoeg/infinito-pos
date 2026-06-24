import { CashSessionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatCurrency, toNumber } from "@/lib/utils";
import { isLowOrNegativeStock } from "@/domain/inventory";
import { getFinanceReport, type FinanceReport } from "@/server/reports/finance";
import { formatGuatemalaDate, guatemalaDayRange, guatemalaDayStart } from "@/lib/time";

const DAILY_SUMMARY_KIND = "daily_summary";
const STUB_RECIPIENT = "daily-report@stub.local";

export type DailySummary = {
  branchName: string;
  date: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  orderCount: number;
  averageTicket: number;
  revenueByMethod: { cash: number; card: number; transfer: number; delivery: number };
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  lowStock: Array<{ name: string; quantity: number; unit: string }>;
  cash: { expected: number; counted: number; difference: number } | null;
};

/**
 * Arma el resumen del dia a partir de datos ya consultados. Funcion pura:
 * separada del envio para poder testear el contenido sin tocar DB ni mandar correos.
 */
export function assembleDailySummary(input: {
  branchName: string;
  date: Date;
  finance: FinanceReport;
  lowStock: Array<{ name: string; quantity: number; unit: string }>;
  cash?: { expected: number; counted: number; difference: number } | null;
}): DailySummary {
  const { pnl, productProfitability } = input.finance;
  return {
    branchName: input.branchName,
    date: formatGuatemalaDate(input.date),
    revenue: pnl.revenue,
    cogs: pnl.cogs,
    grossProfit: pnl.grossProfit,
    expenses: pnl.totalExpenses,
    netProfit: pnl.netProfit,
    orderCount: pnl.orderCount,
    averageTicket: pnl.averageTicket,
    revenueByMethod: pnl.revenueByMethod,
    topProducts: productProfitability
      .slice(0, 5)
      .map((product) => ({ name: product.productName, quantity: product.quantity, revenue: product.revenue })),
    lowStock: input.lowStock,
    cash: input.cash ?? null
  };
}

export function renderDailySummaryHtml(summary: DailySummary): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px;color:#555">${label}</td><td style="padding:4px 12px;font-weight:700;text-align:right">${value}</td></tr>`;
  const topProducts = summary.topProducts.length
    ? summary.topProducts.map((product) => `<li>${product.name} — ${product.quantity} u — ${formatCurrency(product.revenue)}</li>`).join("")
    : "<li>Sin ventas</li>";
  const lowStock = summary.lowStock.length
    ? summary.lowStock.map((item) => `<li>${item.name}: ${item.quantity} ${item.unit}</li>`).join("")
    : "<li>Todo en orden</li>";
  const cashBlock = summary.cash
    ? `<p><strong>Caja:</strong> esperado ${formatCurrency(summary.cash.expected)}, contado ${formatCurrency(summary.cash.counted)}, diferencia ${formatCurrency(summary.cash.difference)}</p>`
    : "";

  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">` +
    `<h1 style="font-size:20px">Resumen diario — ${summary.branchName}</h1>` +
    `<p style="color:#888">${summary.date}</p>` +
    `<table style="width:100%;border-collapse:collapse">` +
    row("Ventas", formatCurrency(summary.revenue)) +
    row("Ordenes", String(summary.orderCount)) +
    row("Ticket promedio", formatCurrency(summary.averageTicket)) +
    row("Efectivo", formatCurrency(summary.revenueByMethod.cash)) +
    row("Tarjeta", formatCurrency(summary.revenueByMethod.card)) +
    row("Transferencia", formatCurrency(summary.revenueByMethod.transfer)) +
    row("Delivery", formatCurrency(summary.revenueByMethod.delivery)) +
    row("COGS", formatCurrency(summary.cogs)) +
    row("Utilidad bruta", formatCurrency(summary.grossProfit)) +
    row("Gastos", formatCurrency(summary.expenses)) +
    row("Utilidad neta", formatCurrency(summary.netProfit)) +
    `</table>` +
    cashBlock +
    `<h2 style="font-size:16px">Top productos</h2><ul>${topProducts}</ul>` +
    `<h2 style="font-size:16px">Alertas de stock</h2><ul>${lowStock}</ul>` +
    `</div>`;
}

/** Consulta los datos del dia y arma el resumen. */
export async function buildDailySummary(branchId: string, date: Date): Promise<DailySummary> {
  const range = guatemalaDayRange(date);
  const [branch, finance, inventory, cashSession] = await Promise.all([
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
    getFinanceReport(branchId, range),
    prisma.branchInventory.findMany({ where: { branchId }, include: { ingredient: true } }),
    prisma.cashSession.findFirst({
      where: { branchId, status: CashSessionStatus.CLOSED, closedAt: { gte: range.start, lt: range.end } },
      orderBy: { closedAt: "desc" }
    })
  ]);

  const lowStock = inventory
    .filter((item) => isLowOrNegativeStock(toNumber(item.quantityOnHand), toNumber(item.ingredient.lowStockThreshold)))
    .map((item) => ({ name: item.ingredient.name, quantity: toNumber(item.quantityOnHand), unit: item.ingredient.unit }));

  const cash = cashSession
    ? {
        expected: toNumber(cashSession.expectedCashAmount),
        counted: toNumber(cashSession.closingAmount),
        difference: toNumber(cashSession.cashDifference)
      }
    : null;

  return assembleDailySummary({ branchName: branch?.name ?? "Sucursal", date, finance, lowStock, cash });
}

/**
 * Arma y "envia" el resumen diario. Envio diferido: por ahora solo registra
 * EmailLog (candado de idempotencia) y loguea el HTML; aun no hay proveedor.
 */
export async function sendDailySummary(input: { branchId: string; date?: Date; sentTo?: string }) {
  const date = input.date ?? new Date();
  const forDate = guatemalaDayStart(date);
  const sentTo = input.sentTo ?? STUB_RECIPIENT;

  const existing = await prisma.emailLog.findUnique({
    where: { branchId_forDate_kind: { branchId: input.branchId, forDate, kind: DAILY_SUMMARY_KIND } }
  });
  if (existing) return { skipped: true as const };

  const summary = await buildDailySummary(input.branchId, date);
  const html = renderDailySummaryHtml(summary);

  // TODO: integrar proveedor (Resend/SMTP). Por ahora se loguea el contenido.
  console.log(`[daily-summary] ${summary.branchName} ${summary.date} -> ${sentTo}\n${html}`);

  try {
    await prisma.emailLog.create({
      data: { branchId: input.branchId, forDate, kind: DAILY_SUMMARY_KIND, sentTo }
    });
  } catch {
    // Carrera (cierre + cron el mismo dia): el unique actua de candado.
    return { skipped: true as const };
  }

  return { skipped: false as const, summary };
}
