"use server";

import { revalidatePath } from "next/cache";
import { revalidatePedidoUrgenteTrasCambioIvaSaldo } from "@/lib/revalidatePedidoUrgenteTrasCambioIvaSaldo";
import { requireCargarGastoEventual, requireEditorFinanzas, requireFinanzasLectura } from "@/lib/actionGates";
import type { ActionResult } from "@/lib/types";
import {
  cargarImputacionesMesParamsSchema,
  crearImputacionGastoUnicoBalanceSchema,
  editarMontoFinBalGastoMensualSchema,
  eliminarFinBalGastoMensualSchema,
  historicoMontosGastoFinalBalanceSchema,
  serieHistorialFilaBalanceSchema,
  listarGastosFinalesNoMensualesParamsSchema,
  mesAnioQuerySchema,
  obtenerMontoMesAnteriorSchema,
  registrarPagoFinBalGastoMensualSchema,
} from "@/lib/validations/finBalGastoMensualBalance";
import {
  actualizarMontoFinBalGastoMensual,
  actualizarPagadoFinBalGastoMensual,
  cargarImputacionesMensualesDesdeCatalogo,
  crearImputacionGastoUnicoBalance,
  eliminarFinBalGastoMensual,
  listarGastosFinalesNoMensualesConEstadoPeriodo,
  listarHistoricoMontosGastoFinalBalance,
  listarImputacionesMensualesBalance,
  listarPendientesDiscriminaIvaCargaMesCatalogo,
  mesAnioCalendarioArgentina,
  obtenerMontoImputacionMesAnterior,
  type BalanceGastoMensualFila,
  type FinBalGastoFinalNoMensualListItem,
  type HistoricoMontoGastoFinalBalanceItem,
  type PendienteDiscriminaIvaCargaMesItem,
} from "@/services/finBalGastoMensualBalance.service";
import { listarSerieHistorialFilaBalanceMensual } from "@/services/balanceMensualHistorialFila.service";
import {
  listarSucursalesGeneraBalance,
  ventasPorSucursalNombreMes,
} from "@/services/ventasMensuales.service";

function revalidateGastosPaths(): void {
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/balance/gastos");
  revalidatePedidoUrgenteTrasCambioIvaSaldo();
}

function firstZodErrorMessage(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] };
}): string {
  const flattened = error.flatten();
  return (
    [...Object.values(flattened.fieldErrors).flat(), ...flattened.formErrors][0] ??
    "Datos inválidos."
  );
}



/** Carga imputaciones del mes `(mes, anio)` desde el catálogo (`gasto_mensual = true`). */
export async function cargarFinBalGastoMensualMesAction(
  raw?: unknown
): Promise<ActionResult<{ creados: number; yaExistentes: number }>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const def = mesAnioCalendarioArgentina();
  const parsed = cargarImputacionesMesParamsSchema.safeParse(
    raw && typeof raw === "object" && raw !== null ? raw : { mes: def.mes, anio: def.anio }
  );
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const res = await cargarImputacionesMensualesDesdeCatalogo(parsed.data);
  if (!res.success) return { ok: false, error: res.error };

  revalidateGastosPaths();
  return { ok: true, data: res.data };
}

/** Lista gastos mensuales del catálogo (política `PREGUNTA`) pendientes de decisión de IVA antes de cargar el mes. */
export async function listarPendientesDiscriminaIvaCargaMesAction(
  raw?: unknown
): Promise<ActionResult<{ pendientesPregunta: PendienteDiscriminaIvaCargaMesItem[] }>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const def = mesAnioCalendarioArgentina();
  const parsed = cargarImputacionesMesParamsSchema.safeParse(
    raw && typeof raw === "object" && raw !== null ? raw : { mes: def.mes, anio: def.anio }
  );
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const { mes, anio } = parsed.data;
  const res = await listarPendientesDiscriminaIvaCargaMesCatalogo({ mes, anio });
  if (!res.success) return { ok: false, error: res.error };
  return { ok: true, data: res.data };
}

/** Catálogo de gastos finales con `gasto_mensual = false` y estado en el periodo. */
export async function listarFinBalGastosFinalesNoMensualesAction(
  raw: unknown
): Promise<ActionResult<FinBalGastoFinalNoMensualListItem[]>> {
  const gate = await requireCargarGastoEventual();
  if (gate) return gate;

  const parsed = listarGastosFinalesNoMensualesParamsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  try {
    const data = await listarGastosFinalesNoMensualesConEstadoPeriodo(parsed.data);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : "No se pudieron listar los gastos únicos del período.";
    return { ok: false, error: msg };
  }
}

