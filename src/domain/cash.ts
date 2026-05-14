import { MAX_MONEY_AMOUNT, PaymentInput, roundMoney } from "@/domain/cart";

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

export function validateCashSessionAmounts(input: { openingAmount: number; closingAmount?: number }) {
  const errors: string[] = [];
  if (!isValidCashAmount(input.openingAmount)) errors.push("El monto inicial debe ser un numero valido mayor o igual a cero.");
  if (input.closingAmount !== undefined && !isValidCashAmount(input.closingAmount)) {
    errors.push("El efectivo contado debe ser un numero valido mayor o igual a cero.");
  }
  return errors;
}

function isValidCashAmount(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= MAX_MONEY_AMOUNT && Math.abs(value * 100 - Math.round(value * 100)) < 1e-9;
}
