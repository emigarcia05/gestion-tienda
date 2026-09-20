/**
 * Imputaciones mensuales de gastos de balance (`fin_bal_gasto_mensual`)
 * para la pantalla `/finanzas/balance/gastos`.
 */
import type { IvaProveedor } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dateToIsoYmdArgentina } from "@/lib/fechaArgentina";
import type { ServiceResult } from "@/types/service.types";
import type { FlujoFondoDetalleDiaFila } from "@/services/vencimientosPorFecha.service";
import { ordenarDetallesFlujoDia } from "@/services/vencimientosPorFecha.service";

/** Resuelve si la imputación discrimina IVA según la política del gasto final y la respuesta del usuario (PREGUNTA). */
export function discriminaIvaDesdePoliticaGastoFinal(
  politica: IvaProveedor,
  respuestaUsuario?: boolean
): ServiceResult<boolean> {
  if (politica === "SIEMPRE") return { success: true, data: true };
  if (politica === "NUNCA") return { success: true, data: false };
  if (typeof respuestaUsuario !== "boolean") {
    return { success: false, error: "Indicá si el gasto discrimina IVA." };
  }
  return { success: true, data: respuestaUsuario };
}

/** Sucursales con `centro_costo` — selectores en Balance · Gastos y catálogo de gastos. */
export interface SucursalOption {
  id: string;
  nombre: string;
}

export async function listarSucursalesParaGastos(): Promise<SucursalOption[]> {
  return prisma.sucursal.findMany({
    where: { centroCosto: true },
    select: { id: true, nombre: true },
    orderBy: [{ nombre: "asc" }],
  });
}

export interface BalanceGastoMensualFila {
  id: string;
  /** FK `fin_bal_gasto_final`. */
  gastoFinalId: string;
  /** Mes calendario de la imputación (`fin_bal_gasto_mensual.mes`, 1–12). */
  mes: number;
  /** Año calendario de la imputación (`fin_bal_gasto_mensual.anio`). */
  anio: number;
  /** Fecha de devengo (mes/año de la fila + día devengado del catálogo). */
  fechaDevengoIso: string;
  sucursalNombre: string;
  /** Flags de `sucursales` al momento de la imputación (lectura en vivo). */
  sucursalGeneraBalance: boolean;
  sucursalCentroCosto: boolean;
  tipoGastoNombre: string;
  /** `fin_bal_gasto_final.gasto_mensual`: recurrente mensual vs eventual (único). */
  esGastoMensual: boolean;
  rubroNombre: string;
  gastoNombre: string;
  /** Comentarios del `fin_bal_gasto_final` (gasto + proveedor + sucursal), si hay. */
  gastoFinalComentarios: string | null;
  proveedorNombre: string;
  monto: number;
  pagado: number;
  /** Fecha de pago = fecha de devengo + `vencimiento` días del catálogo. ISO `yyyy-mm-dd`. */
  fechaVencimientoIso: string;
  /** Si hoy (AR) ≥ fecha de vencimiento: pendiente de pago `max(0, monto - pagado)`; si no, 0. */
  montoVencido: number;
  /** Columna `fin_bal_gasto_mensual.iva`: discrimina IVA en este período. */
  discriminaIva: boolean;
}

/** Días del mes calendario (1–12). Abril → 30. */
export function diasEnMesCalendario(anio: number, mes1a12: number): number {
  return new Date(anio, mes1a12, 0).getDate();
}

