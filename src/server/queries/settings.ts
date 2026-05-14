import { cache } from "react";
import { prisma } from "@/lib/db";

const defaultSettings = {
  id: "global",
  companyName: "Koi POS",
  accentColor: "#ff9766",
  backgroundColor: "#fdfaf8",
  currencySymbol: "Q",
  logoUrl: null,
  sidebarColor: "#ffffff",
  modifierGridEnabled: false
};

export const getAppSettings = cache(async () => {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "global" }
    });

    return settings ?? defaultSettings;
  } catch {
    return defaultSettings;
  }
});
