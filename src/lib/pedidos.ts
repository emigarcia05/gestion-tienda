/**
 * Tipos y utilidades compartidas para módulos de pedidos (server y client).
 */

export type SucursalPedido = "guaymallen" | "maipu";

/** Etiquetas de sucursal para PDF / nota de pedido (alineado a `generarPdfEnviarPedidoAction`). */
export const SUCURSAL_LABEL_PEDIDO: Record<SucursalPedido, string> = {
  guaymallen: "Guaymallén",
  maipu: "Maipú",
};

export const TIPOS_PEDIDO = [
  "URGENTE",
  "TINTOMETRICO",
  "REPOSICION",
  "A FÁBRICA",
] as const;
export type TipoPedido = (typeof TIPOS_PEDIDO)[number];

/** Mínimo de caracteres de búsqueda para contar como segundo filtro en Pedido Urgente. */
export const MIN_CARACTERES_BUSQUEDA_PEDIDO_URGENTE = 3;

export const MENSAJE_SIN_SUCURSAL_PEDIDO_URGENTE =
  "Seleccioná una sucursal para ver los productos.";

export const MENSAJE_SIN_FILTRO_EXTRA_PEDIDO_URGENTE =
  "Seleccioná un segundo filtro (Proveedor, Pedido o búsqueda de al menos 3 caracteres) para ver productos.";

/** Sucursal ya no basta: hace falta PROVEEDOR, PEDIDO o búsqueda ≥ 3. */
export function hayFiltroExtraPedidoUrgente(params: {
  proveedor?: string;
  pedido?: string;
  q?: string;
}): boolean {
  if ((params.proveedor ?? "").trim()) return true;
  if ((params.pedido ?? "").trim()) return true;
  return (params.q ?? "").trim().length >= MIN_CARACTERES_BUSQUEDA_PEDIDO_URGENTE;
}

/** Parsea el query param "tipo" (valores separados por coma) a array de TipoPedido. */
export function parseTiposParam(param: string): TipoPedido[] {
  if (!param?.trim()) return [];
  const valid = new Set(TIPOS_PEDIDO);
  return param
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((v): v is TipoPedido => valid.has(v as TipoPedido));
}
