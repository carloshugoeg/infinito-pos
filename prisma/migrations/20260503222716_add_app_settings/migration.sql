-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "companyName" TEXT NOT NULL DEFAULT 'Koi POS',
    "accentColor" TEXT NOT NULL DEFAULT '#ff9766',
    "sidebarColor" TEXT NOT NULL DEFAULT '#ffffff',
    "backgroundColor" TEXT NOT NULL DEFAULT '#ffe2d2',
    "logoUrl" TEXT,
    "currencySymbol" TEXT NOT NULL DEFAULT 'Q',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
