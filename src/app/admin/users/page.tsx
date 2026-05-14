import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db";
import { createUserAction, toggleUserActiveAction, updateUserAction } from "@/server/actions/admin-actions";
import { requireRole } from "@/server/auth";

export default async function UsersPage() {
  await requireRole([UserRole.ADMIN]);
  const [users, branches] = await Promise.all([
    prisma.user.findMany({ include: { branches: { include: { branch: true } } }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })
  ]);

  return (
    <AppShell title="Usuarios">
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader><CardTitle>Nuevo usuario</CardTitle></CardHeader>
          <CardContent>
            <form action={createUserAction} className="space-y-3">
              <div><Label>Nombre</Label><Input name="name" required /></div>
              <div><Label>Correo</Label><Input name="email" type="email" required /></div>
              <div><Label>Contrasena</Label><Input name="password" type="password" defaultValue="operator12345" required /></div>
              <div>
                <Label>Rol</Label>
                <select name="role" className="touch-target w-full rounded-md border border-[var(--border)] bg-white px-3">
                  <option value="OPERATOR">Operador</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Sucursales</Label>
                {branches.map((branch) => (
                  <label key={branch.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="branchIds" value={branch.id} /> {branch.name}
                  </label>
                ))}
              </div>
              <Button type="submit">Crear</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Listado</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {users.map((user) => {
                const assignedBranchIds = new Set(user.branches.map((item) => item.branchId));
                return (
                  <div key={user.id} className="rounded-[1.5rem] border border-[var(--border)] p-4">
                    <form action={updateUserAction} className="grid gap-3 xl:grid-cols-[1fr_1.2fr_0.8fr_1fr_auto]">
                      <input type="hidden" name="id" value={user.id} />
                      <div><Label>Nombre</Label><Input name="name" defaultValue={user.name} required /></div>
                      <div><Label>Correo</Label><Input name="email" type="email" defaultValue={user.email} required /></div>
                      <div>
                        <Label>Rol</Label>
                        <select name="role" defaultValue={user.role} className="touch-target w-full rounded-md border border-[var(--border)] bg-white px-3">
                          <option value="OPERATOR">Operador</option>
                          <option value="ADMIN">Administrador</option>
                        </select>
                      </div>
                      <div><Label>Nueva contrasena</Label><Input name="password" type="password" placeholder="Dejar igual" /></div>
                      <div className="flex items-end"><Button type="submit" variant="secondary">Guardar</Button></div>
                      <div className="xl:col-span-5">
                        <Label>Sucursales</Label>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {branches.map((branch) => (
                            <label key={branch.id} className="flex items-center gap-2 text-sm font-bold">
                              <input type="checkbox" name="branchIds" value={branch.id} defaultChecked={assignedBranchIds.has(branch.id)} /> {branch.name}
                            </label>
                          ))}
                        </div>
                      </div>
                    </form>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-black text-[var(--muted-foreground)]">{user.isActive ? "Activo" : "Inactivo"}</span>
                      <form action={toggleUserActiveAction}>
                        <input type="hidden" name="id" value={user.id} />
                        <input type="hidden" name="isActive" value={String(!user.isActive)} />
                        <Button type="submit" variant="outline" size="sm">{user.isActive ? "Desactivar" : "Activar"}</Button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
