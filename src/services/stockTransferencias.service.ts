import { Prisma, type StockTransferenciaEstado } from "@prisma/client";
import { cantidadDesdePrisma, fmtCantidad, redondearCantidadUnDecimal } from "@/lib/cantidadUnDecimal";
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
  /** Sucursal que debe aceptar / rechazar. */
  confirmaCodigo: string;
  /** Sucursal del usuario creador (puede cancelar mientras está pendiente). */
  creadoraCodigo: string;
  creadaPorNombre: string;
  resueltaPorNombre: string | null;
  motivo: string | null;
  createdAtIso: string;
  resueltaAtIso: string | null;
  comprobanteId: string | null;
  items: StockTransferenciaItemDto[];
};

const ERROR_YA_RESUELTA = "La transferencia ya no está pendiente.";

type SucursalRef = { id: string; codigo: string; nombre: string };

const transferenciaInclude = {
  sucursalOrigen: { select: { id: true, codigo: true, nombre: true } },
  sucursalDestino: { select: { id: true, codigo: true, nombre: true } },
  sucursalConfirma: { select: { id: true, codigo: true, nombre: true } },
  creadaPor: { select: { nombrePersonal: true } },
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
  return t.sucursalConfirma.id === t.sucursalOrigen.id
    ? t.sucursalDestino
    : t.sucursalOrigen;
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
 * Crea una transferencia **PENDIENTE** (sin ledger). El creador debe ser de una punta;
 * la otra punta recibe la notificación `TRANSF_PENDIENTE`.
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
            titulo: "Transferencia pendiente",
            mensaje: `${usuario.nombrePersonal} (${creadora.nombre}) generó una transferencia ${origen.nombre} → ${destino.nombre} de ${textoItems(input.items.length)}. Revisala y aceptala para registrar el stock.`,
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
 * La punta `sucursal_confirma` acepta: un solo write anidado (comprobante +
 * EGRESO origen / INGRESO destino + cantidades confirmadas + notificaciones).
 * `where estado = PENDIENTE` evita doble aceptación.
 */
export async function aceptarStockTransferencia(
  id: string,
  input: AceptarStockTransferenciaInput
): Promise<ServiceResult<{ comprobanteId: string; movimientos: number }>> {
  try {
    const t = await cargarTransferencia(id);
    if (!t) return { success: false, error: "Transferencia no encontrada." };
    if (t.estado !== "PENDIENTE") return { success: false, error: ERROR_YA_RESUELTA };

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

    const confirmadas = new Map(input.items.map((i) => [i.itemId, i.cantidadConfirmada]));
    for (const itemId of confirmadas.keys()) {
      if (!t.items.some((i) => i.id === itemId)) {
        return { success: false, error: "Ítem de transferencia inválido." };
      }
    }
    const resueltos = t.items.map((i) => {
      const enviada = cantidadDesdePrisma(i.cantidad);
      const conf = redondearCantidadUnDecimal(confirmadas.get(i.id) ?? enviada);
      return { id: i.id, codItem: i.codItem, enviada, conf };
    });
    const excedido = resueltos.find((r) => r.conf > r.enviada);
    if (excedido) {
      return {
        success: false,
        error: `La cantidad confirmada de ${excedido.codItem} supera la enviada (${fmtCantidad(excedido.enviada)}).`,
      };
    }
    const conMovimiento = resueltos.filter((r) => r.conf > 0);
    if (conMovimiento.length === 0) {
      return {
        success: false,
        error: "Todas las cantidades están en 0: rechazá la transferencia.",
      };
    }

    const creadora = sucursalCreadora(t);
    const ajustada = resueltos.some((r) => r.conf !== r.enviada);
    const ahora = new Date();

    const actualizada = await prisma.stockTransferencia.update({
      where: { id, estado: "PENDIENTE" },
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
            movimientos: {
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
            },
          },
        },
        items: {
          update: resueltos.map((r) => ({
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
            sucursalId: creadora.id,
            titulo: "Transferencia aceptada",
            mensaje: `${usuario.nombrePersonal} (${t.sucursalConfirma.nombre}) aceptó la transferencia ${t.sucursalOrigen.nombre} → ${t.sucursalDestino.nombre}${ajustada ? " con cantidades ajustadas" : ""}. El stock quedó registrado.`,
          },
        },
      },
      select: { comprobanteId: true },
    });

    return {
      success: true,
      data: {
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
    if (t.estado !== "PENDIENTE") return { success: false, error: ERROR_YA_RESUELTA };

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
      where: { id, estado: "PENDIENTE" },
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

/** La punta que confirma rechaza: sin ledger; avisa a la creadora. */
export function rechazarStockTransferencia(
  id: string,
  input: ResolverStockTransferenciaInput
): Promise<ServiceResult<void>> {
  return cerrarSinMovimiento(id, input, "RECHAZADA");
}

/** La punta creadora cancela mientras está pendiente: sin ledger; avisa a la otra. */
export function cancelarStockTransferencia(
  id: string,
  input: ResolverStockTransferenciaInput
): Promise<ServiceResult<void>> {
  return cerrarSinMovimiento(id, input, "CANCELADA");
}
