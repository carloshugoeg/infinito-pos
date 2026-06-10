-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('LOCAL', 'PERSONAL', 'SERVICIOS', 'INSUMOS_EXTRA', 'MARKETING', 'EQUIPO', 'IMPUESTOS', 'OTROS');

-- CreateEnum
CREATE TYPE "ExpenseFrequency" AS ENUM ('MONTHLY', 'BIWEEKLY', 'WEEKLY');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "costOfGoodsTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "grossProfit" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "lineCostSnapshot" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN     "unitCostSnapshot" DECIMAL(12,4) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "incurredOn" TIMESTAMP(3) NOT NULL,
    "paymentMethod" "PaymentMethod",
    "vendor" TEXT,
    "recurringId" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "frequency" "ExpenseFrequency" NOT NULL,
    "dayOfPeriod" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "forDate" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "sentTo" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_branchId_incurredOn_idx" ON "Expense"("branchId", "incurredOn");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE INDEX "Expense_recurringId_idx" ON "Expense"("recurringId");

-- CreateIndex
CREATE INDEX "RecurringExpense_branchId_idx" ON "RecurringExpense"("branchId");

-- CreateIndex
CREATE INDEX "RecurringExpense_active_idx" ON "RecurringExpense"("active");

-- CreateIndex
CREATE INDEX "EmailLog_branchId_forDate_idx" ON "EmailLog"("branchId", "forDate");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_branchId_forDate_kind_key" ON "EmailLog"("branchId", "forDate", "kind");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "RecurringExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
