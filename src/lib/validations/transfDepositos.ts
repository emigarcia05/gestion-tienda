import { z } from "zod";
import {
  esBorradorCantidadUnDecimal,
  formatCantidadInputValor,
} from "@/lib/cantidadUnDecimal";

/** Ítem del borrador de grilla (localStorage) hasta Generar Transferencia. */
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
