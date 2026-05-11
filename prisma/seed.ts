import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin12345", 10);

  const branch = await prisma.branch.upsert({
    where: { code: "CENTRO" },
    update: {},
    create: {
      name: "Sucursal Centro",
      code: "CENTRO",
      address: "Guatemala"
    }
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@koi.local" },
    update: { passwordHash, role: UserRole.ADMIN, isActive: true },
    create: {
      name: "Admin Koi",
      email: "admin@koi.local",
      passwordHash,
      role: UserRole.ADMIN
    }
  });

  await prisma.userBranch.upsert({
    where: { userId_branchId: { userId: admin.id, branchId: branch.id } },
    update: {},
    create: { userId: admin.id, branchId: branch.id }
  });

  const ingredients = await Promise.all([
    upsertIngredient("Fresa", "g", 0.03, 1500),
    upsertIngredient("Mango", "g", 0.03, 800),
    upsertIngredient("Chocolate con leche", "g", 0.08, 500),
    upsertIngredient("Chocolate blanco", "g", 0.08, 500),
    upsertIngredient("Chocolate oscuro", "g", 0.08, 500),
    upsertIngredient("Crema", "g", 0.05, 500),
    upsertIngredient("Oreo", "g", 0.05, 300),
    upsertIngredient("Lotus", "g", 0.06, 300),
    upsertIngredient("Malvavisco", "g", 0.04, 300),
    upsertIngredient("Pistacho", "g", 0.1, 200),
    upsertIngredient("Coco", "g", 0.04, 300),
    upsertIngredient("Almendra", "g", 0.08, 200),
    upsertIngredient("Jalea de mango", "g", 0.04, 300),
    upsertIngredient("Jalea de fresa", "g", 0.04, 300),
    upsertIngredient("Leche condensada", "g", 0.05, 300),
    upsertIngredient("Mania", "g", 0.04, 300),
    upsertIngredient("Vaso pequeno", "unidad", 0.6, 20),
    upsertIngredient("Caja grande", "unidad", 1.75, 10),
    upsertIngredient("Tapadera", "unidad", 0.25, 20),
    upsertIngredient("Tenedor", "unidad", 0.15, 20)
  ]);

  const ingredientByName = Object.fromEntries(ingredients.map((item) => [item.name, item]));

  for (const ingredient of ingredients) {
    await prisma.branchInventory.upsert({
      where: { branchId_ingredientId: { branchId: branch.id, ingredientId: ingredient.id } },
      update: {},
      create: {
        branchId: branch.id,
        ingredientId: ingredient.id,
        quantityOnHand: ingredient.unit === "unidad" ? 50 : 5000
      }
    });
  }

  await createProductWithRecipe({
    name: "Vaso pequeno",
    description: "Fresas cubiertas en vaso individual.",
    basePrice: 25,
    sortOrder: 1,
    recipe: [
      ["Fresa", 200],
      ["Vaso pequeno", 1]
    ],
    ingredientByName
  });

  await createProductWithRecipe({
    name: "Caja grande",
    description: "Caja para compartir con fresas cubiertas.",
    basePrice: 60,
    sortOrder: 2,
    recipe: [
      ["Fresa", 500],
      ["Caja grande", 1]
    ],
    ingredientByName
  });

  await createEmpiricalKioskProduct(ingredientByName);

  const products = await prisma.product.findMany({ where: { name: { not: "Vaso" } } });
  for (const product of products) {
    const chocolateGroup = await prisma.modifierGroup.upsert({
      where: { id: `${product.id}-chocolate` },
      update: {},
      create: {
        id: `${product.id}-chocolate`,
        productId: product.id,
        name: "Chocolate",
        isRequired: true,
        minSelections: 1,
        maxSelections: 1,
        sortOrder: 1
      }
    });

    await createModifier(chocolateGroup.id, "Blanco", 0, [["Chocolate blanco", product.name === "Caja grande" ? 100 : 40]], ingredientByName);
    await createModifier(chocolateGroup.id, "Oscuro", 0, [["Chocolate oscuro", product.name === "Caja grande" ? 100 : 40]], ingredientByName);

    const toppingsGroup = await prisma.modifierGroup.upsert({
      where: { id: `${product.id}-toppings` },
      update: {},
      create: {
        id: `${product.id}-toppings`,
        productId: product.id,
        name: "Toppings",
        isRequired: false,
        minSelections: 0,
        maxSelections: 3,
        sortOrder: 2
      }
    });

    await createModifier(toppingsGroup.id, "Oreo", 5, [["Oreo", product.name === "Caja grande" ? 35 : 15]], ingredientByName);
    await createModifier(toppingsGroup.id, "Mania", 3, [["Mania", product.name === "Caja grande" ? 35 : 15]], ingredientByName);
  }
}

