"use server";

import { InventoryMovementType, OrderStatus, PaymentMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";
import {
  buildSaleSuccessPath,
  calculateCartItemTotal,
  calculateCashChange,
  calculateOrderTotals,
  sanitizeOrderNote,
  validateCheckout,
  validateModifierSelections
} from "@/domain/cart";
import { resolveOrderIngredientUsage } from "@/domain/inventory";
import { validateOrderStatusTransition, type OrderStatusValue } from "@/domain/order-status";
import { getActiveBranch } from "@/server/auth";
import { getOpenCashSession } from "@/server/actions/cash-actions";
import { listSellableProducts } from "@/server/queries/catalog";

type IncomingCartItem = {
  productId: string;
  quantity: number;
  modifierIds: string[];
  notes?: string;
};

type IncomingPayment = {
  method: PaymentMethod;
  amount: number;
  receivedAmount?: number;
  reference?: string;
};

export async function createPaidOrderAction(formData: FormData) {
  const { user, branch } = await getActiveBranch();
  const cashSession = await getOpenCashSession(branch.id);
  if (!cashSession) redirect("/cash/open");

  const items = parseJsonArray<IncomingCartItem>(formData.get("items"), "Carrito invalido.");
  const payments = parseJsonArray<IncomingPayment>(formData.get("payments"), "Pagos invalidos.").map((payment) => ({
    method: payment.method,
    amount: Number(payment.amount),
    receivedAmount: payment.receivedAmount === undefined ? undefined : Number(payment.receivedAmount),
    reference: payment.reference ? String(payment.reference).trim().slice(0, 120) : undefined
  }));
  const catalog = await listSellableProducts();
  const normalizedItems = items
    .map((item) => ({
      productId: String(item.productId || ""),
      quantity: Number(item.quantity),
      modifierIds: Array.isArray(item.modifierIds) ? item.modifierIds.map(String) : [],
      notes: sanitizeOrderNote(item.notes)
    }))
    .filter((item) => Number.isInteger(item.quantity) && item.quantity > 0);

  if (normalizedItems.length === 0) redirect("/kiosk?error=carrito");

  const pricedItems = normalizedItems.map((item) => {
    const product = catalog.find((candidate) => candidate.id === item.productId);
    if (!product) throw new Error("Producto invalido.");
    const errors = validateModifierSelections(product, item.modifierIds);
    if (errors.length) throw new Error(errors.join(" "));
    return {
      input: item,
      product,
      lineTotal: calculateCartItemTotal(product, item.modifierIds, item.quantity)
    };
  });

  const totals = calculateOrderTotals(pricedItems.map((item) => ({ lineTotal: item.lineTotal })));
  const checkoutErrors = validateCheckout({ itemCount: normalizedItems.length, total: totals.total, payments });
  if (checkoutErrors.length) throw new Error(checkoutErrors.join(" "));

  const allProductIds = pricedItems.map((item) => item.input.productId);
  const allModifierIds = pricedItems.flatMap((item) => item.input.modifierIds);
  const recipeItems = await prisma.recipeItem.findMany({
    where: {
      OR: [{ productId: { in: allProductIds } }, { modifierId: { in: allModifierIds } }]
    }
  });
  const usage = resolveOrderIngredientUsage(
    pricedItems.map((item) => item.input),
    recipeItems.map((item) => ({
      productId: item.productId,
      modifierId: item.modifierId,
      ingredientId: item.ingredientId,
      quantity: toNumber(item.quantity)
    }))
  );

  const customerNit = String(formData.get("customerNit") || "CF").trim().toUpperCase() || "CF";
  const customerName = String(formData.get("customerName") || "Consumidor Final").trim() || "Consumidor Final";
  const customerPhone = String(formData.get("customerPhone") || "").trim() || null;
  const customer =
    customerNit !== "CF"
      ? await prisma.customer.upsert({
          where: { nit: customerNit },
          update: { name: customerName, phone: customerPhone },
          create: { nit: customerNit, name: customerName, phone: customerPhone }
        })
      : null;

  const orderId = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        branchId: branch.id,
        cashSessionId: cashSession.id,
        customerId: customer?.id,
        customerNit,
        customerName,
        customerPhone,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        createdById: user.id,
        items: {
          create: pricedItems.map((item) => ({
            productId: item.product.id,
            productNameSnapshot: item.product.name,
            basePriceSnapshot: item.product.basePrice,
            quantity: item.input.quantity,
            lineTotal: item.lineTotal,
            notes: item.input.notes || null,
            modifiers: {
              create: item.input.modifierIds.map((modifierId) => {
                const modifier = item.product.modifierGroups.flatMap((group) => group.modifiers).find((candidate) => candidate.id === modifierId);
                if (!modifier) throw new Error("Modificador invalido.");
                return {
                  modifierId,
                  modifierNameSnapshot: modifier.name,
                  priceDeltaSnapshot: modifier.priceDelta
                };
              })
            }
          }))
        },
        payments: {
          create: payments.map((payment) => ({
            method: payment.method,
            amount: payment.amount,
            receivedAmount: payment.receivedAmount ?? null,
            changeAmount: calculateCashChange(payment),
            reference: payment.reference || null
          }))
        }
      }
    });

    for (const item of usage) {
      await tx.branchInventory.upsert({
        where: { branchId_ingredientId: { branchId: branch.id, ingredientId: item.ingredientId } },
        update: { quantityOnHand: { decrement: item.quantity } },
        create: { branchId: branch.id, ingredientId: item.ingredientId, quantityOnHand: -item.quantity }
      });
      await tx.inventoryMovement.create({
        data: {
          branchId: branch.id,
          ingredientId: item.ingredientId,
          type: InventoryMovementType.SALE,
          quantityDelta: -item.quantity,
          reason: "Venta",
          orderId: order.id,
          createdById: user.id
        }
      });
    }

    return order.id;
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
  await getActiveBranch();
  const orderId = String(formData.get("orderId") || "");
  const reason = String(formData.get("reason") || "Cancelada desde kiosco").trim();
  await prisma.order.update({
    where: { id: orderId },
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
