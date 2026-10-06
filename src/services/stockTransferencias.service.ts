import { Prisma, type StockTransferenciaEstado } from "@prisma/client";
import { cantidadDesdePrisma, redondearCantidadUnDecimal } from "@/lib/cantidadUnDecimal";
import { prisma } from "@/lib/prisma";
import {
  etiquetaEstadoTransferencia,
  fmtNumeroTransferenciaInterna,
} from "@/lib/stockTransferenciaNumero";
import type {
  AceptarStockTransferenciaInput,
  CrearStockTransferenciaInput,
  ResolverStockTransferenciaInput,
} from "@/lib/validations/stockTransferencias";
import type { ServiceResult } from "@/types";

export type StockTransferenciaItemDto = {
  id: string;
  codItem: string;
  descripcion: string;
  cantidad: number;
  cantidadConfirmada: number | null;
};

export type StockTransferenciaDetalle = {
  id: string;
  numero: number;
  version: number;
  numeroEtiqueta: string;
  estado: StockTransferenciaEstado;
  origenCodigo: string;
  origenNombre: string;
  destinoCodigo: string;
  destinoNombre: string;
  /** Sucursal que debe aceptar ahora. */
  confirmaCodigo: string;
  /** Sucursal de quien emitió esta versión (puede eliminarla). */
  creadoraCodigo: string;
  creadaPorNombre: string;
  resueltaPorNombre: string | null;
  motivo: string | null;
  comentario: string | null;
  createdAtIso: string;
  resueltaAtIso: string | null;
  comprobanteId: string | null;
  items: StockTransferenciaItemDto[];
};

const ERROR_YA_RESUELTA = "La transferencia ya no está pendiente de aceptación.";

export type AceptarStockTransferenciaResult = {
  resultado: "aceptada" | "rectificada";
  numero: string;
  movimientos: number;
  numeroSiguiente?: string;
  confirmaNombre?: string;
};

function estaAbierta(
  estado: StockTransferenciaEstado
): estado is "EMITIDO_PENDIENTE" | "RECTIFICADO_PENDIENTE" {
  return estado === "EMITIDO_PENDIENTE" || estado === "RECTIFICADO_PENDIENTE";
}

type SucursalRef = { id: string; codigo: string; nombre: string };

const transferenciaInclude = {
  sucursalOrigen: { select: { id: true, codigo: true, nombre: true } },
  sucursalDestino: { select: { id: true, codigo: true, nombre: true } },
  sucursalConfirma: { select: { id: true, codigo: true, nombre: true } },
  creadaPor: { select: { nombrePersonal: true, sucursalPorDefecto: true } },
  resueltaPor: { select: { nombrePersonal: true } },
  items: {
    orderBy: { codItem: "asc" },
    select: {
      id: true,
      codItem: true,
      cantidad: true,
      cantidadConfirmada: true,
      prodTienda: { select: { descripcionTienda: true } },
    },
  },
} satisfies Prisma.StockTransferenciaInclude;

type TransferenciaConRelaciones = Prisma.StockTransferenciaGetPayload<{
  include: typeof transferenciaInclude;
}>;

function sucursalCreadora(t: TransferenciaConRelaciones): SucursalRef {
  const codigo = t.creadaPor.sucursalPorDefecto;
  if (codigo === t.sucursalOrigen.codigo) return t.sucursalOrigen;
  if (codigo === t.sucursalDestino.codigo) return t.sucursalDestino;
  return t.sucursalConfirma.id === t.sucursalOrigen.id
    ? t.sucursalDestino
    : t.sucursalOrigen;
}

function sucursalOpuesta(
  t: TransferenciaConRelaciones,
  sucursalId: string
): SucursalRef {
  return sucursalId === t.sucursalOrigen.id ? t.sucursalDestino : t.sucursalOrigen;
}

