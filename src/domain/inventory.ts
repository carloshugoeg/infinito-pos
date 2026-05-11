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
