export type CatalogModifier = {
  id: string;
  name: string;
  priceDelta: number;
  deliveryPriceDelta: number;
};

export type CatalogModifierGroup = {
  id: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  modifiers: CatalogModifier[];
};

export type CatalogProduct = {
  id: string;
  name: string;
  category?: string | null;
  basePrice: number;
  deliveryPrice: number;
  modifierGroups: CatalogModifierGroup[];
};

// Precio unitario efectivo de un producto segun el canal de venta. En delivery
// se cobra el precio de delivery; en local, el precio base. Si por algun motivo
// faltara el precio de delivery, cae al precio local en vez de cobrar 0.
export function resolveProductUnitPrice(product: CatalogProduct, isDelivery: boolean) {
  if (!isDelivery) return product.basePrice;
  return product.deliveryPrice ?? product.basePrice;
}

// Extra efectivo de un modificador segun el canal de venta.
export function resolveModifierDelta(modifier: CatalogModifier, isDelivery: boolean) {
  if (!isDelivery) return modifier.priceDelta;
  return modifier.deliveryPriceDelta ?? modifier.priceDelta;
}

export const MAX_CART_LINES = 60;
export const MAX_ITEM_QUANTITY = 99;
export const MAX_MONEY_AMOUNT = 999_999.99;

export type CartItemInput = {
  productId: string;
  quantity: number;
  modifierIds: string[];
  notes?: string;
};

export type PaymentInput = {
  method: "CASH" | "CARD" | "TRANSFER" | "DELIVERY";
  amount: number;
  receivedAmount?: number;
  reference?: string;
};

export type CheckoutInput = {
  itemCount: number;
  total: number;
  payments: PaymentInput[];
};

export type InferredCashPaymentInput = {
  total: number;
  explicitCashAmount: number;
  cardAmount: number;
  transferAmount: number;
  receivedAmount: number;
};

export type CashPaymentFromReceivedInput = {
  total: number;
  cashReceivedAmount: number;
  cardAmount: number;
  transferAmount: number;
};

export function validateModifierSelections(product: CatalogProduct, selectedModifierIds: string[]) {
  const errors: string[] = [];
  const selected = new Set(selectedModifierIds);

  if (selected.size !== selectedModifierIds.length) {
    errors.push("No repitas el mismo modificador.");
  }

  for (const group of product.modifierGroups) {
    const selectedCount = group.modifiers.filter((modifier) => selected.has(modifier.id)).length;
    if (group.isRequired && selectedCount < Math.max(1, group.minSelections)) {
      errors.push(`Selecciona ${group.name}.`);
    }
    if (selectedCount < group.minSelections) {
      errors.push(`${group.name} requiere al menos ${group.minSelections}.`);
    }
    if (selectedCount > group.maxSelections) {
      errors.push(`${group.name} permite maximo ${group.maxSelections}.`);
    }
  }

  const knownModifierIds = new Set(product.modifierGroups.flatMap((group) => group.modifiers.map((modifier) => modifier.id)));
  for (const modifierId of selectedModifierIds) {
    if (!knownModifierIds.has(modifierId)) {
      errors.push("La seleccion incluye un modificador invalido.");
    }
  }

  return errors;
}

export function calculateCartItemTotal(
  product: CatalogProduct,
  selectedModifierIds: string[],
  quantity: number,
  isDelivery = false
) {
  const modifiers = product.modifierGroups.flatMap((group) => group.modifiers);
  const safeQuantity = Number.isInteger(quantity) && quantity > 0 ? quantity : 0;
  const modifierTotal = Array.from(new Set(selectedModifierIds)).reduce((total, modifierId) => {
    const modifier = modifiers.find((item) => item.id === modifierId);
    return total + (modifier ? resolveModifierDelta(modifier, isDelivery) : 0);
  }, 0);
  return roundMoney((resolveProductUnitPrice(product, isDelivery) + modifierTotal) * safeQuantity);
}

export function calculateOrderTotals(items: Array<{ lineTotal: number }>) {
  const subtotal = roundMoney(items.reduce((total, item) => total + item.lineTotal, 0));
  return {
    subtotal,
    discountTotal: 0,
    taxTotal: 0,
    total: subtotal
  };
}

