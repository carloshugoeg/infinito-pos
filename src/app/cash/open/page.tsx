import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getActiveBranch } from "@/server/auth";
import { getOpenCashSession, openCashSessionAction } from "@/server/actions/cash-actions";

export default async function OpenCashPage() {
  const { branch } = await getActiveBranch();
  const existing = await getOpenCashSession(branch.id);
  if (existing) redirect("/kiosk");

  return (
    <AppShell title="Abrir caja">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>{branch.name}</CardTitle>
          <p className="text-sm text-[var(--muted-foreground)]">Debes abrir caja antes de vender.</p>
        </CardHeader>
        <CardContent>
          <form action={openCashSessionAction} className="space-y-4">
            <div>
              <Label htmlFor="openingAmount">Monto inicial</Label>
              <Input id="openingAmount" name="openingAmount" type="number" min="0" step="0.01" defaultValue="0" required />
            </div>
            <div>
              <Label htmlFor="notes">Notas</Label>
              <Input id="notes" name="notes" placeholder="Opcional" />
            </div>
            <Button type="submit">Abrir caja</Button>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