/** Alta de imputación mensual para un gasto único (`gasto_mensual = false`) en el periodo. */
export async function crearFinBalImputacionGastoUnicoAction(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireCargarGastoEventual();
  if (gate) return gate;

  const parsed = crearImputacionGastoUnicoBalanceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const res = await crearImputacionGastoUnicoBalance(parsed.data);
  if (!res.success) return { ok: false, error: res.error };

  revalidateGastosPaths();
  return { ok: true, data: res.data };
}

export async function editarMontoFinBalGastoMensualAction(
  raw: unknown
): Promise<ActionResult<{ id: string; monto: number }>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = editarMontoFinBalGastoMensualSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const res = await actualizarMontoFinBalGastoMensual(parsed.data);
  if (!res.success) return { ok: false, error: res.error };

  revalidateGastosPaths();
  return { ok: true, data: res.data };
}

export async function registrarPagoFinBalGastoMensualAction(
  raw: unknown
): Promise<ActionResult<{ id: string; pagado: number }>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = registrarPagoFinBalGastoMensualSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const res = await actualizarPagadoFinBalGastoMensual(parsed.data);
  if (!res.success) return { ok: false, error: res.error };

  revalidateGastosPaths();
  return { ok: true, data: res.data };
}

export async function eliminarFinBalGastoMensualAction(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = eliminarFinBalGastoMensualSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const res = await eliminarFinBalGastoMensual(parsed.data.id);
  if (!res.success) return { ok: false, error: res.error };

  revalidateGastosPaths();
  return { ok: true, data: res.data };
}

/** Monto de la imputación del mes calendario **anterior** al dado, mismo `gasto_final_id`. */
export async function obtenerMontoMesAnteriorFinBalGastoMensualAction(
  raw: unknown
): Promise<ActionResult<{ monto: number | null }>> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;

  const parsed = obtenerMontoMesAnteriorSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  try {
    const monto = await obtenerMontoImputacionMesAnterior(parsed.data);
    return { ok: true, data: { monto } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudo obtener el monto del mes anterior.";
    return { ok: false, error: msg };
  }
}

/** Serie mensual de imputaciones de un gasto final (balance mensual · gráfico). */
export async function listarHistoricoMontosGastoFinalBalanceAction(
  raw: unknown,
): Promise<ActionResult<HistoricoMontoGastoFinalBalanceItem[]>> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;

  const parsed = historicoMontosGastoFinalBalanceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  try {
    const data = await listarHistoricoMontosGastoFinalBalance(parsed.data.gastoFinalId);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : "No se pudo cargar el histórico de montos del gasto.";
    return { ok: false, error: msg };
  }
}

/** Serie mensual del total de una fila de la grilla (columna global o sucursal), misma regla que el resumen. */
export async function listarSerieHistorialFilaBalanceMensualAction(
  raw: unknown,
): Promise<ActionResult<HistoricoMontoGastoFinalBalanceItem[]>> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;

  const parsed = serieHistorialFilaBalanceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  try {
    const data = await listarSerieHistorialFilaBalanceMensual(parsed.data);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : "No se pudo cargar el histórico de la fila del balance.";
    return { ok: false, error: msg };
  }
}

/** Imputaciones del mes y ventas (comprobantes, `ventasMensuales.service`) para armar el mismo resumen que la página (p. ej. desglose al elegir una barra del historial). */
export async function cargarFilasBalanceMensualPeriodoAction(
  raw: unknown,
): Promise<
  ActionResult<{
    filas: BalanceGastoMensualFila[];
    ventasPorSucursalNombre: Record<string, number>;
  }>
> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;

  const parsed = mesAnioQuerySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const { mes, anio } = parsed.data;
  try {
    const [filas, sucursales] = await Promise.all([
      listarImputacionesMensualesBalance({ meses: [mes], anio }),
      listarSucursalesGeneraBalance(),
    ]);
    const ventasPorSucursalNombre = await ventasPorSucursalNombreMes(mes, anio, sucursales);
    return { ok: true, data: { filas, ventasPorSucursalNombre } };
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : "No se pudo cargar el balance del período seleccionado.";
    return { ok: false, error: msg };
  }
}
