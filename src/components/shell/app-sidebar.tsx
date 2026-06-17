"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { BarChart3, Grid2X2, LayoutDashboard, LogOut, Menu, Receipt, Settings, TrendingUp, WalletCards, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/server/actions/auth-actions";
import { Button } from "@/components/ui/button";

const links = [
  ["Kiosco", "/kiosk", LayoutDashboard, "all"],
  ["Caja", "/cash/close", WalletCards, "all"],
  ["Administracion", "/admin", Grid2X2, "admin"],
  ["Reportes", "/admin/reports", BarChart3, "admin"],
  ["Gastos", "/admin/expenses", Receipt, "admin"],
  ["Finanzas", "/admin/finance", TrendingUp, "admin"],
  ["Ajustes", "/admin/settings", Settings, "admin"]
] as const;

export function AppSidebar({ companyName, userRole }: { companyName: string; userRole: UserRole }) {
  // Hover devices (desktop, mouse) expand the rail on hover. Touch devices (tablets)
  // have no hover, so they drive an explicit "pinned" open state via the hamburger.
  const [canHover, setCanHover] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setCanHover(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const isExpanded = canHover ? hovered : pinned;
  const showHamburger = !canHover;
  const visibleLinks = links.filter(([, , , audience]) => audience === "all" || userRole === UserRole.ADMIN);

  // Hover devices keep the auto-expanding rail. Touch devices (tablets) turn the rail into a
  // full-width overlay drawer that slides off-screen when closed, so the content uses the full
  // horizontal width and the floating hamburger brings the sidebar back.
  const asideStateClasses = canHover
    ? isExpanded
      ? "lg:w-64 lg:px-6"
      : "lg:w-[5.5rem] lg:px-4 lg:items-center"
    : `lg:w-64 lg:px-6 ${pinned ? "lg:translate-x-0" : "lg:-translate-x-[140%] lg:pointer-events-none"}`;

  return (
    <>
      {/* Tap-to-close backdrop for the tablet drawer */}
      {showHamburger && pinned && (
        <button
          type="button"
          aria-label="Cerrar menu"
          onClick={() => setPinned(false)}
          className="fixed inset-0 z-20 hidden bg-[var(--foreground)]/25 backdrop-blur-sm lg:block"
        />
      )}

      {/* Floating launcher: brings the hidden sidebar back on touch tablets */}
      {showHamburger && !pinned && (
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setPinned(true)}
          className="fixed left-5 top-5 z-30 hidden size-12 place-items-center rounded-2xl border border-[var(--border)] bg-white/95 text-[var(--foreground)] shadow-lg backdrop-blur-xl transition-colors hover:text-[var(--primary)] active:bg-[var(--muted)] lg:grid"
        >
          <Menu size={22} />
        </button>
      )}

      <aside
        className={`fixed inset-x-3 top-3 z-30 rounded-[2.5rem] border border-[var(--border)] bg-white/95 px-4 py-3 shadow-lg backdrop-blur-xl transition-all duration-300 overflow-hidden lg:inset-y-5 lg:left-5 lg:right-auto lg:flex lg:flex-col lg:py-8 ${asideStateClasses}`}
        onMouseEnter={canHover ? () => setHovered(true) : undefined}
        onMouseLeave={canHover ? () => setHovered(false) : undefined}
      >
        <div className="flex items-center justify-between gap-4 lg:flex-col lg:w-full lg:items-start lg:gap-0">
          {/* Mobile View Header */}
          <div className="flex items-center justify-between w-full lg:hidden">
            <Link href="/kiosk" className="flex items-center gap-3 text-xl font-black">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--primary)] text-2xl text-[var(--primary-foreground)] shadow-lg shadow-[var(--primary)]/20">
                {companyName.slice(0, 1)}
              </span>
              <div className="flex flex-col">
                <span className="font-display text-xl leading-none truncate">{companyName}</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--primary)] font-black mt-1">SISTEMA POS</span>
              </div>
            </Link>
            <form action={logoutAction}>
              <Button variant="secondary" size="icon" type="submit" aria-label="Salir" className="rounded-full shrink-0">
                <LogOut size={17} />
              </Button>
            </form>
          </div>

          {/* Desktop hamburger toggle (touch tablets only) */}
          {showHamburger && (
            <button
              type="button"
              onClick={() => setPinned((value) => !value)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Contraer menu" : "Abrir menu"}
              className={`hidden lg:flex h-12 items-center rounded-2xl text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--primary)] active:bg-[var(--muted)] ${
                isExpanded ? "w-full justify-start gap-3 px-4 mb-2" : "w-12 justify-center self-center mb-1"
              }`}
            >
              {isExpanded ? <X size={22} className="shrink-0" /> : <Menu size={22} className="shrink-0" />}
              <span className={`text-sm font-bold whitespace-nowrap transition-all duration-300 ${isExpanded ? "opacity-100" : "w-0 opacity-0"}`}>
                Menu
              </span>
            </button>
          )}

          {/* Desktop View Header */}
          <Link href="/kiosk" onClick={() => setPinned(false)} title={companyName} aria-label={companyName} className={`hidden lg:flex items-center gap-3 text-xl font-black w-full overflow-hidden transition-all duration-300 ${!isExpanded ? "justify-center" : ""}`}>
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--primary)] text-2xl text-[var(--primary-foreground)] shadow-lg shadow-[var(--primary)]/20">
              {companyName.slice(0, 1)}
            </span>
            <div className={`flex flex-col overflow-hidden transition-all duration-300 whitespace-nowrap ${isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 w-0"}`}>
              <span className="font-display text-xl leading-none truncate">{companyName}</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--primary)] font-black mt-1">SISTEMA POS</span>
            </div>
          </Link>
        </div>

        <nav className={`mt-4 flex gap-2 overflow-x-auto [scrollbar-width:none] lg:mt-12 lg:flex-col lg:overflow-hidden [&::-webkit-scrollbar]:hidden w-full`}>
          {visibleLinks.map(([label, href, Icon]) => {
            const isActive = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href as string);
            return (
              <Link
                key={href}
                href={href}
                title={!isExpanded ? label : undefined}
                onClick={() => setPinned(false)}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all shrink-0 overflow-hidden lg:w-full ${
                  isActive ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-md shadow-[var(--primary)]/20" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--primary)]"
                } ${!isExpanded ? "lg:justify-center lg:px-0 lg:h-12" : "lg:justify-start"}`}
              >
                <Icon size={22} className="shrink-0" />
                <span className={`truncate whitespace-nowrap transition-all duration-300 ${isExpanded ? "opacity-100 lg:w-auto" : "lg:opacity-0 lg:w-0"}`}>
                  {label}
                </span>
                <span className="lg:hidden truncate">{label}</span>
              </Link>
            );
          })}
        </nav>

        <form action={logoutAction} className={`mt-auto hidden lg:flex w-full`}>
          <Button
            variant="ghost"
            className={`flex items-center gap-3 rounded-2xl text-[var(--danger)] hover:bg-red-50 hover:text-[var(--danger)] transition-all overflow-hidden lg:w-full ${
              !isExpanded ? "w-12 h-12 p-0 justify-center mx-auto" : "justify-start px-4 h-auto py-3"
            }`}
            type="submit"
            title={!isExpanded ? "Salir del sistema" : undefined}
          >
            <LogOut size={22} className="shrink-0" />
            <span className={`truncate whitespace-nowrap transition-all duration-300 font-bold text-sm ${isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"}`}>
              Salir del sistema
            </span>
          </Button>
        </form>
      </aside>
    </>
  );
}
