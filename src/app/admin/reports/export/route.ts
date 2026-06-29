import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { paymentMethodLabel } from "@/lib/labels";
import { createRateLimiter } from "@/lib/rate-limit";
import { formatGuatemalaDateTime } from "@/lib/time";
import { formatCurrency, toNumber } from "@/lib/utils";
import { MAX_REPORT_RANGE_DAYS, parseReportDateRange, reportRangeDays } from "@/server/admin-crud";
import { getActiveBranch, requireRole } from "@/server/auth";

// Por usuario: 10 exportaciones por minuto (P1-SEC-02). Estado en memoria de instancia tibia.
const exportLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

export async function GET(request: Request) {
  const { user } = await requireRole([UserRole.ADMIN]);

  const rate = exportLimiter.check(user.id);
  if (!rate.allowed) {
    return new NextResponse("Demasiadas exportaciones. Intenta de nuevo en un momento.", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) }
    });
  }

  const { branch } = await getActiveBranch();
  const url = new URL(request.url);
  const range = parseReportDateRange(url.searchParams.get("from"), url.searchParams.get("to"));

  if (reportRangeDays(range) > MAX_REPORT_RANGE_DAYS) {
    return new NextResponse(
      `El rango no puede exceder ${MAX_REPORT_RANGE_DAYS} días. Reduce el periodo y vuelve a exportar.`,
      { status: 400 }
    );
  }

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
        formatGuatemalaDateTime(order.createdAt),
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

  // BOM UTF-8 para que Excel lea el archivo como UTF-8 (sin BOM lo abre con el
  // codepage ANSI del sistema y corrompe acentos y símbolos -> caracteres basura).
  const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reporte-${branch.code}-${range.startInput}-${range.endInput}.csv"`
    }
  });
}

function csvCell(value: string) {
  // Intl.NumberFormat inserta un espacio duro (U+00A0) en los montos; lo
  // normalizamos a espacio normal para que ninguna herramienta lo muestre como basura.
  const normalized = value.replaceAll("\u00A0", " ");
  return `"${normalized.replaceAll('"', '""')}"`;
}
