/**
 * Tablero del hub `/ventas`: ventas y cobros del día y del mes,
 * de la sucursal del usuario y del total, más clientes con saldo vencido de esa sucursal.
 */

import { etiquetaClienteListado } from "@/lib/envios";
import { esFacturaTipo, esFacturaTipoNotaCredito, montoSaldoVencidoVenta } from "@/lib/factura";
import {
  addDaysToIsoYmdArgentina,
  dateToIsoYmdArgentina,
  isoYmdFromPrismaDateOnly,
  prismaDateOnlyFromIsoYmd,
} from "@/lib/fechaArgentina";
import { prisma } from "@/lib/prisma";
import { sucursalCodigoSesion } from "@/services/facturaSucursalAutorizada.service";
import {
  mapaSucursalIdPorCodigo,
  SELECT_SUCURSAL_VENTA,
  sucursalIdDeVenta,
  VENTAS_MENSUALES_DESDE_ISO,
} from "@/services/ventasMensuales.service";
import type { ServiceResult } from "@/types/service.types";

/** Misma canasta que Ventas Mensuales: factura y NC, fiscal y no fiscal. */
const TIPOS_VENTA = [
  "factura_fiscal",
  "factura_no_fiscal",
  "nota_credito_fiscal",
  "nota_credito_no_fiscal",
] as const;

const TIPOS_VENTA_SALDO = ["factura_fiscal", "factura_no_fiscal"] as const;

/** Variación de ventas contra el período anterior. `pct` es el entero absoluto. */
export interface ComparacionVentas {
  sentido: "mas" | "menos" | "igual" | "sin_base";
  pct: number;
}

export interface TableroVentasMontos {
  ventas: number;
  cobrado: number;
  /**
   * `cobrado / ventas`, entero, sin tope (cobros de otros días pueden pasar de 100).
   * Null si no hubo ventas y sí cobros: no hay base.
   */
  pctCobrado: number | null;
  /** Día: contra ayer. Mes: contra el mismo día del mes anterior. */
  comparacion: ComparacionVentas;
}

export interface TableroVentasClienteVencido {
  id: string;
  nombre: string;
  saldoVencido: number;
}

const ETIQUETAS_MES = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
] as const;

/** Mes del gráfico. `proyectado` solo en el mes en curso. */
export interface TableroVentasMesGrafico {
  mes: number;
  etiqueta: string;
  ventas: number;
  proyectado: number | null;
}

/** Una serie del gráfico: GLOBAL o una sucursal. */
export interface TableroVentasSerieMes {
  id: string;
  etiqueta: string;
  meses: TableroVentasMesGrafico[];
}

/** Parte de las ventas de una sucursal sobre el total global del día o del mes, y su promedio. */
export interface TableroVentasParticipacion {
  id: string;
  nombre: string;
  pctDia: number;
  montoDia: number;
  pctMes: number;
  montoMes: number;
  /** Total del año / días con ventas netas mayores a 0. */
  montoPromedioDia: number;
  /** Posición de la marca sobre la misma escala que `pctDia` (0–100). */
  pctPromedioDia: number;
  /** Total del año / meses con ventas netas mayores a 0. */
  montoPromedio: number;
  /** Posición de la marca sobre la misma escala que `pctMes` (0–100). */
  pctPromedio: number;
}

