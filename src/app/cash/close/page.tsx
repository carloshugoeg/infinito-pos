import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, toNumber } from "@/lib/utils";
import { getActiveBranch } from "@/server/auth";
import { calculateCashSessionBreakdown, closeCashSessionAction, getOpenCashSession } from "@/server/actions/cash-actions";

export default async function CloseCashPage() {
  const { branch } = await getActiveBranch();
  const cashSession = await getOpenCashSession(branch.id);
  if (!cashSession) redirect("/cash/open");
  const breakdown = await calculateCashSessionBreakdown(cashSession.id);
  const expected = toNumber(cashSession.openingAmount) + breakdown.cash;

  return (
    <AppShell title="Cerrar caja">
      <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Resumen del turno</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Monto inicial</span><strong>{formatCurrency(toNumber(cashSession.openingAmount))}</strong></div>
            <div className="flex justify-between"><span>Efectivo vendido</span><strong>{formatCurrency(breakdown.cash)}</strong></div>
            <div className="flex justify-between"><span>Tarjeta</span><strong>{formatCurrency(breakdown.card)}</strong></div>
            <div className="flex justify-between"><span>Transferencia</span><strong>{formatCurrency(breakdown.transfer)}</strong></div>
            <div className="flex justify-between border-t border-[var(--border)] pt-2 text-base"><span>Efectivo esperado</span><strong>{formatCurrency(expected)}</strong></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Conteo fisico</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={closeCashSessionAction} className="space-y-4">
              <div>
                <Label htmlFor="closingAmount">Efectivo contado</Label>
                <Input id="closingAmount" name="closingAmount" type="number" min="0" step="0.01" required />
              </div>
              <div>
                <Label htmlFor="notes">Notas</Label>
                <Input id="notes" name="notes" placeholder="Opcional" />
              </div>
              <Button type="submit">Cerrar caja</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
