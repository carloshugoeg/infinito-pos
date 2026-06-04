import { getAppSettings } from "@/server/queries/settings";
import { requireUser } from "@/server/auth";
import { AppSidebar } from "./app-sidebar";

export async function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  const [settings, { user }] = await Promise.all([getAppSettings(), requireUser()]);

  return (
    <div className="min-h-screen p-3 text-[var(--foreground)] lg:p-5">
      <AppSidebar companyName={settings.companyName} userRole={user.role} />

      <main className="app-main">
        <div className="mb-8 hidden flex-wrap items-center justify-between gap-3 px-1 lg:flex">
          <h1 className="font-display text-4xl font-black tracking-tighter text-[var(--foreground)]">{title}</h1>
        </div>
        {children}
      </main>
    </div>
  );
}
