import { describe, expect, it } from "vitest";
import { calculateCashSessionSummary } from "@/domain/cash";

describe("cash domain", () => {
  it("calcula efectivo esperado y diferencia", () => {
    expect(
      calculateCashSessionSummary({
        openingAmount: 100,
        closingAmount: 260,
        payments: [
          { method: "CASH", amount: 150, receivedAmount: 200 },
          { method: "CARD", amount: 75 }
        ]
      })
    ).toEqual({
      cashSales: 150,
      expectedCashAmount: 250,
      cashDifference: 10
    });
  });
});
