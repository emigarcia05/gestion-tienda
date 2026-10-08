import { prisma } from "@/lib/prisma";
import type { EstCategorizacionItem } from "@/lib/estCategorizacionTypes";
import { matchColoresEnDescripcion } from "@/lib/estPorProdColores";
import {
  etiquetaPresentacionMedida,
  matchPresentacionEnDescripcion,
} from "@/lib/estPorProdPresentacion";
import { matchTerminacionesEnDescripcion } from "@/lib/estPorProdTerminacion";
import { listarEstPorProdColores } from "@/services/estPorProdColores.service";
import {
  nombresCatalogoProdPropio,
  SELECT_NOMBRES_CATALOGO_PROD_PROPIO,
} from "@/services/prodPropiosCatalogos.service";
import { listarEstPorProdPresentaciones } from "@/services/estPorProdPresentacion.service";
import { listarEstPorProdTerminaciones } from "@/services/estPorProdTerminacion.service";

function upperOrEmpty(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleUpperCase("es-AR");
}

/** Listado de `prod_lista` con color, terminación y presentación derivados de la descripción. */
export async function listarProdTiendaCategorizacion(): Promise<EstCategorizacionItem[]> {
  try {
    const [rows, colores, presentaciones, terminaciones] = await Promise.all([
      prisma.prodPropio.findMany({
        select: {
          codTienda: true,
          descripcionTienda: true,
          ...SELECT_NOMBRES_CATALOGO_PROD_PROPIO,
        },
        orderBy: [{ descripcionTienda: "asc" }, { codTienda: "asc" }],
      }),
      listarEstPorProdColores(),
      listarEstPorProdPresentaciones(),
      listarEstPorProdTerminaciones(),
    ]);

    return rows.map((r) => {
      const descripcionTienda = (r.descripcionTienda ?? "").trim();
      const matchedColores = matchColoresEnDescripcion(descripcionTienda, colores);
      const coloresNombres = matchedColores.map((c) => c.nombre);
      const matchedTerm = matchTerminacionesEnDescripcion(
        descripcionTienda,
        terminaciones
      );
      const terminacionesNombres = matchedTerm.map((t) => t.terminacion);
      const matchedPresentacion = matchPresentacionEnDescripcion(
        descripcionTienda,
        presentaciones
      );
      const nombres = nombresCatalogoProdPropio(r);
      return {
        codTienda: r.codTienda,
        descripcionTienda,
        marca: upperOrEmpty(nombres.marca),
        rubro: upperOrEmpty(nombres.rubro),
        subRubro: upperOrEmpty(nombres.subRubro),
        colores: coloresNombres,
        colorEtiqueta: coloresNombres.join(" · "),
        terminaciones: terminacionesNombres,
        terminacionEtiqueta: terminacionesNombres.join(" · "),
        presentacionEtiqueta: matchedPresentacion
          ? etiquetaPresentacionMedida(matchedPresentacion)
          : "",
      };
    });
  } catch (e: unknown) {
    console.error("[estCategorizacion.service] listarProdTiendaCategorizacion:", e);
    return [];
  }
}
