import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  esCobroNotaCreditoNombre,
  esFacturaTipo,
  esFacturaTipoNotaCredito,
  type FacturaCobroDetalle,
  type FacturaNcCobroVista,
  type FacturaComprobanteCobroItem,
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
  impCobrado: number;
  fechaIso: string;
  diasVencimiento: number | null;
  tieneNc: boolean;
  hoyIso: string;
}): { saldoPendiente: number | null; diasVencido: number | null } {
  const esVenta = args.tipo === "factura_fiscal" || args.tipo === "factura_no_fiscal";
  if (!esVenta || args.estado === "rechazado" || args.tieneNc) {
    return { saldoPendiente: null, diasVencido: null };
  }
  const saldo = Math.max(0, Math.round((args.impTotal - args.impCobrado) * 100) / 100);
  if (saldo <= 0) {
    return { saldoPendiente: null, diasVencido: null };
  }
  if (args.diasVencimiento == null) {
    return { saldoPendiente: saldo, diasVencido: null };
  }
  const venceIso = addDaysToIsoYmdArgentina(args.fechaIso, args.diasVencimiento);
  const diasDesdeVence = diffCalendarDaysIsoYmdArgentina(venceIso, args.hoyIso);
  return {
    saldoPendiente: saldo,
    diasVencido:
      diasDesdeVence != null && diasDesdeVence > 0 ? diasDesdeVence : null,
  };
}

