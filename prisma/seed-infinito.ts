import { PrismaClient, Prisma } from "@prisma/client";

/**
 * Seed del catalogo REAL de Infinito segun el "Instructivo de menu".
 *
 * Logica del menu:
 *  A. Fresas Clasicas (base personalizable): incluye OBLIGATORIAMENTE 1 topping
 *     gratis de cortesia (grupo requerido, max 1, priceDelta 0).
 *  B. Fresas Gourmet (recetas fijas): no se arma la base, solo se elige la opcion.
 *     El Parfait de Yogurt ofrece miel gratis opcional.
 *  Extras: UNA lista global (grupo isGlobal) disponible en todos los productos.
 *
 * Costeo (COGS): se reusan los costos de ingredientes existentes. Los ingredientes
 * nuevos (Topping Marshmallow/Kataifi/Granola, Miel, Crema Ferrero) usan costo
 * PLACEHOLDER marcado "REVISAR costo" y deben ajustarse cuando se tenga el dato real.
 * Los gramajes de las recetas nuevas/extras son estimaciones.
 *
 * Idempotente: re-ejecutar actualiza costos/precios/recetas sin duplicar.
 * No siembra BranchInventory (sin stock todavia).
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

// costPerUnit = costo unitario efectivo que consumen las recetas.
// supplier/packQuantity/packPrice = presentacion de compra, solo referencia.
const INGREDIENTS: IngredientSeed[] = [
  // Empaque / desechables
  { name: "Vaso 12oz", unit: "unidad", costPerUnit: 1.28, supplier: "Lumipack", packQuantity: 1000, packPrice: 1080 },
  { name: "Tenedor", unit: "unidad", costPerUnit: 0.24, supplier: "Icotrading", packQuantity: 100, packPrice: 24 },
  { name: "Servilleta", unit: "unidad", costPerUnit: 0.0305, supplier: "Walmart", packQuantity: 500, packPrice: 15.25 },
  { name: "Tapadera", unit: "unidad", costPerUnit: 0.2 },
  { name: "Porta vasos", unit: "unidad", costPerUnit: 0.45 },
  { name: "Souffle de chocolate con tapa", unit: "unidad", costPerUnit: 0.208 },
  // Fruta / lacteos / coberturas compradas
  { name: "Fresa", unit: "g", costPerUnit: 0.0352, supplier: "Edgar" },
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
  { name: "Topping Yogurt", unit: "g", costPerUnit: 0.05 },
  // Toppings nuevos del instructivo (costo PLACEHOLDER, ajustar cuando se tenga el real)
  { name: "Topping Marshmallow", unit: "g", costPerUnit: 0.05, supplier: "REVISAR costo" },
  { name: "Topping Kataifi", unit: "g", costPerUnit: 0.15, supplier: "REVISAR costo" },
  { name: "Topping Granola", unit: "g", costPerUnit: 0.05, supplier: "REVISAR costo" },
  { name: "Miel", unit: "g", costPerUnit: 0.03, supplier: "REVISAR costo" },
  // Bases preparadas en casa
  { name: "Crema", unit: "g", costPerUnit: 0.0459, supplier: "Preparado en casa" },
  { name: "Chocolate con leche (cobertura)", unit: "g", costPerUnit: 0.1592, supplier: "Preparado en casa" },
  { name: "Chocolate blanco (cobertura)", unit: "g", costPerUnit: 0.158, supplier: "Preparado en casa" },
  { name: "Crema Lotus", unit: "g", costPerUnit: 0.1573, supplier: "Preparado en casa" },
  { name: "Crema Rafaello", unit: "g", costPerUnit: 0.0685, supplier: "Preparado en casa" },
  { name: "Crema Ferrero", unit: "g", costPerUnit: 0.08, supplier: "REVISAR costo" } // placeholder para el extra de crema gourmet Ferrero
];

const CATEGORY_CLASICAS = "Fresas Clasicas";
const CATEGORY_GOURMET = "Fresas Gourmet";

type ProductSeed = {
  name: string;
  description: string;
  category: string;
  basePrice: number;
  sortOrder: number;
  isActive: boolean;
  recipe: Array<[string, number]>;
  courtesyTopping?: boolean; // grupo requerido de topping gratis (solo clasicas)
  honey?: boolean; // grupo opcional de miel gratis (solo parfait)
};

const BASE: Array<[string, number]> = [
  ["Vaso 12oz", 1],
  ["Tenedor", 1],
  ["Servilleta", 1]
];

const PRODUCTS: ProductSeed[] = [
  // A. Fresas Clasicas (base personalizable, 1 topping gratis obligatorio)
  {
    name: "Fresas con Crema",
    description: "Base de fresas con crema. Incluye 1 topping gratis de cortesia.",
    category: CATEGORY_CLASICAS,
    basePrice: 36,
    sortOrder: 1,
    isActive: true,
    courtesyTopping: true,
    recipe: [...BASE, ["Fresa", 150], ["Crema", 80], ["Leche condensada", 5]]
  },
  {
    name: "Fresas con Chocolate con Leche",
    description: "Base de fresas con cobertura de chocolate con leche. Incluye 1 topping gratis.",
    category: CATEGORY_CLASICAS,
    basePrice: 39,
    sortOrder: 2,
    isActive: true,
    courtesyTopping: true,
    recipe: [...BASE, ["Fresa", 150], ["Chocolate con leche (cobertura)", 70]]
  },
  {
    name: "Fresas con Chocolate Blanco",
    description: "Base de fresas con cobertura de chocolate blanco. Incluye 1 topping gratis.",
    category: CATEGORY_CLASICAS,
    basePrice: 39,
    sortOrder: 3,
    isActive: true,
    courtesyTopping: true,
    recipe: [...BASE, ["Fresa", 150], ["Chocolate blanco (cobertura)", 70]]
  },
  // B. Fresas Gourmet (recetas fijas)
  {
    name: "Gourmet Ferrero",
    description: "Receta fija: fresas con crema, chocolate, nutella, almendra y Ferrero.",
    category: CATEGORY_GOURMET,
    basePrice: 55,
    sortOrder: 4,
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
    name: "Gourmet Raffaello",
    description: "Receta fija: fresas con crema Raffaello y topping de coco.",
    category: CATEGORY_GOURMET,
    basePrice: 55,
    sortOrder: 5,
    isActive: true,
    recipe: [...BASE, ["Topping Coco", 20], ["Fresa", 200], ["Crema Rafaello", 140]]
  },
  {
    name: "Gourmet Lotus",
    description: "Receta fija: fresas con crema Lotus, galleta y topping Lotus.",
    category: CATEGORY_GOURMET,
    basePrice: 55,
    sortOrder: 6,
    isActive: true,
    recipe: [...BASE, ["Topping Lotus", 30], ["Crema Lotus", 15], ["Crema", 120], ["Fresa", 170], ["Galleta Lotus entera", 1]]
  },
  {
    name: "Gourmet Oreo",
    description: "Receta fija: fresas con crema, nutella, galleta y topping Oreo.",
    category: CATEGORY_GOURMET,
    basePrice: 50,
    sortOrder: 7,
    isActive: true,
    recipe: [...BASE, ["Topping Oreo", 30], ["Fresa", 170], ["Crema", 120], ["Nutella", 15], ["Galleta Oreo entera", 1]]
  },
  {
    name: "Parfait de Yogurt",
    description: "Receta fija: fresas con yogurt natural. Se ofrece miel gratis opcional.",
    category: CATEGORY_GOURMET,
    basePrice: 45,
    sortOrder: 8,
    isActive: true,
    honey: true,
    recipe: [...BASE, ["Topping Yogurt", 50], ["Yogurt natural", 110], ["Fresa", 160]]
  }
];

const PRODUCT_NAMES = PRODUCTS.map((product) => product.name);

// Toppings de cortesia (gratis, max 1) de las clasicas: [opcion, ingrediente, gramos].
const COURTESY_TOPPINGS: Array<[string, string, number]> = [
  ["Oreo", "Topping Oreo", 15],
  ["Lotus", "Topping Lotus", 15],
  ["Marshmallow", "Topping Marshmallow", 15],
  ["Coco rallado", "Topping Coco", 15],
  ["Almendra", "Topping Almendra", 12],
  ["Pistacho", "Topping Pistacho", 12],
  ["Kataifi", "Topping Kataifi", 15],
  ["Granola", "Topping Granola", 15]
];

// Lista GLOBAL de extras (aplica a todos los productos): [nombre, +precio, ingrediente, gramos].
const GLOBAL_EXTRAS: Array<[string, number, string, number]> = [
  ["Extra Oreo", 6, "Topping Oreo", 15],
  ["Extra Lotus", 6, "Topping Lotus", 15],
  ["Extra Marshmallow", 6, "Topping Marshmallow", 15],
  ["Extra Coco rallado", 6, "Topping Coco", 15],
  ["Extra Almendra", 6, "Topping Almendra", 12],
  ["Extra Pistacho", 6, "Topping Pistacho", 12],
  ["Extra Kataifi", 6, "Topping Kataifi", 15],
  ["Extra Granola", 6, "Topping Granola", 15],
  ["Extra Crema Clasica", 15, "Crema", 80],
  ["Extra Chocolate con Leche", 20, "Chocolate con leche (cobertura)", 70],
  ["Extra Chocolate Blanco", 20, "Chocolate blanco (cobertura)", 70],
  ["Extra Crema Ferrero", 25, "Crema Ferrero", 120],
  ["Extra Crema Raffaello", 25, "Crema Rafaello", 140],
  ["Extra Crema Lotus", 25, "Crema Lotus", 30]
];

// Add-ons "Para llevar": modificadores gratis (priceDelta 0) solo para costeo de empaque.
const TAKEOUT_BASE_ADDONS: Array<[string, string]> = [
  ["Tapadera", "Tapadera"],
  ["Porta vasos", "Porta vasos"]
];
const SOUFFLE_ADDON: [string, string] = ["Souffle de chocolate", "Souffle de chocolate con tapa"];
const CHOCOLATE_PRODUCTS = new Set(["Fresas con Chocolate con Leche", "Fresas con Chocolate Blanco", "Gourmet Ferrero"]);

type IngredientMap = Record<string, { id: string }>;

/** Crea/actualiza (idempotente) un grupo de modificadores por (productId|global, name). */
async function upsertGroup(
  productId: string | null,
  name: string,
  opts: { isRequired: boolean; minSelections: number; maxSelections: number; sortOrder: number; isGlobal?: boolean }
) {
  const data = {
    isRequired: opts.isRequired,
    minSelections: opts.minSelections,
    maxSelections: opts.maxSelections,
    sortOrder: opts.sortOrder,
    isGlobal: opts.isGlobal ?? false,
    isActive: true
  };
  const existing = opts.isGlobal
    ? await prisma.modifierGroup.findFirst({ where: { isGlobal: true, name } })
    : await prisma.modifierGroup.findFirst({ where: { productId, name } });
  return existing
    ? prisma.modifierGroup.update({ where: { id: existing.id }, data })
    : prisma.modifierGroup.create({ data: { productId, name, ...data } });
}

