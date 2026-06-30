import { UserRole } from "@prisma/client";
import { IngredientIcon } from "@/components/icons/ingredient-icon";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db";
import { formatCurrency, toNumber } from "@/lib/utils";
import {
  createModifierAction,
  createModifierGroupAction,
  createProductAction,
  createRecipeItemAction,
  removeModifierAction,
  removeModifierGroupAction,
  removeProductAction,
  removeRecipeItemAction,
  toggleModifierActiveAction,
  toggleModifierGroupActiveAction,
  toggleProductActiveAction,
  updateModifierAction,
  updateModifierGroupAction,
  updateProductAction,
  updateRecipeItemAction
} from "@/server/actions/admin-actions";
import { requireRole } from "@/server/auth";

export default async function CatalogPage() {
  await requireRole([UserRole.ADMIN]);
  const groupInclude = {
    modifiers: {
      include: { recipeItems: { include: { ingredient: true } } },
      orderBy: { name: "asc" as const }
    }
  };
  const [products, globalGroups, ingredients] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        modifierGroups: {
          where: { isGlobal: false },
          include: groupInclude,
          orderBy: { sortOrder: "asc" }
        },
        recipeItems: { include: { ingredient: true } }
      }
    }),
    prisma.modifierGroup.findMany({
      where: { isGlobal: true },
      include: groupInclude,
      orderBy: { sortOrder: "asc" }
    }),
    prisma.ingredient.findMany({ orderBy: { name: "asc" } })
  ]);
  const modifiers = [
    ...products.flatMap((product) =>
      product.modifierGroups.flatMap((group) => group.modifiers.map((modifier) => ({ ...modifier, label: `${product.name} / ${group.name} / ${modifier.name}` })))
    ),
    ...globalGroups.flatMap((group) => group.modifiers.map((modifier) => ({ ...modifier, label: `Global / ${group.name} / ${modifier.name}` })))
  ];
  const categories = Array.from(new Set(products.map((product) => product.category).filter((category): category is string => Boolean(category))));

  return (
    <AppShell title="Catalogo y recetas">
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.5fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Nuevo producto</CardTitle></CardHeader>
            <CardContent>
              <form action={createProductAction} className="space-y-3">
                <div><Label>Nombre</Label><Input name="name" required /></div>
                <div><Label>Descripcion</Label><Input name="description" /></div>
                <div><Label>Categoria</Label><Input name="category" list="catalog-categories" placeholder="Fresas Clasicas / Fresas Gourmet" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Precio local</Label><Input name="basePrice" type="number" step="0.01" required /></div>
                  <div><Label>Precio delivery</Label><Input name="deliveryPrice" type="number" step="0.01" placeholder="igual al local" /></div>
                </div>
                <div><Label>Orden</Label><Input name="sortOrder" type="number" defaultValue="0" /></div>
                <Button type="submit">Crear producto</Button>
              </form>
              <datalist id="catalog-categories">
                {categories.map((category) => <option value={category} key={category} />)}
              </datalist>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Grupo de modificadores</CardTitle></CardHeader>
            <CardContent>
              <form action={createModifierGroupAction} className="space-y-3">
                <div><Label>Producto</Label><select name="productId" className="touch-target w-full rounded-md border border-[var(--border)] bg-white px-3"><option value="">(Global - todos los productos)</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></div>
                <div><Label>Nombre</Label><Input name="name" required /></div>
                <label className="flex items-center gap-2 text-sm"><input name="isRequired" type="checkbox" /> Obligatorio</label>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Min</Label><Input name="minSelections" type="number" defaultValue="0" /></div>
                  <div><Label>Max</Label><Input name="maxSelections" type="number" defaultValue="1" /></div>
                </div>
                <Button type="submit">Crear grupo</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Nuevo modificador</CardTitle></CardHeader>
            <CardContent>
              <form action={createModifierAction} className="space-y-3">
                <div><Label>Grupo</Label><select name="modifierGroupId" className="touch-target w-full rounded-md border border-[var(--border)] bg-white px-3">{products.flatMap((product) => product.modifierGroups.map((group) => <option value={group.id} key={group.id}>{product.name} / {group.name}</option>))}{globalGroups.map((group) => <option value={group.id} key={group.id}>Global / {group.name}</option>)}</select></div>
                <div><Label>Nombre</Label><Input name="name" required /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Extra local</Label><Input name="priceDelta" type="number" step="0.01" defaultValue="0" /></div>
                  <div><Label>Extra delivery</Label><Input name="deliveryPriceDelta" type="number" step="0.01" placeholder="igual al local" /></div>
                </div>
                <Button type="submit">Crear modificador</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Agregar receta</CardTitle></CardHeader>
            <CardContent>
              <form action={createRecipeItemAction} className="space-y-3">
                <div><Label>Tipo</Label><select name="ownerType" className="touch-target w-full rounded-md border border-[var(--border)] bg-white px-3"><option value="product">Producto</option><option value="modifier">Modificador</option></select></div>
                <div><Label>ID producto o modificador</Label><select name="ownerId" className="touch-target w-full rounded-md border border-[var(--border)] bg-white px-3">{products.map((product) => <option value={product.id} key={product.id}>Producto: {product.name}</option>)}{modifiers.map((modifier) => <option value={modifier.id} key={modifier.id}>Mod: {modifier.label}</option>)}</select></div>
                <div><Label>Ingrediente</Label><select name="ingredientId" className="touch-target w-full rounded-md border border-[var(--border)] bg-white px-3">{ingredients.map((ingredient) => <option value={ingredient.id} key={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>)}</select></div>
                <div><Label>Cantidad</Label><Input name="quantity" type="number" step="0.001" required /></div>
                <Button type="submit">Agregar receta</Button>
              </form>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader><CardTitle>Productos configurados</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-6">
            {products.map((product) => (
              <div key={product.id} className="rounded-[1.5rem] border border-[var(--border)] p-4">
                <form action={updateProductAction} className="grid gap-3 xl:grid-cols-[1fr_1fr_0.8fr_0.5fr_0.5fr_0.4fr_auto]">
                  <input type="hidden" name="id" value={product.id} />
                  <div><Label>Producto</Label><Input name="name" defaultValue={product.name} required /></div>
                  <div><Label>Descripcion</Label><Input name="description" defaultValue={product.description ?? ""} /></div>
                  <div><Label>Categoria</Label><Input name="category" list="catalog-categories" defaultValue={product.category ?? ""} /></div>
                  <div><Label>Precio local</Label><Input name="basePrice" type="number" step="0.01" defaultValue={toNumber(product.basePrice)} required /></div>
                  <div><Label>Precio delivery</Label><Input name="deliveryPrice" type="number" step="0.01" defaultValue={toNumber(product.deliveryPrice)} required /></div>
                  <div><Label>Orden</Label><Input name="sortOrder" type="number" defaultValue={product.sortOrder} /></div>
                  <div className="flex items-end"><Button type="submit" variant="secondary">Guardar</Button></div>
                </form>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-black text-[var(--muted-foreground)]">
                    {product.isActive ? "Activo" : "Inactivo"} · Local {formatCurrency(toNumber(product.basePrice))} · Delivery {formatCurrency(toNumber(product.deliveryPrice))}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <form action={toggleProductActiveAction}>
                      <input type="hidden" name="id" value={product.id} />
                      <input type="hidden" name="isActive" value={String(!product.isActive)} />
                      <Button type="submit" variant="outline" size="sm">{product.isActive ? "Desactivar" : "Activar"}</Button>
                    </form>
                    <form action={removeProductAction}>
                      <input type="hidden" name="id" value={product.id} />
                      <Button type="submit" variant="danger" size="sm">Eliminar/desactivar</Button>
                    </form>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  <h3 className="text-sm font-black uppercase text-[var(--muted-foreground)]">Grupos y modificadores</h3>
                  {product.modifierGroups.map((group) => (
                    <ModifierGroupBlock key={group.id} group={group} ingredients={ingredients} />
                  ))}
                </div>

                <RecipeList items={product.recipeItems} ingredients={ingredients} ownerLabel="Receta base" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Extras globales</CardTitle>
          <p className="mt-1 text-sm font-medium text-[var(--muted-foreground)]">
            Lista unica de extras disponible en todos los productos. Se edita aqui una sola vez.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {globalGroups.length === 0 ? (
            <span className="text-sm text-[var(--muted-foreground)]">
              No hay grupos globales. Crea uno con Producto = &quot;(Global)&quot; en el formulario de la izquierda.
            </span>
          ) : null}
          {globalGroups.map((group) => (
            <ModifierGroupBlock key={group.id} group={group} ingredients={ingredients} />
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function ModifierGroupBlock({
  group,
  ingredients
}: {
  group: {
    id: string;
    name: string;
    minSelections: number;
    maxSelections: number;
    sortOrder: number;
    isRequired: boolean;
    isActive: boolean;
    modifiers: Array<{
      id: string;
      name: string;
      priceDelta: unknown;
      deliveryPriceDelta: unknown;
      sortOrder: number;
      isActive: boolean;
      recipeItems: Array<{ id: string; ingredientId: string; quantity: unknown; ingredient: { id: string; name: string; unit: string } }>;
    }>;
  };
  ingredients: Array<{ id: string; name: string; unit: string }>;
}) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--field)] p-3">
      <form action={updateModifierGroupAction} className="grid gap-2 lg:grid-cols-[1fr_0.5fr_0.5fr_0.5fr_auto]">
        <input type="hidden" name="id" value={group.id} />
        <div><Label>Grupo</Label><Input name="name" defaultValue={group.name} required /></div>
        <div><Label>Min</Label><Input name="minSelections" type="number" defaultValue={group.minSelections} /></div>
        <div><Label>Max</Label><Input name="maxSelections" type="number" defaultValue={group.maxSelections} /></div>
        <div><Label>Orden</Label><Input name="sortOrder" type="number" defaultValue={group.sortOrder} /></div>
        <div className="flex items-end"><Button type="submit" variant="secondary" size="sm">Guardar grupo</Button></div>
        <label className="flex items-center gap-2 text-sm font-bold lg:col-span-5">
          <input name="isRequired" type="checkbox" defaultChecked={group.isRequired} /> Obligatorio
        </label>
      </form>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-black text-[var(--muted-foreground)]">{group.isActive ? "Activo" : "Inactivo"}</span>
        <div className="flex flex-wrap gap-2">
          <form action={toggleModifierGroupActiveAction}>
            <input type="hidden" name="id" value={group.id} />
            <input type="hidden" name="isActive" value={String(!group.isActive)} />
            <Button type="submit" variant="outline" size="sm">{group.isActive ? "Desactivar" : "Activar"}</Button>
          </form>
          <form action={removeModifierGroupAction}>
            <input type="hidden" name="id" value={group.id} />
            <Button type="submit" variant="danger" size="sm">Eliminar/desactivar</Button>
          </form>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {group.modifiers.map((modifier) => (
          <div key={modifier.id} className="rounded-2xl border border-[var(--border)] bg-white p-3">
            <form action={updateModifierAction} className="grid gap-2 lg:grid-cols-[1fr_0.6fr_0.6fr_0.5fr_auto]">
              <input type="hidden" name="id" value={modifier.id} />
              <div><Label>Modificador</Label><Input name="name" defaultValue={modifier.name} required /></div>
              <div><Label>Extra local</Label><Input name="priceDelta" type="number" step="0.01" defaultValue={toNumber(modifier.priceDelta)} /></div>
              <div><Label>Extra delivery</Label><Input name="deliveryPriceDelta" type="number" step="0.01" defaultValue={toNumber(modifier.deliveryPriceDelta)} /></div>
              <div><Label>Orden</Label><Input name="sortOrder" type="number" defaultValue={modifier.sortOrder} /></div>
              <div className="flex items-end"><Button type="submit" variant="secondary" size="sm">Guardar</Button></div>
            </form>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black text-[var(--muted-foreground)]">
                {modifier.isActive ? "Activo" : "Inactivo"} · Local {formatCurrency(toNumber(modifier.priceDelta))} · Delivery {formatCurrency(toNumber(modifier.deliveryPriceDelta))}
              </span>
              <div className="flex flex-wrap gap-2">
                <form action={toggleModifierActiveAction}>
                  <input type="hidden" name="id" value={modifier.id} />
                  <input type="hidden" name="isActive" value={String(!modifier.isActive)} />
                  <Button type="submit" variant="outline" size="sm">{modifier.isActive ? "Desactivar" : "Activar"}</Button>
                </form>
                <form action={removeModifierAction}>
                  <input type="hidden" name="id" value={modifier.id} />
                  <Button type="submit" variant="danger" size="sm">Eliminar/desactivar</Button>
                </form>
              </div>
            </div>
            <RecipeList items={modifier.recipeItems} ingredients={ingredients} ownerLabel="Receta del modificador" />
          </div>
        ))}
      </div>
    </div>
  );
}

function RecipeList({
  items,
  ingredients,
  ownerLabel
}: {
  items: Array<{ id: string; ingredientId: string; quantity: unknown; ingredient: { id: string; name: string; unit: string } }>;
  ingredients: Array<{ id: string; name: string; unit: string }>;
  ownerLabel: string;
}) {
  return (
    <div className="mt-3 flex flex-col gap-2 text-sm">
      <strong>{ownerLabel}</strong>
      {items.length === 0 ? <span className="text-[var(--muted-foreground)]">Sin receta</span> : null}
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
        <IngredientIcon name={item.ingredient.name} size={18} />
        <form action={updateRecipeItemAction} className="grid flex-1 gap-2 rounded-2xl border border-[var(--border)] bg-white p-2 sm:grid-cols-[1fr_0.5fr_auto_auto]">
          <input type="hidden" name="id" value={item.id} />
          <select name="ingredientId" defaultValue={item.ingredientId} className="touch-target w-full rounded-md border border-[var(--border)] bg-white px-3">
            {ingredients.map((ingredient) => <option value={ingredient.id} key={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>)}
          </select>
          <Input name="quantity" type="number" step="0.001" defaultValue={toNumber(item.quantity)} required />
          <Button type="submit" variant="secondary" size="sm">Guardar</Button>
          <Button formAction={removeRecipeItemAction} type="submit" variant="danger" size="sm">Quitar</Button>
        </form>
        </div>
      ))}
    </div>
  );
}
