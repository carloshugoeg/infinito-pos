import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, Td, Th } from "@/components/ui/table";
import { expenseCategoryLabel } from "@/lib/labels";
import { formatCurrency } from "@/lib/utils";
import { parseReportDateRange } from "@/server/admin-crud";
import { getActiveBranch, requireRole } from "@/server/auth";
import { getFinanceReport } from "@/server/reports/finance";

type FinancePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  await requireRole([UserRole.ADMIN]);
  const { branch } = await getActiveBranch();
  const params = (await searchParams) ?? {};
  const range = parseReportDateRange(readParam(params.from), readParam(params.to));

  const { pnl, productProfitability } = await getFinanceReport(branch.id, range);
  const expenseRows = Object.entries(pnl.expensesByCategory).sort((a, b) => b[1] - a[1]);

  return (
    <AppShell title={`Finanzas - ${branch.name}`}>
      <Card className="mb-4">
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div><Label>Fecha inicio</Label><Input type="date" name="from" defaultValue={range.startInput} /></div>
            <div><Label>Fecha fin</Label><Input type="date" name="to" defaultValue={range.endInput} /></div>
            <div className="flex items-end"><Button type="submit">Filtrar</Button></div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Metric title="Ingresos" value={formatCurrency(pnl.revenue)} hint={`${pnl.orderCount} ordenes`} />
        <Metric title="COGS" value={formatCurrency(pnl.cogs)} hint={`${pnl.cogsPct}% de ventas`} />
        <Metric title="Utilidad bruta" value={formatCurrency(pnl.grossProfit)} hint={`Margen ${pnl.grossMarginPct}%`} />
        <Metric title="Gastos (OPEX)" value={formatCurrency(pnl.totalExpenses)} />
        <Metric
          title="Utilidad neta"
          value={formatCurrency(pnl.netProfit)}
          hint={`Margen ${pnl.netMarginPct}%`}
          tone={pnl.netProfit < 0 ? "danger" : "positive"}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <Metric title="Ticket promedio" value={formatCurrency(pnl.averageTicket)} />
        <Metric title="Efectivo" value={formatCurrency(pnl.revenueByMethod.cash)} />
        <Metric title="Tarjeta" value={formatCurrency(pnl.revenueByMethod.card)} />
        <Metric title="Transferencia" value={formatCurrency(pnl.revenueByMethod.transfer)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Gastos por categoria</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <thead><tr><Th>Categoria</Th><Th>Total</Th></tr></thead>
              <tbody>
                {expenseRows.map(([category, amount]) => (
                  <tr key={category}><Td>{expenseCategoryLabel(category)}</Td><Td>{formatCurrency(amount)}</Td></tr>
                ))}
                {expenseRows.length === 0 && (
                  <tr><Td className="text-[var(--muted-foreground)]">Sin gastos en el rango.</Td></tr>
                )}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rentabilidad por producto</CardTitle>
            <p className="text-sm text-[var(--muted-foreground)]">Utilidad bruta (U.B) por producto, usando el costo congelado al vender.</p>
          </CardHeader>
          <CardContent>
            <Table>
              <thead><tr><Th>Producto</Th><Th>Cant.</Th><Th>Ventas</Th><Th>Costo</Th><Th>U.B</Th><Th>Margen</Th></tr></thead>
              <tbody>
                {productProfitability.map((item) => (
                  <tr key={item.productName}>
                    <Td>{item.productName}</Td>
                    <Td>{item.quantity}</Td>
                    <Td>{formatCurrency(item.revenue)}</Td>
                    <Td>{formatCurrency(item.cost)}</Td>
                    <Td>{formatCurrency(item.grossProfit)}</Td>
                    <Td>{item.marginPct}%</Td>
                  </tr>
                ))}
                {productProfitability.length === 0 && (
                  <tr><Td className="text-[var(--muted-foreground)]">Sin ventas en el rango.</Td></tr>
                )}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Metric({ title, value, hint, tone }: { title: string; value: string; hint?: string; tone?: "danger" | "positive" }) {
  const toneClass = tone === "danger" ? "text-red-700" : tone === "positive" ? "text-teal-700" : "";
  return (
    <Card>
      <CardContent>
        <div className="text-sm text-[var(--muted-foreground)]">{title}</div>
        <div className={`mt-1 text-2xl font-black ${toneClass}`}>{value}</div>
        {hint && <div className="mt-1 text-xs text-[var(--muted-foreground)]">{hint}</div>}
      </CardContent>
    </Card>
  );
}
