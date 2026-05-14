import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { paymentMethodLabel } from "@/lib/labels";
import { formatCurrency, toNumber } from "@/lib/utils";
import { parseReportDateRange } from "@/server/admin-crud";
import { getActiveBranch, requireRole } from "@/server/auth";

export async function GET(request: Request) {
  await requireRole([UserRole.ADMIN]);
  const { branch } = await getActiveBranch();
  const url = new URL(request.url);
  const range = parseReportDateRange(url.searchParams.get("from"), url.searchParams.get("to"));
  const orders = await prisma.order.findMany({
    where: {
      branchId: branch.id,
      createdAt: { gte: range.start, lt: range.end },
      status: { not: "CANCELLED" }
    },
    include: {
      items: { include: { modifiers: true } },
      payments: true
    },
    orderBy: { createdAt: "asc" }
  });

  const rows = [
    ["Fecha", "Orden", "Cliente", "Telefono", "Producto", "Cantidad", "Modificadores", "Pagos", "Total orden"],
    ...orders.flatMap((order) => {
      const payments = order.payments.map((payment) => `${paymentMethodLabel(payment.method)} ${formatCurrency(toNumber(payment.amount))}`).join(" + ");
      return order.items.map((item) => [
        order.createdAt.toLocaleString("es-GT"),
        order.id,
        order.customerName,
        order.customerPhone ?? "",
        item.productNameSnapshot,
        String(item.quantity),
        item.modifiers.map((modifier) => modifier.modifierNameSnapshot).join(" + "),
        payments,
        formatCurrency(toNumber(order.total))
      ]);
    })
  ];

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reporte-${branch.code}-${range.startInput}-${range.endInput}.csv"`
    }
  });
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
