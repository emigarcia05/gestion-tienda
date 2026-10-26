import { z } from "zod";
import { periodoCxMercVendSchema } from "@/lib/validations/balCxMercaderia";

/** Query params de Finanzas · Balance · Balance IVA. */
export const balIvaParamsSchema = z.object({
  periodo: periodoCxMercVendSchema,
});

export type BalIvaParams = z.infer<typeof balIvaParamsSchema>;