function aDetalle(t: TransferenciaConRelaciones): StockTransferenciaDetalle {
  return {
    id: t.id,
    numero: t.numero,
    version: t.version,
    numeroEtiqueta: fmtNumeroTransferenciaInterna(t.numero, t.version),
    estado: t.estado,
    origenCodigo: t.sucursalOrigen.codigo,
    origenNombre: t.sucursalOrigen.nombre,
    destinoCodigo: t.sucursalDestino.codigo,
    destinoNombre: t.sucursalDestino.nombre,
    confirmaCodigo: t.sucursalConfirma.codigo,
    creadoraCodigo: sucursalCreadora(t).codigo,
    creadaPorNombre: t.creadaPor.nombrePersonal,
    resueltaPorNombre: t.resueltaPor?.nombrePersonal ?? null,
    motivo: t.motivo,
    comentario: t.comentario,
    createdAtIso: t.createdAt.toISOString(),
    resueltaAtIso: t.resueltaAt?.toISOString() ?? null,
    comprobanteId: t.comprobanteId,
    items: t.items.map((i) => ({
      id: i.id,
      codItem: i.codItem,
      descripcion: i.prodTienda.descripcionTienda ?? i.codItem,
      cantidad: cantidadDesdePrisma(i.cantidad),
      cantidadConfirmada:
        i.cantidadConfirmada == null ? null : cantidadDesdePrisma(i.cantidadConfirmada),
    })),
  };
}

async function sucursalDeUsuario(personalId: number): Promise<string | null> {
  const u = await prisma.globalPersonal.findUnique({
    where: { idPersonal: personalId },
    select: { sucursalPorDefecto: true },
  });
  return u?.sucursalPorDefecto ?? null;
}

async function cargarTransferencia(id: string): Promise<TransferenciaConRelaciones | null> {
  return prisma.stockTransferencia.findUnique({
    where: { id },
    include: transferenciaInclude,
  });
}

function esNoEncontrado(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";
}

function textoItems(n: number): string {
  return `${n} ítem${n !== 1 ? "s" : ""}`;
}

async function proximoNumeroFamilia(): Promise<number> {
  const agg = await prisma.stockTransferencia.aggregate({ _max: { numero: true } });
  return (agg._max.numero ?? 0) + 1;
}

function movimientosDeAceptados(
  aceptados: Array<{ codItem: string; conf: number }>,
  t: TransferenciaConRelaciones,
  personalId: number
) {
  return aceptados
    .filter((r) => r.conf > 0)
    .flatMap((r) => [
      {
        tipoMovimiento: "EGRESO" as const,
        categoriaMovimiento: "TRANSF_INTERNA" as const,
        codItem: r.codItem,
        sucursalId: t.sucursalOrigen.id,
        cantidad: r.conf,
        usuarioId: personalId,
      },
      {
        tipoMovimiento: "INGRESO" as const,
        categoriaMovimiento: "TRANSF_INTERNA" as const,
        codItem: r.codItem,
        sucursalId: t.sucursalDestino.id,
        cantidad: r.conf,
        usuarioId: personalId,
      },
    ]);
}

/**
 * Crea una transferencia **EMITIDO_PENDIENTE** versión 1 (sin ledger).
 * El creador debe ser de una punta; la otra recibe `TRANSF_PENDIENTE`.
 */
