import { requireAdminForPage, updateAppSettingsAction } from "@/server/actions/admin-actions";
import { getAppSettings } from "@/server/queries/settings";
import { AppShell } from "@/components/shell/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";

export default async function AdminSettingsPage() {
  await requireAdminForPage();
  const settings = await getAppSettings();

  return (
    <AppShell title="Ajustes del Sistema">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3 lg:hidden">
          <div className="rounded-2xl bg-[var(--primary)] p-3 text-white">
            <Settings size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Ajustes del Sistema</h1>
            <p className="text-[var(--muted-foreground)] font-medium">Personaliza la identidad y apariencia de tu punto de venta.</p>
          </div>
        </div>

        <div className="grid max-w-4xl gap-6">
          <form action={updateAppSettingsAction}>
            <Card>
              <CardHeader>
                <CardTitle>Identidad y Apariencia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Nombre de la Empresa</Label>
                    <Input
                      id="companyName"
                      name="companyName"
                      defaultValue={settings.companyName}
                      required
                      placeholder="Ej. Koi Coffee"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currencySymbol">Simbolo de Moneda</Label>
                    <Input
                      id="currencySymbol"
                      name="currencySymbol"
                      defaultValue={settings.currencySymbol}
                      required
                      placeholder="Ej. Q, $, L"
                    />
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="accentColor">Color principal</Label>
                    <div className="flex gap-3">
                      <Input
                        id="accentColor"
                        name="accentColor"
                        type="color"
                        defaultValue={settings.accentColor}
                        className="w-20 h-11 rounded-xl p-1"
                      />
                      <Input
                        type="text"
                        defaultValue={settings.accentColor}
                        className="font-mono"
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backgroundColor">Color de fondo</Label>
                    <div className="flex gap-3">
                      <Input
                        id="backgroundColor"
                        name="backgroundColor"
                        type="color"
                        defaultValue={settings.backgroundColor}
                        className="w-20 h-11 rounded-xl p-1"
                      />
                      <Input
                        type="text"
                        defaultValue={settings.backgroundColor}
                        className="font-mono"
                        readOnly
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-[var(--border)] bg-white/70 p-4">
                  <label htmlFor="modifierGridEnabled" className="flex items-center justify-between gap-4">
                    <div>
                      <span className="block text-sm font-black text-[var(--foreground)]">Reticula tactil en kiosco</span>
                      <span className="mt-1 block text-sm font-medium text-[var(--muted-foreground)]">
                        Muestra bases, toppings y extras como cuadros grandes.
                      </span>
                    </div>
                    <input
                      id="modifierGridEnabled"
                      name="modifierGridEnabled"
                      type="checkbox"
                      defaultChecked={settings.modifierGridEnabled}
                      className="size-6 accent-[var(--primary)]"
                    />
                  </label>
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" size="lg" className="min-w-[200px]">
                    Guardar Ajustes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>

          <Card className="border-[var(--accent)]/20 bg-[var(--soft-mint)] shadow-none">
            <CardHeader>
              <CardTitle className="text-lg">Vista Previa</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm font-medium text-[var(--foreground)] opacity-80">
                Asi se vera el encabezado de tu aplicacion:
              </p>
              <div className="flex items-center justify-between rounded-[2rem] border border-white bg-white/50 p-6">
                <span className="text-2xl font-black text-[var(--primary)]">{settings.companyName}</span>
                <div className="flex gap-2">
                  <div className="size-8 rounded-full bg-[var(--primary)] shadow-sm" />
                  <div className="size-8 rounded-full bg-[var(--accent)] shadow-sm" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
