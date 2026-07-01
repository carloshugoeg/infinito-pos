import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db";
import { createBranchAction, removeBranchAction, toggleBranchActiveAction, updateBranchAction } from "@/server/actions/admin-actions";
import { requireRole } from "@/server/auth";

export default async function BranchesPage() {
  await requireRole([UserRole.ADMIN]);
  const branches = await prisma.branch.findMany({ orderBy: { name: "asc" } });

  return (
    <AppShell title="Sucursales">
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader><CardTitle>Nueva sucursal</CardTitle></CardHeader>
          <CardContent>
            <form action={createBranchAction} className="space-y-3">
              <div><Label>Nombre</Label><Input name="name" required /></div>
              <div><Label>Codigo</Label><Input name="code" required /></div>
              <div><Label>Direccion</Label><Input name="address" /></div>
              <Button type="submit">Crear</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Listado</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {branches.map((branch) => (
                <div key={branch.id} className="rounded-[1.5rem] border border-[var(--border)] p-4">
                  <form action={updateBranchAction} className="grid gap-3 md:grid-cols-[1fr_0.6fr_1fr_auto]">
                    <input type="hidden" name="id" value={branch.id} />
                    <div><Label>Nombre</Label><Input name="name" defaultValue={branch.name} required /></div>
                    <div><Label>Codigo</Label><Input name="code" defaultValue={branch.code} required /></div>
                    <div><Label>Direccion</Label><Input name="address" defaultValue={branch.address ?? ""} /></div>
                    <div className="flex items-end"><Button type="submit" variant="secondary">Guardar</Button></div>
                  </form>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-black text-[var(--muted-foreground)]">
                      {branch.isActive ? "Activa" : "Inactiva"}
                      {branch.isTest ? (
                        <span className="rounded-full bg-[var(--soft-lilac)] px-2 py-0.5 text-xs font-black text-[var(--accent-2)]">
                          PRUEBAS
                        </span>
                      ) : null}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <form action={toggleBranchActiveAction}>
                        <input type="hidden" name="id" value={branch.id} />
                        <input type="hidden" name="isActive" value={String(!branch.isActive)} />
                        <Button type="submit" variant="outline" size="sm">{branch.isActive ? "Desactivar" : "Activar"}</Button>
                      </form>
                      <form action={removeBranchAction}>
                        <input type="hidden" name="id" value={branch.id} />
                        <Button type="submit" variant="danger" size="sm">Eliminar/desactivar</Button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
