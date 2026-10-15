import { z } from "zod";
import { cantidadUnDecimalPositivaSchema } from "@/lib/cantidadUnDecimal";
import { listaPreciosCodTiendaSchema } from "@/lib/validations/common";

export const setProductoCompuestoSchema = z.object({
  codTienda: listaPreciosCodTiendaSchema,
  esProductoCompuesto: z.boolean(),
});

export const guardarComponentesCompuestoSchema = z.object({
  codTienda: listaPreciosCodTiendaSchema,
  componentes: z
    .array(
      z.object({
        codTienda: listaPreciosCodTiendaSchema,
        cantidad: cantidadUnDecimalPositivaSchema,
      })
    )
    .max(100, "Máximo 100 componentes."),
});

export const buscarComponentesCandidatosSchema = z.object({
  codTienda: listaPreciosCodTiendaSchema,
  q: z.string().max(200).optional().default(""),
});

export type GuardarComponentesCompuestoInput = z.infer<typeof guardarComponentesCompuestoSchema>;
