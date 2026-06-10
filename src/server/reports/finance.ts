import { OrderStatus, PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";
import { roundMoney } from "@/domain/cart";
import { computeProfitAndLoss, type ProfitAndLoss } from "@/domain/finance";
import { expandRecurringExpenses, sumExpensesByCategory } from "@/domain/expenses";

export type ProductProfitability = {
  productName: string;
  quantity: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  marginPct: number;
};

export type FinanceReport = {
  pnl: ProfitAndLoss;
  productProfitability: ProductProfitability[];
};

export async function getFinanceReport(
  branchId: string,
  range: { start: Date; end: Date }
): Promise<FinanceReport> {
  const orderWhere = {
    branchId,
    createdAt: { gte: range.start, lt: range.end },
    status: { not: OrderStatus.CANCELLED }
  };

  const [orderAgg, payments, productGroups, expenses, recurring] = await Promise.all([
    prisma.order.aggregate({
      where: orderWhere,
      _sum: { total: true, costOfGoodsTotal: true },
      _count: { _all: true }
    }),
    prisma.payment.groupBy({
      by: ["method"],
      where: { order: orderWhere },
      _sum: { amount: true }
    }),
    prisma.orderItem.groupBy({
      by: ["productNameSnapshot"],
      where: { order: orderWhere },
      _sum: { quantity: true, lineTotal: true, lineCostSnapshot: true },
      orderBy: { _sum: { lineTotal: "desc" } }
    }),
    prisma.expense.findMany({
      where: { OR: [{ branchId }, { branchId: null }], incurredOn: { gte: range.start, lt: range.end } }
    }),
    prisma.recurringExpense.findMany({
      where: { OR: [{ branchId }, { branchId: null }], active: true }
    })
  ]);

  const revenue = toNumber(orderAgg._sum.total);
  const cogs = toNumber(orderAgg._sum.costOfGoodsTotal);
  const orderCount = orderAgg._count._all;

  const byMethod = (method: PaymentMethod) => toNumber(payments.find((payment) => payment.method === method)?._sum.amount);
  const revenueByMethod = {
    cash: byMethod(PaymentMethod.CASH),
    card: byMethod(PaymentMethod.CARD),
    transfer: byMethod(PaymentMethod.TRANSFER)
  };

  const realExpenses = expenses.map((expense) => ({ category: expense.category as string, amount: toNumber(expense.amount) }));
  const virtualExpenses = expandRecurringExpenses(
    recurring.map((item) => ({
      id: item.id,
      category: item.category,
      description: item.description,
      amount: toNumber(item.amount),
      frequency: item.frequency,
      dayOfPeriod: item.dayOfPeriod,
      active: item.active
    })),
    range
  ).map((virtual) => ({ category: virtual.category, amount: virtual.amount }));

  const expensesByCategory = sumExpensesByCategory([...realExpenses, ...virtualExpenses]);

  const pnl = computeProfitAndLoss({ revenue, revenueByMethod, cogs, expensesByCategory, orderCount });

  const productProfitability: ProductProfitability[] = productGroups.map((group) => {
    const productRevenue = roundMoney(toNumber(group._sum.lineTotal));
    const productCost = roundMoney(toNumber(group._sum.lineCostSnapshot));
    const grossProfit = roundMoney(productRevenue - productCost);
    return {
      productName: group.productNameSnapshot,
      quantity: group._sum.quantity ?? 0,
      revenue: productRevenue,
      cost: productCost,
      grossProfit,
      marginPct: productRevenue > 0 ? Math.round((grossProfit / productRevenue) * 1000) / 10 : 0
    };
  });

  return { pnl, productProfitability };
}
