import { z } from "zod";

export const getControlStockParamsSchema = z.object({
  q: z.string().max(500).optional(),
  marca: z.string().max(200).optional(),
  rubro: z.string().max(200).optional(),
  soloNegativo: z.boolean().optional(),
  orden: z.string().max(64).optional(),
  pagina: z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? undefined : v),
    z.coerce.number().int().min(1).max(10_000).optional()
  ),
});
