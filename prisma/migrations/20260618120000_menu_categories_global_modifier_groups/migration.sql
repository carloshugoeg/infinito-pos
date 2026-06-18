-- Logica de menu: categorias de producto + grupos de modificadores globales.
--
-- 1) Product.category: agrupa el catalogo en secciones ("Fresas Clasicas" /
--    "Fresas Gourmet") para el kiosco. Nullable: productos sin categoria caen
--    en una seccion por defecto.
-- 2) ModifierGroup.isGlobal + productId nullable: un grupo global (productId
--    NULL, isGlobal true) representa la "lista global de extras" disponible en
--    todos los productos, una sola fuente editable en un solo lugar.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "category" TEXT;

-- AlterTable
ALTER TABLE "ModifierGroup" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "ModifierGroup" ADD COLUMN "isGlobal" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ModifierGroup_isGlobal_idx" ON "ModifierGroup"("isGlobal");
