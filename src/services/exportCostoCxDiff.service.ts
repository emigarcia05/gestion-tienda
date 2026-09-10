import { prisma } from "@/lib/prisma";

export interface FilaExportCostoCx {
  codigo: string;
  costo: number;
}

/** Ítem con diff de costo (Excel + informe PDF). */
export type ItemCostoCxDiff = {
  codTienda: string;
  descripcion: string;
  marca: string;
  rubro: string;
  costoViejo: number;
  costoNuevo: number;
};

export const MARCA_COSTO_CX_SIN_INFORMAR = "SIN MARCA";
export const RUBRO_COSTO_CX_SIN_INFORMAR = "SIN RUBRO";

/** Diferencias menores a 1 centavo no generan fila en Act. Cx. (Excel importa COSTO a 2 dec.). */
const TOLERANCIA_DIFERENCIA_COSTO_CX = 0.01;

function toNum(n: unknown): number {
  if (n == null) return 0;
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

/**
 * Difieren `prod_tienda.costo_compra` vs `prod_precios_provee.px_compra_final_sin_iva`
 * (vinculados por `costo_compra_cod_ext` → `cod_ext`).
 */
export function costosCompraDifieren(costoCompra: number, pxProveedorSinIva: number): boolean {
  return Math.abs(costoCompra - pxProveedorSinIva) >= TOLERANCIA_DIFERENCIA_COSTO_CX;
}

export function redondearCostoCxExport(px: number): number {
  return Math.round(px * 100) / 100;
}

/**
 * SSOT ítems Act. Cx.: `costo_compra_cod_ext`, vínculo habilitado, diff ≥ 0,01,
 * `px_compra_final_sin_iva` > 0. Usado por Excel y PDF de aumentos.
 */
function itemCostoCxDiffDesdeRow(row: {
  codTienda: string;
  descripcionTienda: string | null;
  marca: string | null;
  rubro: string | null;
  costoCompra: unknown;
  costoListaProveedor: {
    pxCompraFinalSinIva: unknown;
    habilitado: boolean;
  } | null;
}): ItemCostoCxDiff | null {
  const proveedor = row.costoListaProveedor;
  if (!proveedor?.habilitado) return null;

  const pxFinal = toNum(proveedor.pxCompraFinalSinIva);
  if (pxFinal <= 0) return null;

  const costoViejo = toNum(row.costoCompra);
  if (!costosCompraDifieren(costoViejo, pxFinal)) return null;

  const marca = row.marca?.trim() || MARCA_COSTO_CX_SIN_INFORMAR;
  const rubro = row.rubro?.trim() || RUBRO_COSTO_CX_SIN_INFORMAR;
  const descripcion = (row.descripcionTienda?.trim() || "Sin descripción").slice(0, 256);

  return {
    codTienda: row.codTienda,
    descripcion,
    marca,
    rubro,
    costoViejo,
    costoNuevo: redondearCostoCxExport(pxFinal),
  };
}

const selectItemCostoCxDiff = {
  codTienda: true,
  descripcionTienda: true,
  marca: true,
  rubro: true,
  costoCompra: true,
  costoListaProveedor: {
    select: {
      pxCompraFinalSinIva: true,
      habilitado: true,
    },
  },
} as const;

export async function listarItemsCostoCxDiff(): Promise<ItemCostoCxDiff[]> {
  const rows = await prisma.prodTienda.findMany({
    where: {
      costoCompraCodExt: { not: null },
    },
    select: selectItemCostoCxDiff,
    orderBy: { codTienda: "asc" },
  });

  const items: ItemCostoCxDiff[] = [];
  for (const row of rows) {
    const item = itemCostoCxDiffDesdeRow(row);
    if (item) items.push(item);
  }
  return items;
}

/**
 * Ítems a exportar en Excel: CODIGO = `cod_tienda`, COSTO = `px_compra_final_sin_iva` (2 dec.).
 */
export async function listarFilasExportCostoCxDiff(): Promise<FilaExportCostoCx[]> {
  const items = await listarItemsCostoCxDiff();
  return items.map((item) => ({
    codigo: item.codTienda,
    costo: item.costoNuevo,
  }));
}
