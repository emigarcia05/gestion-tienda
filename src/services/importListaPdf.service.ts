/**
 * Importar Lista PDF: actualiza `proveedores_prod_lista.px_lista_proveedor` desde un PDF matricial
 * (filas = descripción, columnas = presentación). Cada cruce con precio es un ítem individualizado
 * (descripción + presentación) cuya clave es `descripcionExport` normalizada.
 *
 * Emparejamiento con la lista del proveedor:
 * 1. VINCULADO: la fila de lista ya apunta (`id_precio_rex`) al ítem del catálogo `prod_precios_rex`
 *    con esa clave (vínculo persistente; sirve aunque los textos no coincidan).
 * 2. SUGERIDO: sin vínculo previo, `descripcion_proveedor` normalizada = descripción + presentación
 *    (`clavesMatchItemPdf`).
 * 3. SIN_VINCULO: ninguno de los anteriores (se vincula a mano desde Lista Prod. Prov.).
 *
 * Al aplicar: guarda todos los ítems del PDF en `prod_precios_rex` (catálogo para vincular a mano),
 * fija `id_precio_rex` en las filas confirmadas y copia el precio a `px_lista_proveedor`.
 */
import { prisma } from "@/lib/prisma";
import {
  clavesMatchItemPdf,
  normalizarDescripcionMatchPdf,
  normalizarDescripcionPrecioRex,
} from "@/lib/listaPreciosPdfMatriz";
import type {
  FilaPreviewImportPdf,
  ItemListaMatchPdf,
  PreviewImportListaPdf,
  ResultadoImportListaPdf,
} from "@/lib/importListaPdf";
import type { FilaPdfMatrizNormalizadaDto } from "@/lib/validations/parseListaPreciosPdfMatriz";
import type { ServiceResult } from "@/types";

const CHUNK = 1000;

interface ItemPdfUnico {
  clave: string;
  descripcionBase: string;
  presentacion: string;
  precio: number;
}

/** Un ítem por clave; si el PDF repite la misma descripción + presentación, gana el último precio. */
function itemsUnicosPorClave(filas: FilaPdfMatrizNormalizadaDto[]): ItemPdfUnico[] {
  const porClave = new Map<string, ItemPdfUnico>();
  for (const f of filas) {
    const clave = normalizarDescripcionPrecioRex(f.descripcionExport);
    if (!clave) continue;
    porClave.set(clave, {
      clave,
      descripcionBase: f.descripcionBase,
      presentacion: f.presentacion,
      precio: f.precio,
    });
  }
  return [...porClave.values()];
}

function trozos<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** Sin escrituras: empareja los ítems del PDF con la lista del proveedor. */
export async function previsualizarImportListaPdf(
  proveedorId: string,
  filas: FilaPdfMatrizNormalizadaDto[]
): Promise<ServiceResult<PreviewImportListaPdf>> {
  try {
    const items = itemsUnicosPorClave(filas);
    if (items.length === 0) {
      return { success: false, error: "El PDF no tiene ítems con descripción y precio." };
    }
    const lista = await prisma.listaPrecioProveedor.findMany({
      where: { idProveedor: proveedorId },
      select: {
        codExt: true,
        codProdProveedor: true,
        descripcionProveedor: true,
        pxListaProveedor: true,
        precioRex: { select: { descripcion: true } },
      },
      orderBy: { descripcionProveedor: "asc" },
    });

    const vinculadosPorClave = new Map<string, ItemListaMatchPdf[]>();
    const sinVinculoPorDescripcion = new Map<string, ItemListaMatchPdf[]>();
    for (const l of lista) {
      const item: ItemListaMatchPdf = {
        codExt: l.codExt,
        codProdProveedor: l.codProdProveedor,
        descripcionProveedor: l.descripcionProveedor,
        pxActual: Number(l.pxListaProveedor),
      };
      const destino = l.precioRex
        ? { mapa: vinculadosPorClave, clave: normalizarDescripcionPrecioRex(l.precioRex.descripcion) }
        : { mapa: sinVinculoPorDescripcion, clave: normalizarDescripcionMatchPdf(l.descripcionProveedor) };
      destino.mapa.set(destino.clave, [...(destino.mapa.get(destino.clave) ?? []), item]);
    }

    const codExtConPrecio = new Set<string>();
    const filasPreview: FilaPreviewImportPdf[] = items.map((it) => {
      const vinculados = vinculadosPorClave.get(it.clave);
      if (vinculados) {
        for (const v of vinculados) codExtConPrecio.add(v.codExt);
        return { ...it, estado: "VINCULADO", items: vinculados };
      }
      const sugeridos = clavesMatchItemPdf(it.descripcionBase, it.presentacion)
        .flatMap((k) => sinVinculoPorDescripcion.get(k) ?? [])
        .filter((s) => !codExtConPrecio.has(s.codExt));
      if (sugeridos.length > 0) {
        for (const s of sugeridos) codExtConPrecio.add(s.codExt);
        return { ...it, estado: "SUGERIDO", items: sugeridos };
      }
      return { ...it, estado: "SIN_VINCULO", items: [] };
    });

    return {
      success: true,
      data: { filas: filasPreview, listaSinPrecioEnPdf: lista.length - codExtConPrecio.size },
    };
  } catch (e) {
    console.error("[importListaPdf.service] previsualizarImportListaPdf:", e);
    return { success: false, error: "No se pudo emparejar el PDF con la lista del proveedor." };
  }
}

