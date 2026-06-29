import { describe, expect, it } from "vitest";
import {
  calculateCartItemTotal,
  calculateCashPaymentFromReceived,
  calculateCashChange,
  calculateChangeBreakdown,
  calculateInferredCashPayment,
  calculateOrderTotals,
  buildSaleSuccessPath,
  replaceCartItem,
  resolveProductUnitPrice,
  sanitizeOrderNote,
  validateCheckout,
  validateModifierSelections,
  validatePayments,
  type CatalogProduct
} from "@/domain/cart";

const product: CatalogProduct = {
  id: "cup",
  name: "Vaso pequeno",
  basePrice: 25,
  deliveryPrice: 30,
  modifierGroups: [
    {
      id: "chocolate",
      name: "Chocolate",
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      modifiers: [
        { id: "white", name: "Blanco", priceDelta: 0, deliveryPriceDelta: 0 },
        { id: "dark", name: "Oscuro", priceDelta: 0, deliveryPriceDelta: 0 }
      ]
    },
    {
      id: "toppings",
      name: "Toppings",
      isRequired: false,
      minSelections: 0,
      maxSelections: 2,
      modifiers: [
        { id: "oreo", name: "Oreo", priceDelta: 5, deliveryPriceDelta: 8 },
        { id: "peanut", name: "Mania", priceDelta: 3, deliveryPriceDelta: 4 }
      ]
    }
  ]
};

