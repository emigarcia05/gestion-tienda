import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EstVtasProductoItem, EstVtasVentaItem } from "@/lib/estVtasTypes";
import { EST_POR_PROD_CARGA_DESDE } from "@/lib/estPorProdPeriodo";
import { matchColoresEnDescripcion } from "@/lib/estPorProdColores";
import {
  etiquetaPresentacionMedida,
  matchPresentacionEnDescripcion,
} from "@/lib/estPorProdPresentacion";
import { matchTerminacionesEnDescripcion } from "@/lib/estPorProdTerminacion";
import { listarEstPorProdColores } from "@/services/estPorProdColores.service";
import { listarEstPorProdPresentaciones } from "@/services/estPorProdPresentacion.service";
import { listarEstPorProdTerminaciones } from "@/services/estPorProdTerminacion.service";

function upperOrEmpty(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleUpperCase("es-AR");
}

function decimalToNumber(value: Prisma.Decimal): number {
  return Number(value.toString());
}

/**
 * Factor para **SUMA DE UNIDADES**:
 * 1) si hay conversión a unidad → `conversion_a_unidad_presentacion`
 * 2) si no, y la unidad medida tiene `suma` → `presentacion_numerica`
 * 3) si no → 1
 */
function factorSumaDesdePresentacion(
  presentacion: ReturnType<typeof matchPresentacionEnDescripcion>
): number {
  if (!presentacion) return 1;
  if (
    presentacion.conversionAUnidadPresentacion != null &&
    presentacion.conversionAUnidad != null
  ) {
    return presentacion.conversionAUnidadPresentacion;
  }
  if (presentacion.unidadMedida.suma) {
    return presentacion.presentacionNumerica;
  }
  return 1;
}

/** Productos tienda con atributos de categorización + `factorSuma` para el dashboard. */
export async function listarProductosEstVtas(): Promise<EstVtasProductoItem[]> {
  try {
    const [rows, colores, presentaciones, terminaciones] = await Promise.all([
      prisma.prodPropio.findMany({
        select: {
          codTienda: true,
          descripcionTienda: true,
          marca: true,
          rubro: true,
          subRubro: true,
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
      return {
        codTienda: r.codTienda,
        descripcionTienda,
        marca: upperOrEmpty(r.marca),
        rubro: upperOrEmpty(r.rubro),
        subRubro: upperOrEmpty(r.subRubro),
        colores: coloresNombres,
        colorEtiqueta: coloresNombres.join(" · "),
        terminaciones: terminacionesNombres,
        terminacionEtiqueta: terminacionesNombres.join(" · "),
        presentacionEtiqueta: matchedPresentacion
          ? etiquetaPresentacionMedida(matchedPresentacion)
          : "",
        factorSuma: factorSumaDesdePresentacion(matchedPresentacion),
      };
    });
  } catch (e: unknown) {
    console.error("[estVtas.service] listarProductosEstVtas:", e);
    return [];
  }
}

/**
 * Ventas `est_por_prod` desde `EST_POR_PROD_CARGA_DESDE` (Mayo 2026) en adelante.
 * Agregación / filtros de sucursal y periodo en el cliente del dashboard.
 */
export async function listarVentasEstVtas(): Promise<EstVtasVentaItem[]> {
  try {
    const { mes: mesMin, anio: anioMin } = EST_POR_PROD_CARGA_DESDE;
    const rows = await prisma.estPorProd.findMany({
      where: {
        OR: [
          { anio: { gt: anioMin } },
          { anio: anioMin, mes: { gte: mesMin } },
        ],
      },
      select: {
        sucursalId: true,
        mes: true,
        anio: true,
        codTienda: true,
        vtasEnUn: true,
      },
    });
    return rows.map((r) => ({
      sucursalId: r.sucursalId,
      mes: r.mes,
      anio: r.anio,
      codTienda: r.codTienda,
      vtasEnUn: decimalToNumber(r.vtasEnUn),
    }));
  } catch (e: unknown) {
    console.error("[estVtas.service] listarVentasEstVtas:", e);
    return [];
  }
}
