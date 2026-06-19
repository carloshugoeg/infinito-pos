import { PrismaClient, Prisma, InventoryMovementType, UserRole } from "@prisma/client";

/**
 * Reset del INVENTARIO real de Infinito ("Iniciaremos de 0").
 *
 * Que hace (por sucursal):
 *  - Borra TODOS los movimientos de inventario (InventoryMovement) y el stock (BranchInventory).
 *  - Crea los ingredientes de inventario que faltan en el catalogo (Raffaello, Pasta de lotus).
 *  - Carga el conteo fisico real como stock inicial, dejando un movimiento ADJUSTMENT por ingrediente
 *    (auditable) con la cantidad cargada.
 *
 * Que NO toca: catalogo, recetas, ingredientes existentes, productos, modificadores ni ordenes.
 *
 * Idempotente: re-ejecutar deja el mismo estado (borra y vuelve a cargar el conteo de abajo).
 *
 * Conversion de "recetas" a gramos (hoja RECETAS de "INFINITO COSTOS"): 1 receta rinde
 *   Chocolate con leche = 1135 g | Chocolate blanco = 567.5 g | Crema = 2035 g
 *   Crema Rafaello = 160 g | Crema Lotus = 140 g | Crema Ferrero = 160 g
 *
 * Sucursal: BRANCH_CODE (si se define); si no, la unica sucursal activa.
 */

const prisma = new PrismaClient();

// Ingredientes de inventario que no existen aun en el catalogo (no entran en ninguna receta;
// se llevan solo para control de stock). Costo unitario tomado de la hoja COSTOS.
const NEW_INGREDIENTS: Array<{ name: string; unit: string; costPerUnit: number }> = [
  { name: "Raffaello", unit: "unidad", costPerUnit: 5.28 },
  { name: "Pasta de lotus", unit: "g", costPerUnit: 0.16 }
];

// Conteo fisico real (2026-06-19). [nombre exacto del ingrediente, cantidad en su unidad].
// Las bases caseras ya vienen convertidas de recetas a gramos.
const INVENTORY: Array<[string, number]> = [
  // Empaque / desechables (unidades)
  ["Vaso 12oz", 400],
  ["Tapadera", 100], // tapadera de vaso
  ["Servilleta", 500],
  ["Tenedor", 500],
  ["Souffle de chocolate con tapa", 50], // 50 souffle + 50 tapadera = 50 completos
  // Toppings (gramos)
  ["Topping Lotus", 600],
  ["Topping Oreo", 600],
  ["Topping Coco", 600],
  ["Topping Pistacho", 608],
  ["Topping Almendra", 908],
  ["Topping Granola", 1000], // "Granola" del conteo = Topping Granola del catalogo
  // Cobertura / cremas / fruta compradas (gramos / unidades)
  ["Nutella", 1000],
  ["Ferrero", 24],
  ["Galleta Lotus entera", 20],
  ["Galleta Oreo entera", 36],
  ["Raffaello", 30], // unidad entera (ingrediente nuevo)
  ["Pasta de lotus", 400], // gramos (ingrediente nuevo)
  // Bases caseras: recetas -> gramos
  ["Chocolate con leche (cobertura)", 5675], // 5 recetas x 1135 g
  ["Chocolate blanco (cobertura)", 4540], // 8 recetas x 567.5 g
  ["Crema", 6105], // 3 recetas x 2035 g
  ["Crema Rafaello", 320], // 2 recetas x 160 g
  ["Crema Lotus", 280], // 2 recetas x 140 g
  ["Crema Ferrero", 320] // 2 recetas x 160 g
];

const RESET_REASON = "Conteo inicial - reset inventario";

async function resolveBranch() {
  const code = process.env.BRANCH_CODE?.toUpperCase();
  if (code) {
    const branch = await prisma.branch.findUnique({ where: { code } });
    if (!branch) throw new Error(`No existe la sucursal con code=${code}.`);
    return branch;
  }
  const active = await prisma.branch.findMany({ where: { isActive: true } });
  if (active.length === 1) return active[0];
  throw new Error(
    `Hay ${active.length} sucursales activas; define BRANCH_CODE para elegir cual reiniciar.`
  );
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
    throw new Error(
      "Refusing to reset inventory in production. Set ALLOW_PROD_SEED=true only if you " +
        "truly intend to wipe and reload inventory in the production database."
    );
  }

  const branch = await resolveBranch();
  const admin = await prisma.user.findFirst({ where: { role: UserRole.ADMIN }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No hay usuario ADMIN para registrar los movimientos.");

  // 1) Asegurar ingredientes nuevos (idempotente, sin recetas).
  for (const ing of NEW_INGREDIENTS) {
    const existing = await prisma.ingredient.findFirst({ where: { name: ing.name } });
    if (existing) {
      await prisma.ingredient.update({ where: { id: existing.id }, data: { isActive: true } });
    } else {
      await prisma.ingredient.create({
        data: { name: ing.name, unit: ing.unit, costPerUnit: new Prisma.Decimal(ing.costPerUnit) }
      });
    }
  }

  // 2) Resolver ingredientes del conteo.
  const targets: Array<{ ingredientId: string; quantity: number }> = [];
  for (const [name, quantity] of INVENTORY) {
    const ingredient = await prisma.ingredient.findFirst({ where: { name } });
    if (!ingredient) throw new Error(`Ingrediente faltante en el catalogo: ${name}`);
    targets.push({ ingredientId: ingredient.id, quantity });
  }

  // 3) Reset + carga atomica para la sucursal.
  const result = await prisma.$transaction(async (tx) => {
    const deletedMovements = await tx.inventoryMovement.deleteMany({ where: { branchId: branch.id } });
    const deletedStock = await tx.branchInventory.deleteMany({ where: { branchId: branch.id } });

    for (const { ingredientId, quantity } of targets) {
      await tx.branchInventory.create({
        data: { branchId: branch.id, ingredientId, quantityOnHand: new Prisma.Decimal(quantity) }
      });
      await tx.inventoryMovement.create({
        data: {
          branchId: branch.id,
          ingredientId,
          type: InventoryMovementType.ADJUSTMENT,
          quantityDelta: new Prisma.Decimal(quantity),
          reason: RESET_REASON,
          createdById: admin.id
        }
      });
    }

    return { deletedMovements: deletedMovements.count, deletedStock: deletedStock.count };
  });

  console.log(
    `Reset inventario OK en sucursal ${branch.name} (${branch.code}): ` +
      `borrados ${result.deletedMovements} movimientos y ${result.deletedStock} filas de stock; ` +
      `cargados ${targets.length} ingredientes con conteo inicial.`
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
