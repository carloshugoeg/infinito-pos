/**
 * Genera el CSV EXACTO que produce /admin/reports/export usando las mismas
 * consultas y los mismos helpers de la app. Solo para inspeccionar la salida.
 *
 *   npx tsx scripts/dump-report-csv.ts [from=YYYY-MM-DD] [to=YYYY-MM-DD]
 */
import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/db";
import { paymentMethodLabel } from "../src/lib/labels";
import { formatGuatemalaDateTime } from "../src/lib/time";
import { formatCurrency, toNumber } from "../src/lib/utils";

function csvCell(value: string) {
  const normalized = value.replaceAll("\u00A0", " ");
  return `"${normalized.replaceAll('"', '""')}"`;
}

async function main() {
  // Toma la sucursal y un rango amplio para incluir todas las órdenes seed.
  const branch = await prisma.branch.findFirstOrThrow();
  const start = new Date("2000-01-01T00:00:00Z");
  const end = new Date("2100-01-01T00:00:00Z");

  const orders = await prisma.order.findMany({
    where: {
      branchId: branch.id,
      createdAt: { gte: start, lt: end },
      status: { not: "CANCELLED" }
    },
    include: { items: { include: { modifiers: true } }, payments: true },
    orderBy: { createdAt: "asc" }
  });

  const rows = [
    ["Fecha", "Orden", "Cliente", "Telefono", "Producto", "Cantidad", "Modificadores", "Pagos", "Total orden"],
    ...orders.flatMap((order) => {
      const payments = order.payments
        .map((payment) => `${paymentMethodLabel(payment.method)} ${formatCurrency(toNumber(payment.amount))}`)
        .join(" + ");
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

  const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const out = "reporte-ejemplo.csv";
  writeFileSync(out, csv, "utf8");
  console.log(`OK -> ${out} | branch=${branch.code} | orders=${orders.length} | rows=${rows.length - 1} | bytes=${Buffer.byteLength(csv, "utf8")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
