-- Migrate OrderStatus: PAID/READY -> PENDING/PREPARING (simplified kiosk flow)
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING', 'PREPARING', 'DELIVERED', 'CANCELLED');

ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING (
  CASE "status"::text
    WHEN 'PAID' THEN 'PENDING'::"OrderStatus_new"
    WHEN 'PREPARING' THEN 'PREPARING'::"OrderStatus_new"
    WHEN 'READY' THEN 'PREPARING'::"OrderStatus_new"
    WHEN 'DELIVERED' THEN 'DELIVERED'::"OrderStatus_new"
    WHEN 'CANCELLED' THEN 'CANCELLED'::"OrderStatus_new"
  END
);

ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";

ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;
