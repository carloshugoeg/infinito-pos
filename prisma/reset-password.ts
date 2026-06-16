import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Password reset for an EXISTING user — the "locked-out admin" recovery path.
//
// In-app, an ADMIN can already reset anyone's password from /admin/users. But a
// sole admin who forgets their OWN password can't log in to do that. This script
// breaks that chicken-and-egg from the server/DB side: it looks up a user by
// email and rewrites their password hash (bcryptjs, same as the app), so they can
// log in again. It refuses to CREATE a user — for first-admin bootstrap use
// prisma/seed-admin.ts instead.
//
//   RESET_EMAIL=admin@infinitopos.com \
//   NEW_PASSWORD='a-strong-password' \
//   npm run db:reset-password
//
// Against production, load the prod connection first, e.g.:
//   set -a; source .env.production.local; set +a; \
//   RESET_EMAIL=... NEW_PASSWORD='...' npm run db:reset-password

const MIN_PASSWORD_LENGTH = 12;

function required(name: string): string {
  const value = (process.env[name] ?? "").trim();
  if (!value) {
    throw new Error(`Missing required env var ${name}. See prisma/reset-password.ts for usage.`);
  }
  return value;
}

async function main() {
  const email = required("RESET_EMAIL").toLowerCase();
  const password = required("NEW_PASSWORD");

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`NEW_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  // Use the direct connection (:5432) for this one-off; the pooled URL can choke
  // on prepared statements outside the app runtime.
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      throw new Error(
        `No user found with email "${email}". This script only resets EXISTING users; ` +
          `use "npm run db:seed:admin" to bootstrap a first admin.`
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.update({
      where: { email },
      data: { passwordHash, isActive: true }
    });

    // Verify the new hash actually validates the chosen password before we claim success.
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new Error("Password hash written but verification failed — aborting without confidence.");
    }

    console.log(`Password reset for "${user.email}" (role ${user.role}, active=${user.isActive}). Verification OK.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
