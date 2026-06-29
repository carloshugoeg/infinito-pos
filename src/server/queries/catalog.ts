import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";

type RawModifierGroup = {
  id: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  modifiers: Array<{ id: string; name: string; priceDelta: unknown; deliveryPriceDelta: unknown }>;
};

function mapGroup(group: RawModifierGroup) {
  return {
    id: group.id,
    name: group.name,
    isRequired: group.isRequired,
    minSelections: group.minSelections,
    maxSelections: group.maxSelections,
    sortOrder: group.sortOrder,
    modifiers: group.modifiers.map((modifier) => ({
      id: modifier.id,
      name: modifier.name,
      priceDelta: toNumber(modifier.priceDelta),
      deliveryPriceDelta: toNumber(modifier.deliveryPriceDelta)
    }))
  };
}

export async function listSellableProducts() {
  const modifierInclude = {
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" as const }, { name: "asc" as const }]
  };

  const [products, globalGroups] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        modifierGroups: {
          // Grupos propios del producto (los globales se fusionan abajo).
          where: { isActive: true, isGlobal: false },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: { modifiers: modifierInclude }
        }
      }
    }),
    // Lista global de extras: una sola fuente, aplica a todos los productos.
    prisma.modifierGroup.findMany({
      where: { isActive: true, isGlobal: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { modifiers: modifierInclude }
    })
  ]);

  const mappedGlobalGroups = globalGroups.map(mapGroup);

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    basePrice: toNumber(product.basePrice),
    deliveryPrice: toNumber(product.deliveryPrice),
    // Primero los grupos propios (p. ej. topping de cortesia), luego los extras globales.
    modifierGroups: [...product.modifierGroups.map(mapGroup), ...mappedGlobalGroups]
  }));
}
