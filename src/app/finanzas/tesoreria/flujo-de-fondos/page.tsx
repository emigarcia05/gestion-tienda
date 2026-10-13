import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import FinanzasVencPorFechaPageClient from "@/components/finanzas/FinanzasVencPorFechaPageClient";
import {
  addDaysToIsoYmdArgentina,
  dateToIsoYmdArgentina,
} from "@/lib/fechaArgentina";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import {
  FLUJO_FONDO_DETALLE_MERCADERIA,
  listarVencimientosEnRango,
  ordenarDetallesFlujoDia,
  type FlujoFondoDetalleDiaFila,
  sumarSaldoVencimientosConFechaVencAnteriorA,
} from "@/services/vencimientosPorFecha.service";
import {
  listarVencimientosGastoFlujoEnRango,
  sumarPendienteGastosConFechaVencAnteriorA,
} from "@/services/finBalGastoMensualBalance.service";
import { listarCajasTesoreria } from "@/services/cajasTesoreria.service";
import { listarIngresosCajaPorFechaAcreditacion } from "@/services/tesoreriaMovimientos.service";
import {
  FLUJO_FONDO_DETALLE_ECHEQ,
  listarChequesEmitidosPendientesEnRango,
} from "@/services/tesoreriaChequesEmitidos.service";
import type { FilaFlujoDeFondoVista } from "@/components/finanzas/TablaFlujoDeFondo";
import { calcularFilasFlujoDeFondo } from "@/lib/flujoDeFondoFilas";
import { PAGE_SIZE, skipForPagina, totalPaginasFromTotal } from "@/lib/pagination";

export const dynamic = "force-dynamic";

/** Ventana fija: desde hoy (AR) hasta 150 días adelante (inclusive). */
const DIAS_VENTANA_VENC_POR_FECHA = 150;

function claveDiaFechaVenc(fechaVenc: string | Date): string {
  if (typeof fechaVenc === "string") {
    return fechaVenc.length >= 10 ? fechaVenc.slice(0, 10) : fechaVenc;
  }
  return dateToIsoYmdArgentina(fechaVenc);
}

function sortFechaCompToIso(fechaComp: string): string {
  return fechaComp.length >= 10 ? fechaComp.slice(0, 10) : fechaComp;
}

interface Props {
  searchParams: Promise<{
    pagina?: string;
  }>;
}

