import { recipeSourceMatchesItem, type OrderIngredientInput, type RecipeSource } from "@/domain/inventory";

export type IngredientCostMap = Record<string, number>;

export type OrderItemCost = {
  unitCost: number;
  lineCost: number;
};

function roundCost(value: number) {
  return Math.round((value + Number.EPSILON) * 1e4) / 1e4;
}

/**
 * Costo unitario derivado de la presentacion de compra: precio del paquete / cantidad del paquete.
 * Pensado como sugerencia para la UI de ingredientes (no sobreescribe costPerUnit). Guarda contra
 * division por cero y entradas nulas devolviendo 0.
 */
export function derivePackUnitCost(
  packPrice: number | null | undefined,
  packQuantity: number | null | undefined
): number {
  if (!packPrice || !packQuantity || packQuantity <= 0) return 0;
  return roundCost(packPrice / packQuantity);
}

/**
 * Costo real (COGS) de una linea de orden, derivado de la receta del producto base
 * mas la de los modificadores seleccionados, valorada al costo por unidad de cada ingrediente.
 * Espeja la columna TOTAL del Excel de costos. Funcion pura: no toca DB.
 */
export function calculateOrderItemCost(
  item: OrderIngredientInput,
  recipeItems: RecipeSource[],
  ingredientCosts: IngredientCostMap
): OrderItemCost {
  let unitCost = 0;
  for (const source of recipeItems) {
    if (recipeSourceMatchesItem(source, item)) {
      unitCost += source.quantity * (ingredientCosts[source.ingredientId] ?? 0);
    }
  }
  unitCost = roundCost(unitCost);
  return { unitCost, lineCost: roundCost(unitCost * item.quantity) };
}
