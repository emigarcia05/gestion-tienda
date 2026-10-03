import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  arcaCertificadosConfigurados,
  topeCfSinDocDesdeEnv,
  wsfeCaeSolicitar,
  wsfeCompConsultar,
  wsfeCompUltimoAutorizado,
  wsfeDummy,
  wsfeParamGetPtosVenta,
  wsfeParamGetTiposCbte,
  type WsfeCaeRequest,
} from "@/lib/arca";
import {
  ambienteArcaActual,
  obtenerAuthWsfe,
} from "@/services/arcaAuth.service";
import {
  obtenerClienteListaPorId,
  saldosCuentaCorrientePorCliente,
} from "@/services/clientes.service";
import {
  listarVentasPendientesPagoCuentaCorriente,
  listarVistaCobroNotaCredito,
  usadoNotaCreditoPesos,
} from "@/services/facturaComprobantesListado.service";
import {
  dateToIsoYmdArgentina,
  isoYmdFromPrismaDateOnly,
  isoYmdToYyyymmdd,
  prismaDateOnlyFromIsoYmd,
  yyyymmddToIsoYmd,
} from "@/lib/fechaArgentina";
import {
  efectoStockPorTipo,
  diasVencimientoPorSaldoPendiente,
  esCobroNotaCreditoNombre,
  esFacturaTipo,
  esFacturaTipoFiscal,
  esFacturaTipoNotaCredito,
  esFacturaTipoVenta,
  ncPermiteDevolucion,
  puedeConvertirComprobanteEnFiscal,
  puedeEliminarComprobante,
  tipoFiscalDesdeNoFiscal,
  tipoNotaCreditoDesdeVenta,
  impCobradoDesdeCobros,
  imputarPagoFifoVentas,
  saldoPendienteTrasCobro,
  MENSAJE_CLIENTE_TOPE_CTA_CORRIENTE,
  MENSAJE_PERSONAL_SIN_SUCURSAL,
  MENSAJE_PTO_VTA_SUCURSAL_USUARIO,
  clienteSuperaTopeCtaCorriente,
  mensajeClienteFacturaNoSeleccionado,
  nombreClienteFactura,
  porcentajeDescuentoGlobal,
  porcentajeDescuentoLinea,
  pxConDescuento,
  resumenTotalesFactura,
  type FacturaComprobanteDuplicarBorrador,
  type FacturaComprobanteEstado,
  type FacturaDescuentoEstado,
  type FacturaEmitirResultado,
  type FacturaLineaLocal,
  type FacturaTipo,
} from "@/lib/factura";
import {
  ARCA_ALICUOTA_IVA_DEFAULT,
  ARCA_CONDICION_IVA,
  ARCA_DOC_TIPO,
  alicuotasParaRepresentacion,
  aplicarDocumentoConsumidorFinal,
  armarTotalesWsfe,
  coherenciaImpTotal,
  docNroAEnteroArca,
  esCuitValido,
  esTipoComprobanteFiscal,
  formatoNroComprobante,
  ivaIdDesdeAlicuota,
  leyendaCondicionIvaEmisor,
  operacionDiscriminaIva,
  operacionTransparenciaFiscal,
  ptoVentaAEnteroArca,
  receptorFiscalParaEmitir,
  receptorRequiereCuit,
  resolverLetraYCbteTipo,
  roundArs2,
  type ArcaLetra,
  type ReceptorFiscalSnapshot,
} from "@/lib/facturaFiscal";
import type {
  EmitirFacturaComprobanteInput,
  GuardarDiasVencimientoFacturaInput,
  RegistrarCobroComprobanteFacturaInput,
  RegistrarPagoCuentaCorrienteInput,
  AsignarClienteCobroComoCobroInput,
} from "@/lib/validations/factura";
import {
  emisorPdfDesdePtoVta,
  type FacturaComprobantePdfEmisor,
  type FacturaComprobantePdfFiscal,
} from "@/lib/facturaComprobantePdfEmisor";
import { etiquetaCondicionIvaArca } from "@/lib/globalPtoVtas";
import type { ServiceResult } from "@/types/service.types";
import {
  conComprobanteEnMovimientos,
  crearMovimientosCobroPreparados,
  prepararMovimientosCobroDesdeSnapshots,
  type MovimientoCobroFacturaData,
} from "@/services/tesoreriaMovimientos.service";
import {
  crearImputacionNotaCreditoMovimiento,
  eliminarImputacionesNotaCredito,
  leftoverClienteCobroDesdeMovimientos,
  listarCobrosDeComprobante,
  siguienteOrdenCobroComprobante,
  sumarImpCobradoDesdeMovimientos,
} from "@/services/cobrosComprobante.service";

/** Error de negocio al impactar cobros en tesorería (rollback de la misma tx). */
class TesoreriaCobroFacturaError extends Error {
  constructor(readonly serviceError: string) {
    super(serviceError);
    this.name = "TesoreriaCobroFacturaError";
  }
}

async function persistirMovimientosCobroEnTx(
  filas: readonly MovimientoCobroFacturaData[],
  tx: Prisma.TransactionClient
): Promise<void> {
  if (filas.length === 0) return;
  const mov = await crearMovimientosCobroPreparados(filas, tx);
  if (!mov.success) {
    throw new TesoreriaCobroFacturaError(mov.error);
  }
}

function documentoReceptorPdf(
  tipo: FacturaTipo,
  docTipo: number | null,
  docNro: string | null
): string | null {
  if (!esFacturaTipoFiscal(tipo)) return null;
  const nro = (docNro ?? "").replace(/\D/g, "");
  if (!nro || nro === "0" || docTipo === ARCA_DOC_TIPO.CF) return null;
  return nro;
}

function decimalToNumber(value: Prisma.Decimal | number): number {
  return Number(value);
}

function asEstado(raw: string): FacturaComprobanteEstado {
  if (raw === "borrador" || raw === "autorizado" || raw === "rechazado") return raw;
  return "borrador";
}

