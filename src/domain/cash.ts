import { PaymentInput, roundMoney } from "@/domain/cart";

export function calculateCashSessionSummary(input: {
  openingAmount: number;
  closingAmount: number;
  payments: PaymentInput[];
}) {
  const cashSales = input.payments
    .filter((payment) => payment.method === "CASH")
    .reduce((total, payment) => total + payment.amount, 0);
  const expectedCashAmount = roundMoney(input.openingAmount + cashSales);
  return {
    cashSales: roundMoney(cashSales),
    expectedCashAmount,
    cashDifference: roundMoney(input.closingAmount - expectedCashAmount)
  };
}
