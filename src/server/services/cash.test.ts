import { describe, expect, it } from "vitest";
import { PaymentMethod } from "@prisma/client";
import { prepareCashSessionClose } from "@/server/services/cash";

describe("cash service", () => {
  it("prepara cierre de caja con efectivo esperado, diferencia y notas", () => {
    const close = prepareCashSessionClose({
      openingAmount: 100,
      closingAmount: 180,
      existingNotes: "turno tarde",
      submittedNotes: "",
      payments: [
        { method: PaymentMethod.CASH, amount: 75, receivedAmount: 100 },
        { method: PaymentMethod.CARD, amount: 40 }
      ]
    });

    expect(close.summary).toEqual({
      cashSales: 75,
      expectedCashAmount: 175,
      cashDifference: 5
    });
    expect(close.notes).toBe("turno tarde");
  });

  it("rechaza cierre con efectivo contado invalido", () => {
    expect(() =>
      prepareCashSessionClose({
        openingAmount: 100,
        closingAmount: -1,
        payments: []
      })
    ).toThrow("El efectivo contado debe ser un numero valido mayor o igual a cero.");
  });
});