/** Sucursal (`sucursales.id`) a partir de `personal.sucursal_por_defecto` (código). */
async function sucursalIdDesdeCodigo(
  codigo: string | null | undefined,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string | null> {
  const limpio = (codigo ?? "").trim();
  if (!limpio) return null;
  const sucursal = await db.sucursal.findUnique({
    where: { codigo: limpio },
    select: { id: true },
  });
  return sucursal?.id ?? null;
}

/** Elimina las imputaciones de una NC en el ledger y devuelve el saldo a cada venta. */
async function revertirImputacionesNotaCredito(
  tx: Prisma.TransactionClient,
  notaCreditoId: string
): Promise<void> {
  const eliminadas = await eliminarImputacionesNotaCredito(notaCreditoId, tx);
  if (eliminadas.length === 0) return;

  for (const { ventaId, montoPesos } of eliminadas) {
    const venta = await tx.comprobanteVta.findUnique({
      where: { id: ventaId },
      select: {
        impTotal: true,
        impCobrado: true,
        diasVencimiento: true,
        clienteId: true,
      },
    });
    if (!venta) continue;
    const restar = roundArs2(montoPesos);
    const siguienteImpCobrado = roundArs2(
      Math.max(0, decimalToNumber(venta.impCobrado) - restar)
    );
    const impTotal = decimalToNumber(venta.impTotal);
    const siguienteSaldo = saldoPendienteTrasCobro(impTotal, siguienteImpCobrado);
    let diasVencimiento = venta.diasVencimiento;
    if (siguienteSaldo <= 0) {
      diasVencimiento = null;
    } else if (diasVencimiento == null) {
      let plazo: number | null = null;
      if (venta.clienteId) {
        const cli = await tx.cliente.findUnique({
          where: { id: venta.clienteId },
          select: { ctaCorrientePlazo: true },
        });
        plazo = cli?.ctaCorrientePlazo ?? null;
      }
      diasVencimiento = diasVencimientoPorSaldoPendiente({
        esVenta: true,
        impTotal,
        impCobrado: siguienteImpCobrado,
        plazoCliente: plazo,
      });
    }
    await tx.comprobanteVta.update({
      where: { id: ventaId },
      data: { impCobrado: siguienteImpCobrado, diasVencimiento },
    });
  }
}

function observacionImputacionNc(nroNc: string): string {
  return `Imputación NC ${nroNc.trim()}`;
}

/** Reasigna las imputaciones de la NC no fiscal a la NC fiscal que la reemplaza. */
async function retargetImputacionesNotaCredito(
  ncViejoId: string,
  ncNuevo: { id: string; nroComprobante: string }
): Promise<void> {
  if (!ncViejoId || !ncNuevo.id || ncViejoId === ncNuevo.id) return;
  await prisma.tesoreriaMovimiento.updateMany({
    where: {
      notaCreditoId: ncViejoId,
      catMovimiento: "NOTA_CREDITO",
      cajaId: null,
    },
    data: {
      notaCreditoId: ncNuevo.id,
      observacion: observacionImputacionNc(ncNuevo.nroComprobante),
    },
  });
}

async function imputarNcEmitidaAlOriginal(
  emitido: ServiceResult<FacturaEmitirResultado>,
  originalId: string | null
): Promise<ServiceResult<FacturaEmitirResultado>> {
  if (!emitido.success || !originalId) return emitido;
  const tipo = emitido.data.tipo;
  if (!esFacturaTipoNotaCredito(tipo)) return emitido;
  const asoc = await asignarNotaCreditoComoCobro({
    notaCreditoId: emitido.data.id,
    ventaId: originalId,
  });
  if (!asoc.success) {
    console.error("[facturaComprobantes][imputarNc]", asoc.error);
  }
  return emitido;
}

function resolverCobrosYVencimiento(args: {
  tipo: FacturaTipo;
  impTotal: number;
  cobros: EmitirFacturaComprobanteInput["cobros"];
  plazoCliente: number | null;
}): ServiceResult<{
  cobros: EmitirFacturaComprobanteInput["cobros"];
  impCobrado: number;
  diasVencimiento: number | null;
}> {
  const esVenta = esFacturaTipoVenta(args.tipo);
  const cobros = esVenta ? args.cobros : [];
  if (cobros.some((c) => esCobroNotaCreditoNombre(c.pagoNombre))) {
    return {
      success: false,
      error: "La nota de crédito se imputa desde el comprobante NC.",
    };
  }
  const cobradoCents = cobros.reduce((acc, c) => acc + c.montoCents, 0);
  const totalCents = Math.round(args.impTotal * 100);
  if (cobradoCents > totalCents) {
    return {
      success: false,
      error: "El cobro no puede ser mayor al total del comprobante.",
    };
  }
  const impCobrado = impCobradoDesdeCobros(cobros);
  return {
    success: true,
    data: {
      cobros,
      impCobrado,
      diasVencimiento: diasVencimientoPorSaldoPendiente({
        esVenta,
        impTotal: args.impTotal,
        impCobrado,
        plazoCliente: args.plazoCliente,
      }),
    },
  };
}

/** FK a `clientes_proyectos` si el dato existe y pertenece al cliente. */
async function resolverProyectoIdComprobante(args: {
  clienteId: string | null;
  proyectoId: string | null | undefined;
}): Promise<ServiceResult<string | null>> {
  const pedido = args.proyectoId ?? null;
  if (!args.clienteId) {
    if (pedido) {
      return {
        success: false,
        error: "El proyecto requiere un cliente de catálogo.",
      };
    }
    return { success: true, data: null };
  }
  const proyectos = await prisma.enviosDireccion.findMany({
    where: { personaId: args.clienteId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (pedido) {
    if (!proyectos.some((p) => p.id === pedido)) {
      return {
        success: false,
        error: "El proyecto no pertenece al cliente seleccionado.",
      };
    }
    return { success: true, data: pedido };
  }
  if (proyectos.length === 1) {
    const unico = proyectos[0];
    return { success: true, data: unico ? unico.id : null };
  }
  return { success: true, data: null };
}

export type FacturaComprobantePdfDatos = {
  tipo: FacturaTipo;
  fechaIso: string;
  cliente: string;
  nroComprobante: string;
  comentarios: string;
  lineas: FacturaLineaLocal[];
  descuento: FacturaDescuentoEstado | null;
  cae: string | null;
  caeVtoIso: string | null;
  letra: string | null;
  emisor: FacturaComprobantePdfEmisor | null;
  clienteCuit: string | null;
  clienteCondicionIva: string | null;
  /** Nombre del proyecto solo si el cliente tiene más de uno. */
  proyectoNombre: string | null;
  /** Null si no es un fiscal autorizado. */
  fiscal: FacturaComprobantePdfFiscal | null;
};

function fiscalPdfDesdeRow(
  row: {
    estado: string;
    cae: string | null;
    cbteTipo: number | null;
    cbteNro: number | null;
    ptoVenta: string;
    letra: string | null;
    receptorDocTipo: number | null;
    receptorDocNro: string | null;
    receptorCondicionIva: number | null;
    receptorDomicilio: string | null;
    emisorCondicionIva: number | null;
    impNeto: Prisma.Decimal | number;
    impIva: Prisma.Decimal | number;
    impTrib: Prisma.Decimal | number;
    impTotal: Prisma.Decimal | number;
    moneda: string;
    cotizacion: Prisma.Decimal | number;
    items: { importe: Prisma.Decimal | number; alicuotaIva: Prisma.Decimal | number }[];
    ptoVta: { cuit: string | null; condicionIva: number | null };
    emisorCondicionIvaArca: { descripcion: string } | null;
  }
): FacturaComprobantePdfFiscal | null {
  if (row.estado !== "autorizado" || !row.cae || row.cbteTipo == null || row.cbteNro == null) {
    return null;
  }
  const cuit = (row.ptoVta.cuit ?? "").replace(/\D/g, "");
  if (!/^\d{11}$/.test(cuit)) return null;
  const letra: ArcaLetra =
    row.letra === "A" || row.letra === "B" || row.letra === "C" ? row.letra : "B";
  const condicion = row.receptorCondicionIva ?? ARCA_CONDICION_IVA.CF;
  const impNeto = decimalToNumber(row.impNeto);
  const impIva = decimalToNumber(row.impIva);
  return {
    cbteTipo: row.cbteTipo,
    ptoVenta: ptoVentaAEnteroArca(row.ptoVenta),
    cbteNro: row.cbteNro,
    cuitEmisor: cuit,
    leyendaEmisor: leyendaCondicionIvaEmisor(
      row.emisorCondicionIva ?? row.ptoVta.condicionIva,
      row.emisorCondicionIvaArca?.descripcion
    ),
    receptorDocTipo: row.receptorDocTipo ?? ARCA_DOC_TIPO.CF,
    receptorDocNro: row.receptorDocNro ?? "0",
    receptorCondicionIva: condicion,
    receptorDomicilio: row.receptorDomicilio,
    leyendaConsumidorFinal: condicion === ARCA_CONDICION_IVA.CF,
    discriminarIva: operacionDiscriminaIva({ letra, receptorCondicionIva: condicion }),
    transparenciaFiscal: operacionTransparenciaFiscal(condicion),
    impNeto,
    impIva,
    impTrib: decimalToNumber(row.impTrib),
    impTotal: decimalToNumber(row.impTotal),
    moneda: row.moneda || "PES",
    cotizacion: decimalToNumber(row.cotizacion) || 1,
    alicuotas: alicuotasParaRepresentacion({
      lineas: row.items.map((l) => ({
        importeFinal: decimalToNumber(l.importe),
        alicuotaIva: decimalToNumber(l.alicuotaIva),
      })),
      letra,
      impNeto,
      impIva,
    }),
  };
}

async function domicilioReceptorParaFiscal(args: {
  fiscal: boolean;
  letra: ArcaLetra | null;
  proyectoId: string | null;
  domicilioOriginal: string | null;
}): Promise<ServiceResult<string | null>> {
  if (!args.fiscal) return { success: true, data: null };
  const previo = (args.domicilioOriginal ?? "").trim();
  if (previo) return { success: true, data: previo };
  let texto: string | null = null;
  if (args.proyectoId) {
    const proyecto = await prisma.enviosDireccion.findUnique({
      where: { id: args.proyectoId },
      select: {
        calleNombre: true,
        numeracion: true,
        distrito: true,
        departamento: true,
      },
    });
    if (proyecto) {
      const calle = [proyecto.calleNombre.trim(), proyecto.numeracion.trim()]
        .filter((p) => p.length > 0)
        .join(" ");
      const lugar = [proyecto.distrito.trim(), (proyecto.departamento ?? "").replaceAll("_", " ")]
        .filter((p) => p.length > 0)
        .join(", ");
      const armado = [calle, lugar].filter((p) => p.length > 0).join(", ").trim();
      texto = armado || null;
    }
  }
  if (args.letra === "A" && !texto) {
    return {
      success: false,
      error:
        "La factura A requiere el domicilio del receptor. Cargá la dirección en el proyecto del cliente.",
    };
  }
  return { success: true, data: texto };
}

export async function obtenerFacturaComprobantePdfDatos(
  id: string
): Promise<ServiceResult<FacturaComprobantePdfDatos>> {
  try {
    const row = await prisma.comprobanteVta.findUnique({
      where: { id },
      include: {
        items: { orderBy: { orden: "asc" } },
        ptoVta: {
          select: {
            titular: true,
            cuit: true,
            iiBb: true,
            domicilioComercial: true,
            inicioActividades: true,
            condicionIva: true,
          },
        },
        emisorCondicionIvaArca: { select: { descripcion: true } },
        receptorCondicionIvaArca: { select: { descripcion: true } },
        proyecto: { select: { nombreProyecto: true } },
        cliente: { select: { _count: { select: { direcciones: true } } } },
      },
    });
    if (!row) return { success: false, error: "El comprobante no existe." };
    const tipo: FacturaTipo = esFacturaTipo(row.tipoComprobante)
      ? row.tipoComprobante
      : "factura_no_fiscal";
    const lineas: FacturaLineaLocal[] = row.items.map((l, idx) => ({
      key: l.id || String(idx),
      codTienda: l.codTienda,
      descripcion: l.descripcion,
      cantidad: decimalToNumber(l.cantidad),
      pxLista: decimalToNumber(l.px),
      descuentoPctEspecial: decimalToNumber(l.descuentoPct),
      comentario: l.comentario,
    }));
    const descPct = decimalToNumber(row.descPct);
    const descuento: FacturaDescuentoEstado | null =
      descPct > 0
        ? { fuente: "porcentaje", porcentaje: descPct, totalFacObjetivo: null }
        : null;
    return {
      success: true,
      data: {
        tipo,
        fechaIso: isoYmdFromPrismaDateOnly(row.fecha),
        cliente: row.receptorNombre,
        nroComprobante: formatoNroComprobante(row.ptoVenta, row.cbteNro),
        comentarios: row.comentarios,
        lineas,
        descuento,
        cae: row.cae,
        caeVtoIso: row.caeVto ? isoYmdFromPrismaDateOnly(row.caeVto) : null,
        letra: row.letra,
        clienteCuit: documentoReceptorPdf(tipo, row.receptorDocTipo, row.receptorDocNro),
        clienteCondicionIva:
          esFacturaTipoFiscal(tipo) && row.receptorCondicionIvaArca
            ? etiquetaCondicionIvaArca(row.receptorCondicionIvaArca.descripcion)
            : null,
        proyectoNombre:
          (row.cliente?._count.direcciones ?? 0) > 1
            ? (row.proyecto?.nombreProyecto.trim() ?? null)
            : null,
        emisor: emisorPdfDesdePtoVta({
          titular: row.ptoVta.titular,
          cuit: row.ptoVta.cuit,
          iiBb: row.ptoVta.iiBb,
          domicilioComercial: row.ptoVta.domicilioComercial,
          inicioActividades: row.ptoVta.inicioActividades
            ? isoYmdFromPrismaDateOnly(row.ptoVta.inicioActividades)
            : null,
        }),
        fiscal: esFacturaTipoFiscal(tipo) ? fiscalPdfDesdeRow(row) : null,
      },
    };
  } catch (e) {
    console.error("[facturaComprobantes][obtenerPdf]", e);
    return { success: false, error: "No se pudo leer el comprobante." };
  }
}

export async function obtenerBorradorDuplicarComprobante(
  id: string
): Promise<ServiceResult<FacturaComprobanteDuplicarBorrador>> {
  try {
    const row = await prisma.comprobanteVta.findUnique({
      where: { id },
      include: { items: { orderBy: { orden: "asc" } } },
    });
    if (!row) return { success: false, error: "El comprobante no existe." };
    const tipo: FacturaTipo = esFacturaTipo(row.tipoComprobante)
      ? row.tipoComprobante
      : "factura_no_fiscal";
    const lineas: FacturaLineaLocal[] = row.items.map((l, idx) => ({
      key: `dup-${idx}-${l.id}`,
      codTienda: l.codTienda,
      descripcion: l.descripcion,
      cantidad: decimalToNumber(l.cantidad),
      pxLista: decimalToNumber(l.px),
      descuentoPctEspecial: decimalToNumber(l.descuentoPct),
      comentario: l.comentario,
    }));
    const descPct = decimalToNumber(row.descPct);
    const descuento: FacturaDescuentoEstado | null =
      descPct > 0
        ? { fuente: "porcentaje", porcentaje: descPct, totalFacObjetivo: null }
        : null;
    const clienteId = row.clienteId;
    const clienteCatalogo = clienteId
      ? await obtenerClienteListaPorId(clienteId)
      : null;
    return {
      success: true,
      data: {
        tipo,
        fechaIso: dateToIsoYmdArgentina(new Date()),
        comentarios: row.comentarios,
        cliente: row.receptorNombre,
        clienteId,
        proyectoId: row.proyectoId,
        clienteCatalogo,
        cbteAsocId: row.cbteAsocId,
        cbteAsocLabel: null,
        lineas,
        descuento,
      },
    };
  } catch (e) {
    console.error("[facturaComprobantes][duplicar]", e);
    return { success: false, error: "No se pudo duplicar el comprobante." };
  }
}

export async function obtenerBorradorNotaCreditoComprobante(
  id: string
): Promise<ServiceResult<FacturaComprobanteDuplicarBorrador>> {
  try {
    const row = await prisma.comprobanteVta.findUnique({
      where: { id },
      include: { items: { orderBy: { orden: "asc" } } },
    });
    if (!row) return { success: false, error: "El comprobante no existe." };
    const tipoOrigen: FacturaTipo = esFacturaTipo(row.tipoComprobante)
      ? row.tipoComprobante
      : "factura_no_fiscal";
    const tipoNc = tipoNotaCreditoDesdeVenta(tipoOrigen);
    if (!tipoNc) {
      return {
        success: false,
        error: "Solo se puede cargar nota de crédito desde una venta.",
      };
    }
    const lineas: FacturaLineaLocal[] = row.items.map((l, idx) => ({
      key: `nc-${idx}-${l.id}`,
      codTienda: l.codTienda,
      descripcion: l.descripcion,
      cantidad: decimalToNumber(l.cantidad),
      pxLista: decimalToNumber(l.px),
      descuentoPctEspecial: decimalToNumber(l.descuentoPct),
      comentario: l.comentario,
    }));
    const descPct = decimalToNumber(row.descPct);
    const descuento: FacturaDescuentoEstado | null =
      descPct > 0
        ? { fuente: "porcentaje", porcentaje: descPct, totalFacObjetivo: null }
        : null;
    const clienteId = row.clienteId;
    const clienteCatalogo = clienteId
      ? await obtenerClienteListaPorId(clienteId)
      : null;
    return {
      success: true,
      data: {
        tipo: tipoNc,
        fechaIso: dateToIsoYmdArgentina(new Date()),
        comentarios: row.comentarios,
        cliente: row.receptorNombre,
        clienteId,
        proyectoId: row.proyectoId,
        clienteCatalogo,
        cbteAsocId: row.id,
        cbteAsocLabel: formatoNroComprobante(row.ptoVenta, row.cbteNro),
        lineas,
        descuento,
      },
    };
  } catch (e) {
    console.error("[facturaComprobantes][nc]", e);
    return { success: false, error: "No se pudo cargar la nota de crédito." };
  }
}

export async function eliminarComprobanteNoFiscal(
  id: string
): Promise<ServiceResult<void>> {
  try {
    const row = await prisma.comprobanteVta.findUnique({
      where: { id },
      select: {
        id: true,
        tipoComprobante: true,
        ptoVenta: true,
        cbteNro: true,
      },
    });
    if (!row) return { success: false, error: "El comprobante no existe." };
    const tipo: FacturaTipo = esFacturaTipo(row.tipoComprobante)
      ? row.tipoComprobante
      : "factura_no_fiscal";
    if (!puedeEliminarComprobante(tipo)) {
      return {
        success: false,
        error: "Solo se pueden eliminar comprobantes no fiscales.",
      };
    }
    await prisma.$transaction(async (tx) => {
      if (esFacturaTipoNotaCredito(tipo)) {
        await revertirImputacionesNotaCredito(tx, id);
      }
      await tx.comprobanteVta.updateMany({
        where: { cbteAsocId: id },
        data: { cbteAsocId: null },
      });
      await tx.comprobanteVta.delete({ where: { id } });
    });
    return { success: true, data: undefined };
  } catch (e) {
    console.error("[facturaComprobantes][eliminar]", e);
    return { success: false, error: "No se pudo eliminar el comprobante." };
  }
}

/**
 * Emite un fiscal con los mismos datos (fecha = hoy AR) y borra el no fiscal
 * solo si el fiscal quedó autorizado.
 */
export async function convertirComprobanteNoFiscalEnFiscal(input: {
  id: string;
  personalId: number;
}): Promise<ServiceResult<FacturaEmitirResultado>> {
  try {
    const MSG_CLIENTE_SIN_CUIT_CONVERSION_FISCAL =
      '"Para emitir Factura Fiscal" primero debe cargar un CUIT a este cliente';
    const row = await prisma.comprobanteVta.findUnique({
      where: { id: input.id },
      include: {
        items: { orderBy: { orden: "asc" } },
        notasCredito: { select: { id: true }, take: 1 },
      },
    });
    if (!row) return { success: false, error: "El comprobante no existe." };
    const tipoOrigen: FacturaTipo = esFacturaTipo(row.tipoComprobante)
      ? row.tipoComprobante
      : "factura_no_fiscal";
    const tipoDestino = tipoFiscalDesdeNoFiscal(tipoOrigen);
    if (!tipoDestino || !puedeConvertirComprobanteEnFiscal(tipoOrigen)) {
      return {
        success: false,
        error: "Solo se pueden convertir comprobantes no fiscales (venta o nota de crédito).",
      };
    }
    if (tipoDestino === "factura_fiscal" || tipoDestino === "nota_credito_fiscal") {
      if (!row.clienteId) {
        return { success: false, error: MSG_CLIENTE_SIN_CUIT_CONVERSION_FISCAL };
      }
      const cliente = await prisma.cliente.findUnique({
        where: { id: row.clienteId },
        select: { cuit: true },
      });
      if (!cliente?.cuit || !esCuitValido(cliente.cuit)) {
        return { success: false, error: MSG_CLIENTE_SIN_CUIT_CONVERSION_FISCAL };
      }
    }
    if (row.estado === "rechazado") {
      return { success: false, error: "No se puede convertir un comprobante rechazado." };
    }
    if (row.items.length === 0) {
      return { success: false, error: "El comprobante no tiene ítems." };
    }

    const cobrosActuales = await listarCobrosDeComprobante(row.id);
    const cobros = cobrosActuales
      .filter((c) => !c.esCuentaCorriente && c.montoCents > 0)
      .map((c) => ({
        pagoNombre: c.pagoNombre,
        entidadNombre: c.entidadNombre,
        cuotaEtiqueta: c.cuotaEtiqueta,
        montoCents: c.montoCents,
      }));

    const descPct = decimalToNumber(row.descPct);
    const emitRes = await emitirFacturaComprobante(
      {
        fechaIso: dateToIsoYmdArgentina(new Date()),
        tipo: tipoDestino,
        cliente: row.receptorNombre,
        clienteId: row.clienteId,
        proyectoId: row.proyectoId,
        comentarios: row.comentarios,
        ptoVtaId: row.ptoVtaId,
        personalId: input.personalId,
        receptorDocTipo: row.receptorDocTipo ?? undefined,
        receptorDocNro: row.receptorDocNro ?? undefined,
        receptorCondicionIva: row.receptorCondicionIva ?? undefined,
        cbteAsocId: row.cbteAsocId ?? undefined,
        lineas: row.items.map((l) => ({
          codTienda: l.codTienda,
          descripcion: l.descripcion,
          cantidad: decimalToNumber(l.cantidad),
          pxLista: decimalToNumber(l.px),
          descuentoPct: decimalToNumber(l.descuentoPct),
          comentario: l.comentario,
          alicuotaIva: decimalToNumber(l.alicuotaIva),
        })),
        descuento:
          descPct > 0
            ? { fuente: "porcentaje", porcentaje: descPct, totalFacObjetivo: null }
            : null,
        cobros,
      },
      { omitirTopeCtaCorriente: true }
    );
    if (!emitRes.success) return emitRes;
    if (emitRes.data.estado !== "autorizado" || !emitRes.data.cae) {
      return {
        success: false,
        error:
          emitRes.data.resultado === "R"
            ? "ARCA rechazó el comprobante fiscal. Se conservó el no fiscal."
            : "No se obtuvo CAE. Se conservó el comprobante no fiscal.",
      };
    }

    if (esFacturaTipoNotaCredito(tipoOrigen)) {
      await retargetImputacionesNotaCredito(row.id, {
        id: emitRes.data.id,
        nroComprobante: emitRes.data.nroComprobante,
      });
    }
    if (esFacturaTipoVenta(tipoOrigen)) {
      await prisma.comprobanteVta.updateMany({
        where: { cbteAsocId: row.id },
        data: { cbteAsocId: emitRes.data.id },
      });
    }

    const del = await eliminarComprobanteNoFiscal(row.id);
    if (!del.success) {
      return {
        success: false,
        error: `Se emitió el fiscal ${emitRes.data.nroComprobante} pero no se pudo borrar el no fiscal.`,
      };
    }
    return emitRes;
  } catch (e) {
    console.error("[facturaComprobantes][convertirFiscal]", e);
    return {
      success: false,
      error: "No se pudo convertir el comprobante en fiscal.",
    };
  }
}

type LineaCalculada = {
  orden: number;
  codTienda: string;
  descripcion: string;
  cantidad: number;
  px: number;
  descuentoPct: number;
  alicuotaIva: number;
  ivaId: number;
  importe: number;
  comentario: string;
};

function calcularLineas(
  input: EmitirFacturaComprobanteInput,
  letra: ArcaLetra | null
): ServiceResult<LineaCalculada[]> {
  const lineasLocales: FacturaLineaLocal[] = input.lineas.map((l, i) => ({
    key: String(i),
    codTienda: l.codTienda,
    descripcion: l.descripcion,
    cantidad: l.cantidad,
    pxLista: l.pxLista,
    descuentoPctEspecial: l.descuentoPct,
    comentario: l.comentario ?? "",
  }));
  const descuento: FacturaDescuentoEstado | null = input.descuento ?? null;
  const pctGlobal = porcentajeDescuentoGlobal(lineasLocales, descuento);
  const out: LineaCalculada[] = [];
  for (let i = 0; i < input.lineas.length; i += 1) {
    const raw = input.lineas[i];
    const linea = lineasLocales[i];
    const pct = porcentajeDescuentoLinea(linea, pctGlobal);
    const pxDesc = pxConDescuento(raw.pxLista, pct);
    const importe = roundArs2(raw.cantidad * pxDesc);
    const alicuota =
      letra === "C" ? 0 : (raw.alicuotaIva ?? ARCA_ALICUOTA_IVA_DEFAULT);
    const ivaId = ivaIdDesdeAlicuota(alicuota);
    if (ivaId == null) {
      return { success: false, error: `Alícuota IVA inválida en la línea ${i + 1}.` };
    }
    out.push({
      orden: i + 1,
      codTienda: raw.codTienda,
      descripcion: raw.descripcion.toLocaleUpperCase("es-AR"),
      cantidad: raw.cantidad,
      px: roundArs2(raw.pxLista),
      descuentoPct: roundArs2(pct),
      alicuotaIva: alicuota,
      ivaId,
      importe,
      comentario: (raw.comentario ?? "").trim().toLocaleUpperCase("es-AR"),
    });
  }
  return { success: true, data: out };
}

/** Serie local (presupuesto / comprobante) por pto + tipo. Factura ARCA usa FECompUltimoAutorizado. */
async function siguienteNroInterno(
  ptoVtaId: string,
  tipoComprobante: FacturaTipo,
  tx: Prisma.TransactionClient
): Promise<number> {
  const max = await tx.comprobanteVta.aggregate({
    where: { ptoVtaId, tipoComprobante, cbteNro: { not: null } },
    _max: { cbteNro: true },
  });
  return (max._max.cbteNro ?? 0) + 1;
}

function validarReceptorFiscal(opts: {
  letra: ArcaLetra;
  condicionIva: number;
  docTipo: number;
  docNro: string;
  impTotal: number;
}): ServiceResult<void> {
  if (opts.letra === "A" && opts.condicionIva !== ARCA_CONDICION_IVA.RI) {
    return {
      success: false,
      error: "Factura A requiere receptor IVA Responsable Inscripto.",
    };
  }
  if (receptorRequiereCuit(opts.condicionIva)) {
    if (opts.docTipo !== ARCA_DOC_TIPO.CUIT && opts.docTipo !== ARCA_DOC_TIPO.CUIL) {
      return { success: false, error: "El receptor debe identificarse con CUIT/CUIL." };
    }
    if (!esCuitValido(opts.docNro)) {
      return { success: false, error: "CUIT/CUIL del receptor inválido." };
    }
  }
  if (opts.condicionIva === ARCA_CONDICION_IVA.CF) {
    const tope = topeCfSinDocDesdeEnv();
    const esCfSinDoc =
      opts.docTipo === ARCA_DOC_TIPO.CF && docNroAEnteroArca(opts.docNro) === 0;
    if (opts.impTotal > tope && esCfSinDoc) {
      return {
        success: false,
        error: "Por el importe, el consumidor final debe identificarse con DNI o CUIT.",
      };
    }
    if (!esCfSinDoc && opts.docTipo === ARCA_DOC_TIPO.DNI) {
      const dni = opts.docNro.replace(/\D/g, "");
      if (dni.length < 7 || dni.length > 8) {
        return { success: false, error: "DNI del receptor inválido." };
      }
    }
  }
  return { success: true, data: undefined };
}

async function persistirIntento(opts: {
  comprobanteId: string;
  operacion: string;
  resultado: string | null;
  errores: string | null;
  payload?: string | null;
}): Promise<void> {
  try {
    await prisma.comprobanteVtaHistorialArca.create({
      data: {
        comprobanteId: opts.comprobanteId,
        requestId: crypto.randomUUID(),
        operacion: opts.operacion,
        resultado: opts.resultado,
        errores: opts.errores,
        payload: opts.payload ?? null,
      },
    });
  } catch (e) {
    console.error("[arca][intento]", e instanceof Error ? e.message : "error");
  }
}

function emitirResultadoDesdeRow(row: {
  id: string;
  tipoComprobante: string;
  letra: string | null;
  ptoVenta: string;
  cbteNro: number | null;
  cae: string | null;
  caeVto: Date | null;
  resultado: string | null;
  estado: string;
}): FacturaEmitirResultado {
  const tipo: FacturaTipo = esFacturaTipo(row.tipoComprobante)
    ? row.tipoComprobante
    : "factura_no_fiscal";
  return {
    id: row.id,
    nroComprobante: formatoNroComprobante(row.ptoVenta, row.cbteNro),
    cae: row.cae,
    caeVtoIso: row.caeVto ? isoYmdFromPrismaDateOnly(row.caeVto) : null,
    resultado: row.resultado,
    estado: asEstado(row.estado),
    tipo,
    letra: row.letra,
  };
}

const PTO_VTA_EMITIR_SELECT = {
  id: true,
  ptoVenta: true,
  cuit: true,
  condicionIva: true,
  concepto: true,
  estado: true,
} as const;

async function ptoVtaActivoDeSucursalPersonal(
  sucursalCodigo: string | null
): Promise<
  ServiceResult<{
    id: string;
    ptoVenta: string;
    cuit: string | null;
    condicionIva: number | null;
    concepto: string;
    estado: string;
  }>
> {
  if (!sucursalCodigo) {
    return { success: false, error: MENSAJE_PERSONAL_SIN_SUCURSAL };
  }
  const pto = await prisma.globalPtoVta.findFirst({
    where: {
      estado: "activo",
      sucursales: { some: { sucursal: { codigo: sucursalCodigo } } },
    },
    orderBy: { ptoVenta: "asc" },
    select: PTO_VTA_EMITIR_SELECT,
  });
  if (!pto) {
    return { success: false, error: MENSAJE_PTO_VTA_SUCURSAL_USUARIO };
  }
  return { success: true, data: pto };
}

export async function emitirFacturaComprobante(
  input: EmitirFacturaComprobanteInput,
  opciones?: { omitirTopeCtaCorriente?: boolean }
): Promise<ServiceResult<FacturaEmitirResultado>> {
  const fecha = prismaDateOnlyFromIsoYmd(input.fechaIso);
  if (!fecha) return { success: false, error: "Fecha de comprobante inválida." };

  const personal = await prisma.globalPersonal.findUnique({
    where: { idPersonal: input.personalId },
    select: { idPersonal: true, sucursalPorDefecto: true },
  });
  if (!personal) {
    return { success: false, error: "El usuario no existe." };
  }

  const ptoRes = await ptoVtaActivoDeSucursalPersonal(personal.sucursalPorDefecto);
  if (!ptoRes.success) return ptoRes;
  const pto = ptoRes.data;

  const clienteNoSel = mensajeClienteFacturaNoSeleccionado(
    input.cliente,
    input.clienteId
  );
  if (clienteNoSel) {
    return { success: false, error: clienteNoSel };
  }

  const clienteId: string | null = input.clienteId ?? null;
  let clienteFiscal: { cuit: string | null; condicionIva: number | null } | null =
    null;
  let plazoCliente: number | null = null;
  if (clienteId) {
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
      select: {
        id: true,
        cuit: true,
        condicionIva: true,
        ctaCorrienteMontoMax: true,
        ctaCorrientePlazo: true,
      },
    });
    if (!cliente) {
      return { success: false, error: "El cliente seleccionado no existe." };
    }
    if (
      !opciones?.omitirTopeCtaCorriente &&
      esFacturaTipoVenta(input.tipo) &&
      cliente.ctaCorrienteMontoMax != null
    ) {
      const saldos = await saldosCuentaCorrientePorCliente([clienteId]);
      const saldo = saldos.get(clienteId) ?? 0;
      if (clienteSuperaTopeCtaCorriente(saldo, Number(cliente.ctaCorrienteMontoMax))) {
        return { success: false, error: MENSAJE_CLIENTE_TOPE_CTA_CORRIENTE };
      }
    }
    clienteFiscal = { cuit: cliente.cuit, condicionIva: cliente.condicionIva };
    plazoCliente = cliente.ctaCorrientePlazo;
  }
  const proyectoResuelto = await resolverProyectoIdComprobante({
    clienteId,
    proyectoId: input.proyectoId,
  });
  if (!proyectoResuelto.success) return proyectoResuelto;
  const proyectoId = proyectoResuelto.data;
  let receptor = receptorFiscalParaEmitir({
    cliente: clienteFiscal,
    fallback: {
      docTipo: input.receptorDocTipo,
      docNro: input.receptorDocNro,
      condicionIva: input.receptorCondicionIva,
    },
  });

  const fiscal = esTipoComprobanteFiscal(input.tipo);
  let letra: ArcaLetra | null = null;
  let cbteTipo: number | null = null;
  let original: {
    id: string;
    cbteTipo: number | null;
    ptoVenta: string;
    cbteNro: number | null;
    cae: string | null;
    fecha: Date;
    receptorNombre: string;
    receptorDocTipo: number | null;
    receptorDocNro: string | null;
    receptorCondicionIva: number | null;
    receptorDomicilio: string | null;
  } | null = null;

  if (esFacturaTipoNotaCredito(input.tipo) && input.cbteAsocId) {
    original = await prisma.comprobanteVta.findUnique({
      where: { id: input.cbteAsocId },
      select: {
        id: true,
        cbteTipo: true,
        ptoVenta: true,
        cbteNro: true,
        cae: true,
        fecha: true,
        receptorNombre: true,
        receptorDocTipo: true,
        receptorDocNro: true,
        receptorCondicionIva: true,
        receptorDomicilio: true,
      },
    });
    if (input.tipo === "nota_credito_fiscal") {
      if (!original || !original.cae || original.cbteTipo == null || original.cbteNro == null) {
        return {
          success: false,
          error: "El comprobante original no está autorizado en ARCA.",
        };
      }
    } else if (!original) {
      return { success: false, error: "El comprobante original no existe." };
    }
  }

  if (fiscal) {
    if (!pto.cuit || !esCuitValido(pto.cuit)) {
      return { success: false, error: "El punto de venta no tiene CUIT válido." };
    }
    if (pto.condicionIva == null) {
      return { success: false, error: "El punto de venta no tiene condición IVA." };
    }
    const letraRes = resolverLetraYCbteTipo({
      emisorCondicionIva: pto.condicionIva,
      receptorCondicionIva: receptor.condicionIva,
      esNotaCredito: input.tipo === "nota_credito_fiscal",
    });
    if (!letraRes.ok) return { success: false, error: letraRes.error };
    letra = letraRes.letra;
    cbteTipo = letraRes.cbteTipo;
  }

  const lineasRes = calcularLineas(input, letra);
  if (!lineasRes.success) return lineasRes;
  const lineas = lineasRes.data;
  const resumen = resumenTotalesFactura(
    input.lineas.map((l, i) => ({
      key: String(i),
      codTienda: l.codTienda,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      pxLista: l.pxLista,
      descuentoPctEspecial: l.descuentoPct,
      comentario: l.comentario ?? "",
    })),
    input.descuento ?? null
  );

  let impNeto = roundArs2(resumen.totalConDesc);
  let impIva = 0;
  let impTotal = impNeto;
  let impTotConc = 0;
  let impOpEx = 0;
  let impTrib = 0;
  let impExento = 0;
  let alicIva: { id: number; baseImp: number; importe: number }[] = [];

  if (fiscal && letra) {
    const tot = armarTotalesWsfe(
      lineas.map((l) => ({ importeFinal: l.importe, alicuotaIva: l.alicuotaIva })),
      letra
    );
    if ("ok" in tot) {
      return { success: false, error: tot.error };
    }
    if (!coherenciaImpTotal(tot)) {
      return { success: false, error: "ImpTotal no cierra con Neto + IVA." };
    }
    impNeto = tot.impNeto;
    impIva = tot.impIva;
    impTotal = tot.impTotal;
    impTotConc = tot.impTotConc;
    impOpEx = tot.impOpEx;
    impTrib = tot.impTrib;
    impExento = tot.impExento;
    alicIva = tot.alicIva;

    const docCf = aplicarDocumentoConsumidorFinal(
      receptor,
      input.documentoReceptor ?? ""
    );
    if (!docCf.ok) return { success: false, error: docCf.error };
    receptor = docCf.receptor;

    const recOk = validarReceptorFiscal({
      letra,
      condicionIva: receptor.condicionIva,
      docTipo: receptor.docTipo,
      docNro: receptor.docNro,
      impTotal,
    });
    if (!recOk.success) return recOk;
  }

  const cobrosRes = resolverCobrosYVencimiento({
    tipo: input.tipo,
    impTotal,
    cobros: input.cobros ?? [],
    plazoCliente,
  });
  if (!cobrosRes.success) return cobrosRes;
  const { cobros, impCobrado, diasVencimiento } = cobrosRes.data;

  const movsPrep = await prepararMovimientosCobroDesdeSnapshots({
    cobros,
    sucursalCodigo: personal.sucursalPorDefecto ?? "",
    fechaIso: input.fechaIso,
    personalId: personal.idPersonal,
  });
  if (!movsPrep.success) return movsPrep;
  const movimientosCobro = movsPrep.data;

  const ambiente = ambienteArcaActual();
  const concepto = pto.concepto || "1";
  const receptorNombre = nombreClienteFactura(input.cliente);

  if (!fiscal) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const cbteNro = await siguienteNroInterno(pto.id, input.tipo, tx);
        const header = await tx.comprobanteVta.create({
          data: {
            tipoComprobante: input.tipo,
            cbteTipo: null,
            letra: input.tipo === "factura_no_fiscal" ? "X" : null,
            ptoVtaId: pto.id,
            ptoVenta: pto.ptoVenta,
            cbteNro,
            fecha,
            concepto,
            clienteId,
            proyectoId,
            personalId: input.personalId,
            receptorNombre,
            receptorDocTipo: null,
            receptorDocNro: null,
            receptorCondicionIva: null,
            impNeto,
            impIva: 0,
            impExento: 0,
            impTotConc: 0,
            impTrib: 0,
            impOpEx: 0,
            impTotal,
            descPct: roundArs2(resumen.descPctPromedio),
            descImporte: roundArs2(resumen.descPesos),
            ambiente,
            comentarios: input.comentarios.trim().toLocaleUpperCase("es-AR"),
            estado: "autorizado",
            efectoStock: efectoStockPorTipo(input.tipo),
            stockAplicado: false,
            diasVencimiento,
            impCobrado,
            cbteAsocId: original?.id ?? null,
            cbteAsocTipo: original?.cbteTipo ?? null,
            cbteAsocPtoVta: original
              ? ptoVentaAEnteroArca(original.ptoVenta)
              : null,
            cbteAsocNro: original?.cbteNro ?? null,
            cbteAsocCae: original?.cae ?? null,
            items: {
              create: lineas.map((l) => ({
                orden: l.orden,
                codTienda: l.codTienda,
                descripcion: l.descripcion,
                cantidad: l.cantidad,
                px: l.px,
                descuentoPct: l.descuentoPct,
                alicuotaIva: l.alicuotaIva,
                ivaId: l.ivaId,
                importe: l.importe,
                comentario: l.comentario,
              })),
            },
          },
        });
        await persistirMovimientosCobroEnTx(
          conComprobanteEnMovimientos(movimientosCobro, {
            comprobanteId: header.id,
            ordenInicio: 0,
          }),
          tx
        );
        return header;
      });
      const emitido = { success: true as const, data: emitirResultadoDesdeRow(created) };
      return imputarNcEmitidaAlOriginal(emitido, original?.id ?? null);
    } catch (e) {
      if (e instanceof TesoreriaCobroFacturaError) {
        return { success: false, error: e.serviceError };
      }
      console.error("[facturaComprobantes][emitirInterno]", e);
      return { success: false, error: "No se pudo guardar el comprobante." };
    }
  }

  const domicilioRes = await domicilioReceptorParaFiscal({
    fiscal,
    letra,
    proyectoId,
    domicilioOriginal: original?.receptorDomicilio ?? null,
  });
  if (!domicilioRes.success) return domicilioRes;

  return emitirFiscal({
    input,
    pto,
    letra: letra as ArcaLetra,
    cbteTipo: cbteTipo as number,
    fecha,
    concepto,
    clienteId,
    proyectoId,
    receptorNombre,
    receptor,
    lineas,
    resumen,
    impNeto,
    impIva,
    impTotal,
    impTotConc,
    impOpEx,
    impTrib,
    impExento,
    alicIva,
    ambiente,
    original,
    impCobrado,
    diasVencimiento,
    receptorDomicilio: domicilioRes.data,
    emisorCondicionIva: fiscal ? pto.condicionIva : null,
    movimientosCobro,
  });
}

