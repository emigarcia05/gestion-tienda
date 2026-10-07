"use server";

import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import type { ActionResult } from "@/lib/types";
import { z } from "zod";
import {
  buscarBasesTintometricas,
  getCatalogoAgregarTintometrico,
  getProveedoresTintometricos,
  type BaseTintometricaCatalogo,
  type MarcaTintometricaCatalogo,
  type ProveedorTintometrico,
} from "@/services/tintometrico.service";

export async function getCatalogoAgregarTintometricoAction(): Promise<
  ActionResult<{
    proveedores: ProveedorTintometrico[];
    marcas: MarcaTintometricaCatalogo[];
    bases: BaseTintometricaCatalogo[];
  }>
> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) {
    return { ok: false, error: "Sin permisos para pedidos." };
  }
  try {
    const [proveedores, catalogo] = await Promise.all([
      getProveedoresTintometricos(),
      getCatalogoAgregarTintometrico(),
    ]);
    return { ok: true, data: { proveedores, ...catalogo } };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al cargar el catálogo tintométrico.";
    return { ok: false, error: message };
  }
}

const buscarBasesSchema = z.object({
  q: z.string().max(200).optional().default(""),
});

export async function buscarBasesTintometricasAction(
  raw: unknown
): Promise<ActionResult<{ items: Awaited<ReturnType<typeof buscarBasesTintometricas>>["items"]; total: number }>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) {
    return { ok: false, error: "Sin permisos para pedidos." };
  }

  const parsed = buscarBasesSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Parámetros inválidos." };
  }

  try {
    const { items, total } = await buscarBasesTintometricas(parsed.data.q, 100);
    return { ok: true, data: { items, total } };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al buscar bases.";
    return { ok: false, error: message };
  }
}

