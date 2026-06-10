import { PrismaClient, Prisma } from "@prisma/client";

/**
 * Seed con la data REAL de Infinito (catalogo + costos, sin inventario).
 * Fuente: "INFINITO COSTOS.xlsx" (hojas COSTO PRODUCTOS, RECETAS, COSTOS).
 *
 * - Idempotente: re-ejecutar actualiza costos/precios sin duplicar.
 * - No siembra BranchInventory (sin stock todavia).
 * - Desactiva el catalogo demo para que el kiosco muestre solo productos reales.
 *
 * Precio de venta = TOTAL (COGS) + U.B (utilidad bruta) de cada tarjeta del Excel; siempre
 * cae en un valor redondo (Q35/38/46/50/60). basePrice se fija a ese precio exacto; el COGS
 * se calcula de la receta y queda ~ al TOTAL del Excel (a 4 decimales de costo unitario).
 */

const prisma = new PrismaClient();

type IngredientSeed = {
  name: string;
  unit: string;
  costPerUnit: number;
  supplier?: string;
  packQuantity?: number;
  packPrice?: number;
};

// costPerUnit = costo unitario efectivo que consumen las recetas (columna PRODUCTO BASE del Excel).
// supplier/packQuantity/packPrice = presentacion de compra (hoja COSTO PRODUCTOS), solo referencia.
const INGREDIENTS: IngredientSeed[] = [
  // Empaque / desechables
  { name: "Vaso 12oz", unit: "unidad", costPerUnit: 1.28, supplier: "Lumipack", packQuantity: 1000, packPrice: 1080 }, // efectivo incluye tapa; compra = 1.08
  { name: "Tenedor", unit: "unidad", costPerUnit: 0.24, supplier: "Icotrading", packQuantity: 100, packPrice: 24 },
  { name: "Servilleta", unit: "unidad", costPerUnit: 0.0305, supplier: "Walmart", packQuantity: 500, packPrice: 15.25 },
  // Empaque para llevar (costos de la hoja PRODUCTO BASE; sin presentacion de compra)
  { name: "Tapadera", unit: "unidad", costPerUnit: 0.2 },
  { name: "Porta vasos", unit: "unidad", costPerUnit: 0.45 },
  { name: "Souffle de chocolate con tapa", unit: "unidad", costPerUnit: 0.208 },
  // Fruta / lacteos / coberturas compradas
  { name: "Fresa", unit: "g", costPerUnit: 0.0352, supplier: "Edgar" }, // precio variable, sin presentacion fija
  { name: "Leche condensada", unit: "g", costPerUnit: 0.0373, supplier: "Pricesmart", packQuantity: 2382, packPrice: 84.95 },
  { name: "Nutella", unit: "g", costPerUnit: 0.0679, supplier: "Pricesmart", packQuantity: 1000, packPrice: 67.95 },
  { name: "Yogurt natural", unit: "g", costPerUnit: 0.035, supplier: "Pricesmart", packQuantity: 1000, packPrice: 34.95 },
  { name: "Ferrero", unit: "unidad", costPerUnit: 4.5833, packQuantity: 24, packPrice: 110 },
  { name: "Galleta Oreo entera", unit: "unidad", costPerUnit: 0.8608, supplier: "Pricesmart", packQuantity: 180, packPrice: 154.95 },
  { name: "Galleta Lotus entera", unit: "unidad", costPerUnit: 1.695, supplier: "La Torre", packQuantity: 20, packPrice: 33.9 },
  // Toppings
  { name: "Topping Oreo", unit: "g", costPerUnit: 0.0467, supplier: "Suma", packQuantity: 4000, packPrice: 186.95 },
  { name: "Topping Lotus", unit: "g", costPerUnit: 0.1436, supplier: "La Torre" },
  { name: "Topping Almendra", unit: "g", costPerUnit: 0.1069, supplier: "Pricesmart", packQuantity: 907, packPrice: 99.95 },
  { name: "Topping Coco", unit: "g", costPerUnit: 0.0705, supplier: "Eben Ezer", packQuantity: 4540, packPrice: 320 },
  { name: "Topping Pistacho", unit: "g", costPerUnit: 0.2323, supplier: "Pricesmart", packQuantity: 680, packPrice: 157.95 },
  // Bases preparadas en casa (costo unitario tomado de la hoja RECETAS; sin presentacion de compra)
  { name: "Crema", unit: "g", costPerUnit: 0.0459, supplier: "Preparado en casa" },
  { name: "Chocolate con leche (cobertura)", unit: "g", costPerUnit: 0.1592, supplier: "Preparado en casa" }, // C.G mezcla (hoja RECETAS), que es el costo que usan las tarjetas COSTOS

  { name: "Chocolate blanco (cobertura)", unit: "g", costPerUnit: 0.158, supplier: "Preparado en casa" },
  { name: "Crema Lotus", unit: "g", costPerUnit: 0.1573, supplier: "Preparado en casa" },
  { name: "Crema Rafaello", unit: "g", costPerUnit: 0.0685, supplier: "Preparado en casa" }
];

