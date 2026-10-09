import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import ControlComprobantesPageClient from "@/components/finanzas/ControlComprobantesPageClient";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listarControlComprobantes } from "@/services/controlComprobantes.service";
import { listarProveedoresMercaderiaPlazosPagos } from "@/services/proveedor.service";

export const dynamic = "force-dynamic";

export default async function ControlComprobantesPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }
  const esEditor = rol === "editor";
  const [raw, proveedoresMercaderia] = await Promise.all([
    listarControlComprobantes(),
    listarProveedoresMercaderiaPlazosPagos(),
  ]);
  const filas = raw.map((fila) => ({
    id: fila.id,
    fechaComp: fila.fechaComp,
    proveedorNombre: fila.proveedorNombre,
    proveedorPrefijo: fila.proveedorPrefijo,
    sucursalNombre: fila.sucursalNombre,
    pedidoHistoriaId: fila.pedidoHistoriaId,
    comprobante: fila.comprobante,
    total: fila.total.toFixed(2),
    montoAplicado: fila.montoAplicado.toFixed(2),
    vencimientoSaldo: fila.vencimientoSaldo.toFixed(2),
    controlado: fila.controlado,
    plazoPago1Dias: fila.plazoPago1Dias,
    plazoPago2Dias: fila.plazoPago2Dias,
    plazoPago3Dias: fila.plazoPago3Dias,
    plazoPago4Dias: fila.plazoPago4Dias,
    proveedorPlazo1Dias: fila.proveedorPlazo1Dias,
    proveedorPlazo2Dias: fila.proveedorPlazo2Dias,
    proveedorPlazo3Dias: fila.proveedorPlazo3Dias,
    proveedorPlazo4Dias: fila.proveedorPlazo4Dias,
    planPlazosLabel: fila.planPlazosLabel,
    fechaVenc: fila.fechaVenc,
  }));

  return (
    <ControlComprobantesPageClient
      filas={filas}
      proveedoresMercaderia={proveedoresMercaderia}
      esEditor={esEditor}
    />
  );
}
