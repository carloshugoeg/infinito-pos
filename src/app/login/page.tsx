import { loginAction } from "@/server/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-md border-white/90 bg-white/88 backdrop-blur">
        <CardHeader>
          <div className="mb-3 grid size-12 place-items-center rounded-[1.1rem] bg-[var(--primary)] font-display text-2xl font-black text-white shadow-[var(--shadow-button)]">
            K
          </div>
          <CardTitle>Koi POS</CardTitle>
          <p className="text-sm font-bold text-[var(--muted-foreground)]">Ingresa para operar tu kiosco.</p>
        </CardHeader>
        <CardContent>
          <LoginForm searchParams={searchParams} />
        </CardContent>
      </Card>
    </main>
  );
}

async function LoginForm({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <form action={loginAction} className="flex flex-col gap-4">
      {params.error ? <div className="rounded-[1rem] bg-[#fff0ed] p-3 text-sm font-black text-[var(--danger)]">Credenciales incorrectas.</div> : null}
      <div>
        <Label htmlFor="email">Correo</Label>
        <Input id="email" name="email" type="email" defaultValue="admin@koi.local" required />
      </div>
      <div>
        <Label htmlFor="password">Contrasena</Label>
        <Input id="password" name="password" type="password" defaultValue="admin12345" required />
      </div>
      <Button type="submit" className="w-full">
        Entrar
      </Button>
    </form>
  );
}
