import { z } from "zod";
import { cantidadUnDecimalPositivaSchema } from "@/lib/cantidadUnDecimal";
import { listaPreciosCodTiendaSchema } from "@/lib/validations/common";

export const setProductoCompuestoSchema = z.object({
  codTienda: listaPreciosCodTiendaSchema,
  esProductoCompuesto: z.boolean(),
});

/** Lista completa de componentes (`cod_tienda` + cantidad por kit). */
export const componentesCompuestoSchema = z
  .array(
    z.object({
      codTienda: listaPreciosCodTiendaSchema,
      cantidad: cantidadUnDecimalPositivaSchema,
    })
  )
  .max(100, "Máximo 100 componentes.");

export const guardarComponentesCompuestoSchema = z.object({
  codTienda: listaPreciosCodTiendaSchema,
  componentes: componentesCompuestoSchema,
});

/** `codTienda` null = compuesto todavía sin crear (Agregar Item): no hay ítem que excluir. */
export const buscarComponentesCandidatosSchema = z.object({
  codTienda: listaPreciosCodTiendaSchema.nullable(),
  q: z.string().max(200).optional().default(""),
});

export type ComponentesCompuestoInput = z.infer<typeof componentesCompuestoSchema>;
export type GuardarComponentesCompuestoInput = z.infer<typeof guardarComponentesCompuestoSchema>;
