export type RecipeSource = {
  productId?: string | null;
  modifierId?: string | null;
  ingredientId: string;
  quantity: number;
};

export type OrderIngredientInput = {
  productId: string;
  quantity: number;
  modifierIds: string[];
};

export type IngredientUsage = {
  ingredientId: string;
  quantity: number;
};

export type ManualInventoryMovementType = "PURCHASE" | "WASTE" | "ADJUSTMENT";

const manualInventoryMovementTypes: ManualInventoryMovementType[] = ["PURCHASE", "WASTE", "ADJUSTMENT"];
const MAX_INVENTORY_QUANTITY = 999_999.999;

export function resolveOrderIngredientUsage(items: OrderIngredientInput[], recipeItems: RecipeSource[]) {
  const usage = new Map<string, number>();

  for (const item of items) {
    const sources = recipeItems.filter(
      (recipe) =>
        recipe.productId === item.productId ||
        (recipe.modifierId !== null && recipe.modifierId !== undefined && item.modifierIds.includes(recipe.modifierId))
    );

    for (const source of sources) {
      const current = usage.get(source.ingredientId) ?? 0;
      usage.set(source.ingredientId, current + source.quantity * item.quantity);
    }
  }

  return Array.from(usage.entries()).map(([ingredientId, quantity]) => ({ ingredientId, quantity }));
}

export function isLowOrNegativeStock(quantityOnHand: number, lowStockThreshold: number) {
  return quantityOnHand <= lowStockThreshold;
}

export function validateManualInventoryMovement(input: { type: string; quantity: number }) {
  const errors: string[] = [];
  if (!isManualInventoryMovementType(input.type)) errors.push("Tipo de movimiento invalido.");
  if (!Number.isFinite(input.quantity)) errors.push("La cantidad debe ser un numero valido.");
  if (Number.isFinite(input.quantity) && Math.abs(input.quantity) > MAX_INVENTORY_QUANTITY) errors.push("La cantidad es demasiado alta.");
  if (Number.isFinite(input.quantity) && !hasQuantityPrecision(input.quantity)) errors.push("La cantidad permite maximo 3 decimales.");
  if ((input.type === "PURCHASE" || input.type === "WASTE") && input.quantity <= 0) {
    errors.push("Compra y merma requieren una cantidad mayor a cero.");
  }
  if (input.type === "ADJUSTMENT" && input.quantity === 0) errors.push("El ajuste no puede ser cero.");
  return errors;
}

export function calculateManualInventoryDelta(type: ManualInventoryMovementType, quantity: number) {
  return type === "WASTE" ? -Math.abs(quantity) : quantity;
}

export function isManualInventoryMovementType(value: unknown): value is ManualInventoryMovementType {
  return manualInventoryMovementTypes.includes(value as ManualInventoryMovementType);
}

function hasQuantityPrecision(value: number) {
  return Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-9;
}
