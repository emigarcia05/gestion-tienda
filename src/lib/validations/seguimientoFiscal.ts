import { z } from "zod";
import { periodoCxMercVendSchema } from "@/lib/validations/balCxMercaderia";

/** Query params de Administrador · COBROS & DESC. · Seguimiento Fiscal. */
export const seguimientoFiscalParamsSchema = z.object({
  periodo: periodoCxMercVendSchema,
});
