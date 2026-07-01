import { StockLocationKind, type StockLocation } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function getBodegaLocation(): Promise<StockLocation> {
  const bodega = await prisma.stockLocation.findFirst({ where: { kind: StockLocationKind.BODEGA } });
  if (!bodega) throw new Error("No existe la bodega central.");
  return bodega;
}

export async function getQuioscoLocation(branchId: string): Promise<StockLocation> {
  const quiosco = await prisma.stockLocation.findUnique({
    where: { branchId_kind: { branchId, kind: StockLocationKind.QUIOSCO } }
  });
  if (!quiosco) throw new Error("La sucursal no tiene quiosco configurado.");
  return quiosco;
}

/** Ubicaciones que un admin de esta sucursal puede gestionar: bodega central + su quiosco. */
export async function getManageableLocations(branchId: string): Promise<[StockLocation, StockLocation]> {
  const [bodega, quiosco] = await Promise.all([getBodegaLocation(), getQuioscoLocation(branchId)]);
  return [bodega, quiosco];
}