describe("cart domain", () => {
  it("valida grupos obligatorios y limites", () => {
    expect(validateModifierSelections(product, [])).toContain("Selecciona Chocolate.");
    expect(validateModifierSelections(product, ["white", "dark"])).toContain("Chocolate permite maximo 1.");
    expect(validateModifierSelections(product, ["white", "oreo", "oreo"])).toContain("No repitas el mismo modificador.");
    expect(validateModifierSelections(product, ["white", "oreo", "peanut"])).toEqual([]);
  });

  it("calcula totales con modificadores y cantidad", () => {
    expect(calculateCartItemTotal(product, ["white", "oreo"], 2)).toBe(60);
    expect(calculateCartItemTotal(product, ["white", "oreo", "oreo"], 2)).toBe(60);
    expect(calculateOrderTotals([{ lineTotal: 60 }, { lineTotal: 25 }]).total).toBe(85);
  });

  it("aplica precios de delivery a producto y extras cuando es delivery", () => {
    // Local: (25 + 5) * 2 = 60. Delivery: (30 + 8) * 2 = 76.
    expect(calculateCartItemTotal(product, ["white", "oreo"], 2, true)).toBe(76);
    // Extra sin precio de delivery distinto sigue igual; el producto sube a 30.
    expect(calculateCartItemTotal(product, ["white"], 1, true)).toBe(30);
    expect(resolveProductUnitPrice(product, false)).toBe(25);
    expect(resolveProductUnitPrice(product, true)).toBe(30);
  });

  it("valida pagos divididos y vuelto", () => {
    expect(validatePayments(85, [{ method: "CASH", amount: 50, receivedAmount: 100 }, { method: "TRANSFER", amount: 35 }])).toEqual([]);
    expect(calculateCashChange({ method: "CASH", amount: 50, receivedAmount: 100 })).toBe(50);
    expect(validatePayments(85, [{ method: "CARD", amount: 20 }])).toContain("El monto pagado es menor al total.");
    expect(validatePayments(85, [{ method: "CARD", amount: 90 }])).toContain("El monto pagado no debe superar el total.");
    expect(validatePayments(85, [{ method: "CARD", amount: 45 }, { method: "CARD", amount: 40 }])).toContain("Usa un solo registro por metodo de pago.");
  });

  it("acepta delivery como metodo que cubre el total sin vuelto", () => {
    expect(validatePayments(85, [{ method: "DELIVERY", amount: 85, reference: "Pedidos Ya" }])).toEqual([]);
    expect(calculateCashChange({ method: "DELIVERY", amount: 85 })).toBe(0);
    expect(validatePayments(85, [{ method: "DELIVERY", amount: 80 }])).toContain("El monto pagado es menor al total.");
  });

  it("no calcula vuelto si no hay efectivo aplicado", () => {
    expect(calculateCashChange({ method: "CASH", amount: 0, receivedAmount: 100 })).toBe(0);
    expect(calculateCashChange({ method: "CARD", amount: 100, receivedAmount: 100 })).toBe(0);
    expect(calculateCashChange({ method: "TRANSFER", amount: 100, receivedAmount: 100 })).toBe(0);
  });

  it("infiere efectivo pendiente cuando solo se captura recibido", () => {
    expect(calculateInferredCashPayment({ total: 73, explicitCashAmount: 0, cardAmount: 0, transferAmount: 0, receivedAmount: 100 })).toBe(73);
    expect(calculateInferredCashPayment({ total: 73, explicitCashAmount: 0, cardAmount: 20, transferAmount: 0, receivedAmount: 100 })).toBe(53);
    expect(calculateInferredCashPayment({ total: 73, explicitCashAmount: 10, cardAmount: 20, transferAmount: 0, receivedAmount: 100 })).toBe(10);
  });

  it("recalcula el efectivo aplicado cuando el carrito cambia despues de capturar recibido", () => {
    const payment = calculateCashPaymentFromReceived({ total: 53, cashReceivedAmount: 100, cardAmount: 0, transferAmount: 0 });

    expect(payment.amount).toBe(53);
    expect(payment.receivedAmount).toBe(100);
    expect(calculateCashChange({ method: "CASH", ...payment })).toBe(47);
  });

  it("calcula vuelto decimal con la menor cantidad de denominaciones", () => {
    expect(calculateCashChange({ method: "CASH", amount: 35.5, receivedAmount: 100 })).toBe(64.5);
    expect(calculateChangeBreakdown(64.5)).toEqual([
      { denomination: 50, quantity: 1 },
      { denomination: 10, quantity: 1 },
      { denomination: 1, quantity: 4 },
      { denomination: 0.5, quantity: 1 }
    ]);
  });

  it("rechaza pagos no numericos, infinitos o menores al total", () => {
    expect(validatePayments(60, [{ method: "CASH", amount: Number.NaN, receivedAmount: 100 }])).toContain("El monto del pago debe ser un numero valido.");
    expect(validatePayments(60, [{ method: "CASH", amount: Number.POSITIVE_INFINITY, receivedAmount: Number.POSITIVE_INFINITY }])).toContain(
      "El monto del pago debe ser un numero valido."
    );
    expect(validatePayments(60, [{ method: "CASH", amount: 59.999, receivedAmount: 100 }])).toContain("El monto del pago debe ser un numero valido.");
    expect(validatePayments(60, [{ method: "BITCOIN" as "CASH", amount: 60 }])).toContain("Metodo de pago invalido.");
    expect(validatePayments(60, [{ method: "CASH", amount: 59.99, receivedAmount: 100 }])).toContain("El monto pagado es menor al total.");
  });

  it("bloquea checkout con carrito positivo pero total cero", () => {
    expect(validateCheckout({ itemCount: 1, total: 0, payments: [{ method: "CASH", amount: 0, receivedAmount: 100 }] })).toContain(
      "El total debe ser mayor a cero para cobrar."
    );
  });

  it("bloquea checkout que excede el limite de 60 lineas de carrito (P2-QA-01)", () => {
    const payments = [{ method: "CASH" as const, amount: 100, receivedAmount: 100 }];
    expect(validateCheckout({ itemCount: 60, total: 100, payments })).not.toContain("El carrito permite maximo 60 lineas.");
    expect(validateCheckout({ itemCount: 61, total: 100, payments })).toContain("El carrito permite maximo 60 lineas.");
  });

  it("sanitiza notas con scripts y texto excesivo", () => {
    const garbage = `${"<script>alert('x')</script>"}${"a".repeat(5000)}`;
    const sanitized = sanitizeOrderNote(garbage);
    expect(sanitized).not.toContain("<script>");
    expect(sanitized.length).toBeLessThanOrEqual(250);
  });

  it("reemplaza un item editable del carrito sin cambiar el orden del resto", () => {
    const items = [
      { localId: "a", productId: "cup", quantity: 1, modifierIds: ["white"], notes: "" },
      { localId: "b", productId: "cup", quantity: 1, modifierIds: ["white", "oreo"], notes: "extra" }
    ];

    expect(replaceCartItem(items, "a", { ...items[0], modifierIds: ["dark"], notes: "sin chocolate" })).toEqual([
      { localId: "a", productId: "cup", quantity: 1, modifierIds: ["dark"], notes: "sin chocolate" },
      items[1]
    ]);
  });

  it("crea una ruta de exito unica para limpiar el cobro despues de cada venta", () => {
    expect(buildSaleSuccessPath("order 123")).toBe("/kiosk?ok=venta&order=order%20123");
  });
});

