"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { clearSession, writeSession } from "@/lib/session";
import { requireUser } from "@/server/auth";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const user = await prisma.user.findFirst({
    where: { email, isActive: true },
    include: { branches: true }
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    redirect("/login?error=credenciales");
  }

  const activeBranchId = user.branches.length === 1 ? user.branches[0].branchId : undefined;
  await writeSession({ userId: user.id, activeBranchId });
  redirect(activeBranchId ? "/kiosk" : "/select-branch");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function setActiveBranchAction(formData: FormData) {
  const branchId = String(formData.get("branchId") || "");
  const { user } = await requireUser();
  const allowed = user.branches.some((item) => item.branchId === branchId && item.branch.isActive);
  if (!allowed) redirect("/select-branch?error=sucursal");
  await writeSession({ userId: user.id, activeBranchId: branchId });
  redirect("/kiosk");
}
