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
import { saldosCuentaCorrientePorCliente } from "@/services/clientes.service";
import {
  dateToIsoYmdArgentina,
  isoYmdFromPrismaDateOnly,
  isoYmdToYyyymmdd,
  prismaDateOnlyFromIsoYmd,
  yyyymmddToIsoYmd,
} from "@/lib/fechaArgentina";
import { CLIENTE_CTA_CORRIENTE_PLAZO_DEFAULT } from "@/lib/envios";
import {
  diasVencimientoDesdePlazoCliente,
  efectoStockPorTipo,
  esFacturaTipo,
  esFacturaTipoNotaCredito,
  esFacturaTipoVenta,
  MENSAJE_CLIENTE_TOPE_CTA_CORRIENTE,
  clienteSuperaTopeCtaCorriente,
  mensajeClienteFacturaNoSeleccionado,
  nombreClienteFactura,
  porcentajeDescuentoGlobal,
  porcentajeDescuentoLinea,
  pxConDescuento,
  resumenTotalesFactura,
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
  armarTotalesWsfe,
  coherenciaImpTotal,
  docNroAEnteroArca,
  esCuitValido,
  esTipoLocalFiscal,
  formatoNroComprobante,
  ivaIdDesdeAlicuota,
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
} from "@/lib/validations/factura";
import type { ServiceResult } from "@/types/service.types";

function decimalToNumber(value: Prisma.Decimal | number): number {
  return Number(value);
}

function asEstado(raw: string): FacturaComprobanteEstado {
  if (raw === "borrador" || raw === "autorizado" || raw === "rechazado") return raw;
  return "borrador";
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
};

