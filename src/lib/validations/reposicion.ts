import { z } from "zod";

/** Valores persistidos en `prod_ped_merc.reposicion_forma_pedido`. */
export const REPOSICION_FORMA_PEDIDO_VALUES = [
  "UNIDADES_MAX",
  "POR_BULTO",
  "UNIDADES_FIJAS",
] as const;

/** Vendedor → Reposición: no incluye UNIDADES_FIJAS. */
export const REPOSICION_FORMA_PEDIDO_VENDEDOR_VALUES = [
  "UNIDADES_MAX",
  "POR_BULTO",
] as const;

/** Pedido A Fáb.: no incluye UNIDADES_MAX. */
export const REPOSICION_FORMA_PEDIDO_FABRICA_VALUES = [
  "POR_BULTO",
  "UNIDADES_FIJAS",
] as const;

export const reposicionFormaPedidoSchema = z.enum(REPOSICION_FORMA_PEDIDO_VALUES);
export const reposicionFormaPedidoVendedorSchema = z.enum(
  REPOSICION_FORMA_PEDIDO_VENDEDOR_VALUES
);
export const reposicionFormaPedidoFabricaSchema = z.enum(
  REPOSICION_FORMA_PEDIDO_FABRICA_VALUES
);

export type ReposicionFormaPedido = z.infer<typeof reposicionFormaPedidoSchema>;
export type ReposicionFormaPedidoVendedor = z.infer<
  typeof reposicionFormaPedidoVendedorSchema
>;
export type ReposicionFormaPedidoFabrica = z.infer<
  typeof reposicionFormaPedidoFabricaSchema
>;

export const REPOSICION_FORMA_PEDIDO_LABELS: Record<ReposicionFormaPedido, string> = {
  UNIDADES_MAX: "UN. MÁXIMAS",
  POR_BULTO: "POR BULTO",
  UNIDADES_FIJAS: "UNIDADES FIJAS",
};

/** Labels cortos de FORMA PEDIR en Pedido A Fáb. */
export const REPOSICION_FORMA_PEDIDO_FABRICA_LABELS: Record<
  ReposicionFormaPedidoFabrica,
  string
> = {
  POR_BULTO: "BULTO",
  UNIDADES_FIJAS: "UNIDAD",
};

/** Labels de FORMA PEDIR en Configurar Reposición (vendedor). */
export const REPOSICION_FORMA_PEDIDO_VENDEDOR_LABELS: Record<
  ReposicionFormaPedidoVendedor,
  string
> = {
  UNIDADES_MAX: "UN. MÁXIMAS",
  POR_BULTO: "BULTO",
};

/** Lee valor persistido (incluye alias previos a la migración). */
export function normalizarReposicionFormaPedido(
  raw: string | null | undefined
): ReposicionFormaPedido | null {
  const v = (raw ?? "").trim().toUpperCase();
  if (
    v === "UNIDADES_MAX" ||
    v === "CANT_MAX" ||
    v === "CANT_MAXIMA" ||
    v === "CANT. MAX."
  ) {
    return "UNIDADES_MAX";
  }
  if (
    v === "POR_BULTO" ||
    v === "CANT_FIJA_POR_BULTO" ||
    v === "CANT_FIJA" ||
    v === "CANT. FIJA"
  ) {
    return "POR_BULTO";
  }
  if (v === "UNIDADES_FIJAS" || v === "CANT_FIJA_POR_UNIDAD") {
    return "UNIDADES_FIJAS";
  }
  return null;
}

export function labelReposicionFormaPedido(
  raw: string | null | undefined
): string {
  const n = normalizarReposicionFormaPedido(raw);
  return n ? REPOSICION_FORMA_PEDIDO_LABELS[n] : "";
}

export function labelReposicionFormaPedidoVendedor(
  raw: string | null | undefined
): string {
  const n = normalizarReposicionFormaPedido(raw);
  if (n === "UNIDADES_MAX" || n === "POR_BULTO") {
    return REPOSICION_FORMA_PEDIDO_VENDEDOR_LABELS[n];
  }
  return "";
}

export function esFormaCantFijaReposicion(
  forma: ReposicionFormaPedido
): boolean {
  return forma === "POR_BULTO" || forma === "UNIDADES_FIJAS";
}

export const sucursalReposicionSchema = z.enum(["guaymallen", "maipu"]);

export const getReposicionParamsSchema = z.object({
  q: z.string().max(500).optional().default(""),
  marca: z.string().max(200).optional().default(""),
  rubro: z.string().max(200).optional().default(""),
  subRubro: z.string().max(200).optional().default(""),
  /** Filtro PROVEEDOR (CUID). Vacío o inválido = sin filtro. */
  proveedor: z.string().max(200).optional().default(""),
  configurado: z.enum(["", "si"]).optional().default(""),
  pagina: z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? 1 : v),
    z.coerce.number().int().min(1).max(10_000)
  ),
});

export const productosReposicionSelectorSchema = z.object({
  q: z.string().max(500).optional().default(""),
  bulto: z
    .number()
    .int()
    .min(1)
    .max(1_000_000)
    .nullable()
    .optional()
    .default(null),
});
