import type { CampoReglaDescuentoListaPrecioInput } from "@/lib/validations/descuentosListaPrecioReglas";

/** Columnas dto_* / cx_transporte materializadas por reglas dimensionales. */
export interface DescuentosMaterializadosItem {
  dtoProveedor: number;
  dtoMarca: number;
  dtoRubro: number;
  dtoCantidad: number;
  dtoFinanciero: number;
  cxTransporte: number;
}

/** Campo virtual de descuento activo (no está en enum Prisma de reglas dimensionales). */
export const CAMPO_DESC_ESPECIAL = "desc_especial" as const;

/** Override de Px Final en USD (columna `px_promo_fijo`; no es regla dimensional). */
export const CAMPO_PX_PROMO_FIJO = "px_promo_fijo" as const;

export type CampoDescuentoActivoListaPrecio =
  | CampoReglaDescuentoListaPrecioInput
  | typeof CAMPO_DESC_ESPECIAL
  | typeof CAMPO_PX_PROMO_FIJO;
