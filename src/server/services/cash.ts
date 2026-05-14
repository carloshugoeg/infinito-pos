import type { PaymentInput } from "@/domain/cart";
import { calculateCashSessionSummary, validateCashSessionAmounts } from "@/domain/cash";
import { toNumber } from "@/lib/utils";

export function prepareCashSessionClose(input: {
  openingAmount: unknown;
  closingAmount: number;
  existingNotes?: string | null;
  submittedNotes?: string | null;
  payments: PaymentInput[];
}) {
  const validationErrors = validateCashSessionAmounts({
    openingAmount: toNumber(input.openingAmount),
    closingAmount: input.closingAmount
  });
  if (validationErrors.length) throw new Error(validationErrors.join(" "));

  const summary = calculateCashSessionSummary({
    openingAmount: toNumber(input.openingAmount),
    closingAmount: input.closingAmount,
    payments: input.payments
  });

  return {
    summary,
    notes: String(input.submittedNotes || input.existingNotes || "").trim() || null
  };
}
