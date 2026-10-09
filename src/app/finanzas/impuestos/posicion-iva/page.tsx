import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import FinanzasBalancePosicionIvaPage from "@/components/finanzas/FinanzasBalancePosicionIvaPage";
import { mesAnioCalendarioArgentina } from "@/services/finBalGastoMensualBalance.service";
import { listarIvaDebitoFinBalPorAnio } from "@/services/finBalIvaDeb.service";
import { sumarIvaCreditoPorMesAnio } from "@/services/finBalPosicionIva.service";
import { listarSaldoManualPosicionIvaPorAnio } from "@/services/finBalPosicionIvaSaldoManual.service";
import { getEstadoIvaComparacionPedido } from "@/services/finBalPosicionIvaComparacionPedido.service";
import { PERMISOS, puede } from "@/lib/permisos";
import { esEditor, getRol } from "@/lib/sesion";

export const dynamic = "force-dynamic";

const ANIO_MIN = 2026;
const ANIO_MAX = 2046;

function clampAnio(a: number): number {
  return Math.min(ANIO_MAX, Math.max(ANIO_MIN, a));
}

export default async function FinanzasPosicionIvaPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const editor = await esEditor();
  const { anio: anioCalendarioActualRaw } = mesAnioCalendarioArgentina();
  const anio = clampAnio(anioCalendarioActualRaw);

  const [ivaDebitoPorMes, ivaCreditoPorMes, saldoManualPorMes, comparacionPedidos] = await Promise.all([
    listarIvaDebitoFinBalPorAnio(anio),
    sumarIvaCreditoPorMesAnio(anio),
    listarSaldoManualPosicionIvaPorAnio(anio),
    getEstadoIvaComparacionPedido(),
  ]);

  return (
    <FinanzasBalancePosicionIvaPage
      anio={anio}
      esEditor={editor}
      ivaDebitoPorMes={ivaDebitoPorMes}
      ivaCreditoPorMes={ivaCreditoPorMes}
      saldoManualPorMes={saldoManualPorMes}
      comparacionPedidos={comparacionPedidos}
    />
  );
}