export function isoFechaDevengo(anio: number, mes: number, diaDevengado: number): string {
  const maxD = diasEnMesCalendario(anio, mes);
  const d = Math.min(Math.max(1, diaDevengado), maxD);
  const mm = String(mes).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${anio}-${mm}-${dd}`;
}

function parseIsoYmdUtcNoon(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 12, 0, 0);
}

/**
 * Cantidad de días calendario **desde** la fecha de devengo **hasta** hoy (AR), **ambas inclusive**
 * (ej.: devengo día 1 y hoy día 21 del mismo mes → **21** para multiplicar el gasto diario).
 * Si hoy &lt; devengo → 0.
 */
export function diasDesdeDevengoHastaHoy(isoDevengo: string, isoHoyArgentina: string): number {
  if (isoHoyArgentina < isoDevengo) return 0;
  const t0 = parseIsoYmdUtcNoon(isoDevengo);
  const t1 = parseIsoYmdUtcNoon(isoHoyArgentina);
  const diffDias = Math.floor((t1 - t0) / 86400000);
  return diffDias + 1;
}

/**
 * Fecha en que el gasto **vence/paga**: `fecha_devengo + vencimientoDias`
 * (ej. devengo **01/04/2026** + 30 días → **01/05/2026**). ISO `yyyy-mm-dd` (mediodía UTC interno).
 */
export function fechaVencimientoGastoBalanceDesdeDevengoIso(
  isoDevengo: string,
  vencimientoDias: number,
): string {
  const [y, m, d] = isoDevengo.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dias = Math.max(0, Math.floor(vencimientoDias || 0));
  t.setUTCDate(t.getUTCDate() + dias);
  const yy = t.getUTCFullYear();
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(t.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function montoVencidoGastoBalance(params: {
  isoHoyArgentina: string;
  isoDevengo: string;
  vencimientoDias: number;
  monto: number;
  pagado: number;
}): number {
  const isoVenc = fechaVencimientoGastoBalanceDesdeDevengoIso(
    params.isoDevengo,
    params.vencimientoDias
  );
  if (params.isoHoyArgentina < isoVenc) return 0;
  return Math.max(0, params.monto - params.pagado);
}

function computePendiente(params: {
  valorMensualReferencia: number;
  diasMes: number;
  diasTranscurridos: number;
}): number {
  const { valorMensualReferencia, diasMes, diasTranscurridos } = params;
  if (valorMensualReferencia <= 0 || diasMes <= 0 || diasTranscurridos <= 0) return 0;
  const diario = valorMensualReferencia / diasMes;
  const proporcional = Math.round(diario * diasTranscurridos);
  /** No supera el monto mensual de referencia: el devengado acumula hasta ese tope. */
  return Math.min(proporcional, valorMensualReferencia);
}

/**
 * Pendiente de pago proporcional al devengo acumulado **hasta** `isoCorte` (vencimientos / flujo de fondo).
 * Solo usa el **monto imputado en ese mes calendario**; si es `0`, no hay base proporcional en ese mes.
 */
export function montoDevengadoPendienteHastaCorte(
  params: {
    isoDevengo: string;
    isoCorte: string;
    mesImputacion: number;
    anioImputacion: number;
    monto: number;
    pagado: number;
  }
): number {
  const { isoDevengo, isoCorte, mesImputacion, anioImputacion, monto, pagado } = params;
  if (isoCorte < isoDevengo) return 0;
  const diasMes = diasEnMesCalendario(anioImputacion, mesImputacion);
  const diasT = diasDesdeDevengoHastaHoy(isoDevengo, isoCorte);
  const valor = monto > 0 ? monto : 0;
  const devengadoAcum = computePendiente({
    valorMensualReferencia: valor,
    diasMes,
    diasTranscurridos: diasT,
  });
  return Math.max(0, devengadoAcum - pagado);
}

/** Mes y año calendario en Argentina (instante actual). */
export function mesAnioCalendarioArgentina(ahora: Date = new Date()): { mes: number; anio: number } {
  const ymd = dateToIsoYmdArgentina(ahora);
  const [y, m] = ymd.split("-").map(Number);
  return { mes: m, anio: y };
}

/** Mes calendario inmediatamente anterior a `(mes, anio)` (ej. abr → mar; ene → dic año-1). */
export function mesAnteriorCalendario(mes: number, anio: number): { mes: number; anio: number } {
  if (mes <= 1) return { mes: 12, anio: anio - 1 };
  return { mes: mes - 1, anio };
}

/** Ítem con política PREGUNTA pendiente de decisión de «discrimina IVA» al cargar el mes desde catálogo. */
export interface PendienteDiscriminaIvaCargaMesItem {
  gastoFinalId: string;
  etiqueta: string;
}

/**
 * Lista gastos mensuales del catálogo que se crearían en `(mes, anio)` y exigen decisión de IVA (`PREGUNTA`).
 */
export async function listarPendientesDiscriminaIvaCargaMesCatalogo(params: {
  mes: number;
  anio: number;
}): Promise<ServiceResult<{ pendientesPregunta: PendienteDiscriminaIvaCargaMesItem[] }>> {
  const { mes, anio } = params;
  if (mes < 1 || mes > 12 || anio < 2000 || anio > 2100) {
    return { success: false, error: "Mes o año inválido." };
  }

  try {
    const finals = await prisma.finBalGastoFinal.findMany({
      where: { gastoMensual: true, sucursalId: { not: null } },
      select: {
        id: true,
        iva: true,
        proveedor: { select: { nombre: true } },
        gasto: { select: { nombre: true } },
        sucursal: { select: { nombre: true } },
      },
    });
    if (finals.length === 0) {
      return { success: true, data: { pendientesPregunta: [] } };
    }

    const existentes = await prisma.finBalGastoMensual.findMany({
      where: {
        mes,
        anio,
        gastoMensualEnAlta: true,
        gastoFinalId: { in: finals.map((f) => f.id) },
      },
      select: { gastoFinalId: true },
    });
    const ya = new Set(existentes.map((e) => e.gastoFinalId));
    const pendientesPregunta: PendienteDiscriminaIvaCargaMesItem[] = finals
      .filter((f) => !ya.has(f.id) && f.iva === "PREGUNTA")
      .map((f) => ({
        gastoFinalId: f.id,
        etiqueta: `${f.gasto.nombre.toUpperCase()} · ${f.proveedor.nombre.toUpperCase()} · ${f.sucursal?.nombre.toUpperCase() ?? "—"}`,
      }));

    pendientesPregunta.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));

    return { success: true, data: { pendientesPregunta } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al listar pendientes de IVA.";
    return { success: false, error: msg };
  }
}

/**
 * Crea filas `fin_bal_gasto_mensual` (monto 0, pagado 0) para el mes/año dado,
 * por cada `fin_bal_gasto_final` con `gasto_mensual = true` que aún no tenga fila.
 * Para política `PREGUNTA`, `ivaPorGastoFinalId[gastoFinalId]` debe ser `true`/`false` (discrimina IVA).
 */
export async function cargarImputacionesMensualesDesdeCatalogo(params: {
  mes: number;
  anio: number;
  ivaPorGastoFinalId?: Record<string, boolean>;
}): Promise<ServiceResult<{ creados: number; yaExistentes: number }>> {
  const { mes, anio, ivaPorGastoFinalId = {} } = params;
  if (mes < 1 || mes > 12 || anio < 2000 || anio > 2100) {
    return { success: false, error: "Mes o año inválido." };
  }

  try {
    const finals = await prisma.finBalGastoFinal.findMany({
      where: { gastoMensual: true, sucursalId: { not: null } },
      select: { id: true, iva: true },
    });
    if (finals.length === 0) {
      return { success: true, data: { creados: 0, yaExistentes: 0 } };
    }

    const existentes = await prisma.finBalGastoMensual.findMany({
      where: {
        mes,
        anio,
        gastoMensualEnAlta: true,
        gastoFinalId: { in: finals.map((f) => f.id) },
      },
      select: { gastoFinalId: true },
    });
    const ya = new Set(existentes.map((e) => e.gastoFinalId));
    const aCrear = finals.filter((f) => !ya.has(f.id));

    if (aCrear.length === 0) {
      return { success: true, data: { creados: 0, yaExistentes: ya.size } };
    }

    for (const f of aCrear) {
      if (f.iva === "PREGUNTA" && !Object.prototype.hasOwnProperty.call(ivaPorGastoFinalId, f.id)) {
        return {
          success: false,
          error:
            "Falta indicar si discrimina IVA para uno o más gastos con política «pregunta». Volvé a cargar el mes y completá el modal.",
        };
      }
    }

    const creates = aCrear.map((f) => {
      const resolved = discriminaIvaDesdePoliticaGastoFinal(
        f.iva,
        f.iva === "PREGUNTA" ? ivaPorGastoFinalId[f.id] : undefined
      );
      if (!resolved.success) {
        throw new Error(resolved.error);
      }
      return prisma.finBalGastoMensual.create({
        data: {
          gastoFinalId: f.id,
          mes,
          anio,
          monto: 0,
          pagado: 0,
          iva: resolved.data,
          gastoMensualEnAlta: true,
        },
      });
    });

    await prisma.$transaction(creates);

    return {
      success: true,
      data: { creados: aCrear.length, yaExistentes: ya.size },
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al cargar imputaciones mensuales.";
    return { success: false, error: msg };
  }
}

/**
 * Listado de imputaciones del `anio` (y de `meses` si hay alguno) con jerarquía de gasto, proveedor y sucursal.
 * `meses` vacío = todo el año. `fechaVencimientoIso` / `montoVencido`: vence en `fecha_devengo + vencimiento`; si hoy (AR) ≥ esa fecha, `montoVencido = max(0, monto - pagado)`.
 */
export async function listarImputacionesMensualesBalance(params: {
  anio: number;
  /** Meses calendario 1–12 a incluir. Vacío = todos los meses del `anio`. */
  meses: number[];
}): Promise<BalanceGastoMensualFila[]> {
  const { anio } = params;
  const mesesUnicos = [
    ...new Set(
      params.meses.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12)
    ),
  ].sort((a, b) => a - b);

  const isoHoy = dateToIsoYmdArgentina(new Date());

  const rows = await prisma.finBalGastoMensual.findMany({
    where:
      mesesUnicos.length === 0
        ? { anio }
        : mesesUnicos.length === 1
          ? { anio, mes: mesesUnicos[0] }
          : { anio, mes: { in: mesesUnicos } },
    orderBy: [{ mes: "asc" }, { createdAt: "asc" }],
    include: {
      imputacionSucursal: {
        select: { nombre: true, generaBalance: true, centroCosto: true },
      },
      gastoFinal: {
        select: {
          gastoMensual: true,
          diaDevengado: true,
          vencimiento: true,
          comentarios: true,
          sucursal: { select: { nombre: true, generaBalance: true, centroCosto: true } },
          proveedor: { select: { nombre: true } },
          gasto: {
            select: {
              nombre: true,
              rubro: {
                select: {
                  nombre: true,
                  tipo: { select: { nombre: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return rows.map((r) => {
    const gf = r.gastoFinal;
    const mesFila = r.mes;
    const anioFila = r.anio;
    const fechaDevengoIso = isoFechaDevengo(anioFila, mesFila, gf.diaDevengado ?? 1);
    const montoActual = r.monto;
    const fechaVencimientoIso = fechaVencimientoGastoBalanceDesdeDevengoIso(
      fechaDevengoIso,
      gf.vencimiento ?? 0
    );
    const montoVencido = montoVencidoGastoBalance({
      isoHoyArgentina: isoHoy,
      isoDevengo: fechaDevengoIso,
      vencimientoDias: gf.vencimiento ?? 0,
      monto: montoActual,
      pagado: r.pagado,
    });

    const comRaw = gf.comentarios?.trim() ?? "";
    const gastoFinalComentarios = comRaw.length > 0 ? comRaw.toUpperCase() : null;

    const sucursalDisplay = r.imputacionSucursal ?? gf.sucursal;

    return {
      id: r.id,
      gastoFinalId: r.gastoFinalId,
      mes: mesFila,
      anio: anioFila,
      fechaDevengoIso,
      sucursalNombre: sucursalDisplay?.nombre.toUpperCase() ?? "—",
      sucursalGeneraBalance: sucursalDisplay?.generaBalance ?? false,
      sucursalCentroCosto: sucursalDisplay?.centroCosto ?? false,
      tipoGastoNombre: gf.gasto.rubro.tipo.nombre.toUpperCase(),
      esGastoMensual: gf.gastoMensual,
      rubroNombre: gf.gasto.rubro.nombre.toUpperCase(),
      gastoNombre: gf.gasto.nombre.toUpperCase(),
      gastoFinalComentarios,
      proveedorNombre: gf.proveedor.nombre.toUpperCase(),
      monto: montoActual,
      pagado: r.pagado,
      fechaVencimientoIso,
      montoVencido,
      discriminaIva: r.iva,
    };
  });
}

const MESES_CORTO_ES: Record<number, string> = {
  1: "ene",
  2: "feb",
  3: "mar",
  4: "abr",
  5: "may",
  6: "jun",
  7: "jul",
  8: "ago",
  9: "sep",
  10: "oct",
  11: "nov",
  12: "dic",
};

/** Punto mensual de imputación para un gasto final (evolución en el tiempo). */
export interface HistoricoMontoGastoFinalBalanceItem {
  mes: number;
  anio: number;
  monto: number;
  /** Etiqueta corta para el eje X (ej. `abr 2026`). */
  etiquetaMes: string;
}

/** Orden estable: mes más antiguo primero (eje temporal del gráfico). */
function ordenarHistoricoMontosCronologicamenteAsc(
  items: HistoricoMontoGastoFinalBalanceItem[],
): HistoricoMontoGastoFinalBalanceItem[] {
  return [...items].sort((a, b) => {
    if (a.anio !== b.anio) return a.anio - b.anio;
    return a.mes - b.mes;
  });
}

/**
 * Lista todos los meses con imputación en `fin_bal_gasto_mensual` para un `gasto_final_id`,
 * orden cronológico ascendente.
 */
export async function listarHistoricoMontosGastoFinalBalance(
  gastoFinalId: string,
): Promise<HistoricoMontoGastoFinalBalanceItem[]> {
  const rows = await prisma.finBalGastoMensual.findMany({
    where: { gastoFinalId },
    orderBy: [{ anio: "asc" }, { mes: "asc" }],
    select: { mes: true, anio: true, monto: true },
  });
  return ordenarHistoricoMontosCronologicamenteAsc(
    rows.map((r) => ({
      mes: r.mes,
      anio: r.anio,
      monto: r.monto,
      etiquetaMes: `${MESES_CORTO_ES[r.mes] ?? String(r.mes)} ${r.anio}`,
    })),
  );
}

/** Ítem del catálogo `fin_bal_gasto_final` con `gasto_mensual = false` (gasto único). */
export interface FinBalGastoFinalNoMensualListItem {
  gastoFinalId: string;
  /** Política de IVA del gasto final (`SIEMPRE` / `NUNCA` / `PREGUNTA`). */
  ivaPolitica: IvaProveedor;
  tipoGastoNombre: string;
  rubroNombre: string;
  gastoNombre: string;
  proveedorNombre: string;
  sucursalNombre: string;
  diaDevengado: number | null;
  vencimiento: number | null;
  gastoFinalComentarios: string | null;
}

/**
 * Gastos finales no mensuales del catálogo (eventuales). Permite varias imputaciones
 * del mismo gasto final en el mismo `(mes, anio)` y sucursal.
 */
export async function listarGastosFinalesNoMensualesConEstadoPeriodo(params: {
  mes: number;
  anio: number;
}): Promise<FinBalGastoFinalNoMensualListItem[]> {
  void params;
  const finals = await prisma.finBalGastoFinal.findMany({
    where: { gastoMensual: false },
    include: {
      sucursal: { select: { nombre: true } },
      proveedor: { select: { nombre: true } },
      gasto: {
        select: {
          nombre: true,
          rubro: {
            select: {
              nombre: true,
              tipo: { select: { nombre: true } },
            },
          },
        },
      },
    },
  });

  const rows: FinBalGastoFinalNoMensualListItem[] = finals.map((gf) => {
    const comRaw = gf.comentarios?.trim() ?? "";
    return {
      gastoFinalId: gf.id,
      ivaPolitica: gf.iva,
      tipoGastoNombre: gf.gasto.rubro.tipo.nombre.toUpperCase(),
      rubroNombre: gf.gasto.rubro.nombre.toUpperCase(),
      gastoNombre: gf.gasto.nombre.toUpperCase(),
      proveedorNombre: gf.proveedor.nombre.toUpperCase(),
      sucursalNombre: gf.sucursal?.nombre.toUpperCase() ?? "—",
      diaDevengado: gf.diaDevengado,
      vencimiento: gf.vencimiento,
      gastoFinalComentarios: comRaw.length > 0 ? comRaw.toUpperCase() : null,
    };
  });

  rows.sort((a, b) => {
    const t = a.tipoGastoNombre.localeCompare(b.tipoGastoNombre, "es");
    if (t !== 0) return t;
    const r = a.rubroNombre.localeCompare(b.rubroNombre, "es");
    if (r !== 0) return r;
    const g = a.gastoNombre.localeCompare(b.gastoNombre, "es");
    if (g !== 0) return g;
    const p = a.proveedorNombre.localeCompare(b.proveedorNombre, "es");
    if (p !== 0) return p;
    return a.sucursalNombre.localeCompare(b.sucursalNombre, "es");
  });

  return rows;
}

/**
 * Crea una fila `fin_bal_gasto_mensual` para un gasto final con `gasto_mensual = false`
 * (imputación puntual del periodo).
 */
export async function crearImputacionGastoUnicoBalance(params: {
  gastoFinalId: string;
  sucursalId: string;
  mes: number;
  anio: number;
  monto: number;
  pagado: number;
  fechaGasto: string;
  plazoPago?: number;
  /** Obligatorio si el gasto final tiene `iva = PREGUNTA`: discrimina IVA en esta imputación. */
  discriminaIva?: boolean;
}): Promise<ServiceResult<{ id: string }>> {
  const { gastoFinalId, sucursalId, mes, anio, monto, pagado, fechaGasto, plazoPago, discriminaIva } =
    params;
  if (monto < 1) {
    return { success: false, error: "El monto es obligatorio y debe ser mayor a cero." };
  }
  if (pagado < 0 || pagado > monto) {
    return { success: false, error: "El importe pagado debe estar entre 0 y el monto." };
  }
  const [y, m, d] = fechaGasto.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d) || y !== anio || m !== mes) {
    return { success: false, error: "La fecha de gasto debe pertenecer al período seleccionado." };
  }
  const maxDiaMes = new Date(anio, mes, 0).getDate();
  if (d < 1 || d > maxDiaMes) {
    return { success: false, error: "La fecha de gasto no es válida para el mes seleccionado." };
  }
  const pagoCompleto = pagado === monto;
  const plazoPersist = pagoCompleto ? 0 : plazoPago;
  if (!pagoCompleto && (typeof plazoPersist !== "number" || plazoPersist < 0 || plazoPersist > 30)) {
    return {
      success: false,
      error: "El plazo de pago es obligatorio y debe estar entre 0 y 30 días.",
    };
  }
  try {
    const gf = await prisma.finBalGastoFinal.findUnique({
      where: { id: gastoFinalId },
      select: { id: true, gastoMensual: true, iva: true },
    });
    if (!gf) {
      return { success: false, error: "Gasto no encontrado en el catálogo." };
    }
    if (gf.gastoMensual) {
      return {
        success: false,
        error: "Este gasto está configurado como mensual; usá «Cargar Mes».",
      };
    }
    const ivaResolved = discriminaIvaDesdePoliticaGastoFinal(gf.iva, discriminaIva);
    if (!ivaResolved.success) {
      return { success: false, error: ivaResolved.error };
    }
    const sucImputacion = await prisma.sucursal.findUnique({
      where: { id: sucursalId },
      select: { id: true, centroCosto: true },
    });
    if (!sucImputacion?.centroCosto) {
      return {
        success: false,
        error: "Elegí una sucursal válida (centro de costo).",
      };
    }
    const row = await prisma.finBalGastoMensual.create({
      data: {
        gastoFinalId,
        mes,
        anio,
        monto,
        pagado,
        imputacionSucursalId: sucursalId,
        iva: ivaResolved.data,
        gastoMensualEnAlta: false,
      },
      select: { id: true },
    });
    return { success: true, data: { id: row.id } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudo crear la imputación.";
    return { success: false, error: msg };
  }
}

const includeGastoFlujoGastoMensual = {
  gastoFinal: {
    select: {
      diaDevengado: true,
      vencimiento: true,
      proveedor: { select: { nombre: true, proveedorMercaderia: true } },
      gasto: { select: { nombre: true } },
    },
  },
} as const;

/** Línea de vencimiento de imputación de balance (Flujo de Fondo, detalle y columna). */
export interface VencimientoGastoFlujoLinea {
  imputacionId: string;
  fechaVenc: string;
  /** Proveedor (catálogo balance), para filtro y grilla. */
  proveedor: string;
  /** Nombre de gasto en catálogo (MAYÚSCULAS, como en Balance). */
  detalle: string;
  monto: number;
  devengoIso: string;
}

/**
 * Suma de **monto devengado pendiente a hoy** de imputaciones cuya fecha de vencimiento (desde
 * devengo) es **&lt; `fechaIso`**, con la misma fórmula que {@link montoDevengadoPendienteHastaCorte}.
 * Sirve con **VTOS ACUMULADOS** junto a comprobantes.
 */
export async function sumarPendienteGastosConFechaVencAnteriorA(
  fechaIso: string
): Promise<number> {
  const hoyCorte = fechaIso;
  const all = await prisma.finBalGastoMensual.findMany({
    include: includeGastoFlujoGastoMensual,
  });
  if (all.length === 0) return 0;
  let suma = 0;
  for (const r of all) {
    const gf = r.gastoFinal;
    const fechaDevengoIso = isoFechaDevengo(r.anio, r.mes, gf.diaDevengado ?? 1);
    const fechaVenc = fechaVencimientoGastoBalanceDesdeDevengoIso(
      fechaDevengoIso,
      gf.vencimiento ?? 0
    );
    if (fechaVenc >= hoyCorte) continue;
    const pend = montoDevengadoPendienteHastaCorte({
      isoDevengo: fechaDevengoIso,
      isoCorte: hoyCorte,
      mesImputacion: r.mes,
      anioImputacion: r.anio,
      monto: r.monto,
      pagado: r.pagado,
    });
    suma += pend;
  }
  return suma;
}

/**
 * Imputaciones cuyo vencimiento entra en `[desde, hasta]`, con **monto a vencer** = devengado
 * pendiente a la **fecha de vencimiento** (corte = `fechaVenc`).
 */
export async function listarVencimientosGastoFlujoEnRango(
  fechaDesde: string,
  fechaHasta: string
): Promise<VencimientoGastoFlujoLinea[]> {
  const all = await prisma.finBalGastoMensual.findMany({
    include: includeGastoFlujoGastoMensual,
  });
  if (all.length === 0) return [];
  const out: VencimientoGastoFlujoLinea[] = [];
  for (const r of all) {
    const gf = r.gastoFinal;
    const fechaDevengoIso = isoFechaDevengo(r.anio, r.mes, gf.diaDevengado ?? 1);
    const fechaVenc = fechaVencimientoGastoBalanceDesdeDevengoIso(
      fechaDevengoIso,
      gf.vencimiento ?? 0
    );
    if (fechaVenc < fechaDesde || fechaVenc > fechaHasta) continue;
    const montoPendVenc = montoDevengadoPendienteHastaCorte({
      isoDevengo: fechaDevengoIso,
      isoCorte: fechaVenc,
      mesImputacion: r.mes,
      anioImputacion: r.anio,
      monto: r.monto,
      pagado: r.pagado,
    });
    if (montoPendVenc <= 0) continue;
    out.push({
      imputacionId: r.id,
      fechaVenc,
      proveedor: gf.proveedor.nombre.toUpperCase(),
      detalle: gf.gasto.nombre.toUpperCase(),
      monto: montoPendVenc,
      devengoIso: fechaDevengoIso,
    });
  }
  return out;
}

/** Proveedor (nombre en MAYÚSCULAS) no mercadería con suma de obligaciones de gasto ya vencidas. */
export interface ProveedorNoMercaderiaObligacionVencidaFila {
  proveedor: string;
  totalVencido: number;
}

/**
 * Obligaciones de balance (imputaciones mensuales) **ya vencidas** (`fecha_venc` &lt; hoy AR),
 * pendiente a hoy &gt; 0, solo si el proveedor del gasto final **no** es mercadería (`proveedorMercaderia === false`).
 *
 * - `detalleLineas`: filas compatibles con {@link TablaFlujoDeFondoDetalleDia} / Flujo de Fondo.
 * - `proveedores`: agregado por proveedor, orden alfabético.
 */
export async function listarObligacionesGastoVencidasNoMercaderia(): Promise<{
  hoyIso: string;
  proveedores: ProveedorNoMercaderiaObligacionVencidaFila[];
  detalleLineas: FlujoFondoDetalleDiaFila[];
}> {
  const hoyIso = dateToIsoYmdArgentina(new Date());
  const all = await prisma.finBalGastoMensual.findMany({
    include: includeGastoFlujoGastoMensual,
  });
  if (all.length === 0) {
    return { hoyIso, proveedores: [], detalleLineas: [] };
  }

  const detalleLineas: FlujoFondoDetalleDiaFila[] = [];
  const totales = new Map<string, number>();

  for (const r of all) {
    const gf = r.gastoFinal;
    if (gf.proveedor.proveedorMercaderia) continue;

    const fechaDevengoIso = isoFechaDevengo(r.anio, r.mes, gf.diaDevengado ?? 1);
    const fechaVenc = fechaVencimientoGastoBalanceDesdeDevengoIso(
      fechaDevengoIso,
      gf.vencimiento ?? 0
    );
    if (fechaVenc >= hoyIso) continue;

    const pend = montoDevengadoPendienteHastaCorte({
      isoDevengo: fechaDevengoIso,
      isoCorte: hoyIso,
      mesImputacion: r.mes,
      anioImputacion: r.anio,
      monto: r.monto,
      pagado: r.pagado,
    });
    if (pend <= 0) continue;

    const proveedor = gf.proveedor.nombre.toUpperCase();
    detalleLineas.push({
      fechaDevengadaIso: fechaDevengoIso,
      fechaVencimientoIso: fechaVenc,
      proveedor,
      detalle: gf.gasto.nombre.toUpperCase(),
      monto: pend,
      sortFecha: fechaDevengoIso,
      sortId: r.id,
    });
    totales.set(proveedor, (totales.get(proveedor) ?? 0) + pend);
  }

  const proveedores: ProveedorNoMercaderiaObligacionVencidaFila[] = [...totales.entries()]
    .map(([proveedor, totalVencido]) => ({ proveedor, totalVencido }))
    .sort((a, b) => a.proveedor.localeCompare(b.proveedor, "es"));

  return {
    hoyIso,
    proveedores,
    detalleLineas: ordenarDetallesFlujoDia(detalleLineas),
  };
}

/**
 * `monto` persistido en el **mes calendario inmediatamente anterior** a `(mes, anio)`
 * para el mismo `gasto_final_id`. Si no hay fila en ese mes, devuelve `null`.
 */
export async function obtenerMontoImputacionMesAnterior(params: {
  gastoFinalId: string;
  mes: number;
  anio: number;
}): Promise<number | null> {
  const { gastoFinalId, mes, anio } = params;
  const prev = mesAnteriorCalendario(mes, anio);
  const row = await prisma.finBalGastoMensual.findFirst({
    where: {
      gastoFinalId,
      mes: prev.mes,
      anio: prev.anio,
      gastoMensualEnAlta: true,
    },
    select: { monto: true },
    orderBy: { createdAt: "desc" },
  });
  return row?.monto ?? null;
}

export async function actualizarMontoFinBalGastoMensual(params: {
  id: string;
  monto: number;
}): Promise<ServiceResult<{ id: string; monto: number }>> {
  const { id, monto } = params;
  try {
    const current = await prisma.finBalGastoMensual.findUnique({
      where: { id },
      select: { pagado: true },
    });
    if (!current) {
      return { success: false, error: "Imputación no encontrada." };
    }
    if (monto < current.pagado) {
      return {
        success: false,
        error: "El monto no puede ser menor al importe ya pagado.",
      };
    }
    const row = await prisma.finBalGastoMensual.update({
      where: { id },
      data: { monto },
      select: { id: true, monto: true },
    });
    return { success: true, data: { id: row.id, monto: row.monto } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudo actualizar el monto.";
    return { success: false, error: msg };
  }
}

export async function actualizarPagadoFinBalGastoMensual(params: {
  id: string;
  pagado: number;
}): Promise<ServiceResult<{ id: string; pagado: number }>> {
  const { id, pagado } = params;
  try {
    const current = await prisma.finBalGastoMensual.findUnique({
      where: { id },
      select: { monto: true },
    });
    if (!current) {
      return { success: false, error: "Imputación no encontrada." };
    }
    if (pagado > current.monto) {
      return {
        success: false,
        error: "El importe pagado no puede superar el monto imputado.",
      };
    }
    const row = await prisma.finBalGastoMensual.update({
      where: { id },
      data: { pagado },
      select: { id: true, pagado: true },
    });
    return { success: true, data: { id: row.id, pagado: row.pagado } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudo registrar el pago.";
    return { success: false, error: msg };
  }
}

export async function eliminarFinBalGastoMensual(
  id: string
): Promise<ServiceResult<{ id: string }>> {
  try {
    await prisma.finBalGastoMensual.delete({ where: { id } });
    return { success: true, data: { id } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudo eliminar la imputación.";
    return { success: false, error: msg };
  }
}
