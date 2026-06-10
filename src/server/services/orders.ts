import { InventoryMovementType, type PaymentMethod } from "@prisma/client";
import {
  calculateCartItemTotal,
  calculateCashChange,
  calculateOrderTotals,
  MAX_CART_LINES,
  MAX_ITEM_QUANTITY,
  roundMoney,
  sanitizeOrderNote,
  validateCheckout,
  validateModifierSelections,
  type CatalogProduct,
  type PaymentInput
} from "@/domain/cart";
import { resolveOrderIngredientUsage, type RecipeSource } from "@/domain/inventory";
import { calculateOrderItemCost, type IngredientCostMap } from "@/domain/costing";

export type IncomingCartItem = {
  productId: string;
  quantity: number;
  modifierIds: string[];
  notes?: string;
};

export type IncomingPayment = {
  method: PaymentMethod | string;
  amount: number;
  receivedAmount?: number;
  reference?: string;
};

export type PreparedPaidOrder = ReturnType<typeof preparePaidOrder>;

type PaidOrderTransactionClient = {
  order: {
    create(input: { data: unknown }): Promise<{ id: string }>;
  };
  branchInventory: {
    upsert(input: { where: unknown; update: unknown; create: unknown }): Promise<unknown>;
  };
  inventoryMovement: {
    create(input: { data: unknown }): Promise<unknown>;
  };
};

export function preparePaidOrder(input: {
  items: IncomingCartItem[];
  payments: IncomingPayment[];
  catalog: CatalogProduct[];
  recipeItems: RecipeSource[];
  ingredientCosts?: IngredientCostMap;
}) {
  if (!Array.isArray(input.items) || input.items.length === 0) throw new Error("Agrega productos al carrito.");
  if (input.items.length > MAX_CART_LINES) throw new Error(`El carrito permite maximo ${MAX_CART_LINES} lineas.`);
  if (!Array.isArray(input.payments)) throw new Error("Pagos invalidos.");

  const payments = input.payments.map((payment) => ({
    method: String(payment.method) as PaymentInput["method"],
    amount: Number(payment.amount),
    receivedAmount: payment.receivedAmount === undefined ? undefined : Number(payment.receivedAmount),
    reference: payment.reference ? String(payment.reference).trim().slice(0, 120) : undefined
  }));
  const normalizedItems = input.items
    .map((item) => ({
      productId: String(item.productId || ""),
      quantity: Number(item.quantity),
      modifierIds: Array.isArray(item.modifierIds) ? item.modifierIds.map(String) : [],
      notes: sanitizeOrderNote(item.notes)
    }));

  const itemErrors = normalizedItems.flatMap((item) => {
    const errors: string[] = [];
    if (!item.productId) errors.push("Producto invalido.");
    if (!Number.isInteger(item.quantity) || item.quantity < 1) errors.push("La cantidad debe ser un entero mayor a cero.");
    if (item.quantity > MAX_ITEM_QUANTITY) errors.push(`La cantidad maxima por linea es ${MAX_ITEM_QUANTITY}.`);
    return errors;
  });
  if (itemErrors.length) throw new Error(Array.from(new Set(itemErrors)).join(" "));

  const ingredientCosts = input.ingredientCosts ?? {};
  const pricedItems = normalizedItems.map((item) => {
    const product = input.catalog.find((candidate) => candidate.id === item.productId);
    if (!product) throw new Error("Producto invalido.");
    const errors = validateModifierSelections(product, item.modifierIds);
    if (errors.length) throw new Error(errors.join(" "));
    const cost = calculateOrderItemCost(
      { productId: item.productId, quantity: item.quantity, modifierIds: item.modifierIds },
      input.recipeItems,
      ingredientCosts
    );
    return {
      input: item,
      product,
      lineTotal: calculateCartItemTotal(product, item.modifierIds, item.quantity),
      unitCost: cost.unitCost,
      lineCost: cost.lineCost,
      modifiers: item.modifierIds.map((modifierId) => {
        const modifier = product.modifierGroups.flatMap((group) => group.modifiers).find((candidate) => candidate.id === modifierId);
        if (!modifier) throw new Error("Modificador invalido.");
        return modifier;
      })
    };
  });

  const baseTotals = calculateOrderTotals(pricedItems.map((item) => ({ lineTotal: item.lineTotal })));
  const checkoutErrors = validateCheckout({ itemCount: normalizedItems.length, total: baseTotals.total, payments });
  if (checkoutErrors.length) throw new Error(checkoutErrors.join(" "));

  const costOfGoodsTotal = roundMoney(pricedItems.reduce((sum, item) => sum + item.lineCost, 0));
  const totals = {
    ...baseTotals,
    costOfGoodsTotal,
    grossProfit: roundMoney(baseTotals.total - costOfGoodsTotal)
  };

  return {
    payments,
    pricedItems,
    totals,
    usage: resolveOrderIngredientUsage(normalizedItems, input.recipeItems)
  };
}

export async function createPaidOrderInTransaction(
  tx: PaidOrderTransactionClient,
  input: {
    branchId: string;
    cashSessionId: string;
    customerId?: string | null;
    customerNit: string;
    customerName: string;
    customerPhone?: string | null;
    createdById: string;
    prepared: PreparedPaidOrder;
  }
) {
  const order = await tx.order.create({
    data: {
      branchId: input.branchId,
      cashSessionId: input.cashSessionId,
      customerId: input.customerId,
      customerNit: input.customerNit,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      subtotal: input.prepared.totals.subtotal,
      discountTotal: input.prepared.totals.discountTotal,
      taxTotal: input.prepared.totals.taxTotal,
      total: input.prepared.totals.total,
      costOfGoodsTotal: input.prepared.totals.costOfGoodsTotal,
      grossProfit: input.prepared.totals.grossProfit,
      createdById: input.createdById,
      items: {
        create: input.prepared.pricedItems.map((item) => ({
          productId: item.product.id,
          productNameSnapshot: item.product.name,
          basePriceSnapshot: item.product.basePrice,
          quantity: item.input.quantity,
          lineTotal: item.lineTotal,
          unitCostSnapshot: item.unitCost,
          lineCostSnapshot: item.lineCost,
          notes: item.input.notes || null,
          modifiers: {
            create: item.modifiers.map((modifier) => ({
              modifierId: modifier.id,
              modifierNameSnapshot: modifier.name,
              priceDeltaSnapshot: modifier.priceDelta
            }))
          }
        }))
      },
      payments: {
        create: input.prepared.payments.map((payment) => ({
          method: payment.method,
          amount: payment.amount,
          receivedAmount: payment.receivedAmount ?? null,
          changeAmount: calculateCashChange(payment),
          reference: payment.reference || null
        }))
      }
    }
  });

  for (const item of input.prepared.usage) {
    await tx.branchInventory.upsert({
      where: { branchId_ingredientId: { branchId: input.branchId, ingredientId: item.ingredientId } },
      update: { quantityOnHand: { decrement: item.quantity } },
      create: { branchId: input.branchId, ingredientId: item.ingredientId, quantityOnHand: -item.quantity }
    });
    await tx.inventoryMovement.create({
      data: {
        branchId: input.branchId,
        ingredientId: item.ingredientId,
        type: InventoryMovementType.SALE,
        quantityDelta: -item.quantity,
        reason: "Venta",
        orderId: order.id,
        createdById: input.createdById
      }
    });
  }

  return order.id;
}
