import { roundMoney } from "@/domain/cart";

export type RevenueByMethod = {
  cash: number;
  card: number;
  transfer: number;
};

export type ProfitAndLossInput = {
  revenue: number;
  revenueByMethod: RevenueByMethod;
  cogs: number;
  expensesByCategory: Record<string, number>;
  orderCount: number;
};

export type ProfitAndLoss = {
  revenue: number;
  cogs: number;
  cogsPct: number;
  grossProfit: number;
  grossMarginPct: number;
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  netProfit: number;
  netMarginPct: number;
  orderCount: number;
  averageTicket: number;
  revenueByMethod: RevenueByMethod;
};

function roundPct(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function pctOfRevenue(part: number, revenue: number) {
  return revenue > 0 ? roundPct((part / revenue) * 100) : 0;
}

/**
 * Estado de resultados: Ingresos - COGS - OPEX = Utilidad neta.
 * Alineado con la columna U.B del Excel pero llevado a resultado neto.
 * Funcion pura: recibe agregados ya calculados, no toca DB.
 */
export function computeProfitAndLoss(input: ProfitAndLossInput): ProfitAndLoss {
  const revenue = roundMoney(input.revenue);
  const cogs = roundMoney(input.cogs);
  const grossProfit = roundMoney(revenue - cogs);
  const totalExpenses = roundMoney(
    Object.values(input.expensesByCategory).reduce((sum, amount) => sum + amount, 0)
  );
  const netProfit = roundMoney(grossProfit - totalExpenses);

  return {
    revenue,
    cogs,
    cogsPct: pctOfRevenue(cogs, revenue),
    grossProfit,
    grossMarginPct: pctOfRevenue(grossProfit, revenue),
    totalExpenses,
    expensesByCategory: input.expensesByCategory,
    netProfit,
    netMarginPct: pctOfRevenue(netProfit, revenue),
    orderCount: input.orderCount,
    averageTicket: input.orderCount > 0 ? roundMoney(revenue / input.orderCount) : 0,
    revenueByMethod: input.revenueByMethod
  };
}
