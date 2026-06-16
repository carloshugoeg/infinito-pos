import { describe, expect, it } from "vitest";
import { assembleDailySummary, renderDailySummaryHtml } from "@/server/services/notifications";
import type { FinanceReport } from "@/server/reports/finance";

const finance: FinanceReport = {
  pnl: {
    revenue: 1000,
    cogs: 400,
    cogsPct: 40,
    grossProfit: 600,
    grossMarginPct: 60,
    totalExpenses: 250,
    expensesByCategory: { LOCAL: 250 },
    netProfit: 350,
    netMarginPct: 35,
    orderCount: 40,
    averageTicket: 25,
    revenueByMethod: { cash: 700, card: 200, transfer: 100, delivery: 150 }
  },
  productProfitability: [
    { productName: "Vaso Oreo", quantity: 20, revenue: 600, cost: 240, grossProfit: 360, marginPct: 60 },
    { productName: "Vaso Lotus", quantity: 10, revenue: 300, cost: 120, grossProfit: 180, marginPct: 60 },
    { productName: "Vaso Crema", quantity: 5, revenue: 100, cost: 40, grossProfit: 60, marginPct: 60 }
  ]
};

describe("daily summary assembly", () => {
  it("arma el resumen del dia a partir del reporte financiero, stock y caja", () => {
    const summary = assembleDailySummary({
      branchName: "Sucursal Centro",
      date: new Date(2026, 5, 7),
      finance,
      lowStock: [{ name: "Fresa", quantity: -2, unit: "g" }],
      cash: { expected: 700, counted: 690, difference: -10 }
    });

    expect(summary.branchName).toBe("Sucursal Centro");
    expect(summary.date).toBe("07/06/2026");
    expect(summary.revenue).toBe(1000);
    expect(summary.cogs).toBe(400);
    expect(summary.grossProfit).toBe(600);
    expect(summary.expenses).toBe(250);
    expect(summary.netProfit).toBe(350);
    expect(summary.orderCount).toBe(40);
    expect(summary.averageTicket).toBe(25);
    expect(summary.revenueByMethod).toEqual({ cash: 700, card: 200, transfer: 100, delivery: 150 });
    expect(summary.topProducts).toHaveLength(3);
    expect(summary.topProducts[0]).toEqual({ name: "Vaso Oreo", quantity: 20, revenue: 600 });
    expect(summary.lowStock).toEqual([{ name: "Fresa", quantity: -2, unit: "g" }]);
    expect(summary.cash).toEqual({ expected: 700, counted: 690, difference: -10 });
  });

  it("limita el top de productos a 5", () => {
    const many: FinanceReport = {
      ...finance,
      productProfitability: Array.from({ length: 8 }, (_, index) => ({
        productName: `P${index}`,
        quantity: index,
        revenue: 100 - index,
        cost: 0,
        grossProfit: 100 - index,
        marginPct: 100
      }))
    };
    const summary = assembleDailySummary({ branchName: "X", date: new Date(2026, 5, 7), finance: many, lowStock: [] });
    expect(summary.topProducts).toHaveLength(5);
    expect(summary.cash).toBeNull();
  });
});

describe("daily summary html", () => {
  it("incluye los datos clave en el HTML", () => {
    const summary = assembleDailySummary({
      branchName: "Sucursal Centro",
      date: new Date(2026, 5, 7),
      finance,
      lowStock: [{ name: "Fresa", quantity: -2, unit: "g" }],
      cash: { expected: 700, counted: 690, difference: -10 }
    });
    const html = renderDailySummaryHtml(summary);

    expect(html).toContain("Sucursal Centro");
    expect(html).toContain("07/06/2026");
    expect(html).toContain("Utilidad neta");
    expect(html).toContain("Delivery");
    expect(html).toContain("Vaso Oreo");
    expect(html).toContain("Fresa");
    expect(html.startsWith("<")).toBe(true);
  });
});
