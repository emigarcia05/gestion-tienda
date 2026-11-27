import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import FinAnaMargenContribucionPageClient from "@/components/finanzas/FinAnaMargenContribucionPageClient";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { getDatosPaginaMargenContribucion } from "@/services/finAnaMargenContribucion.service";

export const dynamic = "force-dynamic";

export default async function FinAnaMargenContribucionPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const esEditor = rol === "editor";
  const {
    filasCostosFinancieros,
    descuentosPorColumna,
    formulas,
    categoriasMc,
  } = await getDatosPaginaMargenContribucion();

  return (
    <FinAnaMargenContribucionPageClient
      filasCostosFinancieros={filasCostosFinancieros}
      descuentosPorColumna={descuentosPorColumna}
      formulas={formulas}
      categoriasMc={categoriasMc}
      esEditor={esEditor}
    />
  );
}
