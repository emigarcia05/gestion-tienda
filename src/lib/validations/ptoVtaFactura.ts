import { z } from "zod";
import { GRUPOS_FACTURA_PTO_VTA } from "@/lib/ptoVtaFactura";
import { prismaCuidOrUuidSchema } from "@/lib/validations/common";

/** `ptoVtaId = null` borra la configuración del grupo. */
export const guardarPtoVtaFacturaSchema = z.object({
  sucursalId: prismaCuidOrUuidSchema,
  grupo: z.enum(GRUPOS_FACTURA_PTO_VTA),
  ptoVtaId: prismaCuidOrUuidSchema.nullable(),
});

export type GuardarPtoVtaFacturaInput = z.infer<typeof guardarPtoVtaFacturaSchema>;