export function validatePayments(total: number, payments: PaymentInput[]) {
  const errors: string[] = [];
  const paid = roundMoney(payments.reduce((sum, payment) => sum + (isValidMoney(payment.amount) ? payment.amount : 0), 0));
  if (payments.length === 0) errors.push("Agrega al menos un pago.");
  if (paid < roundMoney(total)) errors.push("El monto pagado es menor al total.");
  if (paid > roundMoney(total)) errors.push("El monto pagado no debe superar el total.");

  const paymentMethods = payments.map((payment) => payment.method);
  if (new Set(paymentMethods).size !== paymentMethods.length) {
    errors.push("Usa un solo registro por metodo de pago.");
  }

  for (const payment of payments) {
    if (!isValidPaymentMethod(payment.method)) {
      errors.push("Metodo de pago invalido.");
      continue;
    }
    if (!isValidMoney(payment.amount)) {
      errors.push("El monto del pago debe ser un numero valido.");
      continue;
    }
    if (payment.amount <= 0) errors.push("Todos los pagos deben ser mayores a cero.");
    if (payment.amount > MAX_MONEY_AMOUNT) errors.push("El monto del pago es demasiado alto.");
    if (payment.method === "CASH" && !isValidMoney(payment.receivedAmount)) {
      errors.push("El efectivo recibido debe ser un numero valido.");
      continue;
    }
    if (payment.method === "CASH" && Number(payment.receivedAmount || 0) > MAX_MONEY_AMOUNT) {
      errors.push("El efectivo recibido es demasiado alto.");
    }
    if (payment.method === "CASH" && Number(payment.receivedAmount || 0) < payment.amount) {
      errors.push("El efectivo recibido no cubre el pago en efectivo.");
    }
  }
  return errors;
}

export function validateCheckout(input: CheckoutInput) {
  const errors: string[] = [];
  if (input.itemCount <= 0) errors.push("Agrega productos al carrito.");
  if (input.itemCount > MAX_CART_LINES) errors.push(`El carrito permite maximo ${MAX_CART_LINES} lineas.`);
  if (!isValidMoney(input.total) || input.total <= 0) errors.push("El total debe ser mayor a cero para cobrar.");
  return [...errors, ...validatePayments(input.total, input.payments)];
}

export function calculateCashChange(payment: PaymentInput) {
  if (payment.method !== "CASH") return 0;
  if (!isValidMoney(payment.amount) || !isValidMoney(payment.receivedAmount)) return 0;
  if (payment.amount <= 0) return 0;
  return roundMoney(Math.max(0, Number(payment.receivedAmount || 0) - payment.amount));
}

export function calculateInferredCashPayment(input: InferredCashPaymentInput) {
  if (isValidMoney(input.explicitCashAmount) && input.explicitCashAmount > 0) return roundMoney(input.explicitCashAmount);
  if (!isValidMoney(input.receivedAmount) || input.receivedAmount <= 0) return 0;
  const pendingCash = input.total - Math.max(0, input.cardAmount) - Math.max(0, input.transferAmount);
  return roundMoney(Math.max(0, pendingCash));
}

export function calculateCashPaymentFromReceived(input: CashPaymentFromReceivedInput) {
  const cashReceivedAmount = isValidMoney(input.cashReceivedAmount) ? Math.max(0, input.cashReceivedAmount) : 0;
  if (cashReceivedAmount <= 0) return { amount: 0, receivedAmount: 0 };

  const pendingCash = roundMoney(input.total - Math.max(0, input.cardAmount) - Math.max(0, input.transferAmount));
  const amount = roundMoney(Math.min(cashReceivedAmount, Math.max(0, pendingCash)));

  return {
    amount,
    receivedAmount: cashReceivedAmount
  };
}

export function replaceCartItem<T extends { localId: string }>(items: T[], localId: string, replacement: T) {
  return items.map((item) => (item.localId === localId ? replacement : item));
}

export type CupCartItemInput = {
  productId: string;
  quantity: 1;
  modifierIds: string[];
  notes: string;
};

// Convierte los toppings elegidos por vaso (uno por indice) en lineas de
// carrito independientes, cantidad 1 cada una, para que cada vaso conserve
// sus propios modificadores en vez de compartir un set entre N unidades.
export function buildCupCartItems(productId: string, cupModifiers: string[][], notes: string): CupCartItemInput[] {
  return cupModifiers.map((modifierIds) => ({ productId, quantity: 1 as const, modifierIds, notes }));
}

export function buildSaleSuccessPath(orderId: string) {
  return `/kiosk?ok=venta&order=${encodeURIComponent(orderId)}`;
}

export function calculateChangeBreakdown(changeAmount: number) {
  const denominations = [200, 100, 50, 20, 10, 5, 1, 0.5, 0.25, 0.1, 0.05, 0.01];
  let remainingCents = Math.max(0, Math.round(roundMoney(changeAmount) * 100));
  const breakdown: Array<{ denomination: number; quantity: number }> = [];

  for (const denomination of denominations) {
    const denominationCents = Math.round(denomination * 100);
    const quantity = Math.floor(remainingCents / denominationCents);
    if (quantity > 0) {
      breakdown.push({ denomination, quantity });
      remainingCents -= quantity * denominationCents;
    }
  }

  return breakdown;
}

export function sanitizeOrderNote(value: unknown, maxLength = 250) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function isValidMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && hasMoneyPrecision(value);
}

function isValidPaymentMethod(value: unknown): value is PaymentInput["method"] {
  return value === "CASH" || value === "CARD" || value === "TRANSFER" || value === "DELIVERY";
}

function hasMoneyPrecision(value: number) {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-9;
}
