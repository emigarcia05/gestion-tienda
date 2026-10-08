import { z } from "zod";
import { formatoCodSchema } from "@/lib/tintometricoFormatoCod";
import { listaPreciosCodExtSchema, listaPreciosCodTiendaSchema } from "@/lib/validations/common";

/** `prod_marcas.id` / `prod_rubros.id` / `prod_sub_rubros.id`: CUID o UUID (backfill SQL). */
const idCatalogoSchema = z.string().trim().min(1, "ID inválido.").max(64, "ID inválido.");

const nombreCatalogoSchema = z
  .string()
  .trim()
  .min(1, "Ingresá un nombre.")
  .max(120, "El nombre es demasiado largo.");

/** Campos de catálogo comunes al alta y a la edición de un producto de tienda. */
const camposProductoTiendaSchema = z.object({
  descripcion: z
    .string()
    .trim()
    .min(1, "Ingresá la descripción.")
    .max(300, "La descripción es demasiado larga."),
  idRubro: idCatalogoSchema,
  /** Debe pertenecer a `idRubro` (FK compuesta en `prod_propios`). */
  idSubRubro: idCatalogoSchema.nullable(),
  idMarca: idCatalogoSchema,
  idPresentacion: idCatalogoSchema.nullable(),
  idColor: idCatalogoSchema.nullable(),
  bulto: z.number().int("El bulto debe ser entero.").min(1, "El bulto debe ser ≥ 1.").nullable(),
});

/** Un ítem del alta en lote. Propio ⇒ sin vínculo; no propio ⇒ vínculo obligatorio (CX. VINCULADO). */
export const crearProductoTiendaItemSchema = camposProductoTiendaSchema
  .extend({
    esProductoPropio: z.boolean(),
    codExtVinculo: listaPreciosCodExtSchema.nullable(),
  })
  .superRefine((item, ctx) => {
    if (item.esProductoPropio && item.codExtVinculo) {
      ctx.addIssue({ code: "custom", message: "Un producto propio no puede tener CX. VINCULADO." });
    }
    if (!item.esProductoPropio && !item.codExtVinculo) {
      ctx.addIssue({ code: "custom", message: "Elegí el CX. VINCULADO (o marcá producto propio)." });
    }
  });

export const crearProductosTiendaLoteSchema = z
  .object({
    items: z
      .array(crearProductoTiendaItemSchema)
      .min(1, "Agregá al menos un producto.")
      .max(100, "Máximo 100 productos por vez."),
  })
  .superRefine(({ items }, ctx) => {
    const codExts = items.flatMap((i) => (i.codExtVinculo ? [i.codExtVinculo] : []));
    if (new Set(codExts).size !== codExts.length) {
      ctx.addIssue({
        code: "custom",
        message: "Dos productos no pueden vincularse a la misma línea de proveedor.",
      });
    }
  });

/** Editar: vínculos, costo y producto propio se manejan con sus propias acciones (inmediatas). */
export const editarProductoTiendaSchema = camposProductoTiendaSchema.extend({
  codTienda: listaPreciosCodTiendaSchema,
});

export const eliminarProductoTiendaSchema = z.object({ codTienda: listaPreciosCodTiendaSchema });

export const crearMarcaSchema = z.object({
  nombre: nombreCatalogoSchema,
  formatoCodTintometrico: formatoCodSchema.nullable(),
});

export const editarMarcaSchema = crearMarcaSchema.extend({ id: idCatalogoSchema });

export const crearRubroSchema = z.object({ nombre: nombreCatalogoSchema });

export const editarRubroSchema = crearRubroSchema.extend({ id: idCatalogoSchema });

export const crearSubRubroSchema = z.object({ idRubro: idCatalogoSchema, nombre: nombreCatalogoSchema });

export const editarSubRubroSchema = z.object({ id: idCatalogoSchema, nombre: nombreCatalogoSchema });

export const idCatalogoInputSchema = z.object({ id: idCatalogoSchema });

export type CrearProductoTiendaItemInput = z.infer<typeof crearProductoTiendaItemSchema>;
export type CrearProductosTiendaLoteInput = z.infer<typeof crearProductosTiendaLoteSchema>;
export type EditarProductoTiendaInput = z.infer<typeof editarProductoTiendaSchema>;
export type CrearMarcaInput = z.infer<typeof crearMarcaSchema>;
export type EditarMarcaInput = z.infer<typeof editarMarcaSchema>;
export type CrearRubroInput = z.infer<typeof crearRubroSchema>;
export type EditarRubroInput = z.infer<typeof editarRubroSchema>;
export type CrearSubRubroInput = z.infer<typeof crearSubRubroSchema>;
export type EditarSubRubroInput = z.infer<typeof editarSubRubroSchema>;