function mapListItem(
  row: {
    id: string;
    tipoComprobante: string;
    letra: string | null;
    fecha: Date;
    createdAt: Date;
    ptoVenta: string;
    cbteNro: number | null;
    receptorNombre: string;
    clienteId: string | null;
    proyectoId: string | null;
    impTotal: Prisma.Decimal;
    impCobrado: Prisma.Decimal;
    diasVencimiento: number | null;
    personalId: number | null;
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
  const tipo: FacturaTipo = esFacturaTipo(row.tipoComprobante)
    ? row.tipoComprobante
    : "factura_no_fiscal";
  const estado = asEstado(row.estado);
  const fechaIso = isoYmdFromPrismaDateOnly(row.fecha);
  const impTotal = decimalToNumber(row.impTotal);
  const { saldoPendiente, diasVencido } = saldoYDiasCtaCte({
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
    createdAtIso: row.createdAt.toISOString(),
    nroComprobante: formatoNroComprobante(row.ptoVenta, row.cbteNro),
    cliente: row.receptorNombre,
    clienteId: row.clienteId,
    proyectoId: row.proyectoId,
    impTotal,
    saldoPendiente,
    diasVencido,
    sucursalCodigos: [...new Set(sucursalesPto.map((s) => s.codigo))],
    sucursalNombres: [...new Set(sucursalesPto.map((s) => s.nombre))],
    usuarioNombre: row.personal?.nombrePersonal.trim().toLocaleUpperCase("es-AR") ?? "",
    personalId: row.personalId,
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
  tipoComprobante: true,
  letra: true,
  fecha: true,
  createdAt: true,
  ptoVenta: true,
  cbteNro: true,
  receptorNombre: true,
  clienteId: true,
  proyectoId: true,
  impTotal: true,
  impCobrado: true,
  diasVencimiento: true,
  personalId: true,
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
      sucursales: {
        select: { sucursal: { select: { codigo: true } } },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    ptoVenta: r.ptoVenta,
    titular: r.titular.toLocaleUpperCase("es-AR"),
    cuit: r.cuit,
    condicionIva: r.condicionIva,
    condicionIvaDescripcion: r.condicionIvaArca?.descripcion ?? null,
    sucursalCodigos: [
      ...new Set(r.sucursales.map((link) => link.sucursal.codigo)),
    ],
  }));
}

export async function listarUsuariosFiltroFacturas(): Promise<
  FacturaUsuarioFiltroOption[]
> {
  const rows = await prisma.globalPersonal.findMany({
    select: {
      idPersonal: true,
      nombrePersonal: true,
      sucursalPorDefecto: true,
      modulosPermitidos: true,
    },
    orderBy: { nombrePersonal: "asc" },
  });
  return rows
    .filter(
      (r) => r.sucursalPorDefecto != null && r.modulosPermitidos.length > 0
    )
    .map((r) => ({
      idPersonal: r.idPersonal,
      nombrePersonal: r.nombrePersonal.trim().toLocaleUpperCase("es-AR"),
    }));
}

export async function listarFacturasComprobantes(): Promise<FacturaComprobanteListItem[]> {
  const hoyIso = dateToIsoYmdArgentina(new Date());
  const rows = await prisma.comprobanteVta.findMany({
    where: {
      tipoComprobante: {
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
    where: { tipoComprobante: "presupuesto" },
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
      tipoComprobante: "factura_fiscal",
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
): Promise<{
  items: FacturaComprobanteCobroItem[];
  saldoPendiente: number | null;
}> {
  const row = await prisma.comprobanteVta.findUnique({
    where: { id: comprobanteId },
    select: {
      tipoComprobante: true,
      estado: true,
      impTotal: true,
      impCobrado: true,
      fecha: true,
      diasVencimiento: true,
      notasCredito: { select: { id: true }, take: 1 },
      cobros: {
        orderBy: { orden: "asc" },
        select: {
          id: true,
          createdAt: true,
          pagoNombre: true,
          entidadNombre: true,
          cuotaEtiqueta: true,
          montoCents: true,
          esCuentaCorriente: true,
          plazoDias: true,
        },
      },
      personal: { select: { nombrePersonal: true } },
    },
  });
  if (!row) {
    return { items: [], saldoPendiente: null };
  }
  const tipo: FacturaTipo = esFacturaTipo(row.tipoComprobante)
    ? row.tipoComprobante
    : "factura_no_fiscal";
  const estado = asEstado(row.estado);
  const fechaIso = isoYmdFromPrismaDateOnly(row.fecha);
  const { saldoPendiente } = saldoYDiasCtaCte({
    tipo,
    estado,
    impTotal: decimalToNumber(row.impTotal),
    impCobrado: decimalToNumber(row.impCobrado),
    fechaIso,
    diasVencimiento: row.diasVencimiento,
    tieneNc: row.notasCredito.length > 0,
    hoyIso: dateToIsoYmdArgentina(new Date()),
  });
  const personalNombre =
    row.personal?.nombrePersonal.trim().toLocaleUpperCase("es-AR") ?? "";
  return {
    saldoPendiente,
    items: row.cobros.map((r) => ({
      id: r.id,
      createdAtIso: r.createdAt.toISOString(),
      pagoNombre: r.pagoNombre,
      entidadNombre: r.entidadNombre,
      cuotaEtiqueta: r.cuotaEtiqueta,
      montoCents: r.montoCents,
      esCuentaCorriente: r.esCuentaCorriente,
      plazoDias: r.plazoDias,
      personalNombre,
    })),
  };
}

export async function listarVistaCobroNotaCredito(
  notaCreditoId: string
): Promise<FacturaNcCobroVista | null> {
  const nc = await prisma.comprobanteVta.findUnique({
    where: { id: notaCreditoId },
    select: {
      tipoComprobante: true,
      ptoVenta: true,
      cbteNro: true,
      impTotal: true,
      clienteId: true,
    },
  });
  if (!nc) return null;
  const tipo: FacturaTipo = esFacturaTipo(nc.tipoComprobante)
    ? nc.tipoComprobante
    : "factura_no_fiscal";
  if (!esFacturaTipoNotaCredito(tipo)) return null;

  const nro = formatoNroComprobante(nc.ptoVenta, nc.cbteNro);
  const cobros = await prisma.comprobanteVtaCobro.findMany({
    where: { entidadNombre: nro },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      pagoNombre: true,
      montoCents: true,
      comprobante: {
        select: {
          ptoVenta: true,
          cbteNro: true,
          personal: { select: { nombrePersonal: true } },
        },
      },
    },
  });
  const asignaciones = cobros
    .filter((c) => esCobroNotaCreditoNombre(c.pagoNombre))
    .map((c) => ({
      id: c.id,
      comprobanteNro: formatoNroComprobante(c.comprobante.ptoVenta, c.comprobante.cbteNro),
      createdAtIso: c.createdAt.toISOString(),
      montoCents: c.montoCents,
      personalNombre:
        c.comprobante.personal?.nombrePersonal.trim().toLocaleUpperCase("es-AR") ?? "",
    }));
  const usado = asignaciones.reduce((acc, a) => acc + a.montoCents, 0) / 100;
  const saldoDisponible = Math.max(
    0,
    Math.round((decimalToNumber(nc.impTotal) - usado) * 100) / 100
  );

  const ventasRows = nc.clienteId
    ? await prisma.comprobanteVta.findMany({
        where: {
          clienteId: nc.clienteId,
          tipoComprobante: { in: ["factura_fiscal", "factura_no_fiscal"] },
          estado: { not: "rechazado" },
        },
        orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
        take: 200,
        select: {
          id: true,
          ptoVenta: true,
          cbteNro: true,
          tipoComprobante: true,
          estado: true,
          impTotal: true,
          impCobrado: true,
          fecha: true,
          diasVencimiento: true,
          notasCredito: { select: { id: true }, take: 1 },
        },
      })
    : [];
  const hoyIso = dateToIsoYmdArgentina(new Date());
  const ventas = ventasRows.flatMap((row) => {
    const tipoVenta: FacturaTipo = esFacturaTipo(row.tipoComprobante)
      ? row.tipoComprobante
      : "factura_no_fiscal";
    const { saldoPendiente } = saldoYDiasCtaCte({
      tipo: tipoVenta,
      estado: asEstado(row.estado),
      impTotal: decimalToNumber(row.impTotal),
      impCobrado: decimalToNumber(row.impCobrado),
      fechaIso: isoYmdFromPrismaDateOnly(row.fecha),
      diasVencimiento: row.diasVencimiento,
      tieneNc: row.notasCredito.length > 0,
      hoyIso,
    });
    if (saldoPendiente == null || saldoPendiente <= 0) return [];
    return [
      {
        id: row.id,
        nroComprobante: formatoNroComprobante(row.ptoVenta, row.cbteNro),
        saldoPendiente,
      },
    ];
  });

  return { asignaciones, saldoDisponible, ventas };
}

export async function obtenerDetalleCobroComprobante(
  cobroId: string
): Promise<
  { success: true; data: FacturaCobroDetalle } | { success: false; error: string }
> {
  try {
    const row = await prisma.comprobanteVtaCobro.findUnique({
      where: { id: cobroId },
      select: {
        id: true,
        createdAt: true,
        pagoNombre: true,
        entidadNombre: true,
        cuotaEtiqueta: true,
        montoCents: true,
        esCuentaCorriente: true,
        plazoDias: true,
        comprobante: {
          select: {
            id: true,
            ptoVenta: true,
            cbteNro: true,
            personal: { select: { nombrePersonal: true } },
          },
        },
      },
    });
    if (!row) return { success: false, error: "El cobro no existe." };
    const personalNombre =
      row.comprobante.personal?.nombrePersonal.trim().toLocaleUpperCase("es-AR") ??
      "";
    return {
      success: true,
      data: {
        cobro: {
          id: row.id,
          createdAtIso: row.createdAt.toISOString(),
          pagoNombre: row.pagoNombre,
          entidadNombre: row.entidadNombre,
          cuotaEtiqueta: row.cuotaEtiqueta,
          montoCents: row.montoCents,
          esCuentaCorriente: row.esCuentaCorriente,
          plazoDias: row.plazoDias,
          personalNombre,
        },
        comprobantes: [
          {
            id: row.comprobante.id,
            nroComprobante: formatoNroComprobante(
              row.comprobante.ptoVenta,
              row.comprobante.cbteNro
            ),
          },
        ],
      },
    };
  } catch (e) {
    console.error("[facturaComprobantesListado][obtenerDetalleCobro]", e);
    return { success: false, error: "No se pudo leer el cobro." };
  }
}