async function emitirFiscal(args: {
  input: EmitirFacturaComprobanteInput;
  pto: {
    id: string;
    ptoVenta: string;
    cuit: string | null;
    concepto: string;
    condicionIva: number | null;
  };
  letra: ArcaLetra;
  cbteTipo: number;
  fecha: Date;
  concepto: string;
  clienteId: string | null;
  proyectoId: string | null;
  receptorNombre: string;
  receptor: ReceptorFiscalSnapshot;
  lineas: LineaCalculada[];
  resumen: ReturnType<typeof resumenTotalesFactura>;
  impNeto: number;
  impIva: number;
  impTotal: number;
  impTotConc: number;
  impOpEx: number;
  impTrib: number;
  impExento: number;
  alicIva: { id: number; baseImp: number; importe: number }[];
  ambiente: "homo" | "prod";
  original: {
    id: string;
    cbteTipo: number | null;
    ptoVenta: string;
    cbteNro: number | null;
    cae: string | null;
    fecha: Date;
    receptorNombre: string;
    receptorDocTipo: number | null;
    receptorDocNro: string | null;
    receptorCondicionIva: number | null;
  } | null;
  impCobrado: number;
  diasVencimiento: number | null;
  receptorDomicilio: string | null;
  emisorCondicionIva: number | null;
  movimientosCobro: readonly MovimientoCobroFacturaData[];
}): Promise<ServiceResult<FacturaEmitirResultado>> {
  const authRes = await obtenerAuthWsfe({
    ptoVenta: args.pto.ptoVenta,
    cuitEmisor: args.pto.cuit,
  });
  if (!authRes.success) return authRes;
  const auth = authRes.data;
  if (args.pto.cuit && args.pto.cuit !== auth.cuit) {
    return {
      success: false,
      error: "El CUIT del punto de venta no coincide con el certificado ARCA.",
    };
  }

  const ptoNro = ptoVentaAEnteroArca(args.pto.ptoVenta);
  const params = await wsfeParamGetTiposCbte(auth);
  if (params.ok && !params.data.some((t) => t.id === args.cbteTipo)) {
    return { success: false, error: "El tipo de comprobante no está habilitado en ARCA." };
  }
  const ptosArca = await wsfeParamGetPtosVenta(auth);
  if (ptosArca.ok && !ptosArca.data.some((p) => p.nro === ptoNro && p.bloqueado !== "S")) {
    console.error("[arca][FEParamGetPtosVenta] pto no listado", ptoNro);
  }

  const ultimo = await wsfeCompUltimoAutorizado(auth, ptoNro, args.cbteTipo);
  if (!ultimo.ok) return { success: false, error: ultimo.error };
  const cbteNro = ultimo.cbteNro + 1;

  const existente = await prisma.comprobanteVta.findFirst({
    where: {
      ambiente: args.ambiente,
      cbteTipo: args.cbteTipo,
      ptoVenta: args.pto.ptoVenta,
      cbteNro,
    },
  });
  if (existente?.cae) {
    const emitido = { success: true as const, data: emitirResultadoDesdeRow(existente) };
    return imputarNcEmitidaAlOriginal(emitido, args.original?.id ?? null);
  }
  if (existente && !existente.cae) {
    const consultado = await wsfeCompConsultar(auth, ptoNro, args.cbteTipo, cbteNro);
    if (consultado.ok && consultado.data.cae) {
      const caeVtoIso = consultado.data.caeFchVto
        ? yyyymmddToIsoYmd(consultado.data.caeFchVto)
        : null;
      const updated = await prisma.comprobanteVta.update({
        where: { id: existente.id },
        data: {
          cae: consultado.data.cae,
          caeVto: caeVtoIso ? prismaDateOnlyFromIsoYmd(caeVtoIso) : null,
          resultado: consultado.data.resultado ?? "A",
          estado: "autorizado",
        },
      });
      const emitido = { success: true as const, data: emitirResultadoDesdeRow(updated) };
      return imputarNcEmitidaAlOriginal(emitido, args.original?.id ?? null);
    }
  }

  const cbteFch = isoYmdToYyyymmdd(isoYmdFromPrismaDateOnly(args.fecha));
  if (!cbteFch) return { success: false, error: "Fecha de comprobante inválida." };
  const conceptoN = Number.parseInt(args.concepto, 10) || 1;
  const docTipo = args.receptor.docTipo;
  const docNro = docNroAEnteroArca(args.receptor.docNro);

  const req: WsfeCaeRequest = {
    ptoVta: ptoNro,
    cbteTipo: args.cbteTipo,
    det: {
      concepto: conceptoN,
      docTipo,
      docNro,
      cbteDesde: cbteNro,
      cbteHasta: cbteNro,
      cbteFch,
      impTotal: args.impTotal,
      impTotConc: args.impTotConc,
      impNeto: args.impNeto,
      impOpEx: args.impOpEx,
      impTrib: args.impTrib,
      impIVA: args.impIva,
      fchServDesde: conceptoN !== 1 ? cbteFch : undefined,
      fchServHasta: conceptoN !== 1 ? cbteFch : undefined,
      fchVtoPago: conceptoN !== 1 ? cbteFch : undefined,
      monId: "PES",
      monCotiz: 1,
      condicionIvaReceptorId: args.receptor.condicionIva,
      iva: args.alicIva.length > 0 ? args.alicIva : undefined,
      cbtesAsoc:
        args.original && args.original.cbteTipo != null && args.original.cbteNro != null
          ? [
              {
                tipo: args.original.cbteTipo,
                ptoVta: ptoVentaAEnteroArca(args.original.ptoVenta),
                nro: args.original.cbteNro,
                cuit: args.pto.cuit ?? auth.cuit,
                cbteFch: isoYmdToYyyymmdd(isoYmdFromPrismaDateOnly(args.original.fecha)) ?? undefined,
              },
            ]
          : undefined,
    },
  };

  let createdId: string;
  try {
    const created = await prisma.$transaction(async (tx) => {
      const header = await tx.comprobanteVta.create({
        data: {
          tipoComprobante: args.input.tipo,
          cbteTipo: args.cbteTipo,
          letra: args.letra,
          ptoVtaId: args.pto.id,
          ptoVenta: args.pto.ptoVenta,
          cbteNro,
          fecha: args.fecha,
          concepto: args.concepto,
          clienteId: args.clienteId,
          proyectoId: args.proyectoId,
          personalId: args.input.personalId,
          receptorNombre: args.receptorNombre,
          receptorDocTipo: args.receptor.docTipo,
          receptorDocNro: args.receptor.docNro,
          receptorCondicionIva: args.receptor.condicionIva,
          receptorDomicilio: args.receptorDomicilio,
          emisorCondicionIva: args.emisorCondicionIva,
          impNeto: args.impNeto,
          impIva: args.impIva,
          impExento: args.impExento,
          impTotConc: args.impTotConc,
          impTrib: args.impTrib,
          impOpEx: args.impOpEx,
          impTotal: args.impTotal,
          descPct: roundArs2(args.resumen.descPctPromedio),
          descImporte: roundArs2(args.resumen.descPesos),
          ambiente: args.ambiente,
          comentarios: args.input.comentarios.trim().toLocaleUpperCase("es-AR"),
          estado: "borrador",
          efectoStock: efectoStockPorTipo(args.input.tipo),
          stockAplicado: false,
          diasVencimiento: args.diasVencimiento,
          impCobrado: args.impCobrado,
          cbteAsocId: args.original?.id ?? null,
          cbteAsocTipo: args.original?.cbteTipo ?? null,
          cbteAsocPtoVta: args.original
            ? ptoVentaAEnteroArca(args.original.ptoVenta)
            : null,
          cbteAsocNro: args.original?.cbteNro ?? null,
          cbteAsocCae: args.original?.cae ?? null,
          items: {
            create: args.lineas.map((l) => ({
              orden: l.orden,
              codTienda: l.codTienda,
              descripcion: l.descripcion,
              cantidad: l.cantidad,
              px: l.px,
              descuentoPct: l.descuentoPct,
              alicuotaIva: l.alicuotaIva,
              ivaId: l.ivaId,
              importe: l.importe,
              comentario: l.comentario,
            })),
          },
        },
      });
      await persistirMovimientosCobroEnTx(
        conComprobanteEnMovimientos(args.movimientosCobro, {
          comprobanteId: header.id,
          ordenInicio: 0,
        }),
        tx
      );
      return header;
    });
    createdId = created.id;
  } catch (e) {
    if (e instanceof TesoreriaCobroFacturaError) {
      return { success: false, error: e.serviceError };
    }
    console.error("[facturaComprobantes][emitirFiscal] persist", e);
    return { success: false, error: "No se pudo guardar el intento de comprobante." };
  }

  const payloadSolicitud = JSON.stringify({ solicitud: req });
  const caeRes = await wsfeCaeSolicitar(auth, req);
  if (!caeRes.ok) {
    const consultado = await wsfeCompConsultar(auth, ptoNro, args.cbteTipo, cbteNro);
    if (consultado.ok && consultado.data.cae) {
      const caeVtoIso = consultado.data.caeFchVto
        ? yyyymmddToIsoYmd(consultado.data.caeFchVto)
        : null;
      const updated = await prisma.comprobanteVta.update({
        where: { id: createdId },
        data: {
          cae: consultado.data.cae,
          caeVto: caeVtoIso ? prismaDateOnlyFromIsoYmd(caeVtoIso) : null,
          resultado: consultado.data.resultado ?? "A",
          estado: "autorizado",
        },
      });
      await persistirIntento({
        comprobanteId: createdId,
        operacion: "FECAESolicitar",
        resultado: "A",
        errores: `reconciliado tras error: ${caeRes.error}`,
        payload: JSON.stringify({
          solicitud: req,
          respuesta: consultado.data,
        }),
      });
      const emitido = { success: true as const, data: emitirResultadoDesdeRow(updated) };
      return imputarNcEmitidaAlOriginal(emitido, args.original?.id ?? null);
    }
    await prisma.comprobanteVta.update({
      where: { id: createdId },
      data: { estado: "rechazado", resultado: "R", observacionesArca: caeRes.error },
    });
    await persistirIntento({
      comprobanteId: createdId,
      operacion: "FECAESolicitar",
      resultado: "R",
      errores: caeRes.error,
      payload: payloadSolicitud,
    });
    return { success: false, error: caeRes.error };
  }

  const data = caeRes.data;
  const caeVtoIso = data.caeFchVto ? yyyymmddToIsoYmd(data.caeFchVto) : null;
  const obs = data.observaciones.map((o) => `${o.code}: ${o.msg}`).join(" · ");
  const estado: FacturaComprobanteEstado =
    data.resultado === "A" && data.cae ? "autorizado" : "rechazado";
  const updated = await prisma.comprobanteVta.update({
    where: { id: createdId },
    data: {
      cae: data.cae,
      caeVto: caeVtoIso ? prismaDateOnlyFromIsoYmd(caeVtoIso) : null,
      resultado: data.resultado,
      observacionesArca: obs || null,
      estado,
      cbteNro: data.cbteDesde || cbteNro,
    },
  });
  await persistirIntento({
    comprobanteId: createdId,
    operacion: "FECAESolicitar",
    resultado: data.resultado,
    errores: obs || null,
    payload: JSON.stringify({ solicitud: req, respuesta: data }),
  });
  if (estado !== "autorizado") {
    return {
      success: false,
      error: obs || "ARCA no autorizó el comprobante.",
    };
  }
  const emitido = { success: true as const, data: emitirResultadoDesdeRow(updated) };
  return imputarNcEmitidaAlOriginal(emitido, args.original?.id ?? null);
}

