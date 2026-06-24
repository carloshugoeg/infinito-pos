import { describe, expect, it } from "vitest";
import { expandRecurringExpenses, sumExpensesByCategory, validateExpense } from "@/domain/expenses";
import { guatemalaCalendarParts } from "@/lib/time";

// Rangos anclados a 00:00 de Guatemala (06:00 UTC), igual que parseReportDateRange.
const JUNE_2026 = { start: new Date("2026-06-01T06:00:00.000Z"), end: new Date("2026-07-01T06:00:00.000Z") };
const FIRST_WEEK_JUNE_2026 = { start: new Date("2026-06-01T06:00:00.000Z"), end: new Date("2026-06-08T06:00:00.000Z") };

describe("expenses domain", () => {
  it("acepta un gasto valido", () => {
    expect(
      validateExpense({ category: "SERVICIOS", description: "Luz", amount: 350.5, incurredOn: "2026-06-01" })
    ).toEqual([]);
  });

  it("rechaza categoria, monto, descripcion y fecha invalidos", () => {
    expect(validateExpense({ category: "NOPE", description: "x", amount: 10, incurredOn: "2026-06-01" })).toContain(
      "Categoria de gasto invalida."
    );
    expect(validateExpense({ category: "LOCAL", description: "x", amount: 0, incurredOn: "2026-06-01" })).toContain(
      "El monto debe ser mayor a cero."
    );
    expect(validateExpense({ category: "LOCAL", description: "x", amount: 1.234, incurredOn: "2026-06-01" })).toContain(
      "El monto permite maximo 2 decimales."
    );
    expect(validateExpense({ category: "LOCAL", description: "  ", amount: 5, incurredOn: "2026-06-01" })).toContain(
      "La descripcion es obligatoria."
    );
    expect(validateExpense({ category: "LOCAL", description: "x", amount: 5, incurredOn: "no-date" })).toContain(
      "La fecha del gasto es invalida."
    );
  });

  it("suma gastos por categoria", () => {
    const totals = sumExpensesByCategory([
      { category: "LOCAL", amount: 100 },
      { category: "LOCAL", amount: 50 },
      { category: "SERVICIOS", amount: 25.5 }
    ]);
    expect(totals).toEqual({ LOCAL: 150, SERVICIOS: 25.5 });
  });

  it("expande un gasto recurrente mensual una vez en el mes", () => {
    const virtuals = expandRecurringExpenses(
      [{ id: "rent", category: "LOCAL", description: "Renta", amount: 3000, frequency: "MONTHLY", dayOfPeriod: 1 }],
      JUNE_2026
    );
    expect(virtuals).toHaveLength(1);
    expect(virtuals[0]).toMatchObject({ recurringId: "rent", category: "LOCAL", amount: 3000 });
    const parts = guatemalaCalendarParts(virtuals[0].incurredOn);
    expect(parts.monthIndex).toBe(5);
    expect(parts.day).toBe(1);
  });

  it("expande un gasto quincenal dos veces en el mes", () => {
    const virtuals = expandRecurringExpenses(
      [{ id: "pay", category: "PERSONAL", description: "Planilla", amount: 5000, frequency: "BIWEEKLY", dayOfPeriod: 15 }],
      JUNE_2026
    );
    expect(virtuals).toHaveLength(2);
    expect(virtuals.map((item) => guatemalaCalendarParts(item.incurredOn).day)).toEqual([15, 30]);
  });

  it("expande un gasto semanal una vez por semana en su dia", () => {
    const virtuals = expandRecurringExpenses(
      [{ id: "clean", category: "SERVICIOS", description: "Limpieza", amount: 200, frequency: "WEEKLY", dayOfPeriod: 3 }],
      FIRST_WEEK_JUNE_2026
    );
    expect(virtuals).toHaveLength(1);
    expect(guatemalaCalendarParts(virtuals[0].incurredOn).weekday).toBe(3);
  });

  it("ignora plantillas inactivas", () => {
    const virtuals = expandRecurringExpenses(
      [{ id: "old", category: "LOCAL", description: "Vieja", amount: 1, frequency: "MONTHLY", dayOfPeriod: 1, active: false }],
      JUNE_2026
    );
    expect(virtuals).toEqual([]);
  });
});
