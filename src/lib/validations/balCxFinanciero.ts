import { z } from "zod";
import { periodoCxMercVendSchema } from "@/lib/validations/balCxMercaderia";

/** Query params de Finanzas · Balance · Cx Fin Cobros (solo detalle de cobros). */
export const cxFinCobrosParamsSchema = z.object({
  periodo: periodoCxMercVendSchema,
  pago: z.string().trim().max(64).default(""),
  sucursal: z.string().trim().max(64).default(""),
  q: z.string().trim().max(200).default(""),
  pagina: z.coerce.number().int().min(1).default(1),
});

export type CxFinCobrosParams = z.infer<typeof cxFinCobrosParamsSchema>;
