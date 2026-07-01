import { PrismaClient, StockLocationKind, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { assertNonProductionDatabase, isProductionDatabase } from "../src/lib/test-guard";

const prisma = new PrismaClient();

// Two TEST branches: TESTS is the primary smoke/E2E sucursal; TESTS2 exists only so the
// multi-branch picker (branch-selection.spec.ts) has something to exercise.
const TEST_BRANCHES = [
  { code: "TESTS", name: "Sucursal de Pruebas" },
  { code: "TESTS2", name: "Sucursal de Pruebas 2" }
];

async function main() {
  // May run on prod ONLY with ALLOW_PROD_SEED=true (the one intentional prod write).
  assertNonProductionDatabase("db:seed:tests");

  const onProd = isProductionDatabase(process.env.DATABASE_URL);
  const email = (process.env.TEST_USER_EMAIL ?? (onProd ? "" : "qa@koi.local")).trim().toLowerCase();
  const password = process.env.TEST_USER_PASSWORD ?? (onProd ? "" : "qatest12345");
  if (!email || !password) {
    throw new Error("Set TEST_USER_EMAIL and TEST_USER_PASSWORD (required on production).");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const branches = [];
  for (const def of TEST_BRANCHES) {
    const branch = await prisma.branch.upsert({
      where: { code: def.code },
      update: { name: def.name, isTest: true, isActive: true },
      create: { name: def.name, code: def.code, isTest: true }
    });
    branches.push(branch);
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: UserRole.ADMIN, isActive: true },
    create: { name: "QA Pruebas", email, passwordHash, role: UserRole.ADMIN }
  });

  for (const branch of branches) {
    await prisma.userBranch.upsert({
      where: { userId_branchId: { userId: user.id, branchId: branch.id } },
      update: {},
      create: { userId: user.id, branchId: branch.id }
    });
  }

  // Each branch needs a QUIOSCO stock location, otherwise selling on it throws
  // "La sucursal no tiene quiosco configurado." (getQuioscoLocation). The E2E
  // suite runs entirely on TESTS, so the test branches must be sellable.
  for (const branch of branches) {
    await provisionQuioscoInventory(branch.id, branch.name);
  }

  console.log(`Seeded test account "${user.email}" → branches ${branches.map((b) => b.code).join(", ")}.`);
}

/**
 * Ensures a QUIOSCO stock location for the branch and stocks it with every
 * ingredient so E2E sales on the TESTS branch deduct from real inventory
 * (mirrors the CENTRO provisioning in seed.ts). Assumes db:seed already created
 * the ingredients + the central bodega (dev:setup and CI run db:seed first).
 */
async function provisionQuioscoInventory(branchId: string, branchName: string) {
  let bodega = await prisma.stockLocation.findFirst({ where: { kind: StockLocationKind.BODEGA } });
  if (!bodega) {
    bodega = await prisma.stockLocation.create({
      data: { kind: StockLocationKind.BODEGA, name: "Bodega central" }
    });
  }

  const quiosco = await prisma.stockLocation.upsert({
    where: { branchId_kind: { branchId, kind: StockLocationKind.QUIOSCO } },
    update: {},
    create: { kind: StockLocationKind.QUIOSCO, name: `Quiosco ${branchName}`, branchId }
  });

  const ingredients = await prisma.ingredient.findMany({ select: { id: true, unit: true } });
  for (const ingredient of ingredients) {
    await prisma.locationInventory.upsert({
      where: { locationId_ingredientId: { locationId: quiosco.id, ingredientId: ingredient.id } },
      update: {},
      create: {
        locationId: quiosco.id,
        ingredientId: ingredient.id,
        quantityOnHand: ingredient.unit === "unidad" ? 50 : 5000
      }
    });
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
