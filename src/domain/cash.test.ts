import { describe, expect, it } from "vitest";
import { calculateCashSessionSummary, validateCashSessionAmounts } from "@/domain/cash";

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

  it("bloquea montos de caja invalidos", () => {
    expect(validateCashSessionAmounts({ openingAmount: -1 })).toContain("El monto inicial debe ser un numero valido mayor o igual a cero.");
    expect(validateCashSessionAmounts({ openingAmount: 0, closingAmount: Number.NaN })).toContain(
      "El efectivo contado debe ser un numero valido mayor o igual a cero."
    );
    expect(validateCashSessionAmounts({ openingAmount: 0, closingAmount: 100.123 })).toContain(
      "El efectivo contado debe ser un numero valido mayor o igual a cero."
    );
  });
});