/** Crea/actualiza (idempotente) un modificador por (groupId, name) con su receta opcional. */
async function upsertModifier(
  groupId: string,
  name: string,
  priceDelta: number,
  recipe: Array<[string, number]>,
  ingredientByName: IngredientMap
) {
  const existing = await prisma.modifier.findFirst({ where: { modifierGroupId: groupId, name } });
  const modifier = existing
    ? await prisma.modifier.update({ where: { id: existing.id }, data: { priceDelta: new Prisma.Decimal(priceDelta), isActive: true } })
    : await prisma.modifier.create({ data: { modifierGroupId: groupId, name, priceDelta: new Prisma.Decimal(priceDelta) } });

  for (const [ingredientName, quantity] of recipe) {
    const ingredient = ingredientByName[ingredientName];
    if (!ingredient) throw new Error(`Ingrediente faltante para modificador ${name}: ${ingredientName}`);
    const existingRi = await prisma.recipeItem.findFirst({
      where: { modifierId: modifier.id, ingredientId: ingredient.id, productId: null }
    });
    if (existingRi) {
      await prisma.recipeItem.update({ where: { id: existingRi.id }, data: { quantity: new Prisma.Decimal(quantity) } });
    } else {
      await prisma.recipeItem.create({
        data: { modifierId: modifier.id, ingredientId: ingredient.id, quantity: new Prisma.Decimal(quantity) }
      });
    }
  }
  return modifier;
}

