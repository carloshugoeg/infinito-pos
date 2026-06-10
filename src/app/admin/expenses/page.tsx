import { ExpenseCategory, PaymentMethod, UserRole } from "@prisma/client";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, Td, Th } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { expenseCategoryLabel, expenseFrequencyLabel, paymentMethodLabel } from "@/lib/labels";
import { formatCurrency, toNumber } from "@/lib/utils";
import { EXPENSE_CATEGORIES, EXPENSE_FREQUENCIES, isExpenseCategory } from "@/domain/expenses";
import { parseReportDateRange } from "@/server/admin-crud";
import { getActiveBranch, requireRole } from "@/server/auth";
import {
  createExpenseAction,
  createRecurringExpenseAction,
  deleteExpenseAction,
  toggleRecurringExpenseAction
} from "@/server/actions/expense-actions";

type ExpensesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  await requireRole([UserRole.ADMIN]);
  const { branch } = await getActiveBranch();
  const params = (await searchParams) ?? {};
  const range = parseReportDateRange(readParam(params.from), readParam(params.to));
  const categoryParam = readParam(params.category);
  const categoryFilter = isExpenseCategory(categoryParam) ? (categoryParam as ExpenseCategory) : undefined;
  const today = dateInputValue(new Date());

  const [expenses, recurring] = await Promise.all([
    prisma.expense.findMany({
      where: {
        branchId: branch.id,
        incurredOn: { gte: range.start, lt: range.end },
        ...(categoryFilter ? { category: categoryFilter } : {})
      },
      orderBy: { incurredOn: "desc" }
    }),
    prisma.recurringExpense.findMany({
      where: { branchId: branch.id },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const totalExpenses = expenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);

  return (
    <AppShell title={`Gastos - ${branch.name}`}>
      <Card className="mb-4">
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <div><Label>Fecha inicio</Label><Input type="date" name="from" defaultValue={range.startInput} /></div>
            <div><Label>Fecha fin</Label><Input type="date" name="to" defaultValue={range.endInput} /></div>
            <div>
              <Label>Categoria</Label>
              <select
                name="category"
                defaultValue={categoryFilter ?? ""}
                className="touch-target w-full rounded-md border border-[var(--border)] bg-white px-3"
              >
                <option value="">Todas</option>
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{expenseCategoryLabel(category)}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end"><Button type="submit">Filtrar</Button></div>
          </form>
        </CardContent>
      </Card>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Metric title="Total gastos (rango)" value={formatCurrency(totalExpenses)} />
        <Metric title="Gastos registrados" value={String(expenses.length)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.4fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Registrar gasto</CardTitle></CardHeader>
            <CardContent>
              <form action={createExpenseAction} className="space-y-3">
                <div>
                  <Label>Categoria</Label>
                  <select name="category" className="touch-target w-full rounded-md border border-[var(--border)] bg-white px-3">
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>{expenseCategoryLabel(category)}</option>
                    ))}
                  </select>
                </div>
                <div><Label>Descripcion</Label><Input name="description" required /></div>
                <div><Label>Monto (Q)</Label><Input name="amount" type="number" step="0.01" min="0.01" required /></div>
                <div><Label>Fecha</Label><Input name="incurredOn" type="date" defaultValue={today} required /></div>
                <div>
                  <Label>Metodo de pago</Label>
                  <select name="paymentMethod" className="touch-target w-full rounded-md border border-[var(--border)] bg-white px-3">
                    <option value="">Sin especificar</option>
                    {Object.values(PaymentMethod).map((method) => (
                      <option key={method} value={method}>{paymentMethodLabel(method)}</option>
                    ))}
                  </select>
                </div>
                <div><Label>Proveedor (opcional)</Label><Input name="vendor" /></div>
                <div><Label>Notas (opcional)</Label><Input name="notes" /></div>
                <Button type="submit">Guardar gasto</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Gasto recurrente</CardTitle></CardHeader>
            <CardContent>
              <form action={createRecurringExpenseAction} className="space-y-3">
                <div>
                  <Label>Categoria</Label>
                  <select name="category" className="touch-target w-full rounded-md border border-[var(--border)] bg-white px-3">
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>{expenseCategoryLabel(category)}</option>
                    ))}
                  </select>
                </div>
                <div><Label>Descripcion</Label><Input name="description" required /></div>
                <div><Label>Monto (Q)</Label><Input name="amount" type="number" step="0.01" min="0.01" required /></div>
                <div>
                  <Label>Frecuencia</Label>
                  <select name="frequency" className="touch-target w-full rounded-md border border-[var(--border)] bg-white px-3">
                    {EXPENSE_FREQUENCIES.map((frequency) => (
                      <option key={frequency} value={frequency}>{expenseFrequencyLabel(frequency)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Dia del periodo</Label>
                  <Input name="dayOfPeriod" type="number" min="0" max="31" step="1" defaultValue={1} required />
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">Mensual/Quincenal: dia del mes. Semanal: 0=Dom ... 6=Sab.</p>
                </div>
                <Button type="submit">Crear recurrente</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Gastos del rango</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <thead><tr><Th>Fecha</Th><Th>Categoria</Th><Th>Descripcion</Th><Th>Monto</Th><Th>Accion</Th></tr></thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <Td>{expense.incurredOn.toLocaleDateString("es-GT")}</Td>
                      <Td>{expenseCategoryLabel(expense.category)}</Td>
                      <Td>{expense.description}</Td>
                      <Td>{formatCurrency(toNumber(expense.amount))}</Td>
                      <Td>
                        <form action={deleteExpenseAction}>
                          <input type="hidden" name="id" value={expense.id} />
                          <Button type="submit" variant="outline" size="sm">Eliminar</Button>
                        </form>
                      </Td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr><Td className="text-[var(--muted-foreground)]">Sin gastos en el rango.</Td></tr>
                  )}
                </tbody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Gastos recurrentes</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <thead><tr><Th>Descripcion</Th><Th>Categoria</Th><Th>Frecuencia</Th><Th>Dia</Th><Th>Monto</Th><Th>Estado</Th><Th>Accion</Th></tr></thead>
                <tbody>
                  {recurring.map((item) => (
                    <tr key={item.id}>
                      <Td>{item.description}</Td>
                      <Td>{expenseCategoryLabel(item.category)}</Td>
                      <Td>{expenseFrequencyLabel(item.frequency)}</Td>
                      <Td>{item.dayOfPeriod}</Td>
                      <Td>{formatCurrency(toNumber(item.amount))}</Td>
                      <Td className={item.active ? "text-teal-700" : "text-[var(--muted-foreground)]"}>{item.active ? "Activo" : "Inactivo"}</Td>
                      <Td>
                        <form action={toggleRecurringExpenseAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <Button type="submit" variant="outline" size="sm">{item.active ? "Desactivar" : "Activar"}</Button>
                        </form>
                      </Td>
                    </tr>
                  ))}
                  {recurring.length === 0 && (
                    <tr><Td className="text-[var(--muted-foreground)]">Sin gastos recurrentes.</Td></tr>
                  )}
                </tbody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
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
