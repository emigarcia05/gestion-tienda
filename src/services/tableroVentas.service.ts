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

export interface TableroVentasMontos {
  ventas: number;
  cobrado: number;
}

export interface TableroVentasClienteVencido {
  id: string;
  nombre: string;
  saldoVencido: number;
}

export interface TableroVentasDatos {
  /** Nombre de la sucursal del usuario. Null si no tiene sucursal. */
  sucursalNombre: string | null;
  sucursal: { dia: TableroVentasMontos; mes: TableroVentasMontos };
  globales: { dia: TableroVentasMontos; mes: TableroVentasMontos };
  clientesVencidos: TableroVentasClienteVencido[];
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

function montosVacios(): TableroVentasMontos {
  return { ventas: 0, cobrado: 0 };
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
    const [anioRaw, mesRaw] = hoyIso.split("-");
    const anio = Number(anioRaw);
    const mes = Number(mesRaw);
    const desdeMesIso = isoMes(anio, mes);
    const hastaMesIso = mes === 12 ? isoMes(anio + 1, 1) : isoMes(anio, mes + 1);
    const hastaDiaIso = addDaysToIsoYmdArgentina(hoyIso, 1);
    const desdeMesCalendario = prismaDateOnlyFromIsoYmd(desdeMesIso);
    const desdeMesVentas = prismaDateOnlyFromIsoYmd(
      desdeMesIso < VENTAS_MENSUALES_DESDE_ISO ? VENTAS_MENSUALES_DESDE_ISO : desdeMesIso
    );
    const hastaMes = prismaDateOnlyFromIsoYmd(hastaMesIso);
    const desdeDia = prismaDateOnlyFromIsoYmd(hoyIso);
    const hastaDia = prismaDateOnlyFromIsoYmd(hastaDiaIso);
    if (!desdeMesCalendario || !desdeMesVentas || !hastaMes || !desdeDia || !hastaDia) {
      return { success: false, error: "No se pudo armar el período del tablero." };
    }

    const codigo = await sucursalCodigoSesion();
    const [sucursalIdPorCodigo, sucursales] = await Promise.all([
      mapaSucursalIdPorCodigo(),
      prisma.sucursal.findMany({ select: { id: true, nombre: true, codigo: true } }),
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
    let ventasDia = 0;
    let ventasMesSuc = 0;
    let ventasDiaSuc = 0;
    for (const row of ventas) {
      if (!esFacturaTipo(row.tipoComprobante)) continue;
      const signo = esFacturaTipoNotaCredito(row.tipoComprobante) ? -1 : 1;
      const importe = signo * Number(row.impTotal) * Number(row.cotizacion);
      const fechaIso = isoYmdFromPrismaDateOnly(row.fecha);
      const deLaSucursal = sucursalId != null && sucursalIdDeVenta(row, sucursalIdPorCodigo) === sucursalId;
      ventasMes += importe;
      if (deLaSucursal) ventasMesSuc += importe;
      if (fechaIso === hoyIso) {
        ventasDia += importe;
        if (deLaSucursal) ventasDiaSuc += importe;
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
    const clientesVencidos = [...porCliente.values()].sort((a, b) => {
      if (b.saldoVencido !== a.saldoVencido) return b.saldoVencido - a.saldoVencido;
      return a.nombre.localeCompare(b.nombre, "es");
    });

    return {
      success: true,
      data: {
        sucursalNombre: sucursalId ? sucursalNombre : null,
        sucursal: {
          dia: { ventas: redondear2(ventasDiaSuc), cobrado: cobradoDiaSuc },
          mes: { ventas: redondear2(ventasMesSuc), cobrado: cobradoMesSuc },
        },
        globales: {
          dia: { ventas: redondear2(ventasDia), cobrado: cobradoDia },
          mes: { ventas: redondear2(ventasMes), cobrado: cobradoMes },
        },
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
    clientesVencidos: [],
  };
}