export async function emitirNotaCreditoDesdeComprobante(
  comprobanteId: string,
  personalId: number
): Promise<ServiceResult<FacturaEmitirResultado>> {
  const orig = await prisma.comprobanteVta.findUnique({
    where: { id: comprobanteId },
    include: { items: { orderBy: { orden: "asc" } } },
  });
  if (!orig) return { success: false, error: "El comprobante no existe." };
  if (orig.tipoComprobante !== "factura_fiscal" || !orig.cae) {
    return { success: false, error: "Solo se puede acreditar una factura autorizada por ARCA." };
  }
  const ya = await prisma.comprobanteVta.findFirst({
    where: { cbteAsocId: orig.id, tipoComprobante: "nota_credito_fiscal", estado: "autorizado" },
    select: { id: true },
  });
  if (ya) return { success: false, error: "Ese comprobante ya tiene nota de crédito." };

  const input: EmitirFacturaComprobanteInput = {
    fechaIso: dateToIsoYmdArgentina(new Date()),
    tipo: "nota_credito_fiscal",
    cliente: orig.receptorNombre,
    clienteId: orig.clienteId,
    proyectoId: orig.proyectoId,
    comentarios: orig.comentarios,
    ptoVtaId: orig.ptoVtaId,
    personalId,
    receptorDocTipo: orig.receptorDocTipo ?? undefined,
    receptorDocNro: orig.receptorDocNro ?? undefined,
    receptorCondicionIva: orig.receptorCondicionIva ?? undefined,
    cbteAsocId: orig.id,
    lineas: orig.items.map((l) => ({
      codTienda: l.codTienda,
      descripcion: l.descripcion,
      cantidad: decimalToNumber(l.cantidad),
      pxLista: decimalToNumber(l.px),
      descuentoPct: decimalToNumber(l.descuentoPct),
      comentario: l.comentario,
      alicuotaIva: decimalToNumber(l.alicuotaIva),
    })),
    descuento:
      decimalToNumber(orig.descPct) > 0
        ? {
            fuente: "porcentaje",
            porcentaje: decimalToNumber(orig.descPct),
            totalFacObjetivo: null,
          }
        : null,
    cobros: [],
  };
  return emitirFacturaComprobante(input);
}

