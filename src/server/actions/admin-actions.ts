"use server";

import bcrypt from "bcryptjs";
import { InventoryMovementType, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { chooseRemovalMode, normalizeBranchCode, normalizeFormText } from "@/server/admin-crud";
import { getActiveBranch, requireRole } from "@/server/auth";

export async function createBranchAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  await prisma.branch.create({
    data: {
      name: normalizeFormText(formData.get("name")),
      code: normalizeBranchCode(formData.get("code")),
      address: normalizeFormText(formData.get("address")) || null
    }
  });
  revalidatePath("/admin/branches");
}

export async function updateBranchAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  await prisma.branch.update({
    where: { id: normalizeFormText(formData.get("id")) },
    data: {
      name: normalizeFormText(formData.get("name")),
      code: normalizeBranchCode(formData.get("code")),
      address: normalizeFormText(formData.get("address")) || null
    }
  });
  revalidatePath("/admin/branches");
}

export async function toggleBranchActiveAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  await prisma.branch.update({
    where: { id: normalizeFormText(formData.get("id")) },
    data: { isActive: formData.get("isActive") === "true" }
  });
  revalidatePath("/admin/branches");
  revalidatePath("/select-branch");
}

export async function removeBranchAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  const id = normalizeFormText(formData.get("id"));
  const dependencyCount = await countBranchDependencies(id);

  if (chooseRemovalMode(dependencyCount) === "delete") {
    await prisma.branch.delete({ where: { id } });
  } else {
    await prisma.branch.update({ where: { id }, data: { isActive: false } });
  }

  revalidatePath("/admin/branches");
  revalidatePath("/select-branch");
}

export async function createUserAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  const branchIds = formData.getAll("branchIds").map(String);
  const passwordHash = await bcrypt.hash(normalizeFormText(formData.get("password"), "operator12345"), 10);
  await prisma.user.create({
    data: {
      name: normalizeFormText(formData.get("name")),
      email: normalizeFormText(formData.get("email")).toLowerCase(),
      passwordHash,
      role: normalizeFormText(formData.get("role"), "OPERATOR") as UserRole,
      branches: {
        create: branchIds.map((branchId) => ({ branchId }))
      }
    }
  });
  revalidatePath("/admin/users");
}

export async function updateUserAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  const id = normalizeFormText(formData.get("id"));
  const branchIds = formData.getAll("branchIds").map(String);
  const password = normalizeFormText(formData.get("password"));
  const passwordUpdate = password ? { passwordHash: await bcrypt.hash(password, 10) } : {};

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        name: normalizeFormText(formData.get("name")),
        email: normalizeFormText(formData.get("email")).toLowerCase(),
        role: normalizeFormText(formData.get("role"), "OPERATOR") as UserRole,
        ...passwordUpdate
      }
    });
    await tx.userBranch.deleteMany({ where: { userId: id } });
    if (branchIds.length > 0) {
      await tx.userBranch.createMany({
        data: branchIds.map((branchId) => ({ userId: id, branchId })),
        skipDuplicates: true
      });
    }
  });

  revalidatePath("/admin/users");
}

export async function toggleUserActiveAction(formData: FormData) {
  const { user } = await requireRole([UserRole.ADMIN]);
  const id = normalizeFormText(formData.get("id"));
  if (id !== user.id) {
    await prisma.user.update({
      where: { id },
      data: { isActive: formData.get("isActive") === "true" }
    });
  }
  revalidatePath("/admin/users");
}

export async function createProductAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  await prisma.product.create({
    data: {
      name: normalizeFormText(formData.get("name")),
      description: normalizeFormText(formData.get("description")) || null,
      basePrice: Number(formData.get("basePrice") || 0),
      sortOrder: Number(formData.get("sortOrder") || 0)
    }
  });
  revalidatePath("/admin/catalog");
}

export async function updateProductAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  await prisma.product.update({
    where: { id: normalizeFormText(formData.get("id")) },
    data: {
      name: normalizeFormText(formData.get("name")),
      description: normalizeFormText(formData.get("description")) || null,
      basePrice: Number(formData.get("basePrice") || 0),
      sortOrder: Number(formData.get("sortOrder") || 0)
    }
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/kiosk");
}

export async function toggleProductActiveAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  await prisma.product.update({
    where: { id: normalizeFormText(formData.get("id")) },
    data: { isActive: formData.get("isActive") === "true" }
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/kiosk");
}

export async function removeProductAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  const id = normalizeFormText(formData.get("id"));
  const dependencyCount = await prisma.orderItem.count({ where: { productId: id } });

  if (chooseRemovalMode(dependencyCount) === "delete") {
    await prisma.product.delete({ where: { id } });
  } else {
    await prisma.product.update({ where: { id }, data: { isActive: false } });
  }

  revalidatePath("/admin/catalog");
  revalidatePath("/kiosk");
}

export async function createModifierGroupAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  const minSelections = Number(formData.get("minSelections") || 0);
  await prisma.modifierGroup.create({
    data: {
      productId: normalizeFormText(formData.get("productId")),
      name: normalizeFormText(formData.get("name")),
      isRequired: formData.get("isRequired") === "on",
      minSelections,
      maxSelections: Number(formData.get("maxSelections") || Math.max(1, minSelections)),
      sortOrder: Number(formData.get("sortOrder") || 0)
    }
  });
  revalidatePath("/admin/catalog");
}