export async function crearStockTransferencia(
  input: CrearStockTransferenciaInput
): Promise<ServiceResult<{ id: string; confirmaNombre: string; numero: string }>> {
  try {
    const usuario = await prisma.globalPersonal.findUnique({
      where: { idPersonal: input.personalId },
      select: { nombrePersonal: true, sucursalPorDefecto: true },
    });
    if (!usuario?.sucursalPorDefecto) {
      return { success: false, error: "El usuario no tiene sucursal asignada." };
    }
    const codigoUsuario = usuario.sucursalPorDefecto;
    if (codigoUsuario !== input.origenCodigo && codigoUsuario !== input.destinoCodigo) {
      return { success: false, error: "Origen o destino debe ser tu sucursal." };
    }

    const sucursales = await prisma.sucursal.findMany({
      where: { codigo: { in: [input.origenCodigo, input.destinoCodigo] } },
      select: { id: true, codigo: true, nombre: true },
    });
    const origen = sucursales.find((s) => s.codigo === input.origenCodigo);
    const destino = sucursales.find((s) => s.codigo === input.destinoCodigo);
    if (!origen || !destino) {
      return { success: false, error: "Sucursal origen o destino inexistente." };
    }
    const confirma = codigoUsuario === origen.codigo ? destino : origen;
    const creadora = confirma.id === origen.id ? destino : origen;

    const codigos = input.items.map((i) => i.codItem.trim());
    const existentes = await prisma.prodTienda.count({
      where: { codTienda: { in: codigos } },
    });
    if (existentes !== codigos.length) {
      return { success: false, error: "Hay ítems que no existen en el catálogo." };
    }

    const numero = await proximoNumeroFamilia();
    const numeroEtiqueta = fmtNumeroTransferenciaInterna(numero, 1);

    const creada = await prisma.stockTransferencia.create({
      data: {
        numero,
        version: 1,
        sucursalOrigenId: origen.id,
        sucursalDestinoId: destino.id,
        sucursalConfirmaId: confirma.id,
        creadaPorId: input.personalId,
        items: {
          createMany: {
            data: input.items.map((i) => ({
              codItem: i.codItem.trim(),
              cantidad: redondearCantidadUnDecimal(i.cantidad),
            })),
          },
        },
        notificaciones: {
          create: {
            tipo: "TRANSF_PENDIENTE",
            sucursalId: confirma.id,
            titulo: `Transferencia N° ${numeroEtiqueta}`,
            mensaje: `${usuario.nombrePersonal} (${creadora.nombre}) emitió la transferencia interna N° ${numeroEtiqueta} ${origen.nombre} → ${destino.nombre} de ${textoItems(input.items.length)}. Revisá las cantidades.`,
          },
        },
      },
      select: { id: true },
    });
    return {
      success: true,
      data: { id: creada.id, confirmaNombre: confirma.nombre, numero: numeroEtiqueta },
    };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = e.meta?.target;
      const chocaNumero =
        Array.isArray(target) && target.some((k) => k === "numero" || k === "version");
      if (chocaNumero) return crearStockTransferencia(input);
    }
    console.error("[crearStockTransferencia]", e);
    return { success: false, error: "No se pudo crear la transferencia." };
  }
}

export async function obtenerStockTransferenciaDetalle(
  id: string
): Promise<ServiceResult<StockTransferenciaDetalle>> {
  try {
    const t = await cargarTransferencia(id);
    if (!t) return { success: false, error: "Transferencia no encontrada." };
    return { success: true, data: aDetalle(t) };
  } catch (e) {
    console.error("[obtenerStockTransferenciaDetalle]", e);
    return { success: false, error: "No se pudo cargar la transferencia." };
  }
}

/**
 * Ítems con la misma cantidad propuesta → ledger ahora.
 * Ítems rectificados o agregados → nueva versión (N° 0001-2) emitida por
 * quien revisa; la otra punta debe aceptarla. Sin rechazo.
 */
