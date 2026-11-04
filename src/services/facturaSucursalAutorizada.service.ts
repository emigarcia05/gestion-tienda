import { prisma } from "@/lib/prisma";
import { getIdPersonalSesion } from "@/lib/sesion";
import type { ServiceResult } from "@/types/service.types";

/** El usuario ingresado solo puede cambiar ventas de `usuarios.sucursal_por_defecto`. */
export const MENSAJE_SUCURSAL_VENTA_NO_AUTORIZADA =
  "No estás autorizado para modificar ventas de esta sucursal.";

/** Código de sucursal del usuario de la sesión, o null si no hay ingreso o no tiene sucursal. */
export async function sucursalCodigoSesion(): Promise<string | null> {
  const idPersonal = await getIdPersonalSesion();
  if (idPersonal == null) return null;
  const row = await prisma.globalPersonal.findUnique({
    where: { idPersonal },
    select: { sucursalPorDefecto: true },
  });
  const codigo = row?.sucursalPorDefecto?.trim().toLowerCase() ?? "";
  return codigo || null;
}

/**
 * El comprobante se emite con la sucursal del `personalId`.
 * Tiene que ser el usuario ingresado: así no se crea una venta en otra sucursal.
 */
export async function exigirPersonalDeSesion(
  personalId: number
): Promise<ServiceResult<void>> {
  const idSesion = await getIdPersonalSesion();
  if (idSesion == null || idSesion !== personalId) {
    return { success: false, error: MENSAJE_SUCURSAL_VENTA_NO_AUTORIZADA };
  }
  const sucursal = await sucursalCodigoSesion();
  if (!sucursal) {
    return { success: false, error: MENSAJE_SUCURSAL_VENTA_NO_AUTORIZADA };
  }
  return { success: true, data: undefined };
}

/**
 * La sucursal del comprobante es la del punto de venta (`ptos_vtas` → sucursales).
 * Ver el listado de otra sucursal está permitido; modificarlo, no.
 */
export async function exigirComprobanteDeSucursalSesion(
  comprobanteId: string
): Promise<ServiceResult<void>> {
  const sucursal = await sucursalCodigoSesion();
  if (!sucursal) {
    return { success: false, error: MENSAJE_SUCURSAL_VENTA_NO_AUTORIZADA };
  }
  const row = await prisma.comprobanteVta.findUnique({
    where: { id: comprobanteId },
    select: {
      ptoVta: {
        select: {
          sucursales: { select: { sucursal: { select: { codigo: true } } } },
        },
      },
    },
  });
  if (!row) return { success: false, error: "El comprobante no existe." };
  const propia = row.ptoVta.sucursales.some(
    (link) => link.sucursal.codigo.trim().toLowerCase() === sucursal
  );
  if (!propia) {
    return { success: false, error: MENSAJE_SUCURSAL_VENTA_NO_AUTORIZADA };
  }
  return { success: true, data: undefined };
}
