import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  esFacturaTipo,
  type FacturaComprobanteEstado,
  type FacturaComprobanteListItem,
  type FacturaPtoVtaOpcion,
  type FacturaTipo,
} from "@/lib/factura";
import { formatoNroComprobante } from "@/lib/facturaFiscal";
import { isoYmdFromPrismaDateOnly } from "@/lib/fechaArgentina";

function decimalToNumber(value: Prisma.Decimal | number): number {
  return Number(value);
}

function asEstado(raw: string): FacturaComprobanteEstado {
  if (raw === "borrador" || raw === "autorizado" || raw === "rechazado") return raw;
  return "borrador";
}

function mapListItem(row: {
  id: string;
  tipoLocal: string;
  letra: string | null;
  fecha: Date;
  ptoVenta: string;
  cbteNro: number | null;
  receptorNombre: string;
  impTotal: Prisma.Decimal;
  cae: string | null;
  caeVto: Date | null;
  resultado: string | null;
  estado: string;
  ambiente: string;
  notasCredito: { id: string }[];
}): FacturaComprobanteListItem {
  const tipo: FacturaTipo = esFacturaTipo(row.tipoLocal)
    ? row.tipoLocal
    : "factura_no_fiscal";
  return {
    id: row.id,
    tipo,
    letra: row.letra,
    fechaIso: isoYmdFromPrismaDateOnly(row.fecha),
    nroComprobante: formatoNroComprobante(row.ptoVenta, row.cbteNro),
    cliente: row.receptorNombre,
    impTotal: decimalToNumber(row.impTotal),
    cae: row.cae,
    caeVtoIso: row.caeVto ? isoYmdFromPrismaDateOnly(row.caeVto) : null,
    resultado: row.resultado,
    estado: asEstado(row.estado),
    ambiente: row.ambiente,
    puedeNc:
      tipo === "factura_fiscal" &&
      row.estado === "autorizado" &&
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
  cae: true,
  caeVto: true,
  resultado: true,
  estado: true,
  ambiente: true,
  notasCredito: { select: { id: true }, take: 1 },
} as const;

export async function listarFacturaPtoVtasActivos(): Promise<FacturaPtoVtaOpcion[]> {
  const rows = await prisma.globalPtoVta.findMany({
    where: { estado: "activo" },
    orderBy: { ptoVenta: "asc" },
    select: {
      id: true,
      ptoVenta: true,
      nombreTitular: true,
      cuit: true,
      condicionIva: true,
      condicionIvaArca: { select: { descripcion: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    ptoVenta: r.ptoVenta,
    nombreTitular: r.nombreTitular.toLocaleUpperCase("es-AR"),
    cuit: r.cuit,
    condicionIva: r.condicionIva,
    condicionIvaDescripcion: r.condicionIvaArca?.descripcion ?? null,
  }));
}

export async function listarFacturasComprobantes(): Promise<FacturaComprobanteListItem[]> {
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
  return rows.map(mapListItem);
}

export async function listarPresupuestosComprobantes(): Promise<FacturaComprobanteListItem[]> {
  const rows = await prisma.comprobanteVta.findMany({
    where: { tipoLocal: "presupuesto" },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    take: 500,
    select: listSelect,
  });
  return rows.map(mapListItem);
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
