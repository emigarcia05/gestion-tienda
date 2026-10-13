import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import AppShell from "@/components/layout/AppShell";
import TooltipProvider from "@/components/providers/TooltipProvider";
import { ImportResultProvider } from "@/components/import/ImportResultContext";
import { getIdPersonalSesion, getRol } from "@/lib/sesion";
import { SESION_PATHNAME_HEADER } from "@/lib/sesion-arranque";
import { esRutaCuentaCorrientePublica } from "@/lib/cuentaCorrientePublica";
import { esRutaIngreso, RUTA_INGRESO } from "@/lib/ingreso";
import { obtenerUsuarioSesion } from "@/services/ingreso.service";
import { cn } from "@/lib/utils";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TiendaColor — Gestión",
  description: "Sistema de gestión e importación de productos para tienda",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = (await headers()).get(SESION_PATHNAME_HEADER) ?? "";
  const esPublica = esRutaIngreso(pathname) || esRutaCuentaCorrientePublica(pathname);
  const [rol, idPersonal] = await Promise.all([getRol(), getIdPersonalSesion()]);
  const usuario =
    esPublica || idPersonal == null ? null : await obtenerUsuarioSesion(idPersonal);
  if (!esPublica && usuario == null) redirect(RUTA_INGRESO);

  return (
    <html lang="es">
      <body
        className={cn(
          geistSans.variable,
          geistMono.variable,
          "antialiased min-h-screen bg-gris text-foreground",
        )}
      >
        <TooltipProvider>
          <ImportResultProvider>
            <AppShell rol={rol} usuario={usuario}>
              {children}
            </AppShell>
            <Toaster richColors position="bottom-right" />
          </ImportResultProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
