import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export async function requireUser() {
  const session = await readSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findFirst({
    where: { id: session.userId, isActive: true },
    include: {
      branches: {
        include: { branch: true },
        orderBy: { branch: { name: "asc" } }
      }
    }
  });

  if (!user) redirect("/login");
  return { user, session };
}

export async function requireRole(roles: UserRole[]) {
  const context = await requireUser();
  if (!roles.includes(context.user.role)) redirect("/kiosk");
  return context;
}

export async function getActiveBranch() {
  const { user, session } = await requireUser();
  const branches = user.branches.map((item) => item.branch).filter((branch) => branch.isActive);
  if (branches.length === 0) redirect("/login");

  const activeBranch = branches.find((branch) => branch.id === session.activeBranchId);
  if (activeBranch) return { user, branch: activeBranch, branches };
  if (branches.length === 1) return { user, branch: branches[0], branches };
  redirect("/select-branch");
}
