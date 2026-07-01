"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Check, ChevronLeft, Minus, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatGuatemalaTime } from "@/lib/time";
import { formatCurrency } from "@/lib/utils";
import {
  buildCupCartItems,
  calculateCartItemTotal,
  calculateCashPaymentFromReceived,
  calculateCashChange,
  calculateOrderTotals,
  MAX_CART_LINES,
  MAX_ITEM_QUANTITY,
  replaceCartItem,
  resolveModifierDelta,
  resolveProductUnitPrice,
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
  status: "PENDING" | "PREPARING" | "DELIVERED" | "CANCELLED";
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
  const [cupBuilder, setCupBuilder] = useState<{ cups: string[][]; currentIndex: number }>({ cups: [[]], currentIndex: 0 });
  const [notes, setNotes] = useState("");
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [cashDraft, setCashDraft] = useState("");
  const [cardDraft, setCardDraft] = useState("");
  const [transferDraft, setTransferDraft] = useState("");
  const [deliveryMode, setDeliveryMode] = useState(false);
  const [deliveryPlatform, setDeliveryPlatform] = useState("Pedidos Ya");
  const [customerNit, setCustomerNit] = useState("CF");
  const [customerName, setCustomerName] = useState("Consumidor Final");
  const [customerPhone, setCustomerPhone] = useState("");
  const searchParams = useSearchParams();
  const lastClearedSaleRef = useRef<string | null>(null);

  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? products[0];
  const hasModifierGroups = (selectedProduct?.modifierGroups.length ?? 0) > 0;
  const { cups: cupModifiers, currentIndex: currentCupIndex } = cupBuilder;
  const selectedModifiers = cupModifiers[currentCupIndex] ?? [];
  const quantity = cupModifiers.length;
  const isLastCup = !hasModifierGroups || currentCupIndex === cupModifiers.length - 1;
  const showCupNav = hasModifierGroups && cupModifiers.length > 1;
  const productSections = groupProductsByCategory(products);
  const editingCartItem = cart.find((item) => item.localId === editingCartItemId) ?? null;
  const selectedErrors = selectedProduct ? validateModifierSelections(selectedProduct, selectedModifiers) : [];
  const pricedCart = cart.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId)!;
    return {
      ...item,
      product,
      modifierNames: getModifierNames(product, item.modifierIds),
      lineTotal: calculateCartItemTotal(product, item.modifierIds, item.quantity, deliveryMode)
    };
  });
  const totals = calculateOrderTotals(pricedCart);
  const quantityByProduct = new Map<string, number>();
  for (const item of cart) {
    quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) ?? 0) + item.quantity);
  }
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
    setCupBuilder({ cups: [[]], currentIndex: 0 });
    setNotes("");
    setEditingCartItemId(null);
    setCustomizeOpen(false);
    setCashDraft("");
    setCardDraft("");
    setTransferDraft("");
    setDeliveryMode(false);
    setDeliveryPlatform("Pedidos Ya");
    setCustomerNit("CF");
    setCustomerName("Consumidor Final");
    setCustomerPhone("");
  }, [saleSuccessToken]);

  function toggleModifier(product: CatalogProduct, modifierId: string) {
    const group = product.modifierGroups.find((candidate) => candidate.modifiers.some((modifier) => modifier.id === modifierId));
    if (!group) return;
    setCupBuilder((state) => {
      const cup = state.cups[state.currentIndex];
      const exists = cup.includes(modifierId);
      const sameGroup = group.modifiers.map((modifier) => modifier.id);
      const nextCup = exists
        ? cup.filter((id) => id !== modifierId)
        : [...(group.maxSelections === 1 ? cup.filter((id) => !sameGroup.includes(id)) : cup), modifierId];
      const cups = state.cups.map((candidate, index) => (index === state.currentIndex ? nextCup : candidate));
      return { ...state, cups };
    });
  }

  function resetBuilder() {
    setCupBuilder({ cups: [[]], currentIndex: 0 });
    setNotes("");
    setEditingCartItemId(null);
  }

  // "+" del stepper interno: agrega un vaso vacio y salta el foco a el (tope
  // MAX_ITEM_QUANTITY). Agregar y configurar un vaso nuevo son la misma accion.
  function addCup() {
    setCupBuilder((state) => {
      if (state.cups.length >= MAX_ITEM_QUANTITY) return state;
      const cups = [...state.cups, []];
      return { cups, currentIndex: cups.length - 1 };
    });
  }

  // "-" del stepper interno: quita el ultimo vaso (piso de 1 vaso).
  function removeLastCup() {
    setCupBuilder((state) => {
      if (state.cups.length <= 1) return state;
      const cups = state.cups.slice(0, -1);
      return { cups, currentIndex: Math.min(state.currentIndex, cups.length - 1) };
    });
  }

  // "Anterior"/"Siguiente vaso": revisita un vaso ya configurado sin cambiar
  // cuantos vasos hay en total.
  function goToPreviousCup() {
    setCupBuilder((state) => ({ ...state, currentIndex: Math.max(0, state.currentIndex - 1) }));
  }

  function goToNextCup() {
    setCupBuilder((state) => ({ ...state, currentIndex: Math.min(state.cups.length - 1, state.currentIndex + 1) }));
  }

  // Guarda el vaso actual. Solo se llama cuando es el ultimo vaso (ver el
  // boton "Agregar"/"Guardar" en el JSX); confirma todo el lote de una vez:
  // cada vaso queda como su propia linea de carrito (cantidad 1) para que
  // sus toppings nunca se mezclen con los de otro vaso.
  function commitCups() {
    if (!selectedProduct || selectedErrors.length) return;
    const trimmedNotes = sanitizeOrderNote(notes);

    if (!hasModifierGroups) {
      if (!editingCartItemId && cart.length >= MAX_CART_LINES) return;
      const nextItem = {
        localId: editingCartItemId ?? crypto.randomUUID(),
        productId: selectedProduct.id,
        quantity: cupModifiers.length,
        modifierIds: [] as string[],
        notes: trimmedNotes
      };
      setCart((current) => (editingCartItemId ? replaceCartItem(current, editingCartItemId, nextItem) : [...current, nextItem]));
      resetBuilder();
      setCustomizeOpen(false);
      return;
    }

    const newItems = buildCupCartItems(selectedProduct.id, cupModifiers, trimmedNotes);
    const extraLines = editingCartItemId ? newItems.length - 1 : newItems.length;
    if (cart.length + extraLines > MAX_CART_LINES) return;

    setCart((current) => {
      if (!editingCartItemId) {
        return [...current, ...newItems.map((item) => ({ ...item, localId: crypto.randomUUID() }))];
      }
      const [firstCup, ...restCups] = newItems;
      const replaced = replaceCartItem(current, editingCartItemId, { ...firstCup, localId: editingCartItemId });
      return [...replaced, ...restCups.map((item) => ({ ...item, localId: crypto.randomUUID() }))];
    });
    resetBuilder();
    setCustomizeOpen(false);
  }

  // Abre el pop-up para configurar UN vaso nuevo del producto (estado limpio),
  // de modo que los toppings no se mezclen entre vasos.
  function openCustomizeForProduct(product: CatalogProduct) {
    setSelectedProductId(product.id);
    resetBuilder();
    setCustomizeOpen(true);
  }

  // Reabre una linea guardada: el vaso 0 arranca con sus toppings actuales;
  // si la linea tenia cantidad > 1 (solo posible en productos sin toppings),
  // los vasos siguientes arrancan vacios, igual que un vaso nuevo.
  function startEditingItem(item: CartItem) {
    setSelectedProductId(item.productId);
    const cups: string[][] = Array.from({ length: Math.max(1, item.quantity) }, () => []);
    cups[0] = [...item.modifierIds];
    setCupBuilder({ cups, currentIndex: 0 });
    setNotes(item.notes);
    setEditingCartItemId(item.localId);
    setCustomizeOpen(true);
  }

  // Cierra el pop-up sin guardar y limpia el constructor (descarta TODOS los
  // vasos en progreso, no solo el que se estaba viendo).
  function closeCustomize() {
    setCustomizeOpen(false);
    resetBuilder();
  }

  // -1 desde la tarjeta: descuenta primero la linea simple (sin extras) y, si no
  // existe, la ultima linea de ese producto para deshacer un agregado con extras.
  function quickRemoveProduct(product: CatalogProduct) {
    setCart((current) => {
      let index = current.findIndex(
        (item) => item.productId === product.id && item.modifierIds.length === 0 && item.notes === ""
      );
      if (index < 0) {
        for (let i = current.length - 1; i >= 0; i--) {
          if (current[i].productId === product.id) {
            index = i;
            break;
          }
        }
      }
      if (index < 0) return current;
      const line = current[index];
      if (line.quantity <= 1) return current.filter((_, position) => position !== index);
      const next = [...current];
      next[index] = { ...line, quantity: line.quantity - 1 };
      return next;
    });
  }

  const paymentPayload: Array<{ method: "CASH" | "CARD" | "TRANSFER" | "DELIVERY"; amount: number; receivedAmount?: number; reference?: string }> = [];
  if (deliveryMode) {
    if (totals.total > 0) paymentPayload.push({ method: "DELIVERY", amount: totals.total, reference: deliveryPlatform.trim() || "Pedidos Ya" });
  } else {
    if (cashPayment.amount > 0 || cashPayment.receivedAmount > 0) paymentPayload.push({ method: "CASH", ...cashPayment });
    if (cardAmount > 0) paymentPayload.push({ method: "CARD", amount: cardAmount });
    if (transferAmount > 0) paymentPayload.push({ method: "TRANSFER", amount: transferAmount });
  }
  const checkoutErrors = validateCheckout({ itemCount: cart.length, total: totals.total, payments: paymentPayload });

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
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
          <CardContent className="space-y-8">
            {productSections.map((section) => (
              <div key={section.key} className="space-y-4">
                {section.label ? (
                  <h3 className="font-display text-lg font-black tracking-tight text-[var(--foreground)]">{section.label}</h3>
                ) : null}
                <div className="grid gap-4 grid-cols-2 landscape:grid-cols-3 xl:grid-cols-3">
                  {section.products.map((product) => {
                    const active = customizeOpen && selectedProductId === product.id;
                    const cartQuantity = quantityByProduct.get(product.id) ?? 0;
                    const openCup = () => openCustomizeForProduct(product);
                    return (
                      <div
                        key={product.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={active}
                        onClick={openCup}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openCup();
                          }
                        }}
                        className={`group flex aspect-square cursor-pointer flex-col rounded-[2rem] border p-5 text-left transition-all duration-200 ${active
                            ? "selected-item border-transparent scale-[1.02]"
                            : "border-[var(--border)] bg-white hover:border-[var(--primary)] hover:shadow-md"
                          }`}
                      >
                        <div className="flex-1">
                          <div className="mb-3 flex items-center gap-2">
                            <span className={`grid size-12 place-items-center rounded-2xl font-display text-xl font-black transition ${active ? "bg-white/20 text-white" : "bg-[var(--primary)]/10 text-[var(--primary)] group-hover:bg-[var(--primary)] group-hover:text-white"
                              }`}>
                              {product.name.slice(0, 1)}
                            </span>
                          </div>
                          <div className="font-display text-xl font-black tracking-tight">{product.name}</div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm font-bold ${active ? "text-white" : "text-[var(--primary)]"}`}>{formatCurrency(resolveProductUnitPrice(product, deliveryMode))}</span>
                          <QuantityStepper
                            active={active}
                            count={cartQuantity}
                            addLabel={`Sumar uno de ${product.name}`}
                            removeLabel={`Quitar uno de ${product.name}`}
                            onAdd={(event) => {
                              event.stopPropagation();
                              openCup();
                            }}
                            onRemove={(event) => {
                              event.stopPropagation();
                              quickRemoveProduct(product);
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Dialog open={customizeOpen} onOpenChange={(open) => { if (!open) closeCustomize(); }}>
          {selectedProduct ? (
            <DialogContent className="space-y-6">
              <DialogHeader className="pr-10">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <DialogTitle>{editingCartItem ? "Editar" : "Personalizar"} {selectedProduct.name}</DialogTitle>
                    <DialogDescription>
                      {editingCartItem ? "Ajusta tu pedido y guarda los cambios." : "Personaliza este vaso con ingredientes extras."}
                    </DialogDescription>
                  </div>
                  <div className="flex shrink-0 items-center rounded-full bg-[var(--muted)] p-1">
                    <Button data-testid="qty-minus" type="button" size="icon" variant="ghost" className="rounded-full" onClick={removeLastCup}>
                      <Minus size={16} />
                    </Button>
                    <strong className="w-10 text-center text-lg">{quantity}</strong>
                    <Button data-testid="qty-plus" type="button" size="icon" variant="ghost" className="rounded-full" onClick={addCup}>
                      <Plus size={16} />
                    </Button>
                  </div>
                </div>
                {showCupNav ? (
                  <div className="flex items-center justify-center gap-3 rounded-2xl bg-[var(--muted)]/60 px-4 py-2">
                    <Button
                      data-testid="cup-prev"
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full"
                      onClick={goToPreviousCup}
                      disabled={currentCupIndex === 0}
                    >
                      <ChevronLeft size={16} />
                      Anterior
                    </Button>
                    <span className="text-sm font-bold text-[var(--foreground)]">
                      Vaso {currentCupIndex + 1} de {cupModifiers.length}
                    </span>
                  </div>
                ) : null}
              </DialogHeader>
              <div className="space-y-8">
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
                        const modifierDelta = resolveModifierDelta(modifier, deliveryMode);
                        return (
                          <button
                            type="button"
                            key={modifier.id}
                            aria-label={modifier.name}
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
                                      active ? "bg-white/20 text-white" : "bg-[var(--primary)]/10 text-[var(--primary)] group-hover/tile:bg-[var(--primary)] group-hover/tile:text-white"
                                    }`}
                                  >
                                    {modifier.name.slice(0, 1)}
                                  </span>
                                </span>
                                <span>
                                  <span className="block text-lg font-black leading-tight sm:text-xl">{modifier.name}</span>
                                  <span className={`mt-2 block text-sm font-black ${active ? "text-white/90" : "text-[var(--primary)]"}`}>
                                    {modifierDelta > 0 ? `+${formatCurrency(modifierDelta)}` : "Incluido"}
                                  </span>
                                </span>
                              </span>
                            ) : (
                              <>
                                {modifier.name}
                                {modifierDelta > 0 ? (
                                  <span className={`ml-2 ${active ? "text-white/90" : "text-[var(--primary)]"}`}>
                                    +{formatCurrency(modifierDelta)}
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
                <div>
                  <Label className="mb-2 block text-sm font-bold text-[var(--foreground)]">Notas especiales</Label>
                  <Input value={notes} maxLength={250} onChange={(event) => setNotes(sanitizeOrderNote(event.target.value))} placeholder="Ej. sin azucar, extra hielo..." className="rounded-xl" />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button data-testid="edit-cancel" type="button" variant="ghost" onClick={closeCustomize}>
                  Cancelar
                </Button>
                {isLastCup ? (
                  <Button type="button" size="lg" onClick={commitCups} disabled={selectedErrors.length > 0}>
                    {editingCartItem ? "Guardar" : "Agregar"}
                  </Button>
                ) : (
                  <Button type="button" size="lg" onClick={goToNextCup} disabled={selectedErrors.length > 0}>
                    Siguiente vaso
                  </Button>
                )}
              </div>
            </DialogContent>
          ) : null}
        </Dialog>

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

      <aside className="rounded-[2.5rem] border border-[var(--border)] bg-white/80 p-5 shadow-xl backdrop-blur-xl lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-auto">
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
                      <p data-testid="cart-line-modifiers" className="mt-1 text-xs font-medium text-[var(--muted-foreground)]">
                        {item.modifierNames.length > 0 ? item.modifierNames.join(", ") : "Sin extras"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button data-testid="cart-edit" size="icon" variant="ghost" className="size-8 rounded-full" onClick={() => startEditingItem(item)}>
                        <Pencil size={14} />
                      </Button>
                      <Button data-testid="cart-delete" size="icon" variant="ghost" className="size-8 rounded-full text-[var(--danger)]" onClick={() => setCart((current) => current.filter((candidate) => candidate.localId !== item.localId))}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 text-right text-lg font-black text-[var(--primary)]">{formatCurrency(item.lineTotal)}</div>
                </div>
              ))}
              <div className="mt-2 rounded-[2rem] bg-[var(--foreground)] p-6 text-white shadow-lg">
                <div className="text-xs font-bold uppercase tracking-wider opacity-60 mb-1">Total a pagar</div>
                <div data-testid="cart-total" className="font-display text-4xl font-black">{formatCurrency(totals.total)}</div>
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
                  <button
                    type="button"
                    onClick={() => setDeliveryMode((value) => !value)}
                    aria-pressed={deliveryMode}
                    className={`flex w-full touch-target items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                      deliveryMode ? "border-[var(--accent)] bg-[var(--soft-mint)]" : "border-transparent bg-white"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-bold text-[var(--foreground)]">Pedido por delivery</span>
                      <span className="block text-xs font-medium text-[var(--muted-foreground)]">Pedidos Ya u otra plataforma</span>
                    </span>
                    <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${deliveryMode ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}>
                      <span className={`absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform ${deliveryMode ? "translate-x-5" : ""}`} />
                    </span>
                  </button>

                  {deliveryMode ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] ml-1">Plataforma</Label>
                        <Input
                          value={deliveryPlatform}
                          maxLength={40}
                          placeholder="Pedidos Ya"
                          className="rounded-xl border-none bg-white font-bold"
                          onChange={(event) => setDeliveryPlatform(event.target.value)}
                        />
                      </div>
                      <p className="rounded-2xl bg-[var(--soft-mint)] px-4 py-3 text-xs font-semibold text-[var(--foreground)]">
                        Precios de delivery aplicados. El total {formatCurrency(totals.total)} se registra como Delivery. No entra al efectivo de la caja: la plataforma liquida en su propio horario.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] text-center block">Efectivo</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          name="cashAmount"
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
                          name="cardAmount"
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
                          name="transferAmount"
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
                  )}
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--soft-mint)] border border-[var(--accent)]/20">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">{deliveryMode ? "Total delivery" : "Cambio"}</div>
                    <div className="text-2xl font-black text-[var(--foreground)]">{formatCurrency(deliveryMode ? totals.total : change)}</div>
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

// Stepper compacto junto al precio. Con 0 unidades solo muestra el boton +;
// al haber unidades en el carrito aparece el -, la cantidad y el +.
function QuantityStepper({
  active,
  count,
  addLabel,
  removeLabel,
  onAdd,
  onRemove
}: {
  active: boolean;
  count: number;
  addLabel: string;
  removeLabel: string;
  onAdd: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const removeClass = active
    ? "border-white/40 bg-white/15 text-white hover:bg-white/25"
    : "border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]";
  const addClass = active ? "bg-white text-[var(--primary)] hover:brightness-95" : "bg-[var(--primary)] text-white hover:brightness-110";
  return (
    <div className="flex shrink-0 items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
      {count > 0 ? (
        <>
          <button
            type="button"
            aria-label={removeLabel}
            onClick={onRemove}
            className={`grid size-11 place-items-center rounded-full border transition ${removeClass}`}
          >
            <Minus size={18} />
          </button>
          <span className={`min-w-[1.5rem] text-center text-base font-black tabular-nums ${active ? "text-white" : "text-[var(--foreground)]"}`}>
            {count}
          </span>
        </>
      ) : null}
      <button
        type="button"
        aria-label={addLabel}
        onClick={onAdd}
        className={`grid size-11 place-items-center rounded-full border border-transparent transition ${addClass}`}
      >
        <Plus size={18} />
      </button>
    </div>
  );
}

// Agrupa el catalogo por categoria ("Fresas Clasicas" / "Fresas Gourmet"),
// preservando el orden de aparicion. Si no hay categorias, devuelve una sola
// seccion sin encabezado para mantener la grilla plana original.
function groupProductsByCategory(products: CatalogProduct[]) {
  const sections: Array<{ key: string; label: string | null; products: CatalogProduct[] }> = [];
  const byKey = new Map<string, { key: string; label: string | null; products: CatalogProduct[] }>();
  const hasCategory = products.some((product) => Boolean(product.category));

  for (const product of products) {
    const label = hasCategory ? product.category ?? "Otros" : null;
    const key = label ?? "__all__";
    let section = byKey.get(key);
    if (!section) {
      section = { key, label, products: [] };
      byKey.set(key, section);
      sections.push(section);
    }
    section.products.push(product);
  }

  return sections;
}

function modifierGridClass(count: number) {
  if (count <= 3) return "grid grid-cols-2 gap-3 sm:grid-cols-3";
  if (count <= 6) return "grid grid-cols-2 gap-3 lg:grid-cols-3";
  return "grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4";
}

function statusLabel(status: ActiveOrder["status"]) {
  return {
    PENDING: "Pendiente",
    PREPARING: "Preparando",
    DELIVERED: "Entregado",
    CANCELLED: "Cancelado"
  }[status];
}

function nextStatus(status: ActiveOrder["status"]) {
  if (status === "PENDING") return "PREPARING";
  if (status === "PREPARING") return "DELIVERED";
  return "";
}

function nextStatusLabel(status: ActiveOrder["status"]) {
  if (status === "PENDING") return "Preparar";
  if (status === "PREPARING") return "Entregar";
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
