import { prisma } from "@/lib/prisma";

export interface FilaExportCostoCx {
  codigo: string;
  costo: number;
}

function toNum(n: unknown): number {
  if (n == null) return 0;
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

export function redondearCostoCxExport(px: number): number {
  return Math.round(px * 100) / 100;
}

/**
 * Excel Act. Cx.: CODIGO = `cod_tienda`, COSTO = `px_compra_final_sin_iva` (2 dec.) del proveedor elegido
 * (`costo_compra_cod_ext`, línea habilitada, px > 0). Sin espejo del costo DUX no hay diff: exporta todos.
 */
export async function listarFilasExportCostoCxDiff(): Promise<FilaExportCostoCx[]> {
  const rows = await prisma.prodPropio.findMany({
    where: { costoListaProveedor: { habilitado: true } },
    select: {
      codTienda: true,
      costoListaProveedor: { select: { pxCompraFinalSinIva: true } },
    },
    orderBy: { codTienda: "asc" },
  });

  const filas: FilaExportCostoCx[] = [];
  for (const row of rows) {
    const px = toNum(row.costoListaProveedor?.pxCompraFinalSinIva);
    if (px > 0) filas.push({ codigo: row.codTienda, costo: redondearCostoCxExport(px) });
  }
  return filas;
}
