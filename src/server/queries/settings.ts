import { cache } from "react";
import { prisma } from "@/lib/db";

export const getAppSettings = cache(async () => {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "global" }
  });

  if (!settings) {
    return {
      id: "global",
      companyName: "Koi POS",
      accentColor: "#ff9766",
      backgroundColor: "#fdfaf8",
      currencySymbol: "Q",
      logoUrl: null,
      sidebarColor: "#ffffff"
    };
  }

  return settings;
});
