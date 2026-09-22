import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  esFacturaTipo,
  type FacturaComprobanteEstado,
  type FacturaComprobanteListItem,
  type FacturaPtoVtaOpcion,
  type FacturaSucursalFiltroOption,
  type FacturaTipo,
  type FacturaUsuarioFiltroOption,
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
  fechaIso: string;
  diasVencimiento: number | null;
  tieneNc: boolean;
  hoyIso: string;
}): { saldoPendiente: number | null; diasParaVencer: number | null } {
  const esVenta = args.tipo === "factura_fiscal" || args.tipo === "factura_no_fiscal";
  if (
    !esVenta ||
    args.estado === "rechazado" ||
    args.diasVencimiento == null ||
    args.tieneNc
  ) {
    return { saldoPendiente: null, diasParaVencer: null };
  }
  const venceIso = addDaysToIsoYmdArgentina(args.fechaIso, args.diasVencimiento);
  return {
    saldoPendiente: args.impTotal,
    diasParaVencer: diffCalendarDaysIsoYmdArgentina(args.hoyIso, venceIso),
  };
}

function mapListItem(
  row: {
    id: string;
    tipoLocal: string;
    letra: string | null;
    fecha: Date;
    createdAt: Date;
    ptoVenta: string;
    cbteNro: number | null;
    receptorNombre: string;
    impTotal: Prisma.Decimal;
    diasVencimiento: number | null;
    cae: string | null;
    caeVto: Date | null;
    resultado: string | null;
    estado: string;
    ambiente: string;
    notasCredito: { id: string }[];
    personalId: number | null;
    personal: { nombrePersonal: string } | null;
    ptoVta: {
      sucursales: { sucursal: { codigo: string } }[];
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
    fechaIso,
    diasVencimiento: row.diasVencimiento,
    tieneNc: row.notasCredito.length > 0,
    hoyIso,
  });
  return {
    id: row.id,
    tipo,
    letra: row.letra,
    fechaIso,
    createdAtIso: row.createdAt.toISOString(),
    nroComprobante: formatoNroComprobante(row.ptoVenta, row.cbteNro),
    cliente: row.receptorNombre,
    impTotal,
    saldoPendiente,
    diasParaVencer,
    sucursalCodigos: [
      ...new Set(row.ptoVta.sucursales.map((link) => link.sucursal.codigo)),
    ],
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
    personalId: row.personalId,
    usuarioNombre: row.personal?.nombrePersonal ?? "",
  };
}

const listSelect = {
  id: true,
  tipoLocal: true,
  letra: true,
  fecha: true,
  createdAt: true,
  ptoVenta: true,
  cbteNro: true,
  receptorNombre: true,
  impTotal: true,
  diasVencimiento: true,
  cae: true,
  caeVto: true,
  resultado: true,
  estado: true,
  ambiente: true,
  personalId: true,
  personal: { select: { nombrePersonal: true } },
  notasCredito: { select: { id: true }, take: 1 },
  ptoVta: {
    select: {
      sucursales: {
        select: { sucursal: { select: { codigo: true } } },
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
    nombre: r.nombre,
  }));
}

export async function listarUsuariosFiltroFacturas(): Promise<
  FacturaUsuarioFiltroOption[]
> {
  const rows = await prisma.globalPersonal.findMany({
    select: { idPersonal: true, nombrePersonal: true },
    orderBy: { nombrePersonal: "asc" },
  });
  return rows.map((r) => ({
    idPersonal: r.idPersonal,
    nombrePersonal: r.nombrePersonal,
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