type ProductSeed = {
  name: string;
  description: string;
  basePrice: number;
  sortOrder: number;
  isActive: boolean;
  recipe: Array<[string, number]>;
};

const BASE: Array<[string, number]> = [
  ["Vaso 12oz", 1],
  ["Tenedor", 1],
  ["Servilleta", 1]
];

const PRODUCTS: ProductSeed[] = [
  {
    name: "Crema",
    description: "Vaso de fresas con crema y topping de pistacho.",
    basePrice: 35,
    sortOrder: 1,
    isActive: true,
    recipe: [...BASE, ["Topping Pistacho", 12], ["Fresa", 150], ["Crema", 80], ["Leche condensada", 5]]
  },
  {
    name: "Chocolate con leche",
    description: "Vaso de fresas con cobertura de chocolate con leche.",
    basePrice: 38,
    sortOrder: 2,
    isActive: true,
    recipe: [...BASE, ["Topping Pistacho", 12], ["Fresa", 150], ["Chocolate con leche (cobertura)", 70]]
  },
  {
    name: "Chocolate blanco",
    description: "Vaso de fresas con cobertura de chocolate blanco.",
    basePrice: 38,
    sortOrder: 3,
    isActive: true,
    recipe: [...BASE, ["Topping Pistacho", 12], ["Fresa", 150], ["Chocolate blanco (cobertura)", 70]]
  },
  {
    name: "Mixta",
    description: "Vaso de fresas con chocolate con leche y crema.",
    basePrice: 46,
    sortOrder: 4,
    isActive: true,
    recipe: [...BASE, ["Topping Pistacho", 12], ["Fresa", 150], ["Chocolate con leche (cobertura)", 70], ["Crema", 80]]
  },
  {
    name: "Lotus",
    description: "Vaso de fresas con crema Lotus, galleta y topping Lotus.",
    basePrice: 50,
    sortOrder: 5,
    isActive: true,
    recipe: [...BASE, ["Topping Lotus", 30], ["Crema Lotus", 15], ["Crema", 120], ["Fresa", 170], ["Galleta Lotus entera", 1]]
  },
  {
    name: "Oreo",
    description: "Vaso de fresas con crema, nutella, galleta y topping Oreo.",
    basePrice: 50,
    sortOrder: 6,
    isActive: true,
    recipe: [...BASE, ["Topping Oreo", 30], ["Fresa", 170], ["Crema", 120], ["Nutella", 15], ["Galleta Oreo entera", 1]]
  },
  {
    name: "Ferrero",
    description: "Vaso de fresas con crema, chocolate, nutella, almendra y Ferrero.",
    basePrice: 50,
    sortOrder: 7,
    isActive: true,
    recipe: [
      ...BASE,
      ["Topping Almendra", 12],
      ["Crema", 120],
      ["Fresa", 200],
      ["Chocolate con leche (cobertura)", 20],
      ["Nutella", 15],
      ["Ferrero", 1]
    ]
  },
  {
    name: "Rafaello",
    description: "Vaso de fresas con crema Rafaello y topping de coco.",
    basePrice: 50,
    sortOrder: 8,
    isActive: true,
    recipe: [...BASE, ["Topping Coco", 20], ["Fresa", 200], ["Crema Rafaello", 140]]
  },
  {
    name: "Yogurt",
    description: "Vaso de fresas con yogurt natural.",
    basePrice: 50,
    sortOrder: 9,
    isActive: true,
    // El Excel incluye 50g de topping sin costear; se omite (garnish sin precio definido).
    recipe: [...BASE, ["Yogurt natural", 110], ["Fresa", 160]]
  },
  {
    name: "Dubai",
    description: "PENDIENTE: receta en definicion, oculto del kiosco.",
    basePrice: 60,
    sortOrder: 10,
    isActive: false,
    // El Excel incluye 60g de "Crema de pistacho" sin costear; se omite hasta definir su costo.
    recipe: [...BASE, ["Topping Pistacho", 10], ["Fresa", 240], ["Chocolate con leche (cobertura)", 80]]
  }
];

