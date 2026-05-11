import Link from "next/link";
import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/shell/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/server/auth";

const items = [
  ["Sucursales", "/admin/branches", "Gestiona puntos de venta."],
  ["Usuarios", "/admin/users", "Administra operadores y accesos."],
  ["Catalogo", "/admin/catalog", "Productos, modificadores y recetas."],
  ["Ingredientes", "/admin/ingredients", "Insumos y unidades."],
  ["Inventario", "/admin/inventory", "Stock por sucursal y movimientos."],
  ["Reportes", "/admin/reports", "Ventas, pagos y popularidad."]
] as const;

export default async function AdminPage() {
  await requireRole([UserRole.ADMIN]);
  return (
    <AppShell title="Administracion">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map(([title, href, description]) => (
          <Link key={href} href={href}>
            <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
              <CardHeader>
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-[var(--muted-foreground)]">{description}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