export async function consultarFacturaComprobanteArca(
  id: string
): Promise<ServiceResult<FacturaEmitirResultado>> {
  const row = await prisma.comprobanteVta.findUnique({
    where: { id },
    include: { ptoVta: { select: { cuit: true } } },
  });
  if (!row) return { success: false, error: "El comprobante no existe." };
  if (!esTipoComprobanteFiscal(row.tipoComprobante) || row.cbteTipo == null || row.cbteNro == null) {
    return { success: false, error: "Ese comprobante no es fiscal ARCA." };
  }
  if (row.cae) {
    return { success: true, data: emitirResultadoDesdeRow(row) };
  }
  const authRes = await obtenerAuthWsfe({
    ptoVenta: row.ptoVenta,
    cuitEmisor: row.ptoVta.cuit,
  });
  if (!authRes.success) return authRes;
  const consultado = await wsfeCompConsultar(
    authRes.data,
    ptoVentaAEnteroArca(row.ptoVenta),
    row.cbteTipo,
    row.cbteNro
  );
  if (!consultado.ok) return { success: false, error: consultado.error };
  const caeVtoIso = consultado.data.caeFchVto
    ? yyyymmddToIsoYmd(consultado.data.caeFchVto)
    : null;
  const updated = await prisma.comprobanteVta.update({
    where: { id: row.id },
    data: {
      cae: consultado.data.cae,
      caeVto: caeVtoIso ? prismaDateOnlyFromIsoYmd(caeVtoIso) : null,
      resultado: consultado.data.resultado,
      estado: consultado.data.cae ? "autorizado" : row.estado,
    },
  });
  await persistirIntento({
    comprobanteId: row.id,
    operacion: "FECompConsultar",
    resultado: consultado.data.resultado,
    errores: null,
  });
  return { success: true, data: emitirResultadoDesdeRow(updated) };
}

