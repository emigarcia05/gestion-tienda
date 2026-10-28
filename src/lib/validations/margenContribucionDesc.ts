import { z } from "zod";
import {
  FIN_ANA_MC_DESCUENTO_MAX,
  FIN_ANA_MC_DESCUENTO_MIN,
} from "@/lib/finAnaMargenContribucion";
import { prismaCuidOrUuidSchema } from "@/lib/validations/common";

export const guardarDescuentoMargenContribucionSchema = z.object({
  /** `cobros_cx_fin.id` = columna forma × entidad × cuota. */
  cxFinId: prismaCuidOrUuidSchema,
  descuentoPct: z
    .number()
    .int()
    .min(FIN_ANA_MC_DESCUENTO_MIN)
    .max(FIN_ANA_MC_DESCUENTO_MAX),
});

export type GuardarDescuentoMargenContribucionInput = z.infer<
  typeof guardarDescuentoMargenContribucionSchema
>;
