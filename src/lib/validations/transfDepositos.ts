import { z } from "zod";
import {
  esBorradorCantidadUnDecimal,
  formatCantidadInputValor,
} from "@/lib/cantidadUnDecimal";
import { listaPreciosCodTiendaSchema } from "@/lib/validations/common";
import { sucursalPorDefectoSchema } from "@/lib/validations/globalPersonal";

/** Ítem del borrador de grilla (localStorage) hasta Crear Transferencia. */
export const itemBorradorTransfDepositosSchema = z.object({
  cantidad: z
    .union([z.string(), z.number()])
    .transform((v) =>
      typeof v === "number" ? formatCantidadInputValor(v) : v.trim()
    )
    .refine(
      (s) => s !== "" && esBorradorCantidadUnDecimal(s),
      "Cantidad inválida."
    ),
  descripcion: z.string().max(500).optional().default(""),
});

export const catalogoTransfDepositosQuerySchema = z.object({
  origen: sucursalPorDefectoSchema,
  destino: sucursalPorDefectoSchema.optional(),
  q: z.string().trim().max(200).optional().default(""),
  marca: z.string().trim().max(120).optional().default(""),
  rubro: z.string().trim().max(120).optional().default(""),
  pagina: z.coerce.number().int().min(1).max(10_000).optional().default(1),
});

/** Máximo de códigos por consulta de saldos (filas con cantidad fuera de página). */
export const MAX_COD_SALDOS_TRANSF_DEPOSITOS = 200;

export const saldosTransfDepositosQuerySchema = z.object({
  origen: sucursalPorDefectoSchema,
  destino: sucursalPorDefectoSchema.optional(),
  cods: z
    .array(listaPreciosCodTiendaSchema)
    .min(1)
    .max(MAX_COD_SALDOS_TRANSF_DEPOSITOS),
});
