import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// First-admin bootstrap for a fresh production database.
//
// A fresh prod DB has zero users, and `/admin/users` requires an existing admin
// to log in (no public signup) — this script breaks that chicken-and-egg by
// creating exactly one real branch + one ADMIN user from environment variables.
// It deliberately creates NO demo catalog. Run it once, then enter the rest of
// the business data via the admin UI.
//
//   ADMIN_EMAIL=owner@example.com \
//   ADMIN_PASSWORD='a-strong-password' \
//   ADMIN_NAME='Nombre Apellido' \
//   BRANCH_NAME='Sucursal Centro' \
//   BRANCH_CODE='CENTRO' \
//   npm run db:seed:admin

const MIN_PASSWORD_LENGTH = 12;

function required(name: string): string {
  const value = (process.env[name] ?? "").trim();
  if (!value) {
    throw new Error(`Missing required env var ${name}. See prisma/seed-admin.ts for the full list.`);
  }
  return value;
}

async function main() {
  const email = required("ADMIN_EMAIL").toLowerCase();
  const password = required("ADMIN_PASSWORD");
  const name = (process.env.ADMIN_NAME ?? "Administrador").trim();
  const branchName = required("BRANCH_NAME");
  const branchCode = required("BRANCH_CODE").toUpperCase();

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (email === "admin@koi.local") {
    throw new Error("Refusing to bootstrap the demo admin (admin@koi.local). Use a real email.");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const branch = await prisma.branch.upsert({
    where: { code: branchCode },
    update: { name: branchName, isActive: true },
    create: { name: branchName, code: branchCode }
  });

  const admin = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: UserRole.ADMIN, isActive: true },
    create: { name, email, passwordHash, role: UserRole.ADMIN }
  });

  await prisma.userBranch.upsert({
    where: { userId_branchId: { userId: admin.id, branchId: branch.id } },
    update: {},
    create: { userId: admin.id, branchId: branch.id }
  });

  console.log(`Bootstrapped admin "${admin.email}" and branch "${branch.name}" (${branch.code}).`);
  console.log("Next: log in with these credentials and create the rest of the data in /admin.");
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