export default async function VencPorFechaPage({ searchParams }: Props) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }
  const { pagina = "1" } = await searchParams;
  const paginaSolicitada = Math.max(1, parseInt(pagina, 10) || 1);

  const hoyIso = dateToIsoYmdArgentina(new Date());
  const hastaIso = addDaysToIsoYmdArgentina(hoyIso, DIAS_VENTANA_VENC_POR_FECHA);

  const [
    lineasCompra,
    lineasGasto,
    saldoComprasAntes,
    saldoGastosAntes,
    cajasTesoreria,
    ingresosPorDia,
    echeqsPendientes,
  ] = await Promise.all([
    listarVencimientosEnRango(hoyIso, hastaIso),
    listarVencimientosGastoFlujoEnRango(hoyIso, hastaIso),
    sumarSaldoVencimientosConFechaVencAnteriorA(hoyIso),
    sumarPendienteGastosConFechaVencAnteriorA(hoyIso),
    listarCajasTesoreria(),
    listarIngresosCajaPorFechaAcreditacion(hoyIso, hastaIso),
    /** Desde mañana: el EGRESO de un eCheq con pago hoy ya descuenta de `montoDisponible`. */
    listarChequesEmitidosPendientesEnRango(addDaysToIsoYmdArgentina(hoyIso, 1), hastaIso),
  ]);
  const saldoVencidoAntesDeHoy = saldoComprasAntes + saldoGastosAntes;

  const cajaDisponibleInicial = cajasTesoreria.reduce(
    (acc, caja) => acc + Number(caja.montoDisponible || 0),
    0
  );

  const totalPorDia: Record<string, number> = {};
  const acumDetalle: Record<string, FlujoFondoDetalleDiaFila[]> = {};

  for (const l of lineasCompra) {
    const key = claveDiaFechaVenc(l.fechaVenc);
    if (key < hoyIso || key > hastaIso) continue;
    const m = Number(l.saldo);
    totalPorDia[key] = (totalPorDia[key] ?? 0) + m;
    if (!acumDetalle[key]) acumDetalle[key] = [];
    acumDetalle[key].push({
      fechaDevengadaIso: sortFechaCompToIso(l.fechaComp),
      fechaVencimientoIso: key,
      proveedor: l.nombre.trim().toUpperCase(),
      proveedorPrefijo: (l.prefijo ?? "").trim().toUpperCase(),
      detalle: FLUJO_FONDO_DETALLE_MERCADERIA,
      monto: m,
      sortFecha: sortFechaCompToIso(l.fechaComp),
      sortId: l.comprobanteId,
    });
  }

  for (const g of lineasGasto) {
    const key = g.fechaVenc;
    totalPorDia[key] = (totalPorDia[key] ?? 0) + g.monto;
    if (!acumDetalle[key]) acumDetalle[key] = [];
    acumDetalle[key].push({
      fechaDevengadaIso: g.devengoIso,
      fechaVencimientoIso: g.fechaVenc,
      proveedor: g.proveedor,
      proveedorPrefijo: g.proveedorPrefijo,
      detalle: g.detalle,
      monto: g.monto,
      sortFecha: g.devengoIso,
      sortId: g.imputacionId,
    });
  }

  for (const e of echeqsPendientes) {
    const key = e.fechaPagoIso;
    totalPorDia[key] = (totalPorDia[key] ?? 0) + e.monto;
    if (!acumDetalle[key]) acumDetalle[key] = [];
    acumDetalle[key].push({
      fechaDevengadaIso: e.fechaEmisionIso,
      fechaVencimientoIso: key,
      proveedor: e.proveedorNombre,
      proveedorPrefijo: e.proveedorPrefijo,
      detalle: e.numero ? `${FLUJO_FONDO_DETALLE_ECHEQ} N° ${e.numero}` : FLUJO_FONDO_DETALLE_ECHEQ,
      monto: e.monto,
      sortFecha: e.fechaEmisionIso,
      sortId: e.id,
    });
  }

  const detallesPorDia: Record<string, FlujoFondoDetalleDiaFila[]> = Object.fromEntries(
    Object.entries(acumDetalle).map(([isoYmd, filas]) => [isoYmd, ordenarDetallesFlujoDia(filas)])
  );

  const filasTotales: Array<{ isoYmd: string; vencimientoDelDia: number }> = [];
  for (
    let iso = hoyIso;
    iso <= hastaIso;
    iso = addDaysToIsoYmdArgentina(iso, 1)
  ) {
    filasTotales.push({
      isoYmd: iso,
      vencimientoDelDia: totalPorDia[iso] ?? 0,
    });
  }

  /** Ingresos de caja del día (`fecha_acreditacion`) para ajustar SALDO diario. */
  const ingresosAcreditadosPorDia = new Map<string, number>();
  for (const { isoYmd } of filasTotales) {
    const totalDia = (ingresosPorDia[isoYmd] ?? []).reduce(
      (acc, row) => acc + row.montoAcreditado,
      0
    );
    ingresosAcreditadosPorDia.set(isoYmd, totalDia);
  }

  const filasCompletas: FilaFlujoDeFondoVista[] = calcularFilasFlujoDeFondo(filasTotales, {
    cajaDisponibleInicial,
    saldoVencidoAntesDeHoy,
    ingresosAcreditadosPorDia,
  });

  const total = filasCompletas.length;
  const totalPaginas = totalPaginasFromTotal(total, PAGE_SIZE);
  const paginaActual = Math.min(paginaSolicitada, totalPaginas);
  const inicio = skipForPagina(paginaActual, PAGE_SIZE);
  const filas = filasCompletas.slice(inicio, inicio + PAGE_SIZE);

  const nombresProveedores = new Set<string>();
  for (const l of lineasCompra) nombresProveedores.add(l.nombre.trim().toUpperCase());
  for (const g of lineasGasto) nombresProveedores.add(g.proveedor);
  for (const e of echeqsPendientes) nombresProveedores.add(e.proveedorNombre);
  const proveedoresConVencimientos = [...nombresProveedores].sort((a, b) =>
    a.localeCompare(b, "es")
  );

  return (
    <div className="area-page-shell">
      <FinanzasVencPorFechaPageClient
        detallesPorDia={detallesPorDia}
        ingresosPorDia={ingresosPorDia}
        proveedoresConVencimientos={proveedoresConVencimientos}
        filas={filas}
        paginaActual={paginaActual}
        totalPaginas={totalPaginas}
        total={total}
      />
    </div>
  );
}