export async function aceptarStockTransferencia(
  id: string,
  input: AceptarStockTransferenciaInput
): Promise<ServiceResult<AceptarStockTransferenciaResult>> {
  try {
    const t = await cargarTransferencia(id);
    if (!t) return { success: false, error: "Transferencia no encontrada." };
    if (!estaAbierta(t.estado)) return { success: false, error: ERROR_YA_RESUELTA };

    const usuario = await prisma.globalPersonal.findUnique({
      where: { idPersonal: input.personalId },
      select: { nombrePersonal: true, sucursalPorDefecto: true },
    });
    if (usuario?.sucursalPorDefecto !== t.sucursalConfirma.codigo) {
      return {
        success: false,
        error: `Solo un usuario de ${t.sucursalConfirma.nombre} puede aceptarla.`,
      };
    }

    const porId = new Map(t.items.map((i) => [i.id, i]));
    const porCod = new Map(t.items.map((i) => [i.codItem, i]));
    const usados = new Set<string>();
    const aceptados: Array<{ id: string; codItem: string; conf: number }> = [];
    const rectificados: Array<{ codItem: string; conf: number }> = [];

    for (const row of input.items) {
      const existente =
        (row.itemId ? porId.get(row.itemId) : undefined) ?? porCod.get(row.codItem);
      const conf = redondearCantidadUnDecimal(row.cantidadConfirmada);
      if (existente) {
        if (usados.has(existente.id)) {
          return { success: false, error: `Ítem repetido: ${existente.codItem}.` };
        }
        usados.add(existente.id);
        const enviada = cantidadDesdePrisma(existente.cantidad);
        const propuesta =
          existente.cantidadConfirmada == null
            ? enviada
            : cantidadDesdePrisma(existente.cantidadConfirmada);
        if (conf === propuesta) {
          aceptados.push({ id: existente.id, codItem: existente.codItem, conf });
        } else {
          rectificados.push({ codItem: existente.codItem, conf });
        }
      } else {
        rectificados.push({ codItem: row.codItem.trim(), conf });
      }
    }

    if (usados.size !== t.items.length) {
      return {
        success: false,
        error: "Faltan ítems de la transferencia emitida.",
      };
    }

    const nuevosCodigos = rectificados
      .map((r) => r.codItem)
      .filter((cod) => !porCod.has(cod));
    if (nuevosCodigos.length > 0) {
      const existentesCat = await prisma.prodTienda.count({
        where: { codTienda: { in: nuevosCodigos } },
      });
      if (existentesCat !== nuevosCodigos.length) {
        return { success: false, error: "Hay ítems agregados que no existen en el catálogo." };
      }
    }

    const ahora = new Date();
    const numeroEtiqueta = fmtNumeroTransferenciaInterna(t.numero, t.version);
    const lineasLedger = movimientosDeAceptados(aceptados, t, input.personalId);
    const proximaConfirma = sucursalOpuesta(t, t.sucursalConfirma.id);

    const dataCierre: Prisma.StockTransferenciaUpdateInput = {
      estado: "ACEPTADA",
      resueltaPor: { connect: { idPersonal: input.personalId } },
      resueltaAt: ahora,
      items: {
        update: aceptados.map((r) => ({
          where: { id: r.id },
          data: { cantidadConfirmada: r.conf },
        })),
      },
      notificaciones: {
        updateMany: {
          where: { leidaAt: null },
          data: { leidaAt: ahora, leidaPorId: input.personalId },
        },
      },
    };

    if (lineasLedger.length > 0) {
      dataCierre.comprobante = {
        create: {
          tipo: "TRANSFERENCIA_ENTRE_DEPOSITOS",
          sucursal: { connect: { id: t.sucursalOrigen.id } },
          sucursalDestino: { connect: { id: t.sucursalDestino.id } },
          personal: { connect: { idPersonal: input.personalId } },
          movimientos: { createMany: { data: lineasLedger } },
        },
      };
    }

    if (rectificados.length === 0) {
      await prisma.stockTransferencia.update({
        where: { id, estado: t.estado },
        data: {
          ...dataCierre,
          notificaciones: {
            updateMany: {
              where: { leidaAt: null },
              data: { leidaAt: ahora, leidaPorId: input.personalId },
            },
            create: {
              tipo: "TRANSF_ACEPTADA",
              sucursalId: proximaConfirma.id,
              titulo: `Transferencia N° ${numeroEtiqueta} aceptada`,
              mensaje: `${usuario.nombrePersonal} (${t.sucursalConfirma.nombre}) aceptó la transferencia interna N° ${numeroEtiqueta}. El stock de esta versión quedó registrado.`,
            },
          },
        },
        select: { id: true },
      });
      return {
        success: true,
        data: {
          resultado: "aceptada",
          numero: numeroEtiqueta,
          movimientos: lineasLedger.length,
        },
      };
    }

    const versionSiguiente = t.version + 1;
    const numeroSiguiente = fmtNumeroTransferenciaInterna(t.numero, versionSiguiente);
    const comentarioRectificacion = input.comentario ?? null;

    await prisma.$transaction([
      prisma.stockTransferencia.update({
        where: { id, estado: t.estado },
        data: dataCierre,
        select: { id: true },
      }),
      prisma.stockTransferencia.create({
        data: {
          numero: t.numero,
          version: versionSiguiente,
          estado: "RECTIFICADO_PENDIENTE",
          sucursalOrigenId: t.sucursalOrigen.id,
          sucursalDestinoId: t.sucursalDestino.id,
          sucursalConfirmaId: proximaConfirma.id,
          creadaPorId: input.personalId,
          comentario: comentarioRectificacion,
          items: {
            createMany: {
              data: rectificados.map((r) => ({
                codItem: r.codItem,
                cantidad: r.conf,
              })),
            },
          },
          notificaciones: {
            create: {
              tipo: "TRANSF_PENDIENTE",
              sucursalId: proximaConfirma.id,
              titulo: `Rectificación N° ${numeroSiguiente}`,
              mensaje: `${usuario.nombrePersonal} (${t.sucursalConfirma.nombre}) rectificó la transferencia interna N° ${numeroEtiqueta}. Quedó la versión N° ${numeroSiguiente} con ${textoItems(rectificados.length)}.${comentarioRectificacion ? ` Comentario: ${comentarioRectificacion}` : ""}`,
            },
          },
        },
        select: { id: true },
      }),
    ]);

    return {
      success: true,
      data: {
        resultado: "rectificada",
        numero: numeroEtiqueta,
        numeroSiguiente,
        confirmaNombre: proximaConfirma.nombre,
        movimientos: lineasLedger.length,
      },
    };
  } catch (e) {
    if (esNoEncontrado(e)) return { success: false, error: ERROR_YA_RESUELTA };
    console.error("[aceptarStockTransferencia]", e);
    return { success: false, error: "No se pudo aceptar la transferencia." };
  }
}

