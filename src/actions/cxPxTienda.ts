"use server";

import { GP_ROUTES } from "@/lib/gestionProductosRoutes";

import { revalidatePath } from "next/cache";
import { esEditor, getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import type { ActionResult } from "@/lib/types";
import { listaPreciosCodTiendaSchema } from "@/lib/validations/common";
import { z } from "zod";
import { CX_PROD_SELECCION_PROM } from "@/lib/cxPxTienda";
import {
  establecerCodExtCostoLista,
  limpiarCodExtCostoLista,
} from "@/services/costoListaTienda.service";
import { listarFilasExportCostoCxDiff } from "@/services/exportCostoCxDiff.service";
import type { FilaExportCostoCx } from "@/services/exportCostoCxDiff.service";

const guardarCostoCxProdSchema = z.object({
  codTienda: listaPreciosCodTiendaSchema,
  seleccion: z.union([z.literal(CX_PROD_SELECCION_PROM), z.string().min(1).max(128)]),
});

/** Persiste costo CX PROD.: proveedor → `costo_compra_cod_ext`; Cx. Prom. → limpia FK. */
export async function guardarCostoCxProdTiendaAction(
  raw: unknown
): Promise<ActionResult> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.cxPxTienda.acceso)) {
    return { ok: false, error: "Sin acceso." };
  }
  if (!(await esEditor())) {
    return { ok: false, error: "Sin permisos de editor." };
  }

  const parsed = guardarCostoCxProdSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos." };
  }

  const { codTienda, seleccion } = parsed.data;

  if (seleccion === CX_PROD_SELECCION_PROM) {
    const res = await limpiarCodExtCostoLista(codTienda);
    if (!res.success) return { ok: false, error: res.error };
  } else {
    const res = await establecerCodExtCostoLista(codTienda, seleccion);
    if (!res.success) return { ok: false, error: res.error };
  }

  revalidatePath(GP_ROUTES.analisisPrecios.cxYPxTienda.cxCompra);
  revalidatePath(GP_ROUTES.analisisPrecios.listaPropia.listaProductos);
  revalidatePath("/administrador/productos/cx-compra");
  return { ok: true, data: undefined };
}

/** Excel CODIGO + COSTO: diff `costo_compra` (DUX) vs `px_compra_final_sin_iva` vía `costo_compra_cod_ext`. */
export async function exportarCostoCxDiffAction(): Promise<
  ActionResult<{ filas: FilaExportCostoCx[] }>
> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.cxPxTienda.acceso)) {
    return { ok: false, error: "Sin acceso." };
  }
  if (!(await esEditor())) {
    return { ok: false, error: "Sin permisos de editor." };
  }
  try {
    const filas = await listarFilasExportCostoCxDiff();
    return { ok: true, data: { filas } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo generar la exportación.",
    };
  }
}
