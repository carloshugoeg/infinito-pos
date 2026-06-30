-- Precio de delivery por producto y por extra. La venta por delivery cobra
-- mas que en el local (la plataforma se queda con una comision). Cada producto
-- y cada extra tienen su propio precio de delivery, independiente del local.
--
-- Backfill: los registros existentes arrancan con el precio de delivery igual
-- al precio local; el admin los ajusta despues en Catalogo.

-- Product.deliveryPrice
ALTER TABLE "Product" ADD COLUMN "deliveryPrice" DECIMAL(12,2);
UPDATE "Product" SET "deliveryPrice" = "basePrice" WHERE "deliveryPrice" IS NULL;
ALTER TABLE "Product" ALTER COLUMN "deliveryPrice" SET NOT NULL;

-- Modifier.deliveryPriceDelta
ALTER TABLE "Modifier" ADD COLUMN "deliveryPriceDelta" DECIMAL(12,2);
UPDATE "Modifier" SET "deliveryPriceDelta" = "priceDelta" WHERE "deliveryPriceDelta" IS NULL;
ALTER TABLE "Modifier" ALTER COLUMN "deliveryPriceDelta" SET NOT NULL;
