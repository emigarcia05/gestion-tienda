/**
 * Costo de compra del ítem tienda (SSOT):
 * - con CX elegido (`prod_lista.costo_compra_cod_ext`) → `proveedores_prod_lista.px_compra_final_sin_iva`;
 * - sin vínculos (PROD. PROPIO o sin vincular) → `prod_lista.costo_manual`;
 * - con varios vínculos y sin CX elegido → 0 (el usuario debe elegir).
 */
import type { Prisma } from "@prisma/client";
import type { ServiceResult } from "@/types";
import { prisma } from "@/lib/prisma";

function toNum(n: unknown): number {
  if (n == null) return 0;
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

/** Campos de `prod_lista` necesarios para `resolverCostoCompraTienda`. */
export const SELECT_COSTO_COMPRA_TIENDA = {
  costoManual: true,
  costoListaProveedor: { select: { pxCompraFinalSinIva: true, habilitado: true } },
} as const satisfies Prisma.ProdPropioSelect;

/** Línea de proveedor elegida pero deshabilitada → 0 (igual que CX PROD. en Cx Compra). */
export function resolverCostoCompraTienda(row: {
  costoManual: unknown;
  costoListaProveedor: { pxCompraFinalSinIva: unknown; habilitado: boolean } | null;
}): number {
  const proveedor = row.costoListaProveedor;
  if (proveedor) return proveedor.habilitado ? toNum(proveedor.pxCompraFinalSinIva) : 0;
  return toNum(row.costoManual);
}

/** Mapa `cod_tienda` → costo resuelto (lectores por lote). */
export async function mapCostoCompraPorCodTienda(
  codTiendas?: string[]
): Promise<Map<string, number>> {
  const rows = await prisma.prodPropio.findMany({
    where: codTiendas ? { codTienda: { in: codTiendas } } : undefined,
    select: { codTienda: true, ...SELECT_COSTO_COMPRA_TIENDA },
  });
  return new Map(rows.map((r) => [r.codTienda, resolverCostoCompraTienda(r)]));
}

/** Costo manual: solo para ítems sin vínculos con proveedores. `null` = vacío. */
export async function establecerCostoManualTienda(
  codTienda: string,
  costo: number | null
): Promise<ServiceResult<void>> {
  const vinculos = await prisma.listaPrecioProveedor.count({
    where: { codTiendaVinculo: codTienda },
  });
  if (vinculos > 0) {
    return {
      success: false,
      error: "El ítem tiene vínculos con proveedores: el costo se elige en la columna CX.",
    };
  }
  try {
    await prisma.prodPropio.update({
      where: { codTienda },
      data: { costoManual: costo },
    });
    return { success: true, data: undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

/** Valida que `codExt` sea candidato de costo para el ítem tienda. */
export async function validarCodExtCostoLista(
  codTienda: string,
  codExt: string
): Promise<ServiceResult<void>> {
  const row = await prisma.listaPrecioProveedor.findFirst({
    where: {
      codExt,
      codTiendaVinculo: codTienda,
      habilitado: true,
    },
    select: { codExt: true },
  });
  if (!row) {
    return {
      success: false,
      error: "El producto no está vinculado y habilitado para este ítem de tienda.",
    };
  }
  return { success: true, data: undefined };
}

export async function establecerCodExtCostoLista(
  codTienda: string,
  codExt: string
): Promise<ServiceResult<void>> {
  const valid = await validarCodExtCostoLista(codTienda, codExt);
  if (!valid.success) return valid;

  try {
    await prisma.prodPropio.update({
      where: { codTienda },
      data: { costoCompraCodExt: codExt },
    });
    return { success: true, data: undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

/** Si la FK apunta a `codExt`, la limpia (p. ej. al desvincular esa fila). */
export async function limpiarCodExtCostoListaSiCoincide(
  codTienda: string,
  codExt: string
): Promise<void> {
  await prisma.prodPropio.updateMany({
    where: { codTienda, costoCompraCodExt: codExt },
    data: { costoCompraCodExt: null },
  });
}

/**
 * Tras vincular / desvincular: con vínculos, `costo_manual` pasa a null; si no hay CX elegido y queda
 * un único vínculo habilitado, se toma por defecto. Con varios, el usuario elige en la columna CX.
 */
export async function sincronizarCostoTiendaTrasVinculos(codTienda: string): Promise<void> {
  const [tienda, candidatos] = await Promise.all([
    prisma.prodPropio.findUnique({
      where: { codTienda },
      select: { costoCompraCodExt: true, costoManual: true },
    }),
    prisma.listaPrecioProveedor.findMany({
      where: { codTiendaVinculo: codTienda },
      select: { codExt: true, habilitado: true },
    }),
  ]);
  if (!tienda || candidatos.length === 0) return;

  const data: Prisma.ProdPropioUpdateInput = {};
  if (tienda.costoManual != null) data.costoManual = null;
  const habilitados = candidatos.filter((c) => c.habilitado);
  if (!tienda.costoCompraCodExt && habilitados.length === 1) {
    data.costoListaProveedor = { connect: { codExt: habilitados[0].codExt } };
  }
  if (Object.keys(data).length === 0) return;
  await prisma.prodPropio.update({ where: { codTienda }, data });
}

export async function listarCandidatosCostoPorCodTienda(codTienda: string) {
  return prisma.listaPrecioProveedor.findMany({
    where: { codTiendaVinculo: codTienda, habilitado: true },
    select: {
      codExt: true,
      pxCompraFinalSinIva: true,
      proveedor: { select: { nombre: true, prefijo: true } },
    },
  });
}

export function etiquetaProveedorCosto(prefijo: string | null, nombre: string): string {
  const p = (prefijo ?? "").trim();
  if (p) return p;
  return nombre.trim();
}

export function costoDesdeCandidato(pxCompraFinalSinIva: unknown): number {
  return toNum(pxCompraFinalSinIva);
}

export async function limpiarCodExtCostoLista(codTienda: string): Promise<ServiceResult<void>> {
  try {
    await prisma.prodPropio.update({
      where: { codTienda },
      data: { costoCompraCodExt: null },
    });
    return { success: true, data: undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}
