"use server";

import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { getPxCompetenciaPageParamsSchema } from "@/lib/validations/pxCompetencia";
import { getPxCompetenciaPageDataFromDb } from "@/services/pxCompetenciaPage.service";

/** Listado paginado **Px Competencia** (comparación precios vs competidores). */
export async function getPxCompetenciaPageData(params: unknown) {
  const rol = await getRol();
  const vacio = await getPxCompetenciaPageDataFromDb({});
  if (!puede(rol, PERMISOS.cxPxTienda.acceso)) {
    return { ...vacio, items: [], total: 0, totalPaginas: 1 };
  }
  const parsed = getPxCompetenciaPageParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { ...vacio, items: [], total: 0, totalPaginas: 1 };
  }
  return getPxCompetenciaPageDataFromDb(parsed.data);
}
