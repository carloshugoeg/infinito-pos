import { roundMoney } from "@/domain/cart";

export const EXPENSE_CATEGORIES = [
  "LOCAL",
  "PERSONAL",
  "SERVICIOS",
  "INSUMOS_EXTRA",
  "MARKETING",
  "EQUIPO",
  "IMPUESTOS",
  "OTROS"
] as const;
export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_FREQUENCIES = ["MONTHLY", "BIWEEKLY", "WEEKLY"] as const;
export type ExpenseFrequencyValue = (typeof EXPENSE_FREQUENCIES)[number];

export function isExpenseCategory(value: unknown): value is ExpenseCategoryValue {
  return EXPENSE_CATEGORIES.includes(value as ExpenseCategoryValue);
}

export function isExpenseFrequency(value: unknown): value is ExpenseFrequencyValue {
  return EXPENSE_FREQUENCIES.includes(value as ExpenseFrequencyValue);
}

export type ExpenseInput = {
  category: string;
  description: string;
  amount: number;
  incurredOn: Date | string;
};

function hasCentsPrecision(value: number) {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-9;
}

export function validateExpense(input: ExpenseInput): string[] {
  const errors: string[] = [];
  if (!isExpenseCategory(input.category)) errors.push("Categoria de gasto invalida.");
  if (!input.description || !String(input.description).trim()) errors.push("La descripcion es obligatoria.");
  if (!Number.isFinite(input.amount)) {
    errors.push("El monto debe ser un numero valido.");
  } else {
    if (input.amount <= 0) errors.push("El monto debe ser mayor a cero.");
    if (!hasCentsPrecision(input.amount)) errors.push("El monto permite maximo 2 decimales.");
  }
  const date = input.incurredOn instanceof Date ? input.incurredOn : new Date(input.incurredOn);
  if (Number.isNaN(date.getTime())) errors.push("La fecha del gasto es invalida.");
  return errors;
}

export type CategorizedExpense = { category: string; amount: number };

export function sumExpensesByCategory(expenses: CategorizedExpense[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const expense of expenses) {
    totals[expense.category] = roundMoney((totals[expense.category] ?? 0) + expense.amount);
  }
  return totals;
}

export type RecurringExpenseTemplate = {
  id: string;
  category: string;
  description: string;
  amount: number;
  frequency: string;
  dayOfPeriod: number;
  active?: boolean;
};

export type VirtualExpense = {
  recurringId: string;
  category: string;
  description: string;
  amount: number;
  incurredOn: Date;
};

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function recurringFiresOn(template: RecurringExpenseTemplate, date: Date): boolean {
  const dim = daysInMonth(date.getFullYear(), date.getMonth());
  const dayOfMonth = date.getDate();
  switch (template.frequency) {
    case "MONTHLY": {
      const target = Math.min(Math.max(1, template.dayOfPeriod), dim);
      return dayOfMonth === target;
    }
    case "BIWEEKLY": {
      // Quincenal: el dia indicado y ~15 dias despues (clamp al fin de mes).
      const first = Math.min(Math.max(1, template.dayOfPeriod), dim);
      const second = Math.min(first + 15, dim);
      return dayOfMonth === first || dayOfMonth === second;
    }
    case "WEEKLY": {
      const targetDow = (((template.dayOfPeriod % 7) + 7) % 7);
      return date.getDay() === targetDow;
    }
    default:
      return false;
  }
}

/**
 * Expande plantillas de gasto recurrente a gastos virtuales dentro de un rango
 * [start, end). No materializa filas en DB: el modulo financiero los suma al vuelo.
 */
export function expandRecurringExpenses(
  templates: RecurringExpenseTemplate[],
  range: { start: Date; end: Date }
): VirtualExpense[] {
  const result: VirtualExpense[] = [];
  for (const template of templates) {
    if (template.active === false) continue;
    const cursor = new Date(range.start);
    cursor.setHours(0, 0, 0, 0);
    while (cursor < range.end) {
      if (recurringFiresOn(template, cursor)) {
        result.push({
          recurringId: template.id,
          category: template.category,
          description: template.description,
          amount: template.amount,
          incurredOn: new Date(cursor)
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return result;
}
