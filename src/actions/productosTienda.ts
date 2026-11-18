"use server";

import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import type { ActionResult } from "@/lib/types";
import { z } from "zod";
import { prismaCuidSchema } from "@/lib/validations/common";
import * as productosTiendaService from "@/services/productosTienda.service";

const buscarProductosTiendaPorDescripcionSchema = z.object({
  q: z.string().max(200).optional().default(""),
  take: z.coerce.number().int().min(1).max(500).optional().default(100),
  proveedorId: prismaCuidSchema.optional(),
});

export async function buscarProductosTiendaPorDescripcionAction(
  params: unknown
): Promise<
  ActionResult<{
    items: productosTiendaService.ProductoTiendaRowBusqueda[];
    total: number;
  }>
> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) {
    return { ok: false, error: "Sin permisos para pedidos." };
  }

  const parsed = buscarProductosTiendaPorDescripcionSchema.safeParse(params);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const res = await productosTiendaService.buscarProductosTiendaPorDescripcion({
    q: parsed.data.q,
    take: parsed.data.take,
    proveedorId: parsed.data.proveedorId,
  });
  if (!res.success) return { ok: false, error: res.error };

  return { ok: true, data: res.data };
}

