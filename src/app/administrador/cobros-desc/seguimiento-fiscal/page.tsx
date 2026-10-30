import { redirect } from "next/navigation";
import SeguimientoFiscalPageClient from "@/components/vtas-cobros/SeguimientoFiscalPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listarFacturaFiscalObligatoria } from "@/services/facturaFiscalObligatoria.service";
import { listarPtoVtaFacturaFilas } from "@/services/ptoVtaFactura.service";
import { listarSeguimientoFiscalData } from "@/services/seguimientoFiscal.service";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ periodo?: string }>;
}

export default async function SeguimientoFiscalPage({ searchParams }: Props) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const [data, ptoVtaFactura, facturaObligatoria] = await Promise.all([
    listarSeguimientoFiscalData(await searchParams),
    listarPtoVtaFacturaFilas(),
    listarFacturaFiscalObligatoria(),
  ]);

  return (
    <SeguimientoFiscalPageClient
      data={data}
      ptoVtaFactura={ptoVtaFactura}
      facturaObligatoria={facturaObligatoria}
      esEditor={rol === "editor"}
    />
  );
}