export async function updateModifierGroupAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  const minSelections = Number(formData.get("minSelections") || 0);
  await prisma.modifierGroup.update({
    where: { id: normalizeFormText(formData.get("id")) },
    data: {
      name: normalizeFormText(formData.get("name")),
      isRequired: formData.get("isRequired") === "on",
      minSelections,
      maxSelections: Number(formData.get("maxSelections") || Math.max(1, minSelections)),
      sortOrder: Number(formData.get("sortOrder") || 0)
    }
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/kiosk");
}

export async function toggleModifierGroupActiveAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  await prisma.modifierGroup.update({
    where: { id: normalizeFormText(formData.get("id")) },
    data: { isActive: formData.get("isActive") === "true" }
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/kiosk");
}

export async function removeModifierGroupAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  const id = normalizeFormText(formData.get("id"));
  const dependencyCount = await prisma.orderItemModifier.count({ where: { modifier: { modifierGroupId: id } } });

  if (chooseRemovalMode(dependencyCount) === "delete") {
    await prisma.modifierGroup.delete({ where: { id } });
  } else {
    await prisma.modifierGroup.update({ where: { id }, data: { isActive: false } });
  }

  revalidatePath("/admin/catalog");
  revalidatePath("/kiosk");
}

export async function createModifierAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  await prisma.modifier.create({
    data: {
      modifierGroupId: normalizeFormText(formData.get("modifierGroupId")),
      name: normalizeFormText(formData.get("name")),
      priceDelta: Number(formData.get("priceDelta") || 0),
      sortOrder: Number(formData.get("sortOrder") || 0)
    }
  });
  revalidatePath("/admin/catalog");
}

export async function updateModifierAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  await prisma.modifier.update({
    where: { id: normalizeFormText(formData.get("id")) },
    data: {
      name: normalizeFormText(formData.get("name")),
      priceDelta: Number(formData.get("priceDelta") || 0),
      sortOrder: Number(formData.get("sortOrder") || 0)
    }
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/kiosk");
}

export async function toggleModifierActiveAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  await prisma.modifier.update({
    where: { id: normalizeFormText(formData.get("id")) },
    data: { isActive: formData.get("isActive") === "true" }
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/kiosk");
}

export async function removeModifierAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  const id = normalizeFormText(formData.get("id"));
  const dependencyCount = await prisma.orderItemModifier.count({ where: { modifierId: id } });

  if (chooseRemovalMode(dependencyCount) === "delete") {
    await prisma.modifier.delete({ where: { id } });
  } else {
    await prisma.modifier.update({ where: { id }, data: { isActive: false } });
  }

  revalidatePath("/admin/catalog");
  revalidatePath("/kiosk");
}

export async function createIngredientAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  await prisma.ingredient.create({
    data: {
      name: normalizeFormText(formData.get("name")),
      unit: normalizeFormText(formData.get("unit")),
      costPerUnit: Number(formData.get("costPerUnit") || 0),
      lowStockThreshold: Number(formData.get("lowStockThreshold") || 0)
    }
  });
  revalidatePath("/admin/ingredients");
}

export async function updateIngredientAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  await prisma.ingredient.update({
    where: { id: normalizeFormText(formData.get("id")) },
    data: {
      name: normalizeFormText(formData.get("name")),
      unit: normalizeFormText(formData.get("unit")),
      costPerUnit: Number(formData.get("costPerUnit") || 0),
      lowStockThreshold: Number(formData.get("lowStockThreshold") || 0)
    }
  });
  revalidatePath("/admin/ingredients");
  revalidatePath("/admin/inventory");
}

export async function toggleIngredientActiveAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  await prisma.ingredient.update({
    where: { id: normalizeFormText(formData.get("id")) },
    data: { isActive: formData.get("isActive") === "true" }
  });
  revalidatePath("/admin/ingredients");
  revalidatePath("/admin/inventory");
}

export async function removeIngredientAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  const id = normalizeFormText(formData.get("id"));
  const dependencyCount = await countIngredientDependencies(id);

  if (chooseRemovalMode(dependencyCount) === "delete") {
    await prisma.ingredient.delete({ where: { id } });
  } else {
    await prisma.ingredient.update({ where: { id }, data: { isActive: false } });
  }

  revalidatePath("/admin/ingredients");
  revalidatePath("/admin/inventory");
}

export async function createRecipeItemAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  const ownerType = normalizeFormText(formData.get("ownerType"), "product");
  const ownerId = normalizeFormText(formData.get("ownerId"));
  await prisma.recipeItem.create({
    data: {
      productId: ownerType === "product" ? ownerId : null,
      modifierId: ownerType === "modifier" ? ownerId : null,
      ingredientId: normalizeFormText(formData.get("ingredientId")),
      quantity: Number(formData.get("quantity") || 0)
    }
  });
  revalidatePath("/admin/catalog");
}