export interface TableroVentasDatos {
  /** Nombre de la sucursal del usuario. Null si no tiene sucursal. */
  sucursalNombre: string | null;
  sucursal: { dia: TableroVentasMontos; mes: TableroVentasMontos };
  globales: { dia: TableroVentasMontos; mes: TableroVentasMontos };
  /** Todas las sucursales. Orden: mayor % del mes primero. El promedio del día es el total del año / días con ventas; el del mes, / meses con ventas. */
  participacionSucursales: TableroVentasParticipacion[];
  /** GLOBAL y cada sucursal. Siempre 12 meses, de enero a diciembre. */
  seriesMeses: TableroVentasSerieMes[];
  clientesVencidos: TableroVentasClienteVencido[];
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

function comparacionIgual(): ComparacionVentas {
  return { sentido: "igual", pct: 0 };
}

/** Entero. Null si las ventas son 0 y hubo cobros. */
export function pctCobradoSobreVentas(cobrado: number, ventas: number): number | null {
  if (ventas <= 0.009) return cobrado <= 0.009 ? 0 : null;
  return Math.round((cobrado / ventas) * 100);
}

function mesesDelAnio(
  mesActual: number,
  vendidoMes: number,
  diasMes: number,
  diaHoy: number,
  ventasPorMes: Map<number, number>
): TableroVentasMesGrafico[] {
  const proyectado =
    diaHoy > 0 ? redondear2((vendidoMes / diaHoy) * diasMes) : vendidoMes;
  return ETIQUETAS_MES.map((etiqueta, indice) => {
    const m = indice + 1;
    if (m === mesActual) {
      return { mes: m, etiqueta, ventas: vendidoMes, proyectado };
    }
    if (m > mesActual) {
      return { mes: m, etiqueta, ventas: 0, proyectado: null };
    }
    return {
      mes: m,
      etiqueta,
      ventas: redondear2(ventasPorMes.get(m) ?? 0),
      proyectado: null,
    };
  });
}

function montosVacios(): TableroVentasMontos {
  return { ventas: 0, cobrado: 0, pctCobrado: 0, comparacion: comparacionIgual() };
}

/** `(actual − anterior) / |anterior|`. Sin base si el anterior es 0 y este período no. */
function compararVentas(actual: number, anterior: number): ComparacionVentas {
  const a = redondear2(actual);
  const b = redondear2(anterior);
  if (Math.abs(b) < 0.005) {
    return Math.abs(a) < 0.005 ? comparacionIgual() : { sentido: "sin_base", pct: 0 };
  }
  const pct = Math.round(((a - b) / Math.abs(b)) * 100);
  if (pct === 0) return comparacionIgual();
  if (pct < 0) return { sentido: "menos", pct: -pct };
  return { sentido: "mas", pct };
}

function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

function isoMes(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}-01`;
}

async function sumarCobrado(
  desde: Date,
  hasta: Date,
  sucursalId?: string
): Promise<number> {
  const suma = await prisma.tesoreriaMovimiento.aggregate({
    where: {
      catMovimiento: "COBRO",
      tipoMovimiento: "INGRESO",
      fechaRegistro: { gte: desde, lt: hasta },
      ...(sucursalId ? { sucursalId } : {}),
    },
    _sum: { monto: true },
  });
  return suma._sum.monto ?? 0;
}

export async function obtenerTableroVentas(): Promise<ServiceResult<TableroVentasDatos>> {
  try {
    const hoyIso = dateToIsoYmdArgentina(new Date());
    const [anioRaw, mesRaw, diaRaw] = hoyIso.split("-");
    const anio = Number(anioRaw);
    const mes = Number(mesRaw);
    const diaHoy = Number(diaRaw);
    const mesPrev = mes === 1 ? 12 : mes - 1;
    const anioPrev = mes === 1 ? anio - 1 : anio;
    const desdeMesIso = isoMes(anio, mes);
    const desdeMesAntIso = isoMes(anioPrev, mesPrev);
    const diaEquivalente = Math.min(diaHoy, diasDelMes(anioPrev, mesPrev));
    const hastaEqIso = `${anioPrev}-${String(mesPrev).padStart(2, "0")}-${String(diaEquivalente).padStart(2, "0")}`;
    const ayerIso = addDaysToIsoYmdArgentina(hoyIso, -1);
    const hastaMesIso = mes === 12 ? isoMes(anio + 1, 1) : isoMes(anio, mes + 1);
    const hastaDiaIso = addDaysToIsoYmdArgentina(hoyIso, 1);
    const desdeMesCalendario = prismaDateOnlyFromIsoYmd(desdeMesIso);
    const desdeAnioIso = `${anio}-01-01`;
    const hastaAnioIso = `${anio + 1}-01-01`;
    const desdeConsultaIso = desdeMesAntIso < desdeAnioIso ? desdeMesAntIso : desdeAnioIso;
    const desdeComparacionIso =
      desdeConsultaIso < VENTAS_MENSUALES_DESDE_ISO ? VENTAS_MENSUALES_DESDE_ISO : desdeConsultaIso;
    const desdeMesVentas = prismaDateOnlyFromIsoYmd(desdeComparacionIso);
    const hastaMes = prismaDateOnlyFromIsoYmd(hastaMesIso);
    const desdeDia = prismaDateOnlyFromIsoYmd(hoyIso);
    const hastaDia = prismaDateOnlyFromIsoYmd(hastaDiaIso);
    if (!desdeMesCalendario || !desdeMesVentas || !hastaMes || !desdeDia || !hastaDia) {
      return { success: false, error: "No se pudo armar el período del tablero." };
    }

    const codigo = await sucursalCodigoSesion();
    const [sucursalIdPorCodigo, sucursales] = await Promise.all([
      mapaSucursalIdPorCodigo(),
      prisma.sucursal.findMany({
        select: { id: true, nombre: true, codigo: true },
      }),
    ]);
    const sucursalId = codigo ? sucursalIdPorCodigo.get(codigo) : undefined;
    const sucursalNombre =
      sucursales.find((s) => s.codigo.trim().toLowerCase() === codigo)?.nombre.toLocaleUpperCase("es") ??
      null;

    const ventasPromise =
      desdeMesVentas < hastaMes
        ? prisma.comprobanteVta.findMany({
            where: {
              tipoComprobante: { in: [...TIPOS_VENTA] },
              estado: "autorizado",
              fecha: { gte: desdeMesVentas, lt: hastaMes },
            },
            select: {
              fecha: true,
              tipoComprobante: true,
              impTotal: true,
              cotizacion: true,
              ...SELECT_SUCURSAL_VENTA,
            },
          })
        : Promise.resolve([]);

    const vencidasPromise = sucursalId
      ? prisma.comprobanteVta.findMany({
          where: {
            clienteId: { not: null },
            estado: { not: "rechazado" },
            tipoComprobante: { in: [...TIPOS_VENTA_SALDO] },
            diasVencimiento: { not: null },
          },
          select: {
            clienteId: true,
            fecha: true,
            diasVencimiento: true,
            impTotal: true,
            impCobrado: true,
            cliente: { select: { esPintor: true, nombreCompleto: true, cel: true } },
            ...SELECT_SUCURSAL_VENTA,
          },
        })
      : Promise.resolve([]);

    const [ventas, vencidas, cobradoMes, cobradoDia, cobradoMesSuc, cobradoDiaSuc] =
      await Promise.all([
        ventasPromise,
        vencidasPromise,
        sumarCobrado(desdeMesCalendario, hastaMes),
        sumarCobrado(desdeDia, hastaDia),
        sucursalId ? sumarCobrado(desdeMesCalendario, hastaMes, sucursalId) : Promise.resolve(0),
        sucursalId ? sumarCobrado(desdeDia, hastaDia, sucursalId) : Promise.resolve(0),
      ]);

    let ventasMes = 0;
    let ventasMesHastaHoy = 0;
    let ventasDia = 0;
    let ventasAyer = 0;
    let ventasMesAnt = 0;
    let ventasMesSuc = 0;
    let ventasMesHastaHoySuc = 0;
    let ventasDiaSuc = 0;
    let ventasAyerSuc = 0;
    let ventasMesAntSuc = 0;
    const ventasDiaPorSucursal = new Map<string, number>();
    const ventasMesPorSucursal = new Map<string, number>();
    const ventasAnioPorSucursal = new Map<string, number>();
    const ventasPorDiaSucursal = new Map<string, Map<string, number>>();
    const ventasPorMes = new Map<number, number>();
    const ventasPorMesSucursal = new Map<string, Map<number, number>>();
    const ventasHastaHoyPorSucursal = new Map<string, number>();
    for (const row of ventas) {
      if (!esFacturaTipo(row.tipoComprobante)) continue;
      const signo = esFacturaTipoNotaCredito(row.tipoComprobante) ? -1 : 1;
      const importe = signo * Number(row.impTotal) * Number(row.cotizacion);
      const fechaIso = isoYmdFromPrismaDateOnly(row.fecha);
      const idVenta = sucursalIdDeVenta(row, sucursalIdPorCodigo);
      const deLaSucursal = sucursalId != null && idVenta === sucursalId;
      const enMesActual = fechaIso >= desdeMesIso && fechaIso < hastaMesIso;
      const enAnio = fechaIso >= desdeAnioIso && fechaIso < hastaAnioIso;
      const enMesHastaHoy = fechaIso >= desdeMesIso && fechaIso <= hoyIso;
      const enMesAnteriorEq = fechaIso >= desdeMesAntIso && fechaIso <= hastaEqIso;
      if (enMesActual) {
        ventasMes += importe;
        if (deLaSucursal) ventasMesSuc += importe;
        if (idVenta) {
          ventasMesPorSucursal.set(idVenta, (ventasMesPorSucursal.get(idVenta) ?? 0) + importe);
        }
      }
      if (enAnio) {
        const mesFila = Number(fechaIso.slice(5, 7));
        ventasPorMes.set(mesFila, (ventasPorMes.get(mesFila) ?? 0) + importe);
        if (idVenta) {
          ventasAnioPorSucursal.set(idVenta, (ventasAnioPorSucursal.get(idVenta) ?? 0) + importe);
          const porMes = ventasPorMesSucursal.get(idVenta) ?? new Map<number, number>();
          porMes.set(mesFila, (porMes.get(mesFila) ?? 0) + importe);
          ventasPorMesSucursal.set(idVenta, porMes);
          const porDia = ventasPorDiaSucursal.get(idVenta) ?? new Map<string, number>();
          porDia.set(fechaIso, (porDia.get(fechaIso) ?? 0) + importe);
          ventasPorDiaSucursal.set(idVenta, porDia);
        }
      }
      if (enMesHastaHoy) {
        ventasMesHastaHoy += importe;
        if (deLaSucursal) ventasMesHastaHoySuc += importe;
        if (idVenta) {
          ventasHastaHoyPorSucursal.set(
            idVenta,
            (ventasHastaHoyPorSucursal.get(idVenta) ?? 0) + importe
          );
        }
      }
      if (enMesAnteriorEq) {
        ventasMesAnt += importe;
        if (deLaSucursal) ventasMesAntSuc += importe;
      }
      if (fechaIso === hoyIso) {
        ventasDia += importe;
        if (deLaSucursal) ventasDiaSuc += importe;
        if (idVenta) {
          ventasDiaPorSucursal.set(idVenta, (ventasDiaPorSucursal.get(idVenta) ?? 0) + importe);
        }
      }
      if (fechaIso === ayerIso) {
        ventasAyer += importe;
        if (deLaSucursal) ventasAyerSuc += importe;
      }
    }

    const porCliente = new Map<string, TableroVentasClienteVencido>();
    for (const row of vencidas) {
      if (!row.clienteId || !row.cliente) continue;
      if (sucursalIdDeVenta(row, sucursalIdPorCodigo) !== sucursalId) continue;
      const vencido = montoSaldoVencidoVenta({
        saldoPendiente: redondear2(
          Math.max(0, Number(row.impTotal) - Number(row.impCobrado))
        ),
        fechaIso: isoYmdFromPrismaDateOnly(row.fecha),
        diasVencimiento: row.diasVencimiento,
        hoyIso,
      });
      if (vencido <= 0.009) continue;
      const previo = porCliente.get(row.clienteId);
      porCliente.set(row.clienteId, {
        id: row.clienteId,
        nombre: previo?.nombre ?? etiquetaClienteListado(row.cliente),
        saldoVencido: redondear2((previo?.saldoVencido ?? 0) + vencido),
      });
    }
    const totalDia = redondear2(ventasDia);
    const totalMes = redondear2(ventasMes);
    const pctSobre = (monto: number, total: number) =>
      Math.abs(total) < 0.005 ? 0 : Math.round((monto / total) * 100);
    const pctMarca = (monto: number, total: number) => {
      if (Math.abs(total) < 0.005 || monto <= 0) return 0;
      return Math.min(100, Math.max(0, Math.round((monto / total) * 1000) / 10));
    };
    const participacionSucursales: TableroVentasParticipacion[] = sucursales
      .map((s) => {
        const porMes = ventasPorMesSucursal.get(s.id);
        let mesesConVentas = 0;
        if (porMes) {
          for (const neto of porMes.values()) {
            if (neto > 0.009) mesesConVentas += 1;
          }
        }
        const porDia = ventasPorDiaSucursal.get(s.id);
        let diasConVentas = 0;
        if (porDia) {
          for (const neto of porDia.values()) {
            if (neto > 0.009) diasConVentas += 1;
          }
        }
        const montoAnio = redondear2(ventasAnioPorSucursal.get(s.id) ?? 0);
        const montoPromedio =
          mesesConVentas === 0 ? 0 : redondear2(montoAnio / mesesConVentas);
        const montoPromedioDia =
          diasConVentas === 0 ? 0 : redondear2(montoAnio / diasConVentas);
        const montoDia = redondear2(ventasDiaPorSucursal.get(s.id) ?? 0);
        return {
          id: s.id,
          nombre: s.nombre.toLocaleUpperCase("es"),
          pctDia: pctSobre(montoDia, totalDia),
          montoDia,
          pctMes: pctSobre(redondear2(ventasMesPorSucursal.get(s.id) ?? 0), totalMes),
          montoMes: redondear2(ventasMesPorSucursal.get(s.id) ?? 0),
          montoPromedioDia,
          pctPromedioDia: pctMarca(montoPromedioDia, totalDia),
          montoPromedio,
          pctPromedio: pctMarca(montoPromedio, totalMes),
        };
      })
      .sort((a, b) => {
        if (b.pctMes !== a.pctMes) return b.pctMes - a.pctMes;
        return a.nombre.localeCompare(b.nombre, "es");
      });

    const diasMes = diasDelMes(anio, mes);
    const seriesMeses: TableroVentasSerieMes[] = [
      {
        id: "global",
        etiqueta: "GLOBAL",
        meses: mesesDelAnio(mes, redondear2(ventasMesHastaHoy), diasMes, diaHoy, ventasPorMes),
      },
      ...sucursales
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
        .map((s) => ({
          id: s.id,
          etiqueta: s.nombre.toLocaleUpperCase("es"),
          meses: mesesDelAnio(
            mes,
            redondear2(ventasHastaHoyPorSucursal.get(s.id) ?? 0),
            diasMes,
            diaHoy,
            ventasPorMesSucursal.get(s.id) ?? new Map()
          ),
        })),
    ];

    const clientesVencidos = [...porCliente.values()].sort((a, b) => {
      if (b.saldoVencido !== a.saldoVencido) return b.saldoVencido - a.saldoVencido;
      return a.nombre.localeCompare(b.nombre, "es");
    });

    return {
      success: true,
      data: {
        sucursalNombre: sucursalId ? sucursalNombre : null,
        sucursal: {
          dia: {
            ventas: redondear2(ventasDiaSuc),
            cobrado: cobradoDiaSuc,
            pctCobrado: pctCobradoSobreVentas(cobradoDiaSuc, ventasDiaSuc),
            comparacion: compararVentas(ventasDiaSuc, ventasAyerSuc),
          },
          mes: {
            ventas: redondear2(ventasMesSuc),
            cobrado: cobradoMesSuc,
            pctCobrado: pctCobradoSobreVentas(cobradoMesSuc, ventasMesSuc),
            comparacion: compararVentas(ventasMesHastaHoySuc, ventasMesAntSuc),
          },
        },
        globales: {
          dia: {
            ventas: redondear2(ventasDia),
            cobrado: cobradoDia,
            pctCobrado: pctCobradoSobreVentas(cobradoDia, ventasDia),
            comparacion: compararVentas(ventasDia, ventasAyer),
          },
          mes: {
            ventas: redondear2(ventasMes),
            cobrado: cobradoMes,
            pctCobrado: pctCobradoSobreVentas(cobradoMes, ventasMes),
            comparacion: compararVentas(ventasMesHastaHoy, ventasMesAnt),
          },
        },
        participacionSucursales,
        seriesMeses,
        clientesVencidos,
      },
    };
  } catch (error) {
    console.error("[tableroVentas][obtener]", error);
    return { success: false, error: "No se pudo cargar el tablero." };
  }
}

export function tableroVentasVacio(): TableroVentasDatos {
  return {
    sucursalNombre: null,
    sucursal: { dia: montosVacios(), mes: montosVacios() },
    globales: { dia: montosVacios(), mes: montosVacios() },
    participacionSucursales: [],
    seriesMeses: [
      {
        id: "global",
        etiqueta: "GLOBAL",
        meses: ETIQUETAS_MES.map((etiqueta, indice) => ({
          mes: indice + 1,
          etiqueta,
          ventas: 0,
          proyectado: null,
        })),
      },
    ],
    clientesVencidos: [],
  };
}
