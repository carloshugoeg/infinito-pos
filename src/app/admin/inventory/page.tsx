import { InventoryMovementType } from "@prisma/client";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, Td, Th } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";
import { recordInventoryMovementAction, reverseInventoryMovementAction } from "@/server/actions/admin-actions";
import { getActiveBranch } from "@/server/auth";

export default async function InventoryPage() {
  const { branch } = await getActiveBranch();
  const [ingredients, inventory, movements] = await Promise.all([
    prisma.ingredient.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.branchInventory.findMany({
      where: { branchId: branch.id },
      include: { ingredient: true },
      orderBy: { ingredient: { name: "asc" } }
    }),
    prisma.inventoryMovement.findMany({
      where: { branchId: branch.id },
      include: { ingredient: true },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);

  return (
    <AppShell title={`Inventario - ${branch.name}`}>
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.4fr]">
        <Card>
          <CardHeader><CardTitle>Movimiento manual</CardTitle></CardHeader>
          <CardContent>
            <form action={recordInventoryMovementAction} className="space-y-3">
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
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Stock actual</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <thead><tr><Th>Ingrediente</Th><Th>Stock</Th><Th>Estado</Th></tr></thead>
                <tbody>
                  {inventory.map((item) => {
                    const qty = toNumber(item.quantityOnHand);
                    const low = qty <= toNumber(item.ingredient.lowStockThreshold);
                    return <tr key={item.id}><Td>{item.ingredient.name}</Td><Td>{qty} {item.ingredient.unit}</Td><Td className={low ? "font-bold text-red-700" : "text-teal-700"}>{low ? "Bajo/negativo" : "OK"}</Td></tr>;
                  })}
                </tbody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Ultimos movimientos</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <thead><tr><Th>Fecha</Th><Th>Tipo</Th><Th>Ingrediente</Th><Th>Cantidad</Th><Th>Razon</Th><Th>Accion</Th></tr></thead>
                <tbody>
                  {movements.map((move) => (
                    <tr key={move.id}>
                      <Td>{move.createdAt.toLocaleString("es-GT")}</Td>
                      <Td>{move.type}</Td>
                      <Td>{move.ingredient.name}</Td>
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
