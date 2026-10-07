import { z } from "zod";
import { formatoCodSchema } from "@/lib/tintometricoFormatoCod";

/** `prod_marcas.id` / `prod_rubros_lista.id`: CUID o UUID histórico. */
const idCatalogoSchema = z.string().trim().min(1, "ID inválido.").max(64, "ID inválido.");

const nombreCatalogoSchema = z
  .string()
  .trim()
  .min(1, "Ingresá un nombre.")
  .max(120, "El nombre es demasiado largo.");

export const listarListaProductosSchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  rubro: z.string().trim().max(120).optional().default(""),
  marca: z.string().trim().max(64).optional().default(""),
  pagina: z.coerce.number().int().min(1).optional().default(1),
});

export const crearProductoTiendaSchema = z.object({
  descripcion: z
    .string()
    .trim()
    .min(1, "Ingresá la descripción.")
    .max(300, "La descripción es demasiado larga."),
  idRubro: idCatalogoSchema.nullable(),
  subRubro: z.string().trim().max(120, "El sub-rubro es demasiado largo.").nullable(),
  idMarca: idCatalogoSchema.nullable(),
  bulto: z.number().int("El bulto debe ser entero.").min(1, "El bulto debe ser ≥ 1.").nullable(),
  esProductoPropio: z.boolean(),
});

export const crearMarcaSchema = z.object({
  nombre: nombreCatalogoSchema,
  formatoCodTintometrico: formatoCodSchema.nullable(),
});

export const editarMarcaSchema = crearMarcaSchema.extend({ id: idCatalogoSchema });

export const crearRubroSchema = z.object({ nombre: nombreCatalogoSchema });

export const editarRubroSchema = crearRubroSchema.extend({ id: idCatalogoSchema });

export const idCatalogoInputSchema = z.object({ id: idCatalogoSchema });

export type ListarListaProductosInput = z.infer<typeof listarListaProductosSchema>;
export type CrearProductoTiendaInput = z.infer<typeof crearProductoTiendaSchema>;
export type CrearMarcaInput = z.infer<typeof crearMarcaSchema>;
export type EditarMarcaInput = z.infer<typeof editarMarcaSchema>;
export type CrearRubroInput = z.infer<typeof crearRubroSchema>;
export type EditarRubroInput = z.infer<typeof editarRubroSchema>;
