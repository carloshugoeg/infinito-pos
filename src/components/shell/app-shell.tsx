import { UserRole } from "@prisma/client";
import Link from "next/link";
import { BarChart3, Grid2X2, LayoutDashboard, LogOut, Settings, WalletCards } from "lucide-react";
import { logoutAction } from "@/server/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { getAppSettings } from "@/server/queries/settings";
import { requireUser } from "@/server/auth";

const links = [
  ["Kiosco", "/kiosk", LayoutDashboard, "all"],
  ["Caja", "/cash/close", WalletCards, "all"],
  ["Administracion", "/admin", Grid2X2, "admin"],
  ["Reportes", "/admin/reports", BarChart3, "admin"],
  ["Ajustes", "/admin/settings", Settings, "admin"]
] as const;

export async function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  const [settings, { user }] = await Promise.all([getAppSettings(), requireUser()]);
  const visibleLinks = links.filter(([, , , audience]) => audience === "all" || user.role === UserRole.ADMIN);

  return (
    <div className="min-h-screen p-3 text-[var(--foreground)] lg:p-5">
      <aside className="fixed inset-x-3 top-3 z-20 rounded-[2.5rem] border border-[var(--border)] bg-white/90 px-4 py-3 shadow-lg backdrop-blur-xl lg:inset-y-5 lg:left-5 lg:right-auto lg:flex lg:w-64 lg:flex-col lg:px-6 lg:py-8">
        <div className="flex items-center justify-between gap-4 lg:block">
          <Link href="/kiosk" className="flex items-center gap-3 text-xl font-black">
            <span className="grid size-12 place-items-center rounded-2xl bg-[var(--primary)] text-2xl text-white shadow-lg shadow-[var(--primary)]/20">
              {settings.companyName.slice(0, 1)}
            </span>
            <div className="flex flex-col">
              <span className="font-display text-xl leading-none">{settings.companyName}</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--primary)] font-black mt-1">SISTEMA POS</span>
            </div>
          </Link>
          <form action={logoutAction} className="lg:hidden">
            <Button variant="secondary" size="icon" type="submit" aria-label="Salir" className="rounded-full">
              <LogOut size={17} />
            </Button>
          </form>
        </div>

        <nav className="mt-4 flex gap-2 overflow-x-auto [scrollbar-width:none] lg:mt-12 lg:flex-col lg:overflow-visible [&::-webkit-scrollbar]:hidden">
          {visibleLinks.map(([label, href, Icon]) => (
            <Link
              key={href}
              href={href}
              className="flex min-w-max items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-[var(--muted-foreground)] transition-all hover:bg-[var(--muted)] hover:text-[var(--primary)]"
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        <form action={logoutAction} className="mt-auto hidden lg:block">
          <Button variant="ghost" className="w-full justify-start rounded-2xl text-[var(--danger)] hover:bg-red-50" type="submit">
            <LogOut size={17} />
            Salir del sistema
          </Button>
        </form>
      </aside>

      <main className="app-main">
        <div className="mb-8 hidden flex-wrap items-center justify-between gap-3 px-1 lg:flex">
          <h1 className="font-display text-4xl font-black tracking-tighter text-[var(--foreground)]">{title}</h1>
        </div>
        {children}
      </main>
    </div>
  );
}