// Modela el menu del instructivo: una Fresa Clasica con topping de cortesia
// obligatorio (gratis, max 1) y la lista global de extras fusionada por la query.
const clasicaConExtras: CatalogProduct = {
  id: "fresas-crema",
  name: "Fresas con Crema",
  category: "Fresas Clasicas",
  basePrice: 36,
  deliveryPrice: 45,
  modifierGroups: [
    {
      id: "cortesia",
      name: "Topping de cortesia",
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      modifiers: [
        { id: "cortesia-oreo", name: "Oreo", priceDelta: 0, deliveryPriceDelta: 0 },
        { id: "cortesia-lotus", name: "Lotus", priceDelta: 0, deliveryPriceDelta: 0 }
      ]
    },
    {
      // Grupo global fusionado por listSellableProducts(): mismos extras en todos los productos.
      id: "extras",
      name: "Extras",
      isRequired: false,
      minSelections: 0,
      maxSelections: 14,
      modifiers: [
        { id: "extra-oreo", name: "Extra Oreo", priceDelta: 6, deliveryPriceDelta: 6 },
        { id: "extra-choco-leche", name: "Extra Chocolate con Leche", priceDelta: 20, deliveryPriceDelta: 20 }
      ]
    }
  ]
};

describe("logica de menu (instructivo)", () => {
  it("obliga a elegir el topping gratis de cortesia en las clasicas", () => {
    expect(validateModifierSelections(clasicaConExtras, [])).toContain("Selecciona Topping de cortesia.");
    expect(validateModifierSelections(clasicaConExtras, ["cortesia-oreo", "cortesia-lotus"])).toContain(
      "Topping de cortesia permite maximo 1."
    );
    expect(validateModifierSelections(clasicaConExtras, ["cortesia-oreo"])).toEqual([]);
  });

  it("el topping de cortesia no suma al precio y los extras globales si", () => {
    // Solo base + topping gratis = Q36.
    expect(calculateCartItemTotal(clasicaConExtras, ["cortesia-oreo"], 1)).toBe(36);
    // + Extra Oreo (+Q6) = Q42.
    expect(calculateCartItemTotal(clasicaConExtras, ["cortesia-oreo", "extra-oreo"], 1)).toBe(42);
    // + Extra Chocolate con Leche (+Q20) = Q62.
    expect(calculateCartItemTotal(clasicaConExtras, ["cortesia-oreo", "extra-oreo", "extra-choco-leche"], 1)).toBe(62);
  });

  it("permite extras opcionales sin seleccionar ninguno (solo el topping requerido)", () => {
    expect(validateModifierSelections(clasicaConExtras, ["cortesia-lotus"])).toEqual([]);
  });
});
