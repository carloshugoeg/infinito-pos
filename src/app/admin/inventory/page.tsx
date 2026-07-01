import { InventoryMovementType, UserRole } from "@prisma/client";
import { IngredientIcon } from "@/components/icons/ingredient-icon";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, Td, Th } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { inventoryMovementTypeLabel } from "@/lib/labels";
import { toNumber } from "@/lib/utils";
import { recordInventoryMovementAction, reverseInventoryMovementAction, transferStockAction } from "@/server/actions/admin-actions";
import { getActiveBranch, requireRole } from "@/server/auth";
import { getManageableLocations } from "@/server/inventory/locations";

export default async function InventoryPage() {
  await requireRole([UserRole.ADMIN]);
  const { branch } = await getActiveBranch();
  const [bodega, quiosco] = await getManageableLocations(branch.id);
  const [ingredients, bodegaInv, quioscoInv, movements] = await Promise.all([
    prisma.ingredient.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.locationInventory.findMany({ where: { locationId: bodega.id } }),
    prisma.locationInventory.findMany({ where: { locationId: quiosco.id } }),
    prisma.inventoryMovement.findMany({
      where: { locationId: { in: [bodega.id, quiosco.id] } },
      include: { ingredient: true, location: true },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);

  const bodegaByIngredient = new Map(bodegaInv.map((row) => [row.ingredientId, toNumber(row.quantityOnHand)]));
  const quioscoByIngredient = new Map(quioscoInv.map((row) => [row.ingredientId, toNumber(row.quantityOnHand)]));
  const stockRows = ingredients.map((ingredient) => ({
    ingredient,
    bodega: bodegaByIngredient.get(ingredient.id) ?? 0,
    quiosco: quioscoByIngredient.get(ingredient.id) ?? 0,
    threshold: toNumber(ingredient.lowStockThreshold)
  }));

  return (
    <AppShell title={`Inventario - ${branch.name}`}>
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.4fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Movimiento manual</CardTitle></CardHeader>
            <CardContent>
              <form action={recordInventoryMovementAction} className="space-y-3">
                <div>
                  <Label>Ubicacion</Label>
                  <select name="locationId" className="touch-target w-full rounded-md border border-[var(--border)] bg-white px-3">
                    <option value={quiosco.id}>Quiosco ({branch.name})</option>
                    <option value={bodega.id}>Bodega central</option>
                  </select>
                </div>
                <div>
                  <Label>Ingrediente</Label>
                  <select name="ingredientId" className="touch-target w-full rounded-md border border-[var(--border)] bg-white px-3">
                    {ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>)}
                  </select>
                </div>
                <div>
                  <Label>Tipo</Label>
                  <select name="type" className="touch-target w-full rounded-md border border-[var(--border)] bg-white px-3">
                    <option value={InventoryMovementType.PURCHASE}>Compra</option>
                    <option value={InventoryMovementType.WASTE}>Merma</option>
                    <option value={InventoryMovementType.ADJUSTMENT}>Ajuste</option>
                  </select>
                </div>
                <div><Label>Cantidad</Label><Input name="quantity" type="number" step="0.001" required /></div>
                <div><Label>Razon</Label><Input name="reason" required /></div>
                <Button type="submit">Registrar</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Traslado a quiosco</CardTitle></CardHeader>
            <CardContent>
              <form action={transferStockAction} className="space-y-3">
                <p className="text-sm text-[var(--muted-foreground)]">Mueve stock de la bodega central al quiosco de {branch.name}.</p>
                <div>
                  <Label>Ingrediente</Label>
                  <select name="ingredientId" className="touch-target w-full rounded-md border border-[var(--border)] bg-white px-3">
                    {ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>)}
                  </select>
                </div>
                <div><Label>Cantidad</Label><Input name="quantity" type="number" step="0.001" min="0.001" required /></div>
                <div><Label>Razon</Label><Input name="reason" placeholder="Surtido de quiosco" /></div>
                <Button type="submit">Trasladar</Button>
              </form>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Stock actual</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <thead><tr><Th>Ingrediente</Th><Th>Bodega</Th><Th>Quiosco</Th></tr></thead>
                <tbody>
                  {stockRows.map((row) => {
                    const bodegaLow = row.bodega <= row.threshold;
                    const quioscoLow = row.quiosco <= row.threshold;
                    return (
                      <tr key={row.ingredient.id}>
                        <Td><span className="inline-flex items-center gap-2"><IngredientIcon name={row.ingredient.name} size={16} />{row.ingredient.name}</span></Td>
                        <Td className={bodegaLow ? "font-bold text-red-700" : undefined}>{row.bodega} {row.ingredient.unit}</Td>
                        <Td className={quioscoLow ? "font-bold text-red-700" : undefined}>{row.quiosco} {row.ingredient.unit}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Ultimos movimientos</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <thead><tr><Th>Fecha</Th><Th>Tipo</Th><Th>Ubicacion</Th><Th>Ingrediente</Th><Th>Cantidad</Th><Th>Razon</Th><Th>Accion</Th></tr></thead>
                <tbody>
                  {movements.map((move) => (
                    <tr key={move.id}>
                      <Td>{move.createdAt.toLocaleString("es-GT")}</Td>
                      <Td>{inventoryMovementTypeLabel(move.type)}</Td>
                      <Td>{move.location.name}</Td>
                      <Td><span className="inline-flex items-center gap-2"><IngredientIcon name={move.ingredient.name} size={16} />{move.ingredient.name}</span></Td>
                      <Td>{toNumber(move.quantityDelta)}</Td>
                      <Td>{move.reason}</Td>
                      <Td>
                        {move.type === InventoryMovementType.SALE ? (
                          <span className="text-xs font-black text-[var(--muted-foreground)]">Venta</span>
                        ) : (
                          <form action={reverseInventoryMovementAction}>
                            <input type="hidden" name="id" value={move.id} />
                            <Button type="submit" variant="outline" size="sm">Anular</Button>
                          </form>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