/** Quien emitió esta versión la elimina mientras está abierta: sin ledger extra. */
export async function cancelarStockTransferencia(
  id: string,
  input: ResolverStockTransferenciaInput
): Promise<ServiceResult<void>> {
  try {
    const t = await cargarTransferencia(id);
    if (!t) return { success: false, error: "Transferencia no encontrada." };
    if (!estaAbierta(t.estado)) return { success: false, error: ERROR_YA_RESUELTA };

    const creadora = sucursalCreadora(t);
    const codigoUsuario = await sucursalDeUsuario(input.personalId);
    if (codigoUsuario !== creadora.codigo) {
      return {
        success: false,
        error: `Solo un usuario de ${creadora.nombre} puede eliminarla.`,
      };
    }
    const usuario = await prisma.globalPersonal.findUnique({
      where: { idPersonal: input.personalId },
      select: { nombrePersonal: true },
    });
    const ahora = new Date();
    const numeroEtiqueta = fmtNumeroTransferenciaInterna(t.numero, t.version);
    const motivo = input.motivo ? ` Motivo: ${input.motivo}` : "";

    await prisma.stockTransferencia.update({
      where: { id, estado: t.estado },
      data: {
        estado: "CANCELADA",
        motivo: input.motivo ?? null,
        resueltaPorId: input.personalId,
        resueltaAt: ahora,
        notificaciones: {
          updateMany: {
            where: { leidaAt: null },
            data: { leidaAt: ahora, leidaPorId: input.personalId },
          },
          create: {
            tipo: "TRANSF_CANCELADA",
            sucursalId: t.sucursalConfirma.id,
            titulo: `Transferencia N° ${numeroEtiqueta} eliminada`,
            mensaje: `${usuario?.nombrePersonal ?? "Un usuario"} (${creadora.nombre}) eliminó la transferencia interna N° ${numeroEtiqueta}. Esta versión no mueve stock.${motivo}`,
          },
        },
      },
      select: { id: true },
    });
    return { success: true, data: undefined };
  } catch (e) {
    if (esNoEncontrado(e)) return { success: false, error: ERROR_YA_RESUELTA };
    console.error("[cancelarStockTransferencia]", e);
    return { success: false, error: "No se pudo eliminar la transferencia." };
  }
}

export type StockTransferenciaHistorialFila = {
  id: string;
  numeroEtiqueta: string;
  estado: StockTransferenciaEstado;
  estadoEtiqueta: string;
  origenCodigo: string;
  origenNombre: string;
  destinoCodigo: string;
  destinoNombre: string;
  confirmaCodigo: string;
  creadoraCodigo: string;
  createdAtIso: string;
};

/**
 * Historial de transferencias donde la sucursal es origen o destino.
 */
