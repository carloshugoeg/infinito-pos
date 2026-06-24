"use server";

import { ExpenseCategory, ExpenseFrequency, PaymentMethod, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isExpenseCategory, isExpenseFrequency, validateExpense } from "@/domain/expenses";
import { getActiveBranch, requireRole } from "@/server/auth";
import { guatemalaDayStart, guatemalaDayStartFromInput } from "@/lib/time";
import { normalizeFormText, parseNumberField } from "@/server/admin-crud";

function parseIncurredOn(value: FormDataEntryValue | null | undefined): Date {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    // El gasto es una fecha de calendario en Guatemala: se ancla a las 00:00 GT
    // (06:00 UTC) para que caiga en el mismo día con que se filtran reportes/finanzas.
    return guatemalaDayStartFromInput(raw);
  }
  return guatemalaDayStart();
}

function parsePaymentMethod(value: FormDataEntryValue | null | undefined): PaymentMethod | null {
  const raw = normalizeFormText(value);
  return raw in PaymentMethod ? (raw as PaymentMethod) : null;
}

export async function createExpenseAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  const { user, branch } = await getActiveBranch();

  const category = normalizeFormText(formData.get("category"));
  const description = normalizeFormText(formData.get("description"));
  const amount = parseNumberField(formData.get("amount"), "Monto", { min: 0.01, max: 9_999_999.99, decimals: 2 });
  const incurredOn = parseIncurredOn(formData.get("incurredOn"));

  const errors = validateExpense({ category, description, amount, incurredOn });
  if (errors.length) throw new Error(errors.join(" "));

  await prisma.expense.create({
    data: {
      branchId: branch.id,
      category: category as ExpenseCategory,
      description,
      amount,
      incurredOn,
      paymentMethod: parsePaymentMethod(formData.get("paymentMethod")),
      vendor: normalizeFormText(formData.get("vendor")) || null,
      notes: normalizeFormText(formData.get("notes")) || null,
      createdById: user.id
    }
  });

  revalidatePath("/admin/expenses");
  revalidatePath("/admin/finance");
}

export async function deleteExpenseAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  const { branch } = await getActiveBranch();
  const id = normalizeFormText(formData.get("id"));
  if (!id) throw new Error("Gasto invalido.");

  await prisma.expense.deleteMany({ where: { id, branchId: branch.id } });

  revalidatePath("/admin/expenses");
  revalidatePath("/admin/finance");
}

export async function createRecurringExpenseAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  const { branch } = await getActiveBranch();

  const category = normalizeFormText(formData.get("category"));
  const description = normalizeFormText(formData.get("description"));
  const amount = parseNumberField(formData.get("amount"), "Monto", { min: 0.01, max: 9_999_999.99, decimals: 2 });
  const frequency = normalizeFormText(formData.get("frequency"));
  const dayOfPeriod = parseNumberField(formData.get("dayOfPeriod"), "Dia del periodo", {
    integer: true,
    min: 0,
    max: 31
  });

  if (!isExpenseCategory(category)) throw new Error("Categoria de gasto invalida.");
  if (!isExpenseFrequency(frequency)) throw new Error("Frecuencia invalida.");
  if (!description) throw new Error("La descripcion es obligatoria.");

  await prisma.recurringExpense.create({
    data: {
      branchId: branch.id,
      category: category as ExpenseCategory,
      description,
      amount,
      frequency: frequency as ExpenseFrequency,
      dayOfPeriod
    }
  });

  revalidatePath("/admin/expenses");
  revalidatePath("/admin/finance");
}

export async function toggleRecurringExpenseAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  const { branch } = await getActiveBranch();
  const id = normalizeFormText(formData.get("id"));
  if (!id) throw new Error("Gasto recurrente invalido.");

  const recurring = await prisma.recurringExpense.findFirst({ where: { id, branchId: branch.id } });
  if (!recurring) throw new Error("Gasto recurrente no encontrado.");

  await prisma.recurringExpense.update({ where: { id }, data: { active: !recurring.active } });

  revalidatePath("/admin/expenses");
  revalidatePath("/admin/finance");
}
