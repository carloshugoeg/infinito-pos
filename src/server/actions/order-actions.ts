"use server";

import { OrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";
import { buildSaleSuccessPath, sanitizeOrderNote } from "@/domain/cart";
import { validateOrderStatusTransition, type OrderStatusValue } from "@/domain/order-status";
import { getActiveBranch } from "@/server/auth";
import { getQuioscoLocation } from "@/server/inventory/locations";
import { getOpenCashSession } from "@/server/actions/cash-actions";
import { listSellableProducts } from "@/server/queries/catalog";
import { createPaidOrderInTransaction, preparePaidOrder, type IncomingCartItem, type IncomingPayment } from "@/server/services/orders";

export async function createPaidOrderAction(formData: FormData) {
  const { user, branch } = await getActiveBranch();
  const cashSession = await getOpenCashSession(branch.id);
  if (!cashSession) redirect("/cash/open");

  const items = parseJsonArray<IncomingCartItem>(formData.get("items"), "Carrito invalido.");
  const payments = parseJsonArray<IncomingPayment>(formData.get("payments"), "Pagos invalidos.");
  const catalog = await listSellableProducts();
  const allProductIds = items.map((item) => String(item.productId || ""));
  const allModifierIds = items.flatMap((item) => (Array.isArray(item.modifierIds) ? item.modifierIds.map(String) : []));
  const recipeItems = await prisma.recipeItem.findMany({
    where: {
      OR: [{ productId: { in: allProductIds } }, { modifierId: { in: allModifierIds } }]
    },
    include: { ingredient: { select: { costPerUnit: true } } }
  });
  const ingredientCosts: Record<string, number> = {};
  for (const item of recipeItems) {
    ingredientCosts[item.ingredientId] = toNumber(item.ingredient.costPerUnit);
  }
  const prepared = preparePaidOrder({
    items,
    payments,
    catalog,
    recipeItems: recipeItems.map((item) => ({
      productId: item.productId,
      modifierId: item.modifierId,
      ingredientId: item.ingredientId,
      quantity: toNumber(item.quantity)
    })),
    ingredientCosts
  });

  const customerNit = sanitizeOrderNote(formData.get("customerNit") || "CF", 32).toUpperCase() || "CF";
  const customerName = sanitizeOrderNote(formData.get("customerName") || "Consumidor Final", 120) || "Consumidor Final";
  const customerPhone = sanitizeOrderNote(formData.get("customerPhone"), 40) || null;
  const customer =
    customerNit !== "CF"
      ? await prisma.customer.upsert({
          where: { nit: customerNit },
          update: { name: customerName, phone: customerPhone },
          create: { nit: customerNit, name: customerName, phone: customerPhone }
        })
      : null;

  const quiosco = await getQuioscoLocation(branch.id);

  const orderId = await prisma.$transaction(async (tx) => {
    return createPaidOrderInTransaction(tx, {
      branchId: branch.id,
      quioscoLocationId: quiosco.id,
      cashSessionId: cashSession.id,
      customerId: customer?.id,
      customerNit,
      customerName,
      customerPhone,
      createdById: user.id,
      prepared
    });
  });

  revalidatePath("/kiosk");
  revalidatePath("/admin/inventory");
  redirect(buildSaleSuccessPath(orderId));
}

export async function changeOrderStatusAction(formData: FormData) {
  const { branch } = await getActiveBranch();
  const orderId = String(formData.get("orderId") || "");
  const status = String(formData.get("status") || "") as OrderStatus;
  const order = await prisma.order.findFirst({ where: { id: orderId, branchId: branch.id }, select: { status: true } });
  if (!order) throw new Error("Orden no encontrada.");
  const errors = validateOrderStatusTransition(order.status as OrderStatusValue, status as OrderStatusValue);
  if (errors.length) throw new Error(errors.join(" "));
  const data: { status: OrderStatus; deliveredAt?: Date } = { status };
  if (status === OrderStatus.DELIVERED) data.deliveredAt = new Date();
  await prisma.order.update({ where: { id: orderId }, data });
  revalidatePath("/kiosk");
}

export async function cancelOrderAction(formData: FormData) {
  const { branch } = await getActiveBranch();
  const orderId = String(formData.get("orderId") || "");
  const reason = sanitizeOrderNote(formData.get("reason") || "Cancelada desde kiosco", 180) || "Cancelada desde kiosco";
  const order = await prisma.order.findFirst({ where: { id: orderId, branchId: branch.id }, select: { id: true, status: true } });
  if (!order) throw new Error("Orden no encontrada.");
  if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.DELIVERED) throw new Error("No se puede cancelar una orden cerrada.");
  await prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.CANCELLED, cancelledAt: new Date(), cancelReason: reason }
  });
  revalidatePath("/kiosk");
}

function parseJsonArray<T>(value: FormDataEntryValue | null, errorMessage: string): T[] {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    if (!Array.isArray(parsed)) throw new Error(errorMessage);
    return parsed as T[];
  } catch {
    throw new Error(errorMessage);
  }
}
