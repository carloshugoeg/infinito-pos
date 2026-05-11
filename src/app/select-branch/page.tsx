import { setActiveBranchAction } from "@/server/actions/auth-actions";
import { requireUser } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SelectBranchPage() {
  const { user } = await requireUser();
  const branches = user.branches.map((item) => item.branch).filter((branch) => branch.isActive);

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Selecciona sucursal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {branches.map((branch) => (
            <form action={setActiveBranchAction} key={branch.id}>
              <input type="hidden" name="branchId" value={branch.id} />
              <Button type="submit" variant="secondary" className="w-full justify-between">
                <span>{branch.name}</span>
                <span className="text-xs text-[var(--muted-foreground)]">{branch.code}</span>
              </Button>
            </form>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
