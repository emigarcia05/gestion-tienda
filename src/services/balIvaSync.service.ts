/**
 * Sincronización de Balance IVA (`bal_iva`) desde cada origen. Cada función es idempotente:
 * crea, actualiza o borra la única fila del origen según su estado actual. Llamar en la misma
 * transacción que la escritura del origen. Borrar el origen borra la fila (Cascade).
 *
 * - VENTA: factura / NC fiscal autorizada con IVA → DÉBITO (NC en negativo).
 * - COMPRA_MERCADERIA: comprobante de compra `fiscal` → CRÉDITO 21 % incluido en el total (NC en negativo).
 * - GASTO: imputación con `iva` y monto > 0 → CRÉDITO 21 % incluido en el monto.
 * - CX_FINANCIERO: cobro con Cx Fin cuyo vínculo `genera_iva_credito` → CRÉDITO = IVA del costo de
 *   terminal sobre el monto cobrado (devolución de NC en negativo).
 */
import { Prisma, type OrigenBalIva } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { esFacturaTipo, esFacturaTipoFiscal, esFacturaTipoNotaCredito } from "@/lib/factura";
import { formatoNroComprobante } from "@/lib/facturaFiscal";
import { ivaFinAnaCosFina } from "@/lib/finAnaCosFina";
import { ivaCreditoDesdeTotalConIva21 } from "@/lib/ivaDesdeTotalBruto21";
import { TIPO_COMP_COMPRA } from "@/lib/numeroComprobanteCompra";

type DbClient = Prisma.TransactionClient | typeof prisma;

type ClaveBalIva =
  | { comprobanteVtaId: string }
  | { comprobanteCompraId: string }
  | { gastoMensualId: string }
  | { tesoreriaMovimientoId: string };