/**
 * Guarda el catálogo del PDF en `prod_precios_rex` y actualiza las filas de lista confirmadas
 * (`vinculos`: clave del ítem PDF → `cod_ext`), dejando `id_precio_rex` vinculado.
 */
export async function aplicarImportListaPdf(
  proveedorId: string,
  filas: FilaPdfMatrizNormalizadaDto[],
  vinculos: { clave: string; codExt: string }[]
): Promise<ServiceResult<ResultadoImportListaPdf>> {
  try {
    const items = itemsUnicosPorClave(filas);
    const itemPorClave = new Map(items.map((it) => [it.clave, it]));

    const codExts = vinculos.map((v) => v.codExt);
    if (new Set(codExts).size !== codExts.length) {
      return { success: false, error: "Un ítem de la lista no puede recibir dos precios del PDF." };
    }
    const claveFaltante = vinculos.find((v) => !itemPorClave.has(v.clave));
    if (claveFaltante) {
      return { success: false, error: `«${claveFaltante.clave}» no está en el PDF.` };
    }
    const listaRows = await prisma.listaPrecioProveedor.findMany({
      where: { idProveedor: proveedorId, codExt: { in: codExts } },
      select: { codExt: true, idPrecioRex: true },
    });
    if (listaRows.length !== codExts.length) {
      return { success: false, error: "Algún ítem de la lista no existe o es de otro proveedor." };
    }

    const existentes = new Map<string, { id: string; px: number }>();
    for (const chunk of trozos(items.map((it) => it.clave), CHUNK)) {
      const rows = await prisma.prodPrecioRex.findMany({
        where: { idProveedor: proveedorId, descripcion: { in: chunk } },
        select: { id: true, descripcion: true, pxListaProveedor: true },
      });
      for (const r of rows) existentes.set(r.descripcion, { id: r.id, px: Number(r.pxListaProveedor) });
    }

    const nuevos = items.filter((it) => !existentes.has(it.clave));
    for (const chunk of trozos(nuevos, CHUNK)) {
      await prisma.prodPrecioRex.createMany({
        data: chunk.map((it) => ({
          idProveedor: proveedorId,
          descripcion: it.clave,
          pxListaProveedor: it.precio,
        })),
        skipDuplicates: true,
      });
    }
    for (const chunk of trozos(nuevos.map((it) => it.clave), CHUNK)) {
      const rows = await prisma.prodPrecioRex.findMany({
        where: { idProveedor: proveedorId, descripcion: { in: chunk } },
        select: { id: true, descripcion: true, pxListaProveedor: true },
      });
      for (const r of rows) existentes.set(r.descripcion, { id: r.id, px: Number(r.pxListaProveedor) });
    }

    const clavesNuevas = new Set(nuevos.map((it) => it.clave));
    const cambiados: { id: string; px: number }[] = [];
    for (const it of items) {
      const e = existentes.get(it.clave);
      if (e && !clavesNuevas.has(it.clave) && e.px !== it.precio) cambiados.push({ id: e.id, px: it.precio });
    }
    for (const chunk of trozos(cambiados, CHUNK)) {
      const ids = chunk.map((c) => c.id);
      const pxs = chunk.map((c) => c.px);
      await prisma.$executeRaw`
        UPDATE prod_precios_rex AS r
        SET px_lista_proveedor = v.px
        FROM unnest(${ids}::text[], ${pxs}::numeric[]) AS v(id, px)
        WHERE r.id = v.id
      `;
    }

    const idPrevioPorCodExt = new Map(listaRows.map((r) => [r.codExt, r.idPrecioRex]));
    const aplicar: { codExt: string; rexId: string; px: number }[] = [];
    for (const v of vinculos) {
      const rex = existentes.get(v.clave);
      const item = itemPorClave.get(v.clave);
      if (!rex || !item) {
        return { success: false, error: `No se pudo guardar «${v.clave}» en el catálogo del PDF.` };
      }
      aplicar.push({ codExt: v.codExt, rexId: rex.id, px: item.precio });
    }
    const vinculosNuevos = aplicar.filter((a) => idPrevioPorCodExt.get(a.codExt) !== a.rexId).length;
    let itemsActualizados = 0;
    for (const chunk of trozos(aplicar, CHUNK)) {
      const codes = chunk.map((a) => a.codExt);
      const rexIds = chunk.map((a) => a.rexId);
      const pxs = chunk.map((a) => a.px);
      itemsActualizados += Number(await prisma.$executeRaw`
        UPDATE proveedores_prod_lista AS lp
        SET id_precio_rex = v.rex_id, px_lista_proveedor = v.px, updated_at = now()
        FROM unnest(${codes}::text[], ${rexIds}::text[], ${pxs}::numeric[]) AS v(cod_ext, rex_id, px)
        WHERE lp.cod_ext = v.cod_ext AND lp.id_proveedor = ${proveedorId}
      `);
    }

    return {
      success: true,
      data: {
        itemsActualizados,
        vinculosNuevos,
        catalogoCreados: nuevos.length,
        catalogoActualizados: cambiados.length,
      },
    };
  } catch (e) {
    console.error("[importListaPdf.service] aplicarImportListaPdf:", e);
    return { success: false, error: "No se pudieron actualizar los precios." };
  }
}
