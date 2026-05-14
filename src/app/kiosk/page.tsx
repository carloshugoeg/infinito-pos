import { OrderStatus } from "@prisma/client";
import { AppShell } from "@/components/shell/app-shell";
import { KioskClient } from "@/components/kiosk/kiosk-client";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";
import { getActiveBranch } from "@/server/auth";
import { ensureCashSessionForKiosk } from "@/server/actions/cash-actions";
import { listSellableProducts } from "@/server/queries/catalog";
import { getAppSettings } from "@/server/queries/settings";

export default async function KioskPage() {
  const { branch } = await getActiveBranch();
  const cashSession = await ensureCashSessionForKiosk();
  const [products, settings] = await Promise.all([listSellableProducts(), getAppSettings()]);
  const activeOrders = await prisma.order.findMany({
    where: {
      branchId: branch.id,
      status: { in: [OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.READY] }
    },
    orderBy: { createdAt: "asc" },
    include: {
      items: {
        include: { modifiers: true }
      },
      payments: true
    }
  });

  return (
    <AppShell title={`Kiosco - ${branch.name}`}>
      <KioskClient
        products={products}
        modifierGridEnabled={settings.modifierGridEnabled}
        cashSessionOpenedAt={cashSession.openedAt.toISOString()}
        activeOrders={activeOrders.map((order) => ({
          id: order.id,
          status: order.status,
          total: toNumber(order.total),
          customerName: order.customerName,
          paidAt: order.paidAt.toISOString(),
          items: order.items.map((item) => ({
            id: item.id,
            name: item.productNameSnapshot,
            quantity: item.quantity,
            notes: item.notes,
            modifiers: item.modifiers.map((modifier) => modifier.modifierNameSnapshot)
          }))
        }))}
      />
    </AppShell>
  );
}