export async function guardarDiasVencimientoComprobante(
  input: GuardarDiasVencimientoFacturaInput
): Promise<ServiceResult<void>> {
  try {
    const row = await prisma.comprobanteVta.findUnique({
      where: { id: input.id },
      select: {
        fecha: true,
        personalId: true,
        personal: { select: { sucursalPorDefecto: true } },
      },
    });
    if (!row) {
      return { success: false, error: "No se encontró el comprobante." };
    }
    const cobrosLedger = input.cobros.filter(
      (c) =>
        !c.esCuentaCorriente &&
        c.montoCents > 0 &&
        !esCobroNotaCreditoNombre(c.pagoNombre)
    );
    const cobradoCents = cobrosLedger.reduce((acc, c) => acc + c.montoCents, 0);
    let movimientos: MovimientoCobroFacturaData[] = [];
    if (cobrosLedger.length > 0) {
      if (row.personalId == null || !row.personal?.sucursalPorDefecto) {
        return {
          success: false,
          error: "El comprobante no tiene usuario/sucursal para registrar el cobro en tesorería.",
        };
      }
      const prep = await prepararMovimientosCobroDesdeSnapshots({
        cobros: cobrosLedger,
        sucursalCodigo: row.personal.sucursalPorDefecto,
        fechaIso: isoYmdFromPrismaDateOnly(row.fecha),
        personalId: row.personalId,
      });
      if (!prep.success) return prep;
      movimientos = prep.data;
    }
    await prisma.$transaction(async (tx) => {
      // Solo se reescriben los cobros directos; imputaciones de NC y pagos de CC se conservan.
      await tx.tesoreriaMovimiento.deleteMany({
        where: {
          comprobanteId: input.id,
          catMovimiento: "COBRO",
          clienteCobroId: null,
          notaCreditoId: null,
        },
      });
      const retenido = await sumarImpCobradoDesdeMovimientos(input.id, tx);
      const ordenInicio = await siguienteOrdenCobroComprobante(input.id, tx);
      await persistirMovimientosCobroEnTx(
        conComprobanteEnMovimientos(movimientos, {
          comprobanteId: input.id,
          ordenInicio,
        }),
        tx
      );
      await tx.comprobanteVta.update({
        where: { id: input.id },
        data: {
          diasVencimiento: input.diasVencimiento,
          impCobrado: roundArs2(retenido + cobradoCents / 100),
        },
      });
    });
    return { success: true, data: undefined };
  } catch (e) {
    if (e instanceof TesoreriaCobroFacturaError) {
      return { success: false, error: e.serviceError };
    }
    console.error("[guardarDiasVencimientoComprobante]", e);
    return { success: false, error: "No se pudieron guardar los días de vencimiento." };
  }
}