export async function obtenerFacturaComprobantePdfDatos(
  id: string
): Promise<ServiceResult<FacturaComprobantePdfDatos>> {
  try {
    const row = await prisma.comprobanteVta.findUnique({
      where: { id },
      include: { items: { orderBy: { orden: "asc" } } },
    });
    if (!row) return { success: false, error: "El comprobante no existe." };
    const tipo: FacturaTipo = esFacturaTipo(row.tipoLocal)
      ? row.tipoLocal
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
      },
    };
  } catch (e) {
    console.error("[facturaComprobantes][obtenerPdf]", e);
    return { success: false, error: "No se pudo leer el comprobante." };
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
  tipoLocal: FacturaTipo,
  tx: Prisma.TransactionClient
): Promise<number> {
  const max = await tx.comprobanteVta.aggregate({
    where: { ptoVtaId, tipoLocal, cbteNro: { not: null } },
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
}): Promise<void> {
  try {
    await prisma.comprobanteVtaHistorialArca.create({
      data: {
        comprobanteId: opts.comprobanteId,
        requestId: crypto.randomUUID(),
        operacion: opts.operacion,
        resultado: opts.resultado,
        errores: opts.errores,
      },
    });
  } catch (e) {
    console.error("[arca][intento]", e instanceof Error ? e.message : "error");
  }
}

function emitirResultadoDesdeRow(row: {
  id: string;
  tipoLocal: string;
  letra: string | null;
  ptoVenta: string;
  cbteNro: number | null;
  cae: string | null;
  caeVto: Date | null;
  resultado: string | null;
  estado: string;
}): FacturaEmitirResultado {
  const tipo: FacturaTipo = esFacturaTipo(row.tipoLocal)
    ? row.tipoLocal
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

export async function emitirFacturaComprobante(
  input: EmitirFacturaComprobanteInput
): Promise<ServiceResult<FacturaEmitirResultado>> {
  const fecha = prismaDateOnlyFromIsoYmd(input.fechaIso);
  if (!fecha) return { success: false, error: "Fecha de comprobante inválida." };

  const pto = await prisma.globalPtoVta.findUnique({
    where: { id: input.ptoVtaId },
    select: {
      id: true,
      ptoVenta: true,
      cuit: true,
      condicionIva: true,
      concepto: true,
      estado: true,
    },
  });
  if (!pto || pto.estado !== "activo") {
    return { success: false, error: "El punto de venta no existe o está inactivo." };
  }

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
    if (esFacturaTipoVenta(input.tipo) && cliente.ctaCorrienteMontoMax != null) {
      const saldos = await saldosCuentaCorrientePorCliente([clienteId]);
      const saldo = saldos.get(clienteId) ?? 0;
      if (clienteSuperaTopeCtaCorriente(saldo, Number(cliente.ctaCorrienteMontoMax))) {
        return { success: false, error: MENSAJE_CLIENTE_TOPE_CTA_CORRIENTE };
      }
    }
    clienteFiscal = { cuit: cliente.cuit, condicionIva: cliente.condicionIva };
    plazoCliente = cliente.ctaCorrientePlazo ?? CLIENTE_CTA_CORRIENTE_PLAZO_DEFAULT;
  }
  const diasVencimiento = esFacturaTipoVenta(input.tipo)
    ? diasVencimientoDesdePlazoCliente(plazoCliente)
    : null;
  const proyectoResuelto = await resolverProyectoIdComprobante({
    clienteId,
    proyectoId: input.proyectoId,
  });
  if (!proyectoResuelto.success) return proyectoResuelto;
  const proyectoId = proyectoResuelto.data;
  const receptor = receptorFiscalParaEmitir({
    cliente: clienteFiscal,
    fallback: {
      docTipo: input.receptorDocTipo,
      docNro: input.receptorDocNro,
      condicionIva: input.receptorCondicionIva,
    },
  });

  const fiscal = esTipoLocalFiscal(input.tipo);
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
  } | null = null;

  if (esFacturaTipoNotaCredito(input.tipo)) {
    if (!input.cbteAsocId) {
      return { success: false, error: "La nota de crédito requiere el comprobante original." };
    }
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

    const recOk = validarReceptorFiscal({
      letra,
      condicionIva: receptor.condicionIva,
      docTipo: receptor.docTipo,
      docNro: receptor.docNro,
      impTotal,
    });
    if (!recOk.success) return recOk;
  }

  const ambiente = ambienteArcaActual();
  const concepto = pto.concepto || "1";
  const receptorNombre = nombreClienteFactura(input.cliente);

  if (!fiscal) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const cbteNro = await siguienteNroInterno(pto.id, input.tipo, tx);
        const header = await tx.comprobanteVta.create({
          data: {
            tipoLocal: input.tipo,
            cbteTipo: null,
            letra: input.tipo === "factura_no_fiscal" ? "X" : null,
            ptoVtaId: pto.id,
            ptoVenta: pto.ptoVenta,
            cbteNro,
            fecha,
            concepto,
            clienteId,
            proyectoId,
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
        return header;
      });
      return { success: true, data: emitirResultadoDesdeRow(created) };
    } catch (e) {
      console.error("[facturaComprobantes][emitirInterno]", e);
      return { success: false, error: "No se pudo guardar el comprobante." };
    }
  }

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
    diasVencimiento,
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
  diasVencimiento: number | null;
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
    return { success: true, data: emitirResultadoDesdeRow(existente) };
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
      return { success: true, data: emitirResultadoDesdeRow(updated) };
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
      return tx.comprobanteVta.create({
        data: {
          tipoLocal: args.input.tipo,
          cbteTipo: args.cbteTipo,
          letra: args.letra,
          ptoVtaId: args.pto.id,
          ptoVenta: args.pto.ptoVenta,
          cbteNro,
          fecha: args.fecha,
          concepto: args.concepto,
          clienteId: args.clienteId,
          proyectoId: args.proyectoId,
          receptorNombre: args.receptorNombre,
          receptorDocTipo: args.receptor.docTipo,
          receptorDocNro: args.receptor.docNro,
          receptorCondicionIva: args.receptor.condicionIva,
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
    });
    createdId = created.id;
  } catch (e) {
    console.error("[facturaComprobantes][emitirFiscal] persist", e);
    return { success: false, error: "No se pudo guardar el intento de comprobante." };
  }

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
      });
      return { success: true, data: emitirResultadoDesdeRow(updated) };
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
  });
  if (estado !== "autorizado") {
    return {
      success: false,
      error: obs || "ARCA no autorizó el comprobante.",
    };
  }
  return { success: true, data: emitirResultadoDesdeRow(updated) };
}

export async function emitirNotaCreditoDesdeComprobante(
  comprobanteId: string
): Promise<ServiceResult<FacturaEmitirResultado>> {
  const orig = await prisma.comprobanteVta.findUnique({
    where: { id: comprobanteId },
    include: { items: { orderBy: { orden: "asc" } } },
  });
  if (!orig) return { success: false, error: "El comprobante no existe." };
  if (orig.tipoLocal !== "factura_fiscal" || !orig.cae) {
    return { success: false, error: "Solo se puede acreditar una factura autorizada por ARCA." };
  }
  const ya = await prisma.comprobanteVta.findFirst({
    where: { cbteAsocId: orig.id, tipoLocal: "nota_credito_fiscal", estado: "autorizado" },
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
  if (!esTipoLocalFiscal(row.tipoLocal) || row.cbteTipo == null || row.cbteNro == null) {
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
    await prisma.comprobanteVta.update({
      where: { id: input.id },
      data: { diasVencimiento: input.diasVencimiento },
    });
    return { success: true, data: undefined };
  } catch (e) {
    console.error("[guardarDiasVencimientoComprobante]", e);
    return { success: false, error: "No se pudieron guardar los días de vencimiento." };
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