/** Grupo "Para llevar" por producto (empaque gratis, solo costeo). */
async function upsertTakeoutGroup(productId: string, addons: Array<[string, string]>, ingredientByName: IngredientMap) {
  const group = await upsertGroup(productId, "Para llevar", {
    isRequired: false,
    minSelections: 0,
    maxSelections: addons.length,
    sortOrder: 2
  });
  for (const [modName, ingName] of addons) {
    await upsertModifier(group.id, modName, 0, [[ingName, 1]], ingredientByName);
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
  const branchCode = (process.env.BRANCH_CODE ?? "CENTRO").toUpperCase();
  const branchName = (process.env.BRANCH_NAME ?? "Sucursal Centro").trim();
  await prisma.branch.upsert({
    where: { code: branchCode },
    update: { name: branchName, isActive: true },
    create: { name: branchName, code: branchCode, address: "Guatemala" }
  });

  // 2) Ingredientes (con costo + presentacion de compra).
  const ingredientByName: IngredientMap = {};
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

  // 3) Productos + recetas + grupos por producto.
  for (const product of PRODUCTS) {
    const productData = {
      description: product.description,
      category: product.category,
      basePrice: new Prisma.Decimal(product.basePrice),
      sortOrder: product.sortOrder,
      isActive: product.isActive
    };
    const existing = await prisma.product.findFirst({ where: { name: product.name } });
    const saved = existing
      ? await prisma.product.update({ where: { id: existing.id }, data: productData })
      : await prisma.product.create({ data: { name: product.name, ...productData } });

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

    // Topping gratis de cortesia (obligatorio, max 1) solo en clasicas.
    if (product.courtesyTopping) {
      const group = await upsertGroup(saved.id, "Topping de cortesia", {
        isRequired: true,
        minSelections: 1,
        maxSelections: 1,
        sortOrder: 1
      });
      for (const [optName, ingName, grams] of COURTESY_TOPPINGS) {
        await upsertModifier(group.id, optName, 0, [[ingName, grams]], ingredientByName);
      }
    }

    // Miel gratis opcional solo en el Parfait de Yogurt.
    if (product.honey) {
      const group = await upsertGroup(saved.id, "Miel", { isRequired: false, minSelections: 0, maxSelections: 1, sortOrder: 1 });
      await upsertModifier(group.id, "Con miel", 0, [["Miel", 20]], ingredientByName);
    }

    // Add-ons "Para llevar" (gratis). Souffle solo en productos con chocolate.
    const addons = CHOCOLATE_PRODUCTS.has(product.name) ? [...TAKEOUT_BASE_ADDONS, SOUFFLE_ADDON] : [...TAKEOUT_BASE_ADDONS];
    await upsertTakeoutGroup(saved.id, addons, ingredientByName);
  }

  // 4) Lista GLOBAL de extras (una sola fuente para todos los productos).
  const extrasGroup = await upsertGroup(null, "Extras", {
    isRequired: false,
    minSelections: 0,
    maxSelections: GLOBAL_EXTRAS.length,
    sortOrder: 3,
    isGlobal: true
  });
  for (const [name, priceDelta, ingName, grams] of GLOBAL_EXTRAS) {
    await upsertModifier(extrasGroup.id, name, priceDelta, [[ingName, grams]], ingredientByName);
  }

  // 5) Desactivar cualquier producto que no sea del menu nuevo (menu anterior + demo).
  const deactivated = await prisma.product.updateMany({
    where: { name: { notIn: PRODUCT_NAMES } },
    data: { isActive: false }
  });

  const activeCount = PRODUCTS.filter((p) => p.isActive).length;
  console.log(
    `Infinito seed OK: ${INGREDIENTS.length} ingredientes, ${activeCount} productos activos ` +
      `(${PRODUCTS.filter((p) => p.category === CATEGORY_CLASICAS).length} clasicas, ` +
      `${PRODUCTS.filter((p) => p.category === CATEGORY_GOURMET).length} gourmet), ` +
      `1 lista global "Extras" con ${GLOBAL_EXTRAS.length} opciones, ` +
      `${deactivated.count} productos antiguos/demo desactivados. Sin inventario.`
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