export async function registrarCobroComprobanteVta(
  input: RegistrarCobroComprobanteFacturaInput
): Promise<ServiceResult<void>> {
  try {
    const row = await prisma.comprobanteVta.findUnique({
      where: { id: input.id },
      select: {
        tipoComprobante: true,
        estado: true,
        fecha: true,
        impTotal: true,
        impCobrado: true,
        diasVencimiento: true,
        personalId: true,
        personal: { select: { sucursalPorDefecto: true } },
      },
    });
    if (!row) {
      return { success: false, error: "No se encontró el comprobante." };
    }
    const tipo = esFacturaTipo(row.tipoComprobante) ? row.tipoComprobante : "factura_no_fiscal";
    if (esFacturaTipoNotaCredito(tipo)) {
      if (asEstado(row.estado) === "rechazado") {
        return { success: false, error: "No se puede devolver un comprobante rechazado." };
      }
      if (esCobroNotaCreditoNombre(input.pagoNombre)) {
        return { success: false, error: "La devolución no se registra como nota de crédito." };
      }
      const vista = await listarVistaCobroNotaCredito(input.id);
      if (!vista || !ncPermiteDevolucion(vista)) {
        return {
          success: false,
          error:
            "La devolución solo aplica si no quedan ventas para imputar y hay saldo disponible.",
        };
      }
      const montoPesos = roundArs2(input.montoCents / 100);
      if (montoPesos > vista.saldoDisponible) {
        return { success: false, error: "El monto no puede ser mayor al saldo disponible." };
      }
      if (row.personalId == null || !row.personal?.sucursalPorDefecto) {
        return {
          success: false,
          error: "El comprobante no tiene usuario/sucursal para registrar la devolución en tesorería.",
        };
      }
      const prep = await prepararMovimientosCobroDesdeSnapshots({
        cobros: [
          {
            pagoNombre: input.pagoNombre,
            entidadNombre: input.entidadNombre,
            cuotaEtiqueta: input.cuotaEtiqueta,
            montoCents: input.montoCents,
          },
        ],
        sucursalCodigo: row.personal.sucursalPorDefecto,
        fechaIso: dateToIsoYmdArgentina(new Date()),
        personalId: row.personalId,
        observacion: "Devolución de nota de crédito",
      });
      if (!prep.success) return prep;
      // La devolución saca plata de la caja: egreso categoría NOTA_CREDITO con forma de pago.
      const egresos: MovimientoCobroFacturaData[] = prep.data.map((fila) => ({
        ...fila,
        tipoMovimiento: "EGRESO",
        catMovimiento: "NOTA_CREDITO",
      }));
      await prisma.$transaction(async (tx) => {
        const ordenInicio = await siguienteOrdenCobroComprobante(input.id, tx);
        await persistirMovimientosCobroEnTx(
          conComprobanteEnMovimientos(egresos, {
            comprobanteId: input.id,
            ordenInicio,
          }),
          tx
        );
      });
      return { success: true, data: undefined };
    }
    if (!esFacturaTipoVenta(tipo)) {
      return { success: false, error: "Solo se pueden agregar cobros a una venta." };
    }
    if (esCobroNotaCreditoNombre(input.pagoNombre)) {
      return {
        success: false,
        error: "La nota de crédito se imputa desde el comprobante NC.",
      };
    }
    if (asEstado(row.estado) === "rechazado") {
      return { success: false, error: "No se puede cobrar un comprobante rechazado." };
    }
    if (row.personalId == null || !row.personal?.sucursalPorDefecto) {
      return {
        success: false,
        error: "El comprobante no tiene usuario/sucursal para registrar el cobro en tesorería.",
      };
    }
    const impTotal = decimalToNumber(row.impTotal);
    const impCobrado = decimalToNumber(row.impCobrado);
    const saldo = saldoPendienteTrasCobro(impTotal, impCobrado);
    if (saldo <= 0) {
      return { success: false, error: "No hay saldo pendiente." };
    }
    const montoPesos = roundArs2(input.montoCents / 100);
    if (montoPesos > saldo) {
      return { success: false, error: "El monto no puede ser mayor al saldo pendiente." };
    }
    const fechaIso = isoYmdFromPrismaDateOnly(row.fecha);
    const movsPrep = await prepararMovimientosCobroDesdeSnapshots({
      cobros: [
        {
          pagoNombre: input.pagoNombre,
          entidadNombre: input.entidadNombre,
          cuotaEtiqueta: input.cuotaEtiqueta,
          montoCents: input.montoCents,
        },
      ],
      sucursalCodigo: row.personal.sucursalPorDefecto,
      fechaIso,
      personalId: row.personalId,
    });
    if (!movsPrep.success) return movsPrep;

    const siguienteImpCobrado = roundArs2(impCobrado + montoPesos);
    const siguienteSaldo = saldoPendienteTrasCobro(impTotal, siguienteImpCobrado);
    await prisma.$transaction(async (tx) => {
      const ordenInicio = await siguienteOrdenCobroComprobante(input.id, tx);
      await persistirMovimientosCobroEnTx(
        conComprobanteEnMovimientos(movsPrep.data, {
          comprobanteId: input.id,
          ordenInicio,
        }),
        tx
      );
      await tx.comprobanteVta.update({
        where: { id: input.id },
        data: {
          impCobrado: siguienteImpCobrado,
          diasVencimiento: siguienteSaldo <= 0 ? null : row.diasVencimiento,
        },
      });
    });
    return { success: true, data: undefined };
  } catch (e) {
    if (e instanceof TesoreriaCobroFacturaError) {
      return { success: false, error: e.serviceError };
    }
    console.error("[registrarCobroComprobanteVta]", e);
    return { success: false, error: "No se pudo registrar el cobro." };
  }
}

/**
 * Pago de cuenta corriente: el efectivo entra a la caja del pago y se reparte en el ledger
 * (una fila por venta imputada + una fila sin comprobante por el anticipo restante),
 * todas con `cliente_cobro_id` del pago padre. El total en caja es el monto cobrado.
 */
export async function registrarPagoCuentaCorriente(
  input: RegistrarPagoCuentaCorrienteInput
): Promise<ServiceResult<void>> {
  try {
    if (esCobroNotaCreditoNombre(input.pagoNombre)) {
      return {
        success: false,
        error: "El pago de cuenta corriente no se registra como nota de crédito.",
      };
    }
    const ventas = await listarVentasPendientesPagoCuentaCorriente(input.clienteId);
    const montoPesos = roundArs2(input.montoCents / 100);
    if (montoPesos <= 0) {
      return { success: false, error: "Ingresá un monto a pagar." };
    }
    const imputaciones = imputarPagoFifoVentas(ventas, montoPesos).filter(
      (fila) => fila.asignado > 0
    );
    const movsPrep = await prepararMovimientosCobroDesdeSnapshots({
      cobros: [
        {
          pagoNombre: input.pagoNombre,
          entidadNombre: input.entidadNombre,
          cuotaEtiqueta: input.cuotaEtiqueta,
          montoCents: input.montoCents,
        },
      ],
      sucursalCodigo: input.sucursalCodigo,
      fechaIso: dateToIsoYmdArgentina(new Date()),
      personalId: input.personalId,
    });
    if (!movsPrep.success) return movsPrep;
    const base = movsPrep.data[0];
    if (!base) {
      return { success: false, error: "No se pudo resolver el cobro en tesorería." };
    }

    await prisma.$transaction(async (tx) => {
      const padre = await tx.clienteCobro.create({
        data: {
          clienteId: input.clienteId,
          pagoNombre: input.pagoNombre,
          entidadNombre: input.entidadNombre,
          cuotaEtiqueta: input.cuotaEtiqueta,
          montoCents: input.montoCents,
        },
      });
      let restantePesos = base.monto;
      for (const fila of imputaciones) {
        const row = await tx.comprobanteVta.findUnique({
          where: { id: fila.id },
          select: {
            tipoComprobante: true,
            estado: true,
            impTotal: true,
            impCobrado: true,
            diasVencimiento: true,
          },
        });
        if (!row) {
          throw new Error("venta-ausente");
        }
        const tipo = esFacturaTipo(row.tipoComprobante)
          ? row.tipoComprobante
          : "factura_no_fiscal";
        if (!esFacturaTipoVenta(tipo) || asEstado(row.estado) === "rechazado") {
          throw new Error("venta-invalida");
        }
        const impTotal = decimalToNumber(row.impTotal);
        const impCobrado = decimalToNumber(row.impCobrado);
        const saldo = saldoPendienteTrasCobro(impTotal, impCobrado);
        const montoFila = roundArs2(fila.asignado);
        if (montoFila > saldo) {
          throw new Error("saldo-cambio");
        }
        const pesosLedger = Math.min(restantePesos, Math.max(1, Math.round(montoFila)));
        if (pesosLedger <= 0) {
          throw new TesoreriaCobroFacturaError(
            "El monto cobrado no alcanza para imputar todos los comprobantes en pesos enteros."
          );
        }
        restantePesos -= pesosLedger;
        const siguienteImpCobrado = roundArs2(impCobrado + montoFila);
        const siguienteSaldo = saldoPendienteTrasCobro(impTotal, siguienteImpCobrado);
        const ordenInicio = await siguienteOrdenCobroComprobante(fila.id, tx);
        await persistirMovimientosCobroEnTx(
          [
            {
              ...base,
              monto: pesosLedger,
              comprobanteId: fila.id,
              orden: ordenInicio,
              clienteCobroId: padre.id,
            },
          ],
          tx
        );
        await tx.comprobanteVta.update({
          where: { id: fila.id },
          data: {
            impCobrado: siguienteImpCobrado,
            diasVencimiento: siguienteSaldo <= 0 ? null : row.diasVencimiento,
          },
        });
      }
      if (restantePesos > 0) {
        await persistirMovimientosCobroEnTx(
          [
            {
              ...base,
              monto: restantePesos,
              comprobanteId: null,
              orden: null,
              clienteCobroId: padre.id,
            },
          ],
          tx
        );
      }
    });
    return { success: true, data: undefined };
  } catch (e) {
    if (e instanceof TesoreriaCobroFacturaError) {
      return { success: false, error: e.serviceError };
    }
    if (e instanceof Error && e.message === "saldo-cambio") {
      return {
        success: false,
        error: "El saldo de un comprobante cambió. Recargá e intentá de nuevo.",
      };
    }
    console.error("[registrarPagoCuentaCorriente]", e);
    return { success: false, error: "No se pudo registrar el pago." };
  }
}

