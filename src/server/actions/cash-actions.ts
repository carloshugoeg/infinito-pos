"use server";

import { CashSessionStatus, PaymentMethod } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";
import { getActiveBranch, requireUser } from "@/server/auth";
import { prepareCashSessionClose } from "@/server/services/cash";
import { validateCashSessionAmounts } from "@/domain/cash";
import { sanitizeOrderNote } from "@/domain/cart";

export async function getOpenCashSession(branchId: string) {
  return prisma.cashSession.findFirst({
    where: { branchId, status: CashSessionStatus.OPEN },
    orderBy: { openedAt: "desc" }
  });
}

export async function openCashSessionAction(formData: FormData) {
  const { user, branch } = await getActiveBranch();
  const existing = await getOpenCashSession(branch.id);
  if (existing) redirect("/kiosk");
  const openingAmount = Number(formData.get("openingAmount") || 0);
  const validationErrors = validateCashSessionAmounts({ openingAmount });
  if (validationErrors.length) throw new Error(validationErrors.join(" "));

  await prisma.cashSession.create({
    data: {
      branchId: branch.id,
      openedById: user.id,
      openingAmount,
      notes: sanitizeOrderNote(formData.get("notes"), 250) || null
    }
  });

  revalidatePath("/kiosk");
  redirect("/kiosk");
}

export async function closeCashSessionAction(formData: FormData) {
  const { user, branch } = await getActiveBranch();
  const cashSession = await getOpenCashSession(branch.id);
  if (!cashSession) redirect("/cash/open");

  const payments = await prisma.payment.findMany({
    where: {
      order: {
        cashSessionId: cashSession.id,
        status: { not: "CANCELLED" }
      }
    }
  });

  const closingAmount = Number(formData.get("closingAmount") || 0);
  const close = prepareCashSessionClose({
    openingAmount: toNumber(cashSession.openingAmount),
    closingAmount,
    existingNotes: cashSession.notes,
    submittedNotes: sanitizeOrderNote(formData.get("notes"), 250),
    payments: payments.map((payment) => ({
      method: payment.method,
      amount: toNumber(payment.amount),
      receivedAmount: payment.receivedAmount ? toNumber(payment.receivedAmount) : undefined
    }))
  });

  await prisma.cashSession.update({
    where: { id: cashSession.id },
    data: {
      status: CashSessionStatus.CLOSED,
      closedById: user.id,
      closingAmount,
      expectedCashAmount: close.summary.expectedCashAmount,
      cashDifference: close.summary.cashDifference,
      closedAt: new Date(),
      notes: close.notes
    }
  });

  revalidatePath("/kiosk");
  redirect("/cash/open");
}

export async function calculateCashSessionBreakdown(cashSessionId: string) {
  const payments = await prisma.payment.groupBy({
    by: ["method"],
    where: {
      order: {
        cashSessionId,
        status: { not: "CANCELLED" }
      }
    },
    _sum: { amount: true }
  });

  return {
    cash: toNumber(payments.find((item) => item.method === PaymentMethod.CASH)?._sum.amount),
    card: toNumber(payments.find((item) => item.method === PaymentMethod.CARD)?._sum.amount),
    transfer: toNumber(payments.find((item) => item.method === PaymentMethod.TRANSFER)?._sum.amount)
  };
}

export async function ensureCashSessionForKiosk() {
  const { branch } = await getActiveBranch();
  const cashSession = await getOpenCashSession(branch.id);
  if (!cashSession) redirect("/cash/open");
  return cashSession;
}

export async function requireAnyUserForCash() {
  return requireUser();
}
