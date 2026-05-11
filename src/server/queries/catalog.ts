import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";

export async function listSellableProducts() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      modifierGroups: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          modifiers: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
          }
        }
      }
    }
  });

  return products.map((product) => ({
    ...product,
    basePrice: toNumber(product.basePrice),
    modifierGroups: product.modifierGroups.map((group) => ({
      ...group,
      modifiers: group.modifiers.map((modifier) => ({
        ...modifier,
        priceDelta: toNumber(modifier.priceDelta)
      }))
    }))
  }));
}
