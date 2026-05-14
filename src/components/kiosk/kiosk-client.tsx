"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Check, Minus, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatGuatemalaTime } from "@/lib/time";
import { formatCurrency } from "@/lib/utils";
import {
  calculateCartItemTotal,
  calculateCashPaymentFromReceived,
  calculateCashChange,
  calculateOrderTotals,
  MAX_ITEM_QUANTITY,
  replaceCartItem,
  sanitizeOrderNote,
  validateCheckout,
  validateModifierSelections,
  type CatalogProduct
} from "@/domain/cart";
import { cancelOrderAction, changeOrderStatusAction, createPaidOrderAction } from "@/server/actions/order-actions";

type CartItem = {
  localId: string;
  productId: string;
  quantity: number;
  modifierIds: string[];
  notes: string;
};

type ActiveOrder = {
  id: string;
  status: "PAID" | "PREPARING" | "READY" | "DELIVERED" | "CANCELLED";
  total: number;
  customerName: string;
  paidAt: string;
  items: Array<{ id: string; name: string; quantity: number; notes: string | null; modifiers: string[] }>;
};

export function KioskClient({
  products,
  activeOrders,
  cashSessionOpenedAt,
  modifierGridEnabled
}: {
  products: CatalogProduct[];
  activeOrders: ActiveOrder[];
  cashSessionOpenedAt: string;
  modifierGridEnabled: boolean;
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [cashDraft, setCashDraft] = useState("");
  const [cardDraft, setCardDraft] = useState("");
  const [transferDraft, setTransferDraft] = useState("");
  const [customerNit, setCustomerNit] = useState("CF");
  const [customerName, setCustomerName] = useState("Consumidor Final");
  const [customerPhone, setCustomerPhone] = useState("");
  const searchParams = useSearchParams();
  const lastClearedSaleRef = useRef<string | null>(null);

  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? products[0];
  const editingCartItem = cart.find((item) => item.localId === editingCartItemId) ?? null;
  const selectedErrors = selectedProduct ? validateModifierSelections(selectedProduct, selectedModifiers) : [];
  const pricedCart = cart.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId)!;
    return {
      ...item,
      product,
      modifierNames: getModifierNames(product, item.modifierIds),
      lineTotal: calculateCartItemTotal(product, item.modifierIds, item.quantity)
    };
  });
  const totals = calculateOrderTotals(pricedCart);
  const cashAmount = parseMoneyDraft(cashDraft);
  const cardAmount = parseMoneyDraft(cardDraft);
  const transferAmount = parseMoneyDraft(transferDraft);
  const cashPayment = calculateCashPaymentFromReceived({
    total: totals.total,
    cashReceivedAmount: cashAmount,
    cardAmount,
    transferAmount
  });
  const change = calculateCashChange({ method: "CASH", ...cashPayment });

  const saleSuccessToken = searchParams.get("ok") === "venta" ? searchParams.get("order") ?? "venta" : null;

  useEffect(() => {
    if (!saleSuccessToken || lastClearedSaleRef.current === saleSuccessToken) return;
    lastClearedSaleRef.current = saleSuccessToken;
    setCart([]);
    setSelectedModifiers([]);
    setQuantity(1);
    setNotes("");
    setEditingCartItemId(null);
    setCashDraft("");
    setCardDraft("");
    setTransferDraft("");
    setCustomerNit("CF");
    setCustomerName("Consumidor Final");
    setCustomerPhone("");
  }, [saleSuccessToken]);

  function toggleModifier(product: CatalogProduct, modifierId: string) {
    const group = product.modifierGroups.find((candidate) => candidate.modifiers.some((modifier) => modifier.id === modifierId));
    if (!group) return;
    setSelectedModifiers((current) => {
      const exists = current.includes(modifierId);
      if (exists) return current.filter((id) => id !== modifierId);
      const sameGroup = group.modifiers.map((modifier) => modifier.id);
      const withoutGroup = group.maxSelections === 1 ? current.filter((id) => !sameGroup.includes(id)) : current;
      return [...withoutGroup, modifierId];
    });
  }

  function resetBuilder() {
    setSelectedModifiers([]);
    setQuantity(1);
    setNotes("");
    setEditingCartItemId(null);
  }

  function saveItem() {
    if (!selectedProduct || selectedErrors.length) return;
    const nextItem = {
      localId: editingCartItemId ?? crypto.randomUUID(),
      productId: selectedProduct.id,
      quantity,
      modifierIds: selectedModifiers,
      notes: sanitizeOrderNote(notes)
    };
    setCart((current) => (editingCartItemId ? replaceCartItem(current, editingCartItemId, nextItem) : [...current, nextItem]));
    resetBuilder();
  }

  function startEditingItem(item: CartItem) {
    setSelectedProductId(item.productId);
    setSelectedModifiers([...item.modifierIds]);
    setQuantity(item.quantity);
    setNotes(item.notes);
    setEditingCartItemId(item.localId);
  }

  const paymentPayload: Array<{ method: "CASH" | "CARD" | "TRANSFER"; amount: number; receivedAmount?: number }> = [];
  if (cashPayment.amount > 0 || cashPayment.receivedAmount > 0) paymentPayload.push({ method: "CASH", ...cashPayment });
  if (cardAmount > 0) paymentPayload.push({ method: "CARD", amount: cardAmount });
  if (transferAmount > 0) paymentPayload.push({ method: "TRANSFER", amount: transferAmount });
  const checkoutErrors = validateCheckout({ itemCount: cart.length, total: totals.total, payments: paymentPayload });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <section className="flex flex-col gap-6">
        <div className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-[var(--primary)] uppercase tracking-wider">Caja abierta</p>
              <p className="font-display text-2xl font-black sm:text-3xl">Desde {formatGuatemalaTime(cashSessionOpenedAt)}</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-[var(--soft-mint)] px-4 py-2 text-sm font-bold text-[var(--foreground)]">
              <Sparkles size={16} className="text-[var(--accent)]" />
              Koi Software
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Catalogo</CardTitle>
              <p className="mt-1 text-sm font-medium text-[var(--muted-foreground)]">Elige una base y personaliza cada detalle.</p>
            </div>
            <span className="rounded-full bg-[var(--muted)] px-4 py-2 text-xs font-bold text-[var(--foreground)]">
              {products.length} productos
            </span>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => {
              const active = selectedProduct?.id === product.id;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    setSelectedProductId(product.id);
                    resetBuilder();
                  }}
                  className={`group min-h-32 rounded-[2rem] border p-6 text-left transition-all duration-200 ${active
                      ? "selected-item border-transparent scale-[1.02]"
                      : "border-[var(--border)] bg-white hover:border-[var(--primary)] hover:shadow-md"
                    }`}
                >
                  <div className="flex h-full flex-col justify-between gap-5">
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <span className={`grid size-12 place-items-center rounded-2xl font-display text-xl font-black transition ${active ? "bg-white/20 text-white" : "bg-[var(--soft-mint)] text-[var(--foreground)] group-hover:bg-[var(--primary)] group-hover:text-white"
                          }`}>
                          {product.name.slice(0, 1)}
                        </span>
                        <div className={`h-2 w-12 rounded-full transition ${active ? "bg-white/30" : "bg-[var(--accent)] group-hover:bg-[var(--primary)]"}`} />
                      </div>
                      <div className="font-display text-xl font-black tracking-tight">{product.name}</div>
                    </div>
                    <div className={`text-sm font-bold ${active ? "text-white" : "text-[var(--primary)]"}`}>{formatCurrency(product.basePrice)}</div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {selectedProduct ? (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>{editingCartItem ? "Editar" : "Personalizar"} {selectedProduct.name}</CardTitle>
                <p className="mt-1 text-sm font-medium text-[var(--muted-foreground)]">
                  {editingCartItem ? "Ajusta tu pedido y guarda los cambios." : "Personaliza tu eleccion con ingredientes extras."}
                </p>
              </div>
              <div className="flex items-center rounded-full bg-[var(--muted)] p-1">
                <Button type="button" size="icon" variant="ghost" className="rounded-full" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>
                  <Minus size={16} />
                </Button>
                <strong className="w-10 text-center text-lg">{quantity}</strong>
                <Button type="button" size="icon" variant="ghost" className="rounded-full" onClick={() => setQuantity((value) => Math.min(MAX_ITEM_QUANTITY, value + 1))}>
                  <Plus size={16} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              {selectedProduct.modifierGroups.map((group) => {
                const selectedCount = group.modifiers.filter((modifier) => selectedModifiers.includes(modifier.id)).length;
                return (
                  <div key={group.id} className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold tracking-tight">{group.name}</h3>
                        <p className="text-xs font-medium text-[var(--muted-foreground)]">
                          Seleccionado {selectedCount} de {group.maxSelections}
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-bold text-[var(--muted-foreground)]">
                        Min {group.minSelections} - Max {group.maxSelections}
                      </span>
                    </div>
                    <div className={modifierGridEnabled ? modifierGridClass(group.modifiers.length) : "flex flex-wrap gap-3"}>
                      {group.modifiers.map((modifier) => {
                        const active = selectedModifiers.includes(modifier.id);
                        return (
                          <button
                            type="button"
                            key={modifier.id}
                            onClick={() => toggleModifier(selectedProduct, modifier.id)}
                            className={
                              modifierGridEnabled
                                ? `group/tile min-h-32 rounded-[1.75rem] border p-4 text-left transition-all duration-200 sm:min-h-36 ${
                                    active
                                      ? "selected-item border-transparent shadow-lg"
                                      : "border-[var(--border)] bg-white text-[var(--foreground)] hover:-translate-y-0.5 hover:border-[var(--primary)] hover:shadow-md"
                                  }`
                                : `touch-target rounded-full border px-6 py-3 text-sm font-bold transition-all duration-200 ${
                                    active
                                      ? "selected-item border-transparent shadow-md"
                                      : "border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[var(--primary)]"
                                  }`
                            }
                          >
                            {modifierGridEnabled ? (
                              <span className="flex h-full min-h-24 flex-col justify-between gap-4">
                                <span className="flex items-start justify-between gap-3">
                                  <span
                                    className={`grid size-14 shrink-0 place-items-center rounded-2xl font-display text-2xl font-black transition ${
                                      active ? "bg-white/20 text-white" : "bg-[var(--soft-mint)] text-[var(--foreground)] group-hover/tile:bg-[var(--primary)] group-hover/tile:text-white"
                                    }`}
                                  >
                                    {modifier.name.slice(0, 1)}
                                  </span>
                                  <span className={`h-2 min-w-10 flex-1 rounded-full ${active ? "bg-white/30" : "bg-[var(--accent)]/70"}`} />
                                </span>
                                <span>
                                  <span className="block text-lg font-black leading-tight sm:text-xl">{modifier.name}</span>
                                  <span className={`mt-2 block text-sm font-black ${active ? "text-white/90" : "text-[var(--primary)]"}`}>
                                    {modifier.priceDelta > 0 ? `+${formatCurrency(modifier.priceDelta)}` : "Incluido"}
                                  </span>
                                </span>
                              </span>
                            ) : (
                              <>
                                {modifier.name}
                                {modifier.priceDelta > 0 ? (
                                  <span className={`ml-2 ${active ? "text-white/90" : "text-[var(--primary)]"}`}>
                                    +{formatCurrency(modifier.priceDelta)}
                                  </span>
                                ) : null}
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {selectedErrors.length ? (
                <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-[var(--danger)]">{selectedErrors[0]}</p>
              ) : null}
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div>
                  <Label className="mb-2 block text-sm font-bold text-[var(--foreground)]">Notas especiales</Label>
                  <Input value={notes} maxLength={250} onChange={(event) => setNotes(sanitizeOrderNote(event.target.value))} placeholder="Ej. sin azucar, extra hielo..." className="rounded-xl" />
                </div>
                <div className="grid gap-2 self-end">
                  <Button type="button" size="lg" onClick={saveItem} disabled={selectedErrors.length > 0}>
                    {editingCartItem ? "Guardar" : "Agregar"}
                  </Button>
                  {editingCartItem ? (
                    <Button type="button" variant="ghost" onClick={resetBuilder}>
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Pedidos activos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {activeOrders.length === 0 ? <p className="text-sm font-medium text-[var(--muted-foreground)]">No hay pedidos pendientes.</p> : null}
            {activeOrders.map((order) => (
              <div key={order.id} className="rounded-3xl border border-[var(--border)] bg-white p-5 hover:shadow-md transition-shadow">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <strong className="font-display text-xl font-black tracking-tighter">#{order.id.slice(-6)}</strong>
                  <span className="rounded-full bg-[var(--soft-mint)] px-3 py-1 text-xs font-bold text-[var(--accent)] uppercase">{statusLabel(order.status)}</span>
                </div>
                <div className="flex flex-col gap-2 text-sm">
                  {order.items.map((item) => (
                    <div key={item.id} className="border-l-2 border-[var(--primary)] pl-3">
                      <strong className="block text-base">{item.quantity} x {item.name}</strong>
                      <div className="text-xs font-medium text-[var(--muted-foreground)]">{item.modifiers.join(", ") || "Sin extras"}</div>
                      {item.notes ? <div className="mt-1 text-xs italic font-medium">&quot;{item.notes}&quot;</div> : null}
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {nextStatus(order.status) ? (
                    <form action={changeOrderStatusAction}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="status" value={nextStatus(order.status)} />
                      <Button type="submit" size="sm" className="w-full rounded-xl">
                        <Check size={14} />
                        {nextStatusLabel(order.status)}
                      </Button>
                    </form>
                  ) : null}
                  <form action={cancelOrderAction}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="reason" value="Cancelada desde kiosco" />
                    <Button type="submit" variant="ghost" size="sm" className="w-full rounded-xl text-[var(--danger)] hover:bg-red-50">
                      Cancelar
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <aside className="rounded-[2.5rem] border border-[var(--border)] bg-white/80 p-5 shadow-xl backdrop-blur-xl xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-auto">
        <div className="flex flex-col gap-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-black tracking-tight">Tu Pedido</h2>
              <span className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-bold">{pricedCart.length} items</span>
            </div>
            <div className="flex flex-col gap-3">
              {pricedCart.length === 0 ? <p className="rounded-3xl bg-[var(--muted)]/50 p-8 text-center text-sm font-medium text-[var(--muted-foreground)]">El carrito esta vacio.</p> : null}
              {pricedCart.map((item) => (
                <div key={item.localId} className="group relative rounded-3xl border border-[var(--border)] bg-white p-5 hover:border-[var(--primary)] transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <strong className="block text-base leading-tight">{item.quantity} x {item.product.name}</strong>
                      <p className="mt-1 text-xs font-medium text-[var(--muted-foreground)]">
                        {item.modifierNames.length > 0 ? item.modifierNames.join(", ") : "Sin extras"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon" variant="ghost" className="size-8 rounded-full" onClick={() => startEditingItem(item)}>
                        <Pencil size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8 rounded-full text-[var(--danger)]" onClick={() => setCart((current) => current.filter((candidate) => candidate.localId !== item.localId))}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 text-right text-lg font-black text-[var(--primary)]">{formatCurrency(item.lineTotal)}</div>
                </div>
              ))}
              <div className="mt-2 rounded-[2rem] bg-[var(--foreground)] p-6 text-white shadow-lg">
                <div className="text-xs font-bold uppercase tracking-wider opacity-60 mb-1">Total a pagar</div>
                <div className="font-display text-4xl font-black">{formatCurrency(totals.total)}</div>
              </div>
            </div>
          </div>

          <Card className="border-none shadow-none bg-[var(--muted)]/30">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl">Datos de Pago</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <form action={createPaidOrderAction} className="flex flex-col gap-5">
                <input type="hidden" name="items" value={JSON.stringify(cart.map(({ productId, quantity, modifierIds, notes }) => ({ productId, quantity, modifierIds, notes: sanitizeOrderNote(notes) })))} />
                <input type="hidden" name="payments" value={JSON.stringify(paymentPayload)} />

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] ml-1">NIT</Label>
                      <Input name="customerNit" value={customerNit} onChange={(event) => setCustomerNit(event.target.value)} className="rounded-xl border-none bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] ml-1">Telefono</Label>
                      <Input name="customerPhone" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} className="rounded-xl border-none bg-white" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] ml-1">Nombre Cliente</Label>
                    <Input name="customerName" value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="rounded-xl border-none bg-white" />
                  </div>
                </div>

                <div className="space-y-4 pt-2 border-t border-[var(--border)]">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] text-center block">Efectivo</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={cashDraft}
                        className="rounded-xl border-none bg-white text-center font-bold"
                        placeholder="0.00"
                        onBlur={() => {
                          setCashDraft(normalizeMoneyDraft(cashDraft));
                        }}
                        onChange={(event) => setCashDraft(sanitizeMoneyDraft(event.target.value))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] text-center block">Tarjeta</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={cardDraft}
                        className="rounded-xl border-none bg-white text-center font-bold"
                        placeholder="0.00"
                        onBlur={() => {
                          setCardDraft(normalizeMoneyDraft(cardDraft));
                        }}
                        onChange={(event) => setCardDraft(sanitizeMoneyDraft(event.target.value))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] text-center block">Transfer.</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={transferDraft}
                        className="rounded-xl border-none bg-white text-center font-bold"
                        placeholder="0.00"
                        onBlur={() => {
                          setTransferDraft(normalizeMoneyDraft(transferDraft));
                        }}
                        onChange={(event) => setTransferDraft(sanitizeMoneyDraft(event.target.value))}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--soft-mint)] border border-[var(--accent)]/20">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Cambio</div>
                    <div className="text-2xl font-black text-[var(--foreground)]">{formatCurrency(change)}</div>
                  </div>
                  <CheckoutSubmitButton
                    disabled={cart.length === 0 || totals.total <= 0}
                    onClick={(event) => {
                      if (checkoutErrors.length) {
                        event.preventDefault();
                        alert(checkoutErrors[0]);
                      }
                    }}
                  />
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </aside>
    </div>
  );
}

function CheckoutSubmitButton({ disabled, onClick }: { disabled: boolean; onClick: (event: MouseEvent<HTMLButtonElement>) => void }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="rounded-xl px-8 font-black shadow-lg shadow-[var(--primary)]/20" disabled={disabled || pending} onClick={onClick}>
      {pending ? "..." : "COBRAR"}
    </Button>
  );
}

function modifierGridClass(count: number) {
  if (count <= 3) return "grid grid-cols-2 gap-3 sm:grid-cols-3";
  if (count <= 6) return "grid grid-cols-2 gap-3 lg:grid-cols-3";
  return "grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4";
}

function statusLabel(status: ActiveOrder["status"]) {
  return {
    PAID: "Pagado",
    PREPARING: "Preparando",
    READY: "Listo",
    DELIVERED: "Entregado",
    CANCELLED: "Cancelado"
  }[status];
}

function nextStatus(status: ActiveOrder["status"]) {
  if (status === "PAID") return "PREPARING";
  if (status === "PREPARING") return "READY";
  if (status === "READY") return "DELIVERED";
  return "";
}

function nextStatusLabel(status: ActiveOrder["status"]) {
  if (status === "PAID") return "Preparar";
  if (status === "PREPARING") return "Listo";
  if (status === "READY") return "Entregar";
  return "";
}

function sanitizeMoneyDraft(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [integer = "", ...decimalParts] = cleaned.split(".");
  const decimal = decimalParts.join("").slice(0, 2);
  return decimalParts.length > 0 ? `${integer}.${decimal}` : integer;
}

function normalizeMoneyDraft(value: string) {
  const parsed = parseMoneyDraft(value);
  return parsed > 0 ? String(parsed) : "";
}

function parseMoneyDraft(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getModifierNames(product: CatalogProduct, modifierIds: string[]) {
  const selected = new Set(modifierIds);
  return product.modifierGroups
    .flatMap((group) => group.modifiers)
    .filter((modifier) => selected.has(modifier.id))
    .map((modifier) => modifier.name);
}
