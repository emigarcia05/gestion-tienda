import { z } from "zod";
import { TERMINACIONES_PROD_LISTA } from "@/lib/prodListaTerminacion";
import { normalizarCodFliaItem } from "@/lib/prodProducto";
import { formatoCodSchema } from "@/lib/tintometricoFormatoCod";
import { listaPreciosCodExtSchema, listaPreciosCodTiendaSchema } from "@/lib/validations/common";
import { componentesCompuestoSchema } from "@/lib/validations/productoCompuesto";

/** `prod_marcas.id` / `prod_rubros.id` / `prod_sub_rubros.id`: CUID o UUID (backfill SQL). */
const idCatalogoSchema = z.string().trim().min(1, "ID inválido.").max(64, "ID inválido.");

const nombreCatalogoSchema = z
  .string()
  .trim()
  .min(1, "Ingresá un nombre.")
  .max(120, "El nombre es demasiado largo.");

/** `prod_familias.familia_cod`. Vacío → null. `5` y `005` quedan `005`. */
export const codFamiliaSchema = z
  .string()
  .trim()
  .max(6, "El código de familia admite hasta 6 dígitos.")
  .transform((valor, ctx) => {
    const codigo = normalizarCodFliaItem(valor);
    if (!codigo.ok) {
      ctx.addIssue({ code: "custom", message: "El código de familia es un número." });
      return z.NEVER;
    }
    return codigo.codigo;
  });

/** `prod_familias.familia_nombre`. Vacío permitido. Se guarda en mayúsculas. */
export const familiaNombreSchema = z
  .string()
  .trim()
  .max(120, "El nombre de la familia es demasiado largo.")
  .transform((valor) => valor.replace(/\s+/g, " ").toLocaleUpperCase("es-AR"));

/** Campos de catálogo comunes al alta y a la edición de un producto de tienda. */
const camposProductoTiendaSchema = z.object({
  descripcion: z
    .string()
    .trim()
    .min(1, "Ingresá la descripción.")
    .max(300, "La descripción es demasiado larga."),
  idRubro: idCatalogoSchema,
  /** Debe pertenecer a `idRubro` (FK compuesta en `prod_lista`). */
  idSubRubro: idCatalogoSchema.nullable(),
  idMarca: idCatalogoSchema,
  idPresentacion: idCatalogoSchema.nullable(),
  idColor: idCatalogoSchema.nullable(),
  /** `null` = sin terminación. */
  terminacion: z.enum(TERMINACIONES_PROD_LISTA).nullable(),
  bulto: z.number().int("El bulto debe ser entero.").min(1, "El bulto debe ser ≥ 1.").nullable(),
  /** `prod_lista.precio_editable`: el remito puede tipear el PX. LISTA. */
  precioEditable: z.boolean(),
});

/**
 * Un ítem del alta en lote. Propio ⇒ sin vínculo; no propio ⇒ vínculo obligatorio (CX. VINCULADO).
 * Compuesto ⇒ propio y ≥ 1 componente; no compuesto ⇒ sin componentes.
 */
export const crearProductoTiendaItemSchema = camposProductoTiendaSchema
  .extend({
    esProductoPropio: z.boolean(),
    codExtVinculo: listaPreciosCodExtSchema.nullable(),
    esProductoCompuesto: z.boolean(),
    componentes: componentesCompuestoSchema,
    codFamilia: codFamiliaSchema,
    familiaNombre: familiaNombreSchema,
  })
  .superRefine((item, ctx) => {
    if (item.esProductoPropio && item.codExtVinculo) {
      ctx.addIssue({ code: "custom", message: "Un producto propio no puede tener CX. VINCULADO." });
    }
    if (!item.esProductoPropio && !item.codExtVinculo) {
      ctx.addIssue({ code: "custom", message: "Elegí el CX. VINCULADO (o marcá producto propio)." });
    }
    if (item.esProductoCompuesto && !item.esProductoPropio) {
      ctx.addIssue({ code: "custom", message: "Un producto compuesto siempre es PROD. PROPIO." });
    }
    if (item.esProductoCompuesto && item.componentes.length === 0) {
      ctx.addIssue({ code: "custom", message: "Agregá al menos un componente al producto compuesto." });
    }
    if (!item.esProductoCompuesto && item.componentes.length > 0) {
      ctx.addIssue({ code: "custom", message: "Solo un producto compuesto lleva componentes." });
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
  codFamilia: codFamiliaSchema,
  familiaNombre: familiaNombreSchema,
});

export const leerFliaProductoSchema = z.object({
  codigo: z.string().trim().max(6),
});

export const eliminarProductoTiendaSchema = z.object({ codTienda: listaPreciosCodTiendaSchema });

/** Código de familia obligatorio (alta y edición del catálogo). */
export const familiaCodigoObligatorioSchema = codFamiliaSchema.transform((codigo, ctx) => {
  if (codigo == null) {
    ctx.addIssue({ code: "custom", message: "Ingresá el código de familia." });
    return z.NEVER;
  }
  return codigo;
});

/** Nombre de familia obligatorio. Vacío sigue permitido al guardar un ítem. */
export const familiaNombreObligatorioSchema = familiaNombreSchema.transform((nombre, ctx) => {
  if (nombre.length === 0) {
    ctx.addIssue({ code: "custom", message: "Ingresá el nombre de la familia." });
    return z.NEVER;
  }
  return nombre;
});

export const crearFamiliaSchema = z.object({
  codigo: familiaCodigoObligatorioSchema,
  nombre: familiaNombreObligatorioSchema,
});

export const editarFamiliaSchema = crearFamiliaSchema.extend({ id: idCatalogoSchema });

export const crearMarcaSchema = z.object({
  nombre: nombreCatalogoSchema,
  codTintometrico: z.boolean(),
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
export type CrearFamiliaInput = z.infer<typeof crearFamiliaSchema>;
export type EditarFamiliaInput = z.infer<typeof editarFamiliaSchema>;
