import { z } from "zod";
import { prismaCuidOrUuidSchema, globalSucursalIdSchema } from "@/lib/validations/common";

export const guardarCobroPorSucursalDestinoSchema = z.object({
  pagoId: prismaCuidOrUuidSchema,
  entidadId: prismaCuidOrUuidSchema,
  sucursalId: globalSucursalIdSchema,
  /** `null` limpia el destino. */
  cajaDestinoId: prismaCuidOrUuidSchema.nullable(),
});

export type GuardarCobroPorSucursalDestinoInput = z.infer<
  typeof guardarCobroPorSucursalDestinoSchema
>;
