import { Prisma, type StockTransferenciaEstado } from "@prisma/client";
import { cantidadDesdePrisma, redondearCantidadUnDecimal } from "@/lib/cantidadUnDecimal";
import { prisma } from "@/lib/prisma";
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
  estado: StockTransferenciaEstado;
  origenCodigo: string;
  origenNombre: string;
  destinoCodigo: string;
  destinoNombre: string;
  /** Sucursal que debe aceptar ahora. */
  confirmaCodigo: string;
  /** Sucursal de quien emitió (puede cancelar mientras está abierta). */
  creadoraCodigo: string;
  creadaPorNombre: string;
  resueltaPorNombre: string | null;
  motivo: string | null;
  createdAtIso: string;
  resueltaAtIso: string | null;
  comprobanteId: string | null;
  items: StockTransferenciaItemDto[];
};

const ERROR_YA_RESUELTA = "La transferencia ya no está pendiente de aceptación.";

export type AceptarStockTransferenciaResult =
  | { resultado: "aceptada"; comprobanteId: string; movimientos: number }
  | { resultado: "rectificada"; confirmaNombre: string };

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

/**
 * Crea una transferencia **EMITIDO_PENDIENTE** (sin ledger). El creador debe ser
 * de una punta; la otra recibe `TRANSF_PENDIENTE`.
 */
export async function crearStockTransferencia(
  input: CrearStockTransferenciaInput
): Promise<ServiceResult<{ id: string; confirmaNombre: string }>> {
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

    const creada = await prisma.stockTransferencia.create({
      data: {
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
            titulo: "Transferencia emitida",
            mensaje: `${usuario.nombrePersonal} (${creadora.nombre}) emitió una transferencia ${origen.nombre} → ${destino.nombre} de ${textoItems(input.items.length)}. Revisala y aceptala. El stock se registra cuando ambos acepten.`,
          },
        },
      },
      select: { id: true },
    });
    return { success: true, data: { id: creada.id, confirmaNombre: confirma.nombre } };
  } catch (e) {
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
 * Si las cantidades coinciden con lo propuesto → **ACEPTADA** + ledger.
 * Si hay cambios (editar, 0 o ítems nuevos) → **RECTIFICADO_PENDIENTE**
 * y avisa a la otra punta. Sin ledger hasta **ACEPTADA**.
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
    const existentes: Array<{
      id: string;
      codItem: string;
      propuesta: number;
      conf: number;
    }> = [];
    const nuevos: Array<{ codItem: string; conf: number }> = [];

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
        existentes.push({
          id: existente.id,
          codItem: existente.codItem,
          propuesta,
          conf,
        });
      } else {
        nuevos.push({ codItem: row.codItem.trim(), conf });
      }
    }

    if (usados.size !== t.items.length) {
      return {
        success: false,
        error: "Faltan ítems de la transferencia emitida.",
      };
    }

    if (nuevos.length > 0) {
      const existentesCat = await prisma.prodTienda.count({
        where: { codTienda: { in: nuevos.map((n) => n.codItem) } },
      });
      if (existentesCat !== nuevos.length) {
        return { success: false, error: "Hay ítems agregados que no existen en el catálogo." };
      }
    }

    const hayCambio =
      nuevos.length > 0 || existentes.some((r) => r.conf !== r.propuesta);
    const ahora = new Date();

    if (hayCambio) {
      const proximaConfirma = sucursalOpuesta(t, t.sucursalConfirma.id);
      await prisma.stockTransferencia.update({
        where: { id, estado: t.estado },
        data: {
          estado: "RECTIFICADO_PENDIENTE",
          sucursalConfirmaId: proximaConfirma.id,
          items: {
            update: existentes.map((r) => ({
              where: { id: r.id },
              data: { cantidadConfirmada: r.conf },
            })),
            createMany:
              nuevos.length > 0
                ? {
                    data: nuevos.map((n) => ({
                      codItem: n.codItem,
                      cantidad: 0,
                      cantidadConfirmada: n.conf,
                    })),
                  }
                : undefined,
          },
          notificaciones: {
            updateMany: {
              where: { leidaAt: null },
              data: { leidaAt: ahora, leidaPorId: input.personalId },
            },
            create: {
              tipo: "TRANSF_PENDIENTE",
              sucursalId: proximaConfirma.id,
              titulo: "Transferencia rectificada",
              mensaje: `${usuario.nombrePersonal} (${t.sucursalConfirma.nombre}) rectificó la transferencia ${t.sucursalOrigen.nombre} → ${t.sucursalDestino.nombre}. Revisá las cantidades y aceptala. El stock se registra cuando ambos acepten.`,
            },
          },
        },
        select: { id: true },
      });
      return {
        success: true,
        data: { resultado: "rectificada", confirmaNombre: proximaConfirma.nombre },
      };
    }

    const conMovimiento = [
      ...existentes.filter((r) => r.conf > 0),
      ...nuevos.filter((n) => n.conf > 0),
    ];

    const actualizada = await prisma.stockTransferencia.update({
      where: { id, estado: t.estado },
      data: {
        estado: "ACEPTADA",
        resueltaPor: { connect: { idPersonal: input.personalId } },
        resueltaAt: ahora,
        comprobante: {
          create: {
            tipo: "TRANSFERENCIA_ENTRE_DEPOSITOS",
            sucursal: { connect: { id: t.sucursalOrigen.id } },
            sucursalDestino: { connect: { id: t.sucursalDestino.id } },
            personal: { connect: { idPersonal: t.creadaPorId } },
            movimientos:
              conMovimiento.length > 0
                ? {
                    createMany: {
                      data: conMovimiento.flatMap((r) => [
                        {
                          tipoMovimiento: "EGRESO" as const,
                          categoriaMovimiento: "TRANSF_INTERNA" as const,
                          codItem: r.codItem,
                          sucursalId: t.sucursalOrigen.id,
                          cantidad: r.conf,
                          usuarioId: input.personalId,
                        },
                        {
                          tipoMovimiento: "INGRESO" as const,
                          categoriaMovimiento: "TRANSF_INTERNA" as const,
                          codItem: r.codItem,
                          sucursalId: t.sucursalDestino.id,
                          cantidad: r.conf,
                          usuarioId: input.personalId,
                        },
                      ]),
                    },
                  }
                : undefined,
          },
        },
        items: {
          update: existentes.map((r) => ({
            where: { id: r.id },
            data: { cantidadConfirmada: r.conf },
          })),
        },
        notificaciones: {
          updateMany: {
            where: { leidaAt: null },
            data: { leidaAt: ahora, leidaPorId: input.personalId },
          },
          create: {
            tipo: "TRANSF_ACEPTADA",
            sucursalId: sucursalOpuesta(t, t.sucursalConfirma.id).id,
            titulo: "Transferencia aceptada",
            mensaje: `${usuario.nombrePersonal} (${t.sucursalConfirma.nombre}) aceptó la transferencia ${t.sucursalOrigen.nombre} → ${t.sucursalDestino.nombre}. El stock quedó registrado.`,
          },
        },
      },
      select: { comprobanteId: true },
    });

    return {
      success: true,
      data: {
        resultado: "aceptada",
        comprobanteId: actualizada.comprobanteId ?? "",
        movimientos: conMovimiento.length * 2,
      },
    };
  } catch (e) {
    if (esNoEncontrado(e)) return { success: false, error: ERROR_YA_RESUELTA };
    console.error("[aceptarStockTransferencia]", e);
    return { success: false, error: "No se pudo aceptar la transferencia." };
  }
}

