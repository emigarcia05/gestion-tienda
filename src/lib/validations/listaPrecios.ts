import { z } from "zod";

import { prismaCuidSchema, listaPreciosCodExtSchema } from "@/lib/validations/common";

/** Lista no vacía de `cod_ext` para edición masiva en `prod_precios_provee`. */
export { listaPreciosCodExtListSchema, listaPreciosCodExtSchema } from "@/lib/validations/common";

function tieneMaxDosDecimales(n: number): boolean {
  return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}

/** Porcentaje 0–100 con hasta 2 decimales (`prod_precios_provee.dto_*`, `cx_transporte`). */
export const porcentajeListaPreciosSchema = z
  .number()
  .min(0)
  .max(100)
  .refine(tieneMaxDosDecimales, "El porcentaje admite hasta 2 decimales.");

function tieneMaxCuatroDecimales(n: number): boolean {
  return Math.abs(n * 10000 - Math.round(n * 10000)) < 1e-6;
}

/** Px Promo Fijo en moneda del ítem: `null` borra el override; número > 0 lo setea. */
export const pxPromoFijoListaPreciosSchema = z
  .number()
  .gt(0)
  .max(99_999_999)
  .refine(tieneMaxCuatroDecimales, "El Px Promo Fijo admite hasta 4 decimales.")
  .nullable();

/** Campos permitidos en actualización masiva de lista de precios (dto_* / cx_transporte / cotización USD solo vía servicios). */
export const actualizacionMasivaListaPreciosSchema = z.object({
  marca: z.string().nullable().optional(),
  rubro: z.string().nullable().optional(),
  /** Precio de lista del proveedor (`prod_precios_provee.px_lista_proveedor`). */
  pxListaProveedor: z.number().min(0).optional(),
  habilitado: z.boolean().optional(),
  /** Moneda del ítem; `null` elimina el promo (vuelven los descuentos %). */
  pxPromoFijo: pxPromoFijoListaPreciosSchema.optional(),
});

export type ActualizacionMasivaListaPreciosInput = z.infer<typeof actualizacionMasivaListaPreciosSchema>;

function textoOpcionalListaPrecios(s: string | undefined): string | undefined {
  return s && s.length > 0 ? s : undefined;
}

const marcaNombreOpcionalSchema = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform(textoOpcionalListaPrecios);

const rubroNombreOpcionalSchema = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform(textoOpcionalListaPrecios);

function refineRubroExigeMarca(
  val: { marcaNombre?: string; rubroNombre?: string },
  ctx: z.RefinementCtx
): void {
  if (val.rubroNombre && !val.marcaNombre) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Elegí una marca antes de filtrar por rubro.",
      path: ["rubroNombre"],
    });
  }
}

/** Filtros de alcance para variación masiva de `px_lista_proveedor` (sin el delta). */
export const variacionPxListaMasivaFiltrosSchema = z
  .object({
    proveedorId: prismaCuidSchema,
    marcaNombre: marcaNombreOpcionalSchema,
    rubroNombre: rubroNombreOpcionalSchema,
  })
  .superRefine(refineRubroExigeMarca);

export type VariacionPxListaMasivaFiltrosInput = z.infer<typeof variacionPxListaMasivaFiltrosSchema>;

/**
 * Variación masiva de `prod_precios_provee.px_lista_proveedor`.
 * Proveedor y variación % obligatorios; marca opcional; rubro opcional solo con marca.
 */
export const aplicarVariacionPxListaMasivaSchema = z
  .object({
    proveedorId: prismaCuidSchema,
    marcaNombre: marcaNombreOpcionalSchema,
    rubroNombre: rubroNombreOpcionalSchema,
    variacion: z
      .number()
      .finite()
      .min(-99.99, "La variación admite hasta 99,99 %.")
      .max(99.99, "La variación admite hasta 99,99 %.")
      .refine((n) => n !== 0, "La variación debe ser distinta de 0.")
      .refine(tieneMaxDosDecimales, "La variación admite hasta 2 decimales."),
  })
  .superRefine(refineRubroExigeMarca);

export type AplicarVariacionPxListaMasivaInput = z.infer<typeof aplicarVariacionPxListaMasivaSchema>;

/** Opciones de filtro admitidas en listados de lista de precios (objeto estricto). */
export const listaPreciosOpcionesFiltroSchema = z
  .object({
    soloPxSugerido: z.boolean().optional(),
  })
  .strict();

/** Filtros de las Actions de lectura de lista de precios (anti abuso de strings largos). */
export const listaPreciosFiltrosLecturaSchema = z.object({
  proveedorId: prismaCuidSchema.optional(),
  marcaNombre: z.string().max(200).optional(),
  rubroNombre: z.string().max(200).optional(),
  busqueda: z.string().max(500).optional(),
  habilitado: z.boolean().optional(),
  /** Vinculación `prod_precios_provee.id_precio_rex` → `prod_precios_rex`. */
  vinculado: z.boolean().optional(),
  opciones: listaPreciosOpcionesFiltroSchema.optional(),
  pagina: z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? undefined : v),
    z.coerce.number().int().min(1).max(10_000).optional()
  ),
});

export type ListaPreciosFiltrosLecturaInput = z.infer<typeof listaPreciosFiltrosLecturaSchema>;

/** Filtros para exportar lista de precios (sin paginación). */
export const listaPreciosFiltrosExportSchema = listaPreciosFiltrosLecturaSchema.omit({ pagina: true });

export type ListaPreciosFiltrosExportInput = z.infer<typeof listaPreciosFiltrosExportSchema>;

/** Alta manual de un producto en `prod_precios_provee` (misma lógica que import CSV). */
export const crearProductoListaPrecioSchema = z.object({
  idProveedor: prismaCuidSchema,
  codProdProveedor: z
    .string()
    .trim()
    .min(1, "El código de proveedor es obligatorio.")
    .max(128),
  descripcionProveedor: z
    .string()
    .trim()
    .min(1, "La descripción es obligatoria.")
    .max(500),
  pxListaProveedor: z.number().min(0, "El precio de lista debe ser mayor o igual a 0."),
  marca: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined)),
});

export type CrearProductoListaPrecioInput = z.infer<typeof crearProductoListaPrecioSchema>;

/** Eliminar un ítem de `prod_precios_provee` por `cod_ext`. */
export const eliminarListaPrecioSchema = z.object({
  codExt: listaPreciosCodExtSchema,
});

export type EliminarListaPrecioInput = z.infer<typeof eliminarListaPrecioSchema>;