export async function listarStockTransferenciasPorSucursal(
  sucursalCodigo: string
): Promise<ServiceResult<StockTransferenciaHistorialFila[]>> {
  try {
    const sucursal = await prisma.sucursal.findUnique({
      where: { codigo: sucursalCodigo },
      select: { id: true },
    });
    if (!sucursal) return { success: true, data: [] };

    const rows = await prisma.stockTransferencia.findMany({
      where: {
        OR: [{ sucursalOrigenId: sucursal.id }, { sucursalDestinoId: sucursal.id }],
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        numero: true,
        version: true,
        estado: true,
        createdAt: true,
        sucursalOrigen: { select: { codigo: true, nombre: true } },
        sucursalDestino: { select: { codigo: true, nombre: true } },
        sucursalConfirma: { select: { codigo: true } },
        creadaPor: { select: { sucursalPorDefecto: true } },
      },
    });

    return {
      success: true,
      data: rows.map((t) => {
        const creadoraCodigo =
          t.creadaPor.sucursalPorDefecto === t.sucursalOrigen.codigo ||
          t.creadaPor.sucursalPorDefecto === t.sucursalDestino.codigo
            ? t.creadaPor.sucursalPorDefecto
            : t.sucursalConfirma.codigo === t.sucursalOrigen.codigo
              ? t.sucursalDestino.codigo
              : t.sucursalOrigen.codigo;
        return {
          id: t.id,
          numeroEtiqueta: fmtNumeroTransferenciaInterna(t.numero, t.version),
          estado: t.estado,
          estadoEtiqueta: etiquetaEstadoTransferencia(t.estado, t.version),
          origenCodigo: t.sucursalOrigen.codigo,
          origenNombre: t.sucursalOrigen.nombre,
          destinoCodigo: t.sucursalDestino.codigo,
          destinoNombre: t.sucursalDestino.nombre,
          confirmaCodigo: t.sucursalConfirma.codigo,
          creadoraCodigo,
          createdAtIso: t.createdAt.toISOString(),
        };
      }),
    };
  } catch (e) {
    console.error("[listarStockTransferenciasPorSucursal]", e);
    return { success: false, error: "No se pudieron cargar las transferencias." };
  }
}

/**
 * El emisor de una versión abierta puede reemplazar los ítems (mismas puntas).
 */
export async function actualizarStockTransferencia(
  id: string,
  input: CrearStockTransferenciaInput
): Promise<ServiceResult<{ id: string; numero: string }>> {
  try {
    const t = await cargarTransferencia(id);
    if (!t) return { success: false, error: "Transferencia no encontrada." };
    if (!estaAbierta(t.estado)) return { success: false, error: ERROR_YA_RESUELTA };

    const codigoUsuario = await sucursalDeUsuario(input.personalId);
    const creadora = sucursalCreadora(t);
    if (codigoUsuario !== creadora.codigo) {
      return {
        success: false,
        error: `Solo un usuario de ${creadora.nombre} puede editarla.`,
      };
    }
    if (
      input.origenCodigo !== t.sucursalOrigen.codigo ||
      input.destinoCodigo !== t.sucursalDestino.codigo
    ) {
      return { success: false, error: "No se puede cambiar origen o destino." };
    }

    const codigos = input.items.map((i) => i.codItem.trim());
    const existentes = await prisma.prodTienda.count({
      where: { codTienda: { in: codigos } },
    });
    if (existentes !== codigos.length) {
      return { success: false, error: "Hay ítems que no existen en el catálogo." };
    }

    await prisma.stockTransferencia.update({
      where: { id, estado: t.estado },
      data: {
        items: {
          deleteMany: {},
          createMany: {
            data: input.items.map((i) => ({
              codItem: i.codItem.trim(),
              cantidad: redondearCantidadUnDecimal(i.cantidad),
            })),
          },
        },
      },
      select: { id: true },
    });
    return {
      success: true,
      data: { id, numero: fmtNumeroTransferenciaInterna(t.numero, t.version) },
    };
  } catch (e) {
    if (esNoEncontrado(e)) return { success: false, error: ERROR_YA_RESUELTA };
    console.error("[actualizarStockTransferencia]", e);
    return { success: false, error: "No se pudo editar la transferencia." };
  }
}