/**
 * Imputa (parte de) un pago de cliente a una venta: el movimiento de caja del anticipo
 * (sin comprobante) se reasigna a la venta; si sobra, se parte en dos filas.
 */
export async function asignarClienteCobroComoCobro(
  input: AsignarClienteCobroComoCobroInput
): Promise<ServiceResult<void>> {
  try {
    const cobro = await prisma.clienteCobro.findUnique({
      where: { id: input.cobroId },
      select: {
        clienteId: true,
        montoCents: true,
        imputaciones: {
          where: { comprobanteId: { not: null } },
          select: { monto: true },
        },
      },
    });
    if (!cobro) {
      return { success: false, error: "El cobro no existe." };
    }
    const disponiblePesos = leftoverClienteCobroDesdeMovimientos(
      cobro.montoCents,
      cobro.imputaciones
    );
    if (disponiblePesos <= 0) {
      return { success: false, error: "El cobro ya está imputado." };
    }
    const ventas = await listarVentasPendientesPagoCuentaCorriente(cobro.clienteId);
    const ventaPendiente = ventas.find((v) => v.id === input.ventaId);
    if (!ventaPendiente) {
      return { success: false, error: "La venta no tiene saldo pendiente." };
    }
    const montoPesos = roundArs2(
      Math.min(disponiblePesos, ventaPendiente.saldoPendiente)
    );
    const venta = await prisma.comprobanteVta.findUnique({
      where: { id: input.ventaId },
      select: {
        tipoComprobante: true,
        estado: true,
        impTotal: true,
        impCobrado: true,
        diasVencimiento: true,
      },
    });
    if (!venta) {
      return { success: false, error: "No se encontró el comprobante." };
    }
    const tipo = esFacturaTipo(venta.tipoComprobante)
      ? venta.tipoComprobante
      : "factura_no_fiscal";
    if (!esFacturaTipoVenta(tipo) || asEstado(venta.estado) === "rechazado") {
      return { success: false, error: "Solo se puede imputar a una venta." };
    }
    const impTotal = decimalToNumber(venta.impTotal);
    const impCobrado = decimalToNumber(venta.impCobrado);
    const saldo = saldoPendienteTrasCobro(impTotal, impCobrado);
    if (montoPesos > saldo) {
      return {
        success: false,
        error: "El saldo de un comprobante cambió. Recargá e intentá de nuevo.",
      };
    }
    const pesosLedger = Math.min(
      disponiblePesos,
      Math.max(1, Math.round(montoPesos))
    );
    const siguienteImpCobrado = roundArs2(impCobrado + montoPesos);
    const siguienteSaldo = saldoPendienteTrasCobro(impTotal, siguienteImpCobrado);
    await prisma.$transaction(async (tx) => {
      const anticipos = await tx.tesoreriaMovimiento.findMany({
        where: {
          clienteCobroId: input.cobroId,
          comprobanteId: null,
          catMovimiento: "COBRO",
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      let restante = pesosLedger;
      let orden = await siguienteOrdenCobroComprobante(input.ventaId, tx);
      for (const anticipo of anticipos) {
        if (restante <= 0) break;
        const tomar = Math.min(anticipo.monto, restante);
        if (tomar === anticipo.monto) {
          await tx.tesoreriaMovimiento.update({
            where: { id: anticipo.id },
            data: { comprobanteId: input.ventaId, orden },
          });
        } else {
          const acredTomar =
            anticipo.monto > 0
              ? Math.round((anticipo.montoAcreditado * tomar) / anticipo.monto)
              : 0;
          await tx.tesoreriaMovimiento.update({
            where: { id: anticipo.id },
            data: {
              monto: anticipo.monto - tomar,
              montoAcreditado: Math.max(0, anticipo.montoAcreditado - acredTomar),
            },
          });
          await tx.tesoreriaMovimiento.create({
            data: {
              cajaId: anticipo.cajaId,
              tipoMovimiento: anticipo.tipoMovimiento,
              catMovimiento: anticipo.catMovimiento,
              monto: tomar,
              montoAcreditado: acredTomar,
              fechaRegistro: anticipo.fechaRegistro,
              fechaAcreditacion: anticipo.fechaAcreditacion,
              observacion: anticipo.observacion,
              pagoId: anticipo.pagoId,
              entidadId: anticipo.entidadId,
              cuotaId: anticipo.cuotaId,
              cxFinId: anticipo.cxFinId,
              sucursalId: anticipo.sucursalId,
              personalId: anticipo.personalId,
              comprobanteId: input.ventaId,
              orden,
              clienteCobroId: input.cobroId,
            },
          });
        }
        orden += 1;
        restante -= tomar;
      }
      if (restante > 0) {
        throw new TesoreriaCobroFacturaError(
          "No se encontró el movimiento de tesorería del cobro a imputar."
        );
      }
      await tx.comprobanteVta.update({
        where: { id: input.ventaId },
        data: {
          impCobrado: siguienteImpCobrado,
          diasVencimiento: siguienteSaldo <= 0 ? null : venta.diasVencimiento,
        },
      });
    });
    return { success: true, data: undefined };
  } catch (e) {
    if (e instanceof TesoreriaCobroFacturaError) {
      return { success: false, error: e.serviceError };
    }
    console.error("[asignarClienteCobroComoCobro]", e);
    return { success: false, error: "No se pudo asignar el cobro." };
  }
}

/** Imputa el saldo disponible de una NC como cobro de una venta del mismo cliente. */
export async function asignarNotaCreditoComoCobro(input: {
  notaCreditoId: string;
  ventaId: string;
}): Promise<ServiceResult<void>> {
  try {
    const [nc, venta] = await Promise.all([
      prisma.comprobanteVta.findUnique({
        where: { id: input.notaCreditoId },
        select: {
          tipoComprobante: true,
          ptoVenta: true,
          cbteNro: true,
          impTotal: true,
          clienteId: true,
          estado: true,
          cbteAsocId: true,
          personalId: true,
          personal: { select: { sucursalPorDefecto: true } },
        },
      }),
      prisma.comprobanteVta.findUnique({
        where: { id: input.ventaId },
        select: {
          tipoComprobante: true,
          estado: true,
          impTotal: true,
          impCobrado: true,
          clienteId: true,
          diasVencimiento: true,
          personalId: true,
          personal: { select: { sucursalPorDefecto: true } },
        },
      }),
    ]);
    if (!nc || !venta) {
      return { success: false, error: "No se encontró el comprobante." };
    }
    const tipoNc = esFacturaTipo(nc.tipoComprobante) ? nc.tipoComprobante : "factura_no_fiscal";
    if (!esFacturaTipoNotaCredito(tipoNc) || asEstado(nc.estado) === "rechazado") {
      return { success: false, error: "La nota de crédito no se puede imputar." };
    }
    const tipoVenta = esFacturaTipo(venta.tipoComprobante)
      ? venta.tipoComprobante
      : "factura_no_fiscal";
    if (!esFacturaTipoVenta(tipoVenta) || asEstado(venta.estado) === "rechazado") {
      return { success: false, error: "Solo se puede imputar a una venta." };
    }
    if (nc.cbteAsocId !== input.ventaId) {
      if (nc.clienteId == null || nc.clienteId !== venta.clienteId) {
        return { success: false, error: "La venta no es del mismo cliente." };
      }
    }
    const nro = formatoNroComprobante(nc.ptoVenta, nc.cbteNro);
    const usadoPesos = await usadoNotaCreditoPesos(input.notaCreditoId);
    const disponibleCents = Math.max(
      0,
      Math.round(decimalToNumber(nc.impTotal) * 100) - Math.round(usadoPesos * 100)
    );
    if (disponibleCents <= 0) {
      return { success: false, error: "La nota de crédito ya está imputada." };
    }
    const saldoVenta = saldoPendienteTrasCobro(
      decimalToNumber(venta.impTotal),
      decimalToNumber(venta.impCobrado)
    );
    if (saldoVenta <= 0) {
      return { success: false, error: "La venta no tiene saldo pendiente." };
    }
    const sucursalId =
      (await sucursalIdDesdeCodigo(nc.personal?.sucursalPorDefecto)) ??
      (await sucursalIdDesdeCodigo(venta.personal?.sucursalPorDefecto));
    if (!sucursalId) {
      return {
        success: false,
        error: "No se pudo determinar la sucursal para registrar la imputación de la nota de crédito.",
      };
    }
    const montoCents = Math.min(disponibleCents, Math.round(saldoVenta * 100));
    const montoPesos = Math.max(1, Math.round(montoCents / 100));
    const siguienteImpCobrado = roundArs2(decimalToNumber(venta.impCobrado) + montoCents / 100);
    const siguienteSaldo = saldoPendienteTrasCobro(
      decimalToNumber(venta.impTotal),
      siguienteImpCobrado
    );
    await prisma.$transaction(async (tx) => {
      const orden = await siguienteOrdenCobroComprobante(input.ventaId, tx);
      const imputacion = await crearImputacionNotaCreditoMovimiento(
        {
          ventaId: input.ventaId,
          notaCreditoId: input.notaCreditoId,
          montoPesos,
          orden,
          fechaIso: dateToIsoYmdArgentina(new Date()),
          personalId: nc.personalId ?? venta.personalId,
          sucursalId,
          observacion: observacionImputacionNc(nro),
        },
        tx
      );
      if (!imputacion.success) {
        throw new TesoreriaCobroFacturaError(imputacion.error);
      }
      await tx.comprobanteVta.update({
        where: { id: input.ventaId },
        data: {
          impCobrado: siguienteImpCobrado,
          diasVencimiento: siguienteSaldo <= 0 ? null : venta.diasVencimiento,
        },
      });
    });
    return { success: true, data: undefined };
  } catch (e) {
    if (e instanceof TesoreriaCobroFacturaError) {
      return { success: false, error: e.serviceError };
    }
    console.error("[asignarNotaCreditoComoCobro]", e);
    return { success: false, error: "No se pudo asignar la nota de crédito." };
  }
}


export async function healthArca(): Promise<
  ServiceResult<{
    ambiente: "homo" | "prod";
    certConfigured: boolean;
    dummy: { appServer: string; dbServer: string; authServer: string };
  }>
> {
  const dummy = await wsfeDummy();
  if (!dummy.ok) return { success: false, error: dummy.error };
  return {
    success: true,
    data: {
      ambiente: ambienteArcaActual(),
      certConfigured: arcaCertificadosConfigurados(),
      dummy: dummy.data,
    },
  };
}
