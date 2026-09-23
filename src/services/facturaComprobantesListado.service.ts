import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  esFacturaTipo,
  type FacturaComprobanteCobroItem,
  type FacturaComprobanteEstado,
  type FacturaComprobanteListItem,
  type FacturaPtoVtaOpcion,
  type FacturaSucursalFiltroOption,
  type FacturaTipo,
} from "@/lib/factura";
import { formatoNroComprobante } from "@/lib/facturaFiscal";
import {
  addDaysToIsoYmdArgentina,
  dateToIsoYmdArgentina,
  diffCalendarDaysIsoYmdArgentina,
  isoYmdFromPrismaDateOnly,
} from "@/lib/fechaArgentina";

function decimalToNumber(value: Prisma.Decimal | number): number {
  return Number(value);
}

function asEstado(raw: string): FacturaComprobanteEstado {
  if (raw === "borrador" || raw === "autorizado" || raw === "rechazado") return raw;
  return "borrador";
}

function saldoYDiasCtaCte(args: {
  tipo: FacturaTipo;
  estado: FacturaComprobanteEstado;
  impTotal: number;
  impCobrado: number;
  fechaIso: string;
  diasVencimiento: number | null;
  tieneNc: boolean;
  hoyIso: string;
}): { saldoPendiente: number | null; diasParaVencer: number | null } {
  const esVenta = args.tipo === "factura_fiscal" || args.tipo === "factura_no_fiscal";
  if (!esVenta || args.estado === "rechazado" || args.tieneNc) {
    return { saldoPendiente: null, diasParaVencer: null };
  }
  const saldo = Math.max(0, Math.round((args.impTotal - args.impCobrado) * 100) / 100);
  if (saldo <= 0) {
    return { saldoPendiente: null, diasParaVencer: null };
  }
  if (args.diasVencimiento == null) {
    return { saldoPendiente: saldo, diasParaVencer: null };
  }
  const venceIso = addDaysToIsoYmdArgentina(args.fechaIso, args.diasVencimiento);
  return {
    saldoPendiente: saldo,
    diasParaVencer: diffCalendarDaysIsoYmdArgentina(args.hoyIso, venceIso),
  };
}

function mapListItem(
  row: {
    id: string;
    tipoLocal: string;
    letra: string | null;
    fecha: Date;
    ptoVenta: string;
    cbteNro: number | null;
    receptorNombre: string;
    impTotal: Prisma.Decimal;
    impCobrado: Prisma.Decimal;
    diasVencimiento: number | null;
    cae: string | null;
    caeVto: Date | null;
    resultado: string | null;
    estado: string;
    ambiente: string;
    notasCredito: { id: string }[];
    personal: { nombrePersonal: string } | null;
    ptoVta: {
      sucursales: { sucursal: { codigo: string; nombre: string } }[];
    };
  },
  hoyIso: string
): FacturaComprobanteListItem {
  const tipo: FacturaTipo = esFacturaTipo(row.tipoLocal)
    ? row.tipoLocal
    : "factura_no_fiscal";
  const estado = asEstado(row.estado);
  const fechaIso = isoYmdFromPrismaDateOnly(row.fecha);
  const impTotal = decimalToNumber(row.impTotal);
  const { saldoPendiente, diasParaVencer } = saldoYDiasCtaCte({
    tipo,
    estado,
    impTotal,
    impCobrado: decimalToNumber(row.impCobrado),
    fechaIso,
    diasVencimiento: row.diasVencimiento,
    tieneNc: row.notasCredito.length > 0,
    hoyIso,
  });
  const sucursalesPto = row.ptoVta.sucursales.map((link) => ({
    codigo: link.sucursal.codigo,
    nombre: link.sucursal.nombre.toLocaleUpperCase("es-AR"),
  }));
  return {
    id: row.id,
    tipo,
    letra: row.letra,
    fechaIso,
    nroComprobante: formatoNroComprobante(row.ptoVenta, row.cbteNro),
    cliente: row.receptorNombre,
    impTotal,
    saldoPendiente,
    diasParaVencer,
    sucursalCodigos: [...new Set(sucursalesPto.map((s) => s.codigo))],
    sucursalNombres: [...new Set(sucursalesPto.map((s) => s.nombre))],
    usuarioNombre: row.personal?.nombrePersonal.trim().toLocaleUpperCase("es-AR") ?? "",
    cae: row.cae,
    caeVtoIso: row.caeVto ? isoYmdFromPrismaDateOnly(row.caeVto) : null,
    resultado: row.resultado,
    estado,
    ambiente: row.ambiente,
    puedeNc:
      tipo === "factura_fiscal" &&
      estado === "autorizado" &&
      Boolean(row.cae) &&
      row.notasCredito.length === 0,
  };
}

