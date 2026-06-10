import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db";
import { derivePackUnitCost } from "@/domain/costing";
import { formatCurrency, toNumber } from "@/lib/utils";
import { createIngredientAction, removeIngredientAction, toggleIngredientActiveAction, updateIngredientAction } from "@/server/actions/admin-actions";
import { requireRole } from "@/server/auth";

export default async function IngredientsPage() {
  await requireRole([UserRole.ADMIN]);
  const ingredients = await prisma.ingredient.findMany({ orderBy: { name: "asc" } });
  return (
    <AppShell title="Ingredientes">
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader><CardTitle>Nuevo ingrediente</CardTitle></CardHeader>
          <CardContent>
            <form action={createIngredientAction} className="space-y-3">
              <div><Label>Nombre</Label><Input name="name" required /></div>
              <div><Label>Unidad</Label><Input name="unit" placeholder="g, ml, unidad" required /></div>
              <div><Label>Costo por unidad</Label><Input name="costPerUnit" type="number" step="0.0001" defaultValue="0" /></div>
              <div><Label>Alerta baja</Label><Input name="lowStockThreshold" type="number" step="0.001" defaultValue="0" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Cant. por compra</Label><Input name="packQuantity" type="number" step="0.001" placeholder="opcional" /></div>
                <div><Label>Precio de compra</Label><Input name="packPrice" type="number" step="0.01" placeholder="opcional" /></div>
              </div>
              <div><Label>Proveedor</Label><Input name="supplier" placeholder="opcional" /></div>
              <Button type="submit">Crear</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Listado</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {ingredients.map((item) => {
                const packCost = derivePackUnitCost(
                  item.packPrice != null ? toNumber(item.packPrice) : null,
                  item.packQuantity != null ? toNumber(item.packQuantity) : null
                );
                return (
                <div key={item.id} className="rounded-[1.5rem] border border-[var(--border)] p-4">
                  <form action={updateIngredientAction} className="grid gap-3 xl:grid-cols-[1fr_0.5fr_0.7fr_0.7fr_auto]">
                    <input type="hidden" name="id" value={item.id} />
                    <div><Label>Nombre</Label><Input name="name" defaultValue={item.name} required /></div>
                    <div><Label>Unidad</Label><Input name="unit" defaultValue={item.unit} required /></div>
                    <div><Label>Costo</Label><Input name="costPerUnit" type="number" step="0.0001" defaultValue={toNumber(item.costPerUnit)} /></div>
                    <div><Label>Alerta</Label><Input name="lowStockThreshold" type="number" step="0.001" defaultValue={toNumber(item.lowStockThreshold)} /></div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:col-span-4">
                      <div><Label>Cant. por compra</Label><Input name="packQuantity" type="number" step="0.001" defaultValue={item.packQuantity != null ? toNumber(item.packQuantity) : ""} placeholder="opcional" /></div>
                      <div><Label>Precio de compra</Label><Input name="packPrice" type="number" step="0.01" defaultValue={item.packPrice != null ? toNumber(item.packPrice) : ""} placeholder="opcional" /></div>
                      <div><Label>Proveedor</Label><Input name="supplier" defaultValue={item.supplier ?? ""} placeholder="opcional" /></div>
                    </div>
                    <div className="flex items-end xl:col-start-5 xl:row-start-1"><Button type="submit" variant="secondary">Guardar</Button></div>
                  </form>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-black text-[var(--muted-foreground)]">
                      {item.isActive ? "Activo" : "Inactivo"} · {formatCurrency(toNumber(item.costPerUnit))}/{item.unit}
                      {packCost > 0 ? ` · Costo por compra: ${formatCurrency(packCost)}/${item.unit}` : ""}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <form action={toggleIngredientActiveAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="isActive" value={String(!item.isActive)} />
                        <Button type="submit" variant="outline" size="sm">{item.isActive ? "Desactivar" : "Activar"}</Button>
                      </form>
                      <form action={removeIngredientAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <Button type="submit" variant="danger" size="sm">Eliminar/desactivar</Button>
                      </form>
                    </div>
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
