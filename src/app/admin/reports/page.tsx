import { PaymentMethod } from "@prisma/client";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, Td, Th } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { formatCurrency, toNumber } from "@/lib/utils";
import { parseReportDateRange } from "@/server/admin-crud";
import { getActiveBranch } from "@/server/auth";
import { getEmpiricalDailyReport } from "@/server/reports/empirical-daily";

type ReportsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const { branch } = await getActiveBranch();
  const params = (await searchParams) ?? {};
  const range = parseReportDateRange(readParam(params.from), readParam(params.to));
  const exportHref = `/admin/reports/export?from=${range.startInput}&to=${range.endInput}`;

  const [orders, payments, topProducts, topModifiers, empiricalReport] = await Promise.all([
    prisma.order.findMany({
      where: { branchId: branch.id, createdAt: { gte: range.start, lt: range.end }, status: { not: "CANCELLED" } }
    }),
    prisma.payment.groupBy({
      by: ["method"],
      where: { order: { branchId: branch.id, createdAt: { gte: range.start, lt: range.end }, status: { not: "CANCELLED" } } },
      _sum: { amount: true }
    }),
    prisma.orderItem.groupBy({
      by: ["productNameSnapshot"],
      where: { order: { branchId: branch.id, createdAt: { gte: range.start, lt: range.end }, status: { not: "CANCELLED" } } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10
    }),
    prisma.orderItemModifier.groupBy({
      by: ["modifierNameSnapshot"],
      where: { orderItem: { order: { branchId: branch.id, createdAt: { gte: range.start, lt: range.end }, status: { not: "CANCELLED" } } } },
      _count: { modifierNameSnapshot: true },
      orderBy: { _count: { modifierNameSnapshot: "desc" } },
      take: 10
    }),
    getEmpiricalDailyReport(branch.id, range.start)
  ]);

  const total = orders.reduce((sum, order) => sum + toNumber(order.total), 0);
  const byMethod = (method: PaymentMethod) => toNumber(payments.find((payment) => payment.method === method)?._sum.amount);

  return (
    <AppShell title={`Reportes - ${branch.name}`}>
      <Card className="mb-4">
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
            <div><Label>Fecha inicio</Label><Input type="date" name="from" defaultValue={range.startInput} /></div>
            <div><Label>Fecha fin</Label><Input type="date" name="to" defaultValue={range.endInput} /></div>
            <div className="flex items-end"><Button type="submit">Filtrar</Button></div>
            <div className="flex items-end">
              <Button asChild variant="secondary">
                <Link href={exportHref}>Exportar CSV</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-4">
        <Metric title="Ventas" value={formatCurrency(total)} />
        <Metric title="Ordenes" value={String(orders.length)} />
        <Metric title="Efectivo" value={formatCurrency(byMethod(PaymentMethod.CASH))} />
        <Metric title="Tarjeta + transf." value={formatCurrency(byMethod(PaymentMethod.CARD) + byMethod(PaymentMethod.TRANSFER))} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Productos mas vendidos</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <thead><tr><Th>Producto</Th><Th>Cantidad</Th><Th>Total</Th></tr></thead>
              <tbody>{topProducts.map((item) => <tr key={item.productNameSnapshot}><Td>{item.productNameSnapshot}</Td><Td>{item._sum.quantity ?? 0}</Td><Td>{formatCurrency(toNumber(item._sum.lineTotal))}</Td></tr>)}</tbody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Toppings populares</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <thead><tr><Th>Modificador</Th><Th>Usos</Th></tr></thead>
              <tbody>{topModifiers.map((item) => <tr key={item.modifierNameSnapshot}><Td>{item.modifierNameSnapshot}</Td><Td>{item._count.modifierNameSnapshot}</Td></tr>)}</tbody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Corte diario estilo Excel</CardTitle>
          <p className="text-sm text-[var(--muted-foreground)]">
            Lectura compatible con el archivo actual: conteos por efectivo, tarjeta y transferencia. Si una orden tiene pagos divididos, los conteos se asignan al metodo con mayor monto.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {empiricalReport.sections.map((section) => (
            <div key={section.title}>
              <h2 className="mb-2 text-base font-black">{section.title}</h2>
              <Table>
                <thead>
                  <tr>
                    <Th>Descripcion</Th>
                    <Th>Efectivo</Th>
                    <Th>Tarjeta</Th>
                    <Th>Transfer.</Th>
                    <Th>Total</Th>
                    <Th>Unitario</Th>
                    <Th>Total efectivo</Th>
                    <Th>Total tarjeta</Th>
                    <Th>Total transfer.</Th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row) => {
                    const totalCount = row.cashCount + row.cardCount + row.transferCount;
                    return (
                      <tr key={`${section.title}-${row.label}`}>
                        <Td>{row.label}</Td>
                        <Td>{row.cashCount}</Td>
                        <Td>{row.cardCount}</Td>
                        <Td>{row.transferCount}</Td>
                        <Td>{totalCount}</Td>
                        <Td>{formatCurrency(row.unitPrice)}</Td>
                        <Td>{formatCurrency(row.cashCount * row.unitPrice)}</Td>
                        <Td>{formatCurrency(row.cardCount * row.unitPrice)}</Td>
                        <Td>{formatCurrency(row.transferCount * row.unitPrice)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          ))}
          <div className="grid gap-3 md:grid-cols-3">
            <Metric title="Total ingresos efectivo" value={formatCurrency(empiricalReport.paymentTotals.cash)} />
            <Metric title="Total ingresos tarjeta" value={formatCurrency(empiricalReport.paymentTotals.card)} />
            <Metric title="Total ingresos transferencia" value={formatCurrency(empiricalReport.paymentTotals.transfer)} />
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent>
        <div className="text-sm text-[var(--muted-foreground)]">{title}</div>
        <div className="mt-1 text-2xl font-black">{value}</div>
      </CardContent>
    </Card>
  );
}
