import { redirect } from "next/navigation";
import FacturaCrearPageClient from "@/components/facturacion/FacturaCrearPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listarPtoVentasCodArca } from "@/services/globalPtoVtas.service";
import {
  listarFacturaPtoVtasActivos,
  listarFacturasAutorizadasParaNc,
} from "@/services/facturaComprobantesListado.service";
import {
  obtenerBorradorDuplicarComprobante,
  obtenerBorradorNotaCreditoComprobante,
} from "@/services/facturaComprobantes.service";
import type { FacturaComprobanteDuplicarBorrador } from "@/lib/factura";

export const dynamic = "force-dynamic";
/** ARCA (emitir CAE) supera el default de Vercel (~10–15 s). */
export const maxDuration = 60;

type Props = {
  searchParams: Promise<{ duplicar?: string; nc?: string }>;
};

function conOriginalNc(
  originales: { id: string; label: string }[],
  borrador: FacturaComprobanteDuplicarBorrador | null
): { id: string; label: string }[] {
  if (!borrador?.cbteAsocId) return originales;
  if (originales.some((o) => o.id === borrador.cbteAsocId)) return originales;
  return [
    {
      id: borrador.cbteAsocId,
      label: (borrador.cbteAsocLabel ?? borrador.cbteAsocId).trim(),
    },
    ...originales,
  ];
}

export default async function FacturaCrearPage({ searchParams }: Props) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.facturacion.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  const { duplicar, nc } = await searchParams;

  let ptoVtas;
  let condicionesIva;
  let originalesNc;
  let duplicarBorrador = null;
  try {
    const extra = nc
      ? obtenerBorradorNotaCreditoComprobante(nc)
      : duplicar
        ? obtenerBorradorDuplicarComprobante(duplicar)
        : Promise.resolve(null);
    const [ptos, condIva, origNc, dup] = await Promise.all([
      listarFacturaPtoVtasActivos(),
      listarPtoVentasCodArca(),
      listarFacturasAutorizadasParaNc(),
      extra,
    ]);
    ptoVtas = ptos;
    condicionesIva = condIva;
    if (dup && dup.success) duplicarBorrador = dup.data;
    originalesNc = conOriginalNc(origNc, duplicarBorrador);
  } catch (e) {
    console.error(
      "[facturacion][crear]",
      e instanceof Error ? e.message : e
    );
    throw e;
  }

  return (
    <div className="area-page-shell">
      <FacturaCrearPageClient
        ptoVtas={ptoVtas}
        condicionesIva={condicionesIva}
        originalesNc={originalesNc}
        duplicarBorrador={duplicarBorrador}
      />
    </div>
  );
}
