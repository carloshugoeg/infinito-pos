import { PrismaClient, UserRole } from "@prisma/client";
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

  console.log(`Seeded test account "${user.email}" → branches ${branches.map((b) => b.code).join(", ")}.`);
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