export async function updateRecipeItemAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  await prisma.recipeItem.update({
    where: { id: normalizeFormText(formData.get("id")) },
    data: {
      ingredientId: normalizeFormText(formData.get("ingredientId")),
      quantity: Number(formData.get("quantity") || 0)
    }
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/kiosk");
}

export async function removeRecipeItemAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  await prisma.recipeItem.delete({ where: { id: normalizeFormText(formData.get("id")) } });
  revalidatePath("/admin/catalog");
  revalidatePath("/kiosk");
}

export async function recordInventoryMovementAction(formData: FormData) {
  const { user, branch } = await getActiveBranch();
  const ingredientId = normalizeFormText(formData.get("ingredientId"));
  const type = normalizeFormText(formData.get("type"), "ADJUSTMENT") as InventoryMovementType;
  const quantity = Number(formData.get("quantity") || 0);
  const quantityDelta = type === InventoryMovementType.WASTE ? -Math.abs(quantity) : quantity;

  await prisma.$transaction(async (tx) => {
    await tx.branchInventory.upsert({
      where: { branchId_ingredientId: { branchId: branch.id, ingredientId } },
      update: { quantityOnHand: { increment: quantityDelta } },
      create: { branchId: branch.id, ingredientId, quantityOnHand: quantityDelta }
    });
    await tx.inventoryMovement.create({
      data: {
        branchId: branch.id,
        ingredientId,
        type,
        quantityDelta,
        reason: normalizeFormText(formData.get("reason"), type),
        createdById: user.id
      }
    });
  });

  revalidatePath("/admin/inventory");
}

export async function reverseInventoryMovementAction(formData: FormData) {
  const { user, branch } = await getActiveBranch();
  const id = normalizeFormText(formData.get("id"));
  const movement = await prisma.inventoryMovement.findFirst({
    where: { id, branchId: branch.id },
    include: { ingredient: true }
  });

  if (!movement || movement.type === InventoryMovementType.SALE) {
    revalidatePath("/admin/inventory");
    return;
  }

  const reversalDelta = Number(movement.quantityDelta) * -1;
  await prisma.$transaction(async (tx) => {
    await tx.branchInventory.upsert({
      where: { branchId_ingredientId: { branchId: branch.id, ingredientId: movement.ingredientId } },
      update: { quantityOnHand: { increment: reversalDelta } },
      create: { branchId: branch.id, ingredientId: movement.ingredientId, quantityOnHand: reversalDelta }
    });
    await tx.inventoryMovement.create({
      data: {
        branchId: branch.id,
        ingredientId: movement.ingredientId,
        type: InventoryMovementType.ADJUSTMENT,
        quantityDelta: reversalDelta,
        reason: `Anulacion de movimiento ${movement.type}: ${movement.reason}`,
        createdById: user.id
      }
    });
  });

  revalidatePath("/admin/inventory");
}

export async function updateAppSettingsAction(formData: FormData) {
  await requireRole([UserRole.ADMIN]);
  await prisma.appSettings.upsert({
    where: { id: "global" },
    update: {
      companyName: normalizeFormText(formData.get("companyName"), "Koi POS"),
      accentColor: normalizeFormText(formData.get("accentColor"), "#ff9766"),
      backgroundColor: normalizeFormText(formData.get("backgroundColor"), "#fdfaf8"),
      currencySymbol: normalizeFormText(formData.get("currencySymbol"), "Q")
    },
    create: {
      id: "global",
      companyName: normalizeFormText(formData.get("companyName"), "Koi POS"),
      accentColor: normalizeFormText(formData.get("accentColor"), "#ff9766"),
      backgroundColor: normalizeFormText(formData.get("backgroundColor"), "#fdfaf8"),
      currencySymbol: normalizeFormText(formData.get("currencySymbol"), "Q")
    }
  });
  revalidatePath("/");
  revalidatePath("/admin/settings");
}

export async function requireAdminForPage() {
  return requireRole([UserRole.ADMIN]);
}

export async function goAdminAction() {
  redirect("/admin");
}

async function countBranchDependencies(branchId: string) {
  const [users, cashSessions, inventory, movements, orders] = await Promise.all([
    prisma.userBranch.count({ where: { branchId } }),
    prisma.cashSession.count({ where: { branchId } }),
    prisma.branchInventory.count({ where: { branchId } }),
    prisma.inventoryMovement.count({ where: { branchId } }),
    prisma.order.count({ where: { branchId } })
  ]);
  return users + cashSessions + inventory + movements + orders;
}

async function countIngredientDependencies(ingredientId: string) {
  const [recipes, inventory, movements] = await Promise.all([
    prisma.recipeItem.count({ where: { ingredientId } }),
    prisma.branchInventory.count({ where: { ingredientId } }),
    prisma.inventoryMovement.count({ where: { ingredientId } })
  ]);
  return recipes + inventory + movements;
}
