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
 * 3. SIN_VINCULO: ninguno de los anteriores.
 *
 * Los ítems de lista que no reciben precio (`listaSinPrecio`) se vinculan a mano en la vista previa;
 * cuando hay un ítem del PDF parecido (`sugerirPorSimilitud`) viene propuesto en `claveSugerida`.
 * Elegir (o quitar) un ítem del PDF persiste `id_precio_rex` al momento (`guardarVinculoListaPdf`),
 * sin tocar `px_lista_proveedor`, para que la próxima importación lo tome como VINCULADO.
 *
 * Al aplicar: guarda todos los ítems del PDF en `prod_precios_rex` (catálogo para vincular a mano),
 * fija `id_precio_rex` en las filas confirmadas y copia el precio a `px_lista_proveedor`.
 */
import { prisma } from "@/lib/prisma";
import {
  claveIndicePalabraMatchPdf,
  clavesMatchItemPdf,
  normalizarDescripcionMatchPdf,
  normalizarDescripcionPrecioRex,
  patronSimilitudItemPdf,
  similitudItemPdf,
  tokensListaMatchPdf,
  type PatronSimilitudItemPdf,
} from "@/lib/listaPreciosPdfMatriz";
import type {
  FilaPreviewImportPdf,
  ItemListaMatchPdf,
  ItemListaSinPrecioPdf,
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

/**
 * Para cada ítem de lista sin precio, el ítem del PDF más parecido (`similitudItemPdf`): menos palabras
 * de más y, a igualdad, más palabras del PDF coincidentes. Empate entre ítems distintos = sin sugerencia.
 */
function sugerirPorSimilitud(
  items: ItemPdfUnico[],
  sinPrecio: ItemListaMatchPdf[]
): ItemListaSinPrecioPdf[] {
  const indice = new Map<string, { clave: string; patron: PatronSimilitudItemPdf }[]>();
  for (const it of items) {
    const patron = patronSimilitudItemPdf(it.descripcionBase, it.presentacion);
    const primera = patron.fijos[0];
    if (!primera) continue;
    const k = claveIndicePalabraMatchPdf(primera);
    indice.set(k, [...(indice.get(k) ?? []), { clave: it.clave, patron }]);
  }

  return sinPrecio.map((item) => {
    const tokens = tokensListaMatchPdf(item.descripcionProveedor);
    const candidatos = new Set(tokens.flatMap((t) => indice.get(claveIndicePalabraMatchPdf(t)) ?? []));
    let mejor: { clave: string; extras: number; especificidad: number } | null = null;
    let empate = false;
    for (const c of candidatos) {
      const s = similitudItemPdf(c.patron, tokens);
      if (!s) continue;
      const gana =
        !mejor || s.extras < mejor.extras || (s.extras === mejor.extras && s.especificidad > mejor.especificidad);
      if (gana) {
        mejor = { clave: c.clave, ...s };
        empate = false;
      } else if (
        mejor &&
        s.extras === mejor.extras &&
        s.especificidad === mejor.especificidad &&
        c.clave !== mejor.clave
      ) {
        empate = true;
      }
    }
    return { ...item, claveSugerida: mejor && !empate ? mejor.clave : null };
  });
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
    const itemsLista: ItemListaMatchPdf[] = [];
    for (const l of lista) {
      const item: ItemListaMatchPdf = {
        codExt: l.codExt,
        codProdProveedor: l.codProdProveedor,
        descripcionProveedor: l.descripcionProveedor,
        pxActual: Number(l.pxListaProveedor),
      };
      itemsLista.push(item);
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
      data: {
        filas: filasPreview,
        listaSinPrecio: sugerirPorSimilitud(
          items,
          itemsLista.filter((i) => !codExtConPrecio.has(i.codExt))
        ),
      },
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

/**
 * Persiste o quita el vínculo lista ↔ ítem del PDF (`id_precio_rex`) sin cambiar `px_lista_proveedor`.
 * La próxima previsualización lo trata como VINCULADO si el PDF trae la misma clave.
 */
export async function guardarVinculoListaPdf(
  proveedorId: string,
  codExt: string,
  clave: string | null,
  precio?: number
): Promise<ServiceResult<{ codExt: string; clave: string | null }>> {
  try {
    const lista = await prisma.listaPrecioProveedor.findFirst({
      where: { codExt, idProveedor: proveedorId },
      select: { codExt: true },
    });
    if (!lista) {
      return { success: false, error: "El ítem de la lista no existe o es de otro proveedor." };
    }

    if (clave === null) {
      await prisma.listaPrecioProveedor.update({
        where: { codExt },
        data: { idPrecioRex: null },
      });
      return { success: true, data: { codExt, clave: null } };
    }

    const claveNorm = normalizarDescripcionPrecioRex(clave);
    if (!claveNorm) {
      return { success: false, error: "La descripción del ítem del PDF no es válida." };
    }
    if (precio == null || !(precio > 0)) {
      return { success: false, error: "Falta el precio del ítem del PDF para guardar el vínculo." };
    }

    let rex = await prisma.prodPrecioRex.findFirst({
      where: { idProveedor: proveedorId, descripcion: claveNorm },
      select: { id: true },
    });
    if (!rex) {
      rex = await prisma.prodPrecioRex.create({
        data: {
          idProveedor: proveedorId,
          descripcion: claveNorm,
          pxListaProveedor: precio,
        },
        select: { id: true },
      });
    }

    await prisma.listaPrecioProveedor.update({
      where: { codExt },
      data: { idPrecioRex: rex.id },
    });
    return { success: true, data: { codExt, clave: claveNorm } };
  } catch (e) {
    console.error("[importListaPdf.service] guardarVinculoListaPdf:", e);
    return { success: false, error: "No se pudo guardar el vínculo con el ítem del PDF." };
  }
}