// Productos demo de prisma/seed.ts que deben ocultarse del kiosco real.
const DEMO_PRODUCT_NAMES = ["Vaso", "Vaso pequeno", "Caja grande"];

// Add-ons "Para llevar": modificadores opcionales con priceDelta 0 (gratis, solo costeo).
// [nombre del modificador, nombre del ingrediente].
const TAKEOUT_BASE_ADDONS: Array<[string, string]> = [
  ["Tapadera", "Tapadera"],
  ["Porta vasos", "Porta vasos"]
];
const SOUFFLE_ADDON: [string, string] = ["Souffle de chocolate", "Souffle de chocolate con tapa"];
// El souffle solo aplica a productos con chocolate (nota del Excel "solo si es de chocolate").
const CHOCOLATE_PRODUCTS = new Set(["Chocolate con leche", "Chocolate blanco", "Mixta", "Ferrero", "Dubai"]);

/** Crea/actualiza (idempotente) el grupo "Para llevar" con sus add-ons y recetas. */
async function upsertTakeoutGroup(
  productId: string,
  addons: Array<[string, string]>,
  ingredientByName: Record<string, { id: string }>
) {
  const name = "Para llevar";
  const groupData = { isRequired: false, minSelections: 0, maxSelections: addons.length, sortOrder: 1, isActive: true };
  const existingGroup = await prisma.modifierGroup.findFirst({ where: { productId, name } });
  const group = existingGroup
    ? await prisma.modifierGroup.update({ where: { id: existingGroup.id }, data: groupData })
    : await prisma.modifierGroup.create({ data: { productId, name, ...groupData } });

  for (const [modName, ingName] of addons) {
    const ingredient = ingredientByName[ingName];
    if (!ingredient) throw new Error(`Ingrediente faltante para add-on ${modName}: ${ingName}`);
    const existingMod = await prisma.modifier.findFirst({ where: { modifierGroupId: group.id, name: modName } });
    const modifier = existingMod
      ? await prisma.modifier.update({ where: { id: existingMod.id }, data: { priceDelta: new Prisma.Decimal(0), isActive: true } })
      : await prisma.modifier.create({ data: { modifierGroupId: group.id, name: modName, priceDelta: new Prisma.Decimal(0) } });

    const existingRi = await prisma.recipeItem.findFirst({
      where: { modifierId: modifier.id, ingredientId: ingredient.id, productId: null }
    });
    if (existingRi) {
      await prisma.recipeItem.update({ where: { id: existingRi.id }, data: { quantity: new Prisma.Decimal(1) } });
    } else {
      await prisma.recipeItem.create({ data: { modifierId: modifier.id, ingredientId: ingredient.id, quantity: new Prisma.Decimal(1) } });
    }
  }
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
    throw new Error(
      "Refusing to run the Infinito seed in production. Set ALLOW_PROD_SEED=true only if you " +
        "truly intend to load real catalog data into the production database."
    );
  }

  // 1) Sucursal operativa (reutiliza la del bootstrap; no se siembra inventario).
  await prisma.branch.upsert({
    where: { code: "CENTRO" },
    update: {},
    create: { name: "Sucursal Centro", code: "CENTRO", address: "Guatemala" }
  });

  // 2) Ocultar catalogo demo.
  const deactivated = await prisma.product.updateMany({
    where: { name: { in: DEMO_PRODUCT_NAMES } },
    data: { isActive: false }
  });

  // 3) Ingredientes reales (con costo + presentacion de compra).
  const ingredientByName: Record<string, { id: string }> = {};
  for (const ing of INGREDIENTS) {
    const data = {
      unit: ing.unit,
      costPerUnit: new Prisma.Decimal(ing.costPerUnit),
      supplier: ing.supplier ?? null,
      packQuantity: ing.packQuantity != null ? new Prisma.Decimal(ing.packQuantity) : null,
      packPrice: ing.packPrice != null ? new Prisma.Decimal(ing.packPrice) : null,
      isActive: true
    };
    const existing = await prisma.ingredient.findFirst({ where: { name: ing.name } });
    const saved = existing
      ? await prisma.ingredient.update({ where: { id: existing.id }, data })
      : await prisma.ingredient.create({ data: { name: ing.name, ...data } });
    ingredientByName[ing.name] = saved;
  }

  // 4) Productos + recetas (precio fijo, sin modificadores).
  for (const product of PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { name: product.name } });
    const saved = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: {
            description: product.description,
            basePrice: new Prisma.Decimal(product.basePrice),
            sortOrder: product.sortOrder,
            isActive: product.isActive
          }
        })
      : await prisma.product.create({
          data: {
            name: product.name,
            description: product.description,
            basePrice: new Prisma.Decimal(product.basePrice),
            sortOrder: product.sortOrder,
            isActive: product.isActive
          }
        });

    for (const [ingredientName, quantity] of product.recipe) {
      const ingredient = ingredientByName[ingredientName];
      if (!ingredient) throw new Error(`Ingrediente faltante para receta de ${product.name}: ${ingredientName}`);
      const recipeItem = await prisma.recipeItem.findFirst({
        where: { productId: saved.id, ingredientId: ingredient.id, modifierId: null }
      });
      if (recipeItem) {
        await prisma.recipeItem.update({ where: { id: recipeItem.id }, data: { quantity: new Prisma.Decimal(quantity) } });
      } else {
        await prisma.recipeItem.create({
          data: { productId: saved.id, ingredientId: ingredient.id, quantity: new Prisma.Decimal(quantity) }
        });
      }
    }

    // Add-ons "Para llevar" (gratis, solo costeo). Souffle solo en productos con chocolate.
    const addons = CHOCOLATE_PRODUCTS.has(product.name)
      ? [...TAKEOUT_BASE_ADDONS, SOUFFLE_ADDON]
      : [...TAKEOUT_BASE_ADDONS];
    await upsertTakeoutGroup(saved.id, addons, ingredientByName);
  }

  const activeCount = PRODUCTS.filter((p) => p.isActive).length;
  console.log(
    `Infinito seed OK: ${INGREDIENTS.length} ingredientes, ${activeCount} productos activos, ` +
      `1 oculto (Dubai), ${deactivated.count} productos demo desactivados, ` +
      `add-ons "Para llevar" (tapadera/porta vasos + souffle en chocolate). Sin inventario.`
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