async function cerrarSinMovimiento(
  id: string,
  input: ResolverStockTransferenciaInput,
  accion: "RECHAZADA" | "CANCELADA"
): Promise<ServiceResult<void>> {
  try {
    const t = await cargarTransferencia(id);
    if (!t) return { success: false, error: "Transferencia no encontrada." };
    if (!estaAbierta(t.estado)) return { success: false, error: ERROR_YA_RESUELTA };

    const creadora = sucursalCreadora(t);
    const autorizada = accion === "RECHAZADA" ? t.sucursalConfirma : creadora;
    const avisada = accion === "RECHAZADA" ? creadora : t.sucursalConfirma;
    const codigoUsuario = await sucursalDeUsuario(input.personalId);
    if (codigoUsuario !== autorizada.codigo) {
      return {
        success: false,
        error:
          accion === "RECHAZADA"
            ? `Solo un usuario de ${autorizada.nombre} puede rechazarla.`
            : `Solo un usuario de ${autorizada.nombre} puede cancelarla.`,
      };
    }
    const usuario = await prisma.globalPersonal.findUnique({
      where: { idPersonal: input.personalId },
      select: { nombrePersonal: true },
    });
    const ahora = new Date();
    const verbo = accion === "RECHAZADA" ? "rechazó" : "canceló";
    const motivo = input.motivo ? ` Motivo: ${input.motivo}` : "";

    await prisma.stockTransferencia.update({
      where: { id, estado: t.estado },
      data: {
        estado: accion,
        motivo: input.motivo ?? null,
        resueltaPorId: input.personalId,
        resueltaAt: ahora,
        notificaciones: {
          updateMany: {
            where: { leidaAt: null },
            data: { leidaAt: ahora, leidaPorId: input.personalId },
          },
          create: {
            tipo: accion === "RECHAZADA" ? "TRANSF_RECHAZADA" : "TRANSF_CANCELADA",
            sucursalId: avisada.id,
            titulo: accion === "RECHAZADA" ? "Transferencia rechazada" : "Transferencia cancelada",
            mensaje: `${usuario?.nombrePersonal ?? "Un usuario"} (${autorizada.nombre}) ${verbo} la transferencia ${t.sucursalOrigen.nombre} → ${t.sucursalDestino.nombre}. No se movió stock.${motivo}`,
          },
        },
      },
      select: { id: true },
    });
    return { success: true, data: undefined };
  } catch (e) {
    if (esNoEncontrado(e)) return { success: false, error: ERROR_YA_RESUELTA };
    console.error(`[cerrarSinMovimiento:${accion}]`, e);
    return { success: false, error: "No se pudo actualizar la transferencia." };
  }
}

/** La punta que confirma rechaza: sin ledger. */
export function rechazarStockTransferencia(
  id: string,
  input: ResolverStockTransferenciaInput
): Promise<ServiceResult<void>> {
  return cerrarSinMovimiento(id, input, "RECHAZADA");
}

/** Quien emitió cancela mientras está abierta: sin ledger. */
export function cancelarStockTransferencia(
  id: string,
  input: ResolverStockTransferenciaInput
): Promise<ServiceResult<void>> {
  return cerrarSinMovimiento(id, input, "CANCELADA");
}