const listSelect = {
  id: true,
  tipoLocal: true,
  letra: true,
  fecha: true,
  ptoVenta: true,
  cbteNro: true,
  receptorNombre: true,
  impTotal: true,
  impCobrado: true,
  diasVencimiento: true,
  cae: true,
  caeVto: true,
  resultado: true,
  estado: true,
  ambiente: true,
  notasCredito: { select: { id: true }, take: 1 },
  personal: { select: { nombrePersonal: true } },
  ptoVta: {
    select: {
      sucursales: {
        select: { sucursal: { select: { codigo: true, nombre: true } } },
      },
    },
  },
} as const;

export async function listarSucursalesFiltroFacturas(): Promise<
  FacturaSucursalFiltroOption[]
> {
  const rows = await prisma.sucursal.findMany({
    where: { generaEst: true },
    select: { codigo: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
  return rows.map((r) => ({
    codigo: r.codigo,
    nombre: r.nombre.toLocaleUpperCase("es-AR"),
  }));
}

export async function listarFacturaPtoVtasActivos(): Promise<FacturaPtoVtaOpcion[]> {
  const rows = await prisma.globalPtoVta.findMany({
    where: { estado: "activo" },
    orderBy: { ptoVenta: "asc" },
    select: {
      id: true,
      ptoVenta: true,
      titular: true,
      cuit: true,
      condicionIva: true,
      condicionIvaArca: { select: { descripcion: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    ptoVenta: r.ptoVenta,
    titular: r.titular.toLocaleUpperCase("es-AR"),
    cuit: r.cuit,
    condicionIva: r.condicionIva,
    condicionIvaDescripcion: r.condicionIvaArca?.descripcion ?? null,
  }));
}

export async function listarFacturasComprobantes(): Promise<FacturaComprobanteListItem[]> {
  const hoyIso = dateToIsoYmdArgentina(new Date());
  const rows = await prisma.comprobanteVta.findMany({
    where: {
      tipoLocal: {
        in: [
          "factura_no_fiscal",
          "factura_fiscal",
          "nota_credito_no_fiscal",
          "nota_credito_fiscal",
        ],
      },
    },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    take: 500,
    select: listSelect,
  });
  return rows.map((row) => mapListItem(row, hoyIso));
}

export async function listarPresupuestosComprobantes(): Promise<FacturaComprobanteListItem[]> {
  const hoyIso = dateToIsoYmdArgentina(new Date());
  const rows = await prisma.comprobanteVta.findMany({
    where: { tipoLocal: "presupuesto" },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    take: 500,
    select: listSelect,
  });
  return rows.map((row) => mapListItem(row, hoyIso));
}

export async function listarFacturasAutorizadasParaNc(): Promise<
  { id: string; label: string }[]
> {
  const rows = await prisma.comprobanteVta.findMany({
    where: {
      tipoLocal: "factura_fiscal",
      estado: "autorizado",
      cae: { not: null },
      notasCredito: { none: {} },
    },
    orderBy: [{ fecha: "desc" }, { cbteNro: "desc" }],
    take: 80,
    select: {
      id: true,
      letra: true,
      ptoVenta: true,
      cbteNro: true,
      receptorNombre: true,
      fecha: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    label: `${formatoNroComprobante(r.ptoVenta, r.cbteNro)} · ${r.letra ?? ""} · ${r.receptorNombre} · ${isoYmdFromPrismaDateOnly(r.fecha)}`.trim(),
  }));
}

export async function listarCobrosComprobanteVta(
  comprobanteId: string
): Promise<FacturaComprobanteCobroItem[]> {
  const rows = await prisma.comprobanteVtaCobro.findMany({
    where: { comprobanteId },
    orderBy: { orden: "asc" },
    select: {
      id: true,
      pagoNombre: true,
      entidadNombre: true,
      cuotaEtiqueta: true,
      montoCents: true,
      esCuentaCorriente: true,
      plazoDias: true,
    },
  });
  return rows;
}
