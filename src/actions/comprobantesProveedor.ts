"use server";

import { esEditor, getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import type { ActionResult } from "@/lib/types";
import {
  sincronizarComprobantesProveedorDesdeDux,
  type SyncComprobantesProveedorDuxResult,
} from "@/services/comprobantesProveedorDuxSync.service";

/**
 * Descarga compras desde DUX por cada `sucursales.id_dux` y hace upsert en `fin_compras_comprobante`.
 * Solo editor (misma sensibilidad que otras integraciones DUX de escritura).
 */
export async function sincronizarComprobantesProveedorDesdeDuxAction(): Promise<
  ActionResult<SyncComprobantesProveedorDuxResult>
> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    return { ok: false, error: "Sin permisos para finanzas." };
  }
  if (!(await esEditor())) return { ok: false, error: "Sin permisos de editor." };

  const result = await sincronizarComprobantesProveedorDesdeDux();
  if (!result.success) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}
