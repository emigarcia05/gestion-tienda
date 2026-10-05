import type { NotificacionTipo } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types";

export type NotificacionDto = {
  id: string;
  tipo: NotificacionTipo;
  /** Módulo de la app al que pertenece el aviso (columna MÓDULO). */
  moduloEtiqueta: string;
  titulo: string;
  mensaje: string;
  createdAtIso: string;
  leida: boolean;
  transferenciaId: string | null;
  /** Requiere acción (aceptar / rechazar) de esta sucursal. */
  accionable: boolean;
};

function moduloEtiquetaDesdeTipo(tipo: NotificacionTipo): string {
  switch (tipo) {
    case "TRANSF_PENDIENTE":
    case "TRANSF_ACEPTADA":
    case "TRANSF_RECHAZADA":
    case "TRANSF_CANCELADA":
      return "TRANS. DEPÓSITOS";
  }
}

export type NotificacionesSucursal = {
  noLeidas: number;
  items: NotificacionDto[];
};

const LISTADO_MAX = 50;

/** Notificaciones de la sucursal: no leídas primero, luego las más recientes. */
export async function listarNotificacionesSucursal(
  sucursalCodigo: string
): Promise<ServiceResult<NotificacionesSucursal>> {
  try {
    const sucursal = await prisma.sucursal.findUnique({
      where: { codigo: sucursalCodigo },
      select: { id: true },
    });
    if (!sucursal) return { success: true, data: { noLeidas: 0, items: [] } };

    const [noLeidas, rows] = await Promise.all([
      prisma.notificacion.count({
        where: { sucursalId: sucursal.id, leidaAt: null },
      }),
      prisma.notificacion.findMany({
        where: { sucursalId: sucursal.id },
        orderBy: [{ leidaAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
        take: LISTADO_MAX,
        select: {
          id: true,
          tipo: true,
          titulo: true,
          mensaje: true,
          createdAt: true,
          leidaAt: true,
          transferenciaId: true,
          transferencia: { select: { estado: true } },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        noLeidas,
        items: rows.map((n) => ({
          id: n.id,
          tipo: n.tipo,
          moduloEtiqueta: moduloEtiquetaDesdeTipo(n.tipo),
          titulo: n.titulo,
          mensaje: n.mensaje,
          createdAtIso: n.createdAt.toISOString(),
          leida: n.leidaAt !== null,
          transferenciaId: n.transferenciaId,
          accionable:
            n.tipo === "TRANSF_PENDIENTE" &&
            (n.transferencia?.estado === "EMITIDO_PENDIENTE" ||
              n.transferencia?.estado === "RECTIFICADO_PENDIENTE"),
        })),
      },
    };
  } catch (e) {
    console.error("[listarNotificacionesSucursal]", e);
    return { success: false, error: "No se pudieron cargar las notificaciones." };
  }
}

/**
 * Marca leída una notificación informativa de la sucursal del usuario.
 * Las `TRANSF_PENDIENTE` se cierran solas al resolver la transferencia.
 */
export async function marcarNotificacionLeida(
  id: string,
  personalId: number
): Promise<ServiceResult<void>> {
  try {
    const usuario = await prisma.globalPersonal.findUnique({
      where: { idPersonal: personalId },
      select: { sucursalDefault: { select: { id: true } } },
    });
    const sucursalId = usuario?.sucursalDefault?.id;
    if (!sucursalId) {
      return { success: false, error: "El usuario no tiene sucursal asignada." };
    }
    await prisma.notificacion.updateMany({
      where: {
        id,
        sucursalId,
        leidaAt: null,
        tipo: { not: "TRANSF_PENDIENTE" },
      },
      data: { leidaAt: new Date(), leidaPorId: personalId },
    });
    return { success: true, data: undefined };
  } catch (e) {
    console.error("[marcarNotificacionLeida]", e);
    return { success: false, error: "No se pudo marcar la notificación." };
  }
}
