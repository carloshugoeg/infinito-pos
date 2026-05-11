import type { Metadata } from "next";
import { Fraunces, Nunito } from "next/font/google";
import "./globals.css";
import { getAppSettings } from "@/server/queries/settings";

const sans = Nunito({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAppSettings();
  return {
    title: settings.companyName,
    description: `Punto de venta para ${settings.companyName}`
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getAppSettings();

  return (
    <html lang="es">
      <body className={`${sans.variable} ${display.variable}`}>
        <style dangerouslySetInnerHTML={{
          __html: `
            :root {
              --primary: ${settings.accentColor};
              --background: ${settings.backgroundColor};
            }
          `
        }} />
        {children}
      </body>
    </html>
  );
}