async function createEmpiricalKioskProduct(ingredientByName: Record<string, { id: string }>) {
  let product = await prisma.product.findFirst({ where: { name: "Vaso" } });
  if (!product) {
    product = await prisma.product.create({
      data: {
        name: "Vaso",
        description: "Producto principal usado por el kiosco actual.",
        basePrice: 0,
        sortOrder: 0
      }
    });
  }

  await addRecipeItems("product", product.id, [["Vaso pequeno", 1]], ingredientByName);

  const baseGroup = await upsertModifierGroup(product.id, "Base", true, 1, 1, 1);
  await createModifier(baseGroup.id, "Chocolate con leche", 38, [["Fresa", 200], ["Chocolate con leche", 40]], ingredientByName);
  await createModifier(baseGroup.id, "Chocolate blanco", 38, [["Fresa", 200], ["Chocolate blanco", 40]], ingredientByName);
  await createModifier(baseGroup.id, "Solo Fresa", 25, [["Fresa", 200]], ingredientByName);
  await createModifier(baseGroup.id, "Solo Mango", 5, [["Mango", 200]], ingredientByName);
  await createModifier(baseGroup.id, "Crema", 35, [["Fresa", 200], ["Crema", 40]], ingredientByName);

  const toppingsGroup = await upsertModifierGroup(product.id, "Toppings incluidos", false, 0, 8, 2);
  await createModifier(toppingsGroup.id, "Oreo", 0, [["Oreo", 15]], ingredientByName);
  await createModifier(toppingsGroup.id, "Lotus", 0, [["Lotus", 15]], ingredientByName);
  await createModifier(toppingsGroup.id, "Malvavisco", 0, [["Malvavisco", 15]], ingredientByName);
  await createModifier(toppingsGroup.id, "Pistacho", 0, [["Pistacho", 15]], ingredientByName);
  await createModifier(toppingsGroup.id, "Coco", 0, [["Coco", 15]], ingredientByName);
  await createModifier(toppingsGroup.id, "Almendra", 0, [["Almendra", 15]], ingredientByName);
  await createModifier(toppingsGroup.id, "Jalea de mango", 0, [["Jalea de mango", 15]], ingredientByName);
  await createModifier(toppingsGroup.id, "Jalea de fresa", 0, [["Jalea de fresa", 15]], ingredientByName);
  await createModifier(toppingsGroup.id, "Leche condensada", 0, [["Leche condensada", 15]], ingredientByName);

  const extraToppingsGroup = await upsertModifierGroup(product.id, "Extra topping", false, 0, 10, 3);
  await createModifier(extraToppingsGroup.id, "Extra Mango", 10, [["Mango", 80]], ingredientByName);
  await createModifier(extraToppingsGroup.id, "Extra Oreo", 5, [["Oreo", 15]], ingredientByName);
  await createModifier(extraToppingsGroup.id, "Extra Lotus", 5, [["Lotus", 15]], ingredientByName);
  await createModifier(extraToppingsGroup.id, "Extra Malvavisco", 5, [["Malvavisco", 15]], ingredientByName);
  await createModifier(extraToppingsGroup.id, "Extra Pistacho", 5, [["Pistacho", 15]], ingredientByName);
  await createModifier(extraToppingsGroup.id, "Extra Almendra", 5, [["Almendra", 15]], ingredientByName);
  await createModifier(extraToppingsGroup.id, "Extra Coco", 5, [["Coco", 15]], ingredientByName);
  await createModifier(extraToppingsGroup.id, "Extra Jalea de mango", 5, [["Jalea de mango", 15]], ingredientByName);
  await createModifier(extraToppingsGroup.id, "Extra Jalea de fresa", 5, [["Jalea de fresa", 15]], ingredientByName);
  await createModifier(extraToppingsGroup.id, "Extra Leche condensada", 5, [["Leche condensada", 15]], ingredientByName);

  const extraBasesGroup = await upsertModifierGroup(product.id, "Extra bases", false, 0, 3, 4);
  await createModifier(extraBasesGroup.id, "Extra chocolate con leche", 10, [["Chocolate con leche", 40]], ingredientByName);
  await createModifier(extraBasesGroup.id, "Extra chocolate blanco", 10, [["Chocolate blanco", 40]], ingredientByName);
  await createModifier(extraBasesGroup.id, "Extra crema", 10, [["Crema", 40]], ingredientByName);

  const extrasGroup = await upsertModifierGroup(product.id, "Extras", false, 0, 2, 5);
  await createModifier(extrasGroup.id, "Tapadera", 0, [["Tapadera", 1]], ingredientByName);
  await createModifier(extrasGroup.id, "Tenedor", 0, [["Tenedor", 1]], ingredientByName);
}

