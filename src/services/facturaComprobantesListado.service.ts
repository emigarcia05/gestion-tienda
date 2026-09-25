import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  esCobroNotaCreditoNombre,
  esFacturaTipo,
  esFacturaTipoNotaCredito,
  esFacturaTipoVenta,
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const TIPOS_NC_CTA = ["nota_credito_fiscal", "nota_credito_no_fiscal"] as const;

async function idsNotaCreditoPorNro(
  nros: readonly string[]
): Promise<Map<string, string>> {
  const unicos = [...new Set(nros.map((n) => n.trim()).filter(Boolean))];
  const out = new Map<string, string>();
  if (unicos.length === 0) return out;
  const cbtes = [
    ...new Set(
      unicos.flatMap((n) => {
        const i = n.lastIndexOf("-");
        if (i <= 0) return [];
        const cbteNro = Number.parseInt(n.slice(i + 1), 10);
        return Number.isInteger(cbteNro) && cbteNro > 0 ? [cbteNro] : [];
      })
    ),
  ];
  if (cbtes.length === 0) return out;
  const rows = await prisma.comprobanteVta.findMany({
    where: {
      tipoComprobante: { in: [...TIPOS_NC_CTA] },
      cbteNro: { in: cbtes },
    },
    select: { id: true, ptoVenta: true, cbteNro: true },
  });
  const wanted = new Set(unicos);
  for (const r of rows) {
    const nro = formatoNroComprobante(r.ptoVenta, r.cbteNro);
    if (wanted.has(nro) && !out.has(nro)) out.set(nro, r.id);
  }
  return out;
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
  hoyIso: string;
}): { saldoPendiente: number | null; diasVencido: number | null } {
  const esVenta = esFacturaTipoVenta(args.tipo);
  const esNc = esFacturaTipoNotaCredito(args.tipo);
  if ((!esVenta && !esNc) || args.estado === "rechazado") {
    return { saldoPendiente: null, diasVencido: null };
  }
  const saldo = Math.max(0, Math.round((args.impTotal - args.impCobrado) * 100) / 100);
  if (saldo <= 0) {
    return { saldoPendiente: null, diasVencido: null };
  }
  if (esNc || args.diasVencimiento == null) {
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

async function usadoImputadoNcPorNro(
  nros: readonly string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const claves = [...new Set(nros.map((n) => n.trim()).filter(Boolean))];
  if (claves.length === 0) return out;
  const cobros = await prisma.comprobanteVtaCobro.findMany({
    where: { entidadNombre: { in: claves } },
    select: { entidadNombre: true, pagoNombre: true, montoCents: true },
  });
  for (const cobro of cobros) {
    if (!esCobroNotaCreditoNombre(cobro.pagoNombre)) continue;
    const nro = cobro.entidadNombre.trim();
    out.set(nro, round2((out.get(nro) ?? 0) + cobro.montoCents / 100));
  }
  return out;
}

async function usadoDevolucionNcPorId(
  ids: readonly string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const claves = [...new Set(ids.filter(Boolean))];
  if (claves.length === 0) return out;
  const cobros = await prisma.comprobanteVtaCobro.findMany({
    where: { comprobanteId: { in: claves } },
    select: { comprobanteId: true, montoCents: true },
  });
  for (const cobro of cobros) {
    out.set(
      cobro.comprobanteId,
      round2((out.get(cobro.comprobanteId) ?? 0) + cobro.montoCents / 100)
    );
  }
  return out;
}

/** Imputaciones a ventas + devoluciones (cobros en la propia NC). */
export async function usadoNotaCreditoPesos(
  nro: string,
  ncId: string
): Promise<number> {
  const [imputado, devolucion] = await Promise.all([
    usadoImputadoNcPorNro([nro]),
    usadoDevolucionNcPorId([ncId]),
  ]);
  return round2((imputado.get(nro.trim()) ?? 0) + (devolucion.get(ncId) ?? 0));
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
  hoyIso: string,
  usadoNc: number | null
): FacturaComprobanteListItem {
  const tipo: FacturaTipo = esFacturaTipo(row.tipoComprobante)
    ? row.tipoComprobante
    : "factura_no_fiscal";
  const estado = asEstado(row.estado);
  const fechaIso = isoYmdFromPrismaDateOnly(row.fecha);
  const impTotal = decimalToNumber(row.impTotal);
  const impCobrado = esFacturaTipoNotaCredito(tipo)
    ? (usadoNc ?? 0)
    : decimalToNumber(row.impCobrado);
  const { saldoPendiente, diasVencido } = saldoYDiasCtaCte({
    tipo,
    estado,
    impTotal,
    impCobrado,
    fechaIso,
    diasVencimiento: row.diasVencimiento,
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
  const ncs = rows
    .filter((row) =>
      esFacturaTipoNotaCredito(
        esFacturaTipo(row.tipoComprobante) ? row.tipoComprobante : "factura_no_fiscal"
      )
    )
    .map((row) => ({
      id: row.id,
      nro: formatoNroComprobante(row.ptoVenta, row.cbteNro),
    }));
  const [imputadosNc, devolucionesNc] = await Promise.all([
    usadoImputadoNcPorNro(ncs.map((n) => n.nro)),
    usadoDevolucionNcPorId(ncs.map((n) => n.id)),
  ]);
  const usadosNc = new Map<string, number>();
  for (const nc of ncs) {
    usadosNc.set(
      nc.nro,
      round2((imputadosNc.get(nc.nro) ?? 0) + (devolucionesNc.get(nc.id) ?? 0))
    );
  }
  return rows.map((row) => {
    const nro = formatoNroComprobante(row.ptoVenta, row.cbteNro);
    return mapListItem(row, hoyIso, usadosNc.get(nro) ?? 0);
  });
}

export async function listarPresupuestosComprobantes(): Promise<FacturaComprobanteListItem[]> {
  const hoyIso = dateToIsoYmdArgentina(new Date());
  const rows = await prisma.comprobanteVta.findMany({
    where: { tipoComprobante: "presupuesto" },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    take: 500,
    select: listSelect,
  });
  return rows.map((row) => mapListItem(row, hoyIso, null));
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
      ptoVenta: true,
      cbteNro: true,
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
  let impCobrado = decimalToNumber(row.impCobrado);
  if (esFacturaTipoNotaCredito(tipo) && asEstado(row.estado) !== "rechazado") {
    const nro = formatoNroComprobante(row.ptoVenta, row.cbteNro);
    impCobrado = await usadoNotaCreditoPesos(nro, comprobanteId);
  }
  const { saldoPendiente } = saldoYDiasCtaCte({
    tipo,
    estado,
    impTotal: decimalToNumber(row.impTotal),
    impCobrado,
    fechaIso,
    diasVencimiento: row.diasVencimiento,
    hoyIso: dateToIsoYmdArgentina(new Date()),
  });
  const personalNombre =
    row.personal?.nombrePersonal.trim().toLocaleUpperCase("es-AR") ?? "";
  const idNcPorNro = await idsNotaCreditoPorNro(
    row.cobros
      .filter((c) => esCobroNotaCreditoNombre(c.pagoNombre))
      .map((c) => c.entidadNombre)
  );
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
      notaCreditoId: esCobroNotaCreditoNombre(r.pagoNombre)
        ? idNcPorNro.get(r.entidadNombre.trim()) ?? null
        : null,
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
      personal: { select: { nombrePersonal: true } },
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
    },
  });
  if (!nc) return null;
  const tipo: FacturaTipo = esFacturaTipo(nc.tipoComprobante)
    ? nc.tipoComprobante
    : "factura_no_fiscal";
  if (!esFacturaTipoNotaCredito(tipo)) return null;

  const nro = formatoNroComprobante(nc.ptoVenta, nc.cbteNro);
  const personalNombreNc =
    nc.personal?.nombrePersonal.trim().toLocaleUpperCase("es-AR") ?? "";
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
          id: true,
          ptoVenta: true,
          cbteNro: true,
          personal: { select: { nombrePersonal: true } },
        },
      },
    },
  });
  const asignaciones = cobros
    .filter(
      (c) =>
        esCobroNotaCreditoNombre(c.pagoNombre) && c.comprobante.id !== notaCreditoId
    )
    .map((c) => ({
      id: c.id,
      comprobanteId: c.comprobante.id,
      comprobanteNro: formatoNroComprobante(c.comprobante.ptoVenta, c.comprobante.cbteNro),
      createdAtIso: c.createdAt.toISOString(),
      montoCents: c.montoCents,
      personalNombre:
        c.comprobante.personal?.nombrePersonal.trim().toLocaleUpperCase("es-AR") ?? "",
    }));
  const devoluciones = nc.cobros.map((r) => ({
    id: r.id,
    createdAtIso: r.createdAt.toISOString(),
    pagoNombre: r.pagoNombre,
    entidadNombre: r.entidadNombre,
    cuotaEtiqueta: r.cuotaEtiqueta,
    montoCents: r.montoCents,
    esCuentaCorriente: r.esCuentaCorriente,
    plazoDias: r.plazoDias,
    personalNombre: personalNombreNc,
    notaCreditoId: null,
  }));
  const usado = round2(
    asignaciones.reduce((acc, a) => acc + a.montoCents, 0) / 100 +
      devoluciones.reduce((acc, d) => acc + d.montoCents, 0) / 100
  );
  const saldoDisponible = Math.max(
    0,
    round2(decimalToNumber(nc.impTotal) - usado)
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
      hoyIso,
    });
    if (saldoPendiente == null || saldoPendiente <= 0) return [];
    return [
      {
        id: row.id,
        nroComprobante: formatoNroComprobante(row.ptoVenta, row.cbteNro),
        fechaIso: isoYmdFromPrismaDateOnly(row.fecha),
        saldoPendiente,
      },
    ];
  });

  const pendienteCliente = round2(
    ventas.reduce((acc, v) => acc + v.saldoPendiente, 0)
  );
  const saldoADevolver = round2(Math.max(0, saldoDisponible - pendienteCliente));

  return { asignaciones, devoluciones, saldoDisponible, saldoADevolver, ventas };
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
    const notaCreditoId = esCobroNotaCreditoNombre(row.pagoNombre)
      ? (await idsNotaCreditoPorNro([row.entidadNombre])).get(
          row.entidadNombre.trim()
        ) ?? null
      : null;
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
          notaCreditoId,
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