interface LineaBalIva {
  origen: OrigenBalIva;
  fecha: Date;
  descripcion: string;
  /** Con signo: NC / devolución en negativo. */
  debito: number;
  credito: number;
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

function decimal(n: number): Prisma.Decimal {
  return new Prisma.Decimal(redondear2(n).toFixed(2));
}

/** `null` = el origen no genera IVA: se borra su fila si existía. */
async function guardarLineaBalIva(
  db: DbClient,
  clave: ClaveBalIva,
  linea: LineaBalIva | null,
  opciones: { conservarFecha?: boolean } = {}
): Promise<void> {
  if (!linea) {
    await db.balIva.deleteMany({ where: clave });
    return;
  }
  const valores = {
    descripcion: linea.descripcion.slice(0, 255),
    debito: decimal(linea.debito),
    credito: decimal(linea.credito),
  };
  await db.balIva.upsert({
    where: clave,
    create: { ...clave, origen: linea.origen, fecha: linea.fecha, ...valores },
    update: opciones.conservarFecha ? valores : { ...valores, fecha: linea.fecha },
  });
}

function nroComprobanteVta(c: {
  letra: string | null;
  ptoVenta: string;
  cbteNro: number | null;
}): string {
  return [c.letra, formatoNroComprobante(c.ptoVenta, c.cbteNro)].filter(Boolean).join(" ");
}

/** VENTA: llamar tras autorizar (idempotente; reintentable al reconsultar ARCA). */
export async function sincronizarIvaVenta(
  comprobanteVtaId: string,
  db: DbClient = prisma
): Promise<void> {
  const c = await db.comprobanteVta.findUnique({
    where: { id: comprobanteVtaId },
    select: {
      tipoComprobante: true,
      estado: true,
      cae: true,
      fecha: true,
      impIva: true,
      cotizacion: true,
      letra: true,
      ptoVenta: true,
      cbteNro: true,
      receptorNombre: true,
    },
  });
  const tipo = c && esFacturaTipo(c.tipoComprobante) ? c.tipoComprobante : null;
  const iva = c ? redondear2(Number(c.impIva) * Number(c.cotizacion)) : 0;
  if (!c || !tipo || !esFacturaTipoFiscal(tipo) || c.estado !== "autorizado" || !c.cae || iva <= 0) {
    await guardarLineaBalIva(db, { comprobanteVtaId }, null);
    return;
  }
  const esNc = esFacturaTipoNotaCredito(tipo);
  await guardarLineaBalIva(db, { comprobanteVtaId }, {
    origen: "VENTA",
    fecha: c.fecha,
    descripcion: [nroComprobanteVta(c), c.receptorNombre.toUpperCase()].filter(Boolean).join(" · "),
    debito: esNc ? -iva : iva,
    credito: 0,
  });
}

/** COMPRA_MERCADERIA: un comprobante de compra o NC. */
export async function sincronizarIvaComprobanteCompra(
  comprobanteCompraId: string,
  db: DbClient = prisma
): Promise<void> {
  const c = await db.comprobanteProveedor.findUnique({
    where: { id: comprobanteCompraId },
    select: {
      tipoComp: true,
      fiscal: true,
      total: true,
      fechaComp: true,
      comprobante: true,
      proveedor: { select: { nombre: true } },
    },
  });
  const iva = c ? ivaCreditoDesdeTotalConIva21(Number(c.total)) : 0;
  if (!c || !c.fiscal || iva <= 0) {
    await guardarLineaBalIva(db, { comprobanteCompraId }, null);
    return;
  }
  const esNc = c.tipoComp.toUpperCase() === TIPO_COMP_COMPRA.NOTA_CREDITO;
  await guardarLineaBalIva(db, { comprobanteCompraId }, {
    origen: "COMPRA_MERCADERIA",
    fecha: c.fechaComp,
    descripcion: `${c.comprobante} · ${c.proveedor.nombre.toUpperCase()}`,
    debito: 0,
    credito: esNc ? -iva : iva,
  });
}

/** COMPRA_MERCADERIA: todos los comprobantes (y NC) de un pedido recepcionado. */
export async function sincronizarIvaComprasDePedido(
  pedidoHistoriaId: string,
  db: DbClient = prisma
): Promise<void> {
  const rows = await db.comprobanteProveedor.findMany({
    where: { pedidoHistoriaId },
    select: { id: true },
  });
  for (const r of rows) {
    await sincronizarIvaComprobanteCompra(r.id, db);
  }
}

function fechaDevengoGasto(anio: number, mes: number, diaDevengado: number | null): Date {
  const diasMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const dia = Math.min(Math.max(1, diaDevengado ?? 1), diasMes);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

/**
 * GASTO: imputación mensual o eventual. `fechaGasto` (alta de eventual) fija la fecha;
 * sin ella se usa el día de devengo del catálogo y, si la fila ya existía, se conserva su fecha.
 */
export async function sincronizarIvaGastoMensual(
  gastoMensualId: string,
  db: DbClient = prisma,
  fechaGasto?: Date
): Promise<void> {
  const g = await db.finBalGastoMensual.findUnique({
    where: { id: gastoMensualId },
    select: {
      monto: true,
      iva: true,
      mes: true,
      anio: true,
      imputacionSucursal: { select: { nombre: true } },
      gastoFinal: {
        select: {
          diaDevengado: true,
          gasto: { select: { nombre: true } },
          sucursal: { select: { nombre: true } },
        },
      },
    },
  });
  const iva = g ? ivaCreditoDesdeTotalConIva21(g.monto) : 0;
  if (!g || !g.iva || iva <= 0) {
    await guardarLineaBalIva(db, { gastoMensualId }, null);
    return;
  }
  const sucursal = g.imputacionSucursal ?? g.gastoFinal.sucursal;
  await guardarLineaBalIva(
    db,
    { gastoMensualId },
    {
      origen: "GASTO",
      fecha: fechaGasto ?? fechaDevengoGasto(g.anio, g.mes, g.gastoFinal.diaDevengado),
      descripcion: [g.gastoFinal.gasto.nombre, sucursal?.nombre]
        .filter(Boolean)
        .join(" · ")
        .toUpperCase(),
      debito: 0,
      credito: iva,
    },
    { conservarFecha: !fechaGasto }
  );
}

function claveVinculo(pagoId: string, entidadId: string | null, sucursalId: string): string {
  return `${pagoId}|${entidadId ?? ""}|${sucursalId}`;
}

/**
 * CX_FINANCIERO: movimientos de cobro / devolución NC. Mismo universo que `bal_cx_financiero`,
 * solo si el vínculo de caja (`cobros_vinc_cajas`) tiene `genera_iva_credito`.
 */
export async function sincronizarIvaCxFinanciero(
  movimientoIds: readonly string[],
  db: DbClient = prisma
): Promise<void> {
  const ids = [...new Set(movimientoIds.filter(Boolean))];
  if (ids.length === 0) return;
  const movimientos = await db.tesoreriaMovimiento.findMany({
    where: {
      id: { in: ids },
      catMovimiento: { in: ["COBRO", "NOTA_CREDITO"] },
      cajaId: { not: null },
      comprobanteId: { not: null },
      pagoId: { not: null },
      costoFinanciero: { gt: 0 },
    },
    select: {
      id: true,
      tipoMovimiento: true,
      fechaRegistro: true,
      monto: true,
      pagoId: true,
      entidadId: true,
      sucursalId: true,
      cxFin: { select: { arancel: true, costoFinanciero: true } },
      pago: { select: { nombre: true } },
      entidad: { select: { nombre: true } },
      comprobante: { select: { letra: true, ptoVenta: true, cbteNro: true } },
    },
  });

  const conPago = movimientos.filter(
    (m): m is typeof m & { pagoId: string } => m.pagoId !== null
  );
  const vinculos =
    conPago.length === 0
      ? []
      : await db.cobrosPorSucursal.findMany({
          where: {
            OR: conPago.map((m) => ({
              pagoId: m.pagoId,
              entidadId: m.entidadId,
              sucursalId: m.sucursalId,
            })),
          },
          select: { pagoId: true, entidadId: true, sucursalId: true, generaIvaCredito: true },
        });
  const generaIva = new Set(
    vinculos
      .filter((v) => v.generaIvaCredito)
      .map((v) => claveVinculo(v.pagoId, v.entidadId, v.sucursalId))
  );

  const lineas = new Map<string, LineaBalIva>();
  for (const m of conPago) {
    if (!m.cxFin || !generaIva.has(claveVinculo(m.pagoId, m.entidadId, m.sucursalId))) continue;
    const ivaPct = ivaFinAnaCosFina(Number(m.cxFin.arancel), Number(m.cxFin.costoFinanciero));
    const iva = redondear2((m.monto * ivaPct) / 100);
    if (iva <= 0) continue;
    const forma = [m.pago?.nombre, m.entidad?.nombre].filter(Boolean).join(" ");
    const comprobante = m.comprobante ? nroComprobanteVta(m.comprobante) : "";
    lineas.set(m.id, {
      origen: "CX_FINANCIERO",
      fecha: m.fechaRegistro,
      descripcion: [forma, comprobante].filter(Boolean).join(" · ").toUpperCase(),
      debito: 0,
      credito: m.tipoMovimiento === "EGRESO" ? -iva : iva,
    });
  }

  for (const id of ids) {
    await guardarLineaBalIva(db, { tesoreriaMovimientoId: id }, lineas.get(id) ?? null);
  }
}