async function upsertModifierGroup(productId: string, name: string, isRequired: boolean, minSelections: number, maxSelections: number, sortOrder: number) {
  const existing = await prisma.modifierGroup.findFirst({ where: { productId, name } });
  if (existing) return existing;
  return prisma.modifierGroup.create({
    data: { productId, name, isRequired, minSelections, maxSelections, sortOrder }
  });
}

async function upsertIngredient(name: string, unit: string, costPerUnit: number, lowStockThreshold: number) {
  const existing = await prisma.ingredient.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.ingredient.create({
    data: { name, unit, costPerUnit, lowStockThreshold }
  });
}

async function createProductWithRecipe(input: {
  name: string;
  description: string;
  basePrice: number;
  sortOrder: number;
  recipe: Array<[string, number]>;
  ingredientByName: Record<string, { id: string }>;
}) {
  let product = await prisma.product.findFirst({ where: { name: input.name } });
  if (!product) {
    product = await prisma.product.create({
      data: {
        name: input.name,
        description: input.description,
        basePrice: input.basePrice,
        sortOrder: input.sortOrder
      }
    });
  }

  for (const [ingredientName, quantity] of input.recipe) {
    const ingredient = input.ingredientByName[ingredientName];
    const existing = await prisma.recipeItem.findFirst({
      where: { productId: product.id, ingredientId: ingredient.id, modifierId: null }
    });
    if (!existing) {
      await prisma.recipeItem.create({
        data: { productId: product.id, ingredientId: ingredient.id, quantity }
      });
    }
  }
}

async function createModifier(
  modifierGroupId: string,
  name: string,
  priceDelta: number,
  recipe: Array<[string, number]>,
  ingredientByName: Record<string, { id: string }>
) {
  let modifier = await prisma.modifier.findFirst({ where: { modifierGroupId, name } });
  if (!modifier) {
    modifier = await prisma.modifier.create({
      data: { modifierGroupId, name, priceDelta }
    });
  }

  for (const [ingredientName, quantity] of recipe) {
    await addRecipeItems("modifier", modifier.id, [[ingredientName, quantity]], ingredientByName);
  }
}

async function addRecipeItems(
  ownerType: "product" | "modifier",
  ownerId: string,
  recipe: Array<[string, number]>,
  ingredientByName: Record<string, { id: string }>
) {
  for (const [ingredientName, quantity] of recipe) {
    const ingredient = ingredientByName[ingredientName];
    const existing = await prisma.recipeItem.findFirst({
      where: {
        productId: ownerType === "product" ? ownerId : null,
        modifierId: ownerType === "modifier" ? ownerId : null,
        ingredientId: ingredient.id
      }
    });
    if (!existing) {
      await prisma.recipeItem.create({
        data: {
          productId: ownerType === "product" ? ownerId : null,
          modifierId: ownerType === "modifier" ? ownerId : null,
          ingredientId: ingredient.id,
          quantity
        }
      });
    }
  }
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
