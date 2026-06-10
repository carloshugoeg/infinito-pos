import { describe, expect, it } from "vitest";
import { computeProfitAndLoss } from "@/domain/finance";

describe("finance domain", () => {
  it("calcula utilidad bruta, neta, margenes y ticket promedio", () => {
    const pnl = computeProfitAndLoss({
      revenue: 1000,
      revenueByMethod: { cash: 600, card: 300, transfer: 100 },
      cogs: 400,
      expensesByCategory: { LOCAL: 200, SERVICIOS: 100 },
      orderCount: 50
    });

    expect(pnl.grossProfit).toBe(600);
    expect(pnl.grossMarginPct).toBe(60);
    expect(pnl.cogsPct).toBe(40);
    expect(pnl.totalExpenses).toBe(300);
    expect(pnl.netProfit).toBe(300);
    expect(pnl.netMarginPct).toBe(30);
    expect(pnl.averageTicket).toBe(20);
  });

  it("evita divisiones por cero cuando no hay ingresos", () => {
    const pnl = computeProfitAndLoss({
      revenue: 0,
      revenueByMethod: { cash: 0, card: 0, transfer: 0 },
      cogs: 0,
      expensesByCategory: {},
      orderCount: 0
    });

    expect(pnl.grossMarginPct).toBe(0);
    expect(pnl.cogsPct).toBe(0);
    expect(pnl.netMarginPct).toBe(0);
    expect(pnl.averageTicket).toBe(0);
    expect(pnl.netProfit).toBe(0);
  });

  it("la utilidad neta puede ser negativa", () => {
    const pnl = computeProfitAndLoss({
      revenue: 500,
      revenueByMethod: { cash: 500, card: 0, transfer: 0 },
      cogs: 300,
      expensesByCategory: { PERSONAL: 400 },
      orderCount: 10
    });

    // UB = 200, OPEX = 400 -> UN = -200
    expect(pnl.grossProfit).toBe(200);
    expect(pnl.totalExpenses).toBe(400);
    expect(pnl.netProfit).toBe(-200);
  });
});
