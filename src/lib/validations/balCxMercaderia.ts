import { z } from "zod";

/** Periodo `YYYY-MM` del filtro FECHA de Cx Merc. Vend. */
export const periodoCxMercVendSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Periodo inválido (YYYY-MM).");

/** Query params de Finanzas · Balance · Cx Merc. Vend. */
export const cxMercVendParamsSchema = z.object({
  periodo: periodoCxMercVendSchema,
  rubro: z.string().trim().max(64).default(""),
  sucursal: z.string().trim().max(64).default(""),
  q: z.string().trim().max(200).default(""),
  pagina: z.coerce.number().int().min(1).default(1),
});

export type CxMercVendParams = z.infer<typeof cxMercVendParamsSchema>;
