/**
 * Costo lista para Cx/Px Tienda: `prod_lista.costo_compra_cod_ext` → `proveedor_prod_lista`.
 * `costo_compra` / `proveedor` en tienda siguen siendo espejo DUX (sync).
 */
import type { ServiceResult } from "@/types";
import { prisma } from "@/lib/prisma";

export function normalizarTextoProveedor(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export function proveedorTextoCoincideConDux(
  proveedorDux: string | null | undefined,
  nombre: string | null | undefined,
  prefijo: string | null | undefined
): boolean {
  const dux = normalizarTextoProveedor(proveedorDux);
  if (!dux) return false;
  const nom = normalizarTextoProveedor(nombre);
  const pref = normalizarTextoProveedor(prefijo);
  return dux === nom || (pref.length > 0 && dux === pref);
}

function toNum(n: unknown): number {
  if (n == null) return 0;
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
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
 * Tras vincular: si aún no hay costo lista, asigna único candidato habilitado o el que coincide con proveedor DUX.
 */
export async function autoAsignarCodExtCostoListaTrasVincular(
  codTienda: string
): Promise<void> {
  const tienda = await prisma.prodPropio.findUnique({
    where: { codTienda },
    select: { costoCompraCodExt: true, proveedor: true },
  });
  if (!tienda || tienda.costoCompraCodExt) return;

  const candidatos = await prisma.listaPrecioProveedor.findMany({
    where: { codTiendaVinculo: codTienda, habilitado: true },
    select: {
      codExt: true,
      proveedor: { select: { nombre: true, prefijo: true } },
    },
  });
  if (candidatos.length === 0) return;

  if (candidatos.length === 1) {
    await prisma.prodPropio.update({
      where: { codTienda },
      data: { costoCompraCodExt: candidatos[0].codExt },
    });
    return;
  }

  const matchDux = candidatos.find((c) =>
    proveedorTextoCoincideConDux(
      tienda.proveedor,
      c.proveedor.nombre,
      c.proveedor.prefijo
    )
  );
  if (matchDux) {
    await prisma.prodPropio.update({
      where: { codTienda },
      data: { costoCompraCodExt: matchDux.codExt },
    });
  }
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

/** Promedio de `px_compra_final_sin_iva` entre vínculos habilitados (> 0). */
export function calcularCostoPromedioVinculos(
  candidatos: Array<{ pxCompraFinalSinIva: unknown }>
): number | null {
  const valores = candidatos
    .map((c) => toNum(c.pxCompraFinalSinIva))
    .filter((n) => n > 0);
  if (valores.length === 0) return null;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
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
