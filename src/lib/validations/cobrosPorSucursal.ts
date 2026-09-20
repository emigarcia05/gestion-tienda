import { z } from "zod";
import { prismaCuidOrUuidSchema } from "@/lib/validations/common";

export const crearCobroPorSucursalSchema = z.object({
  pagoId: prismaCuidOrUuidSchema,
  entidadId: prismaCuidOrUuidSchema,
  cajaDestinoId: prismaCuidOrUuidSchema,
  observacion: z.string().max(2000).default(""),
});

export type CrearCobroPorSucursalInput = z.infer<typeof crearCobroPorSucursalSchema>;

export const actualizarCobroPorSucursalSchema = z.object({
  pagoId: prismaCuidOrUuidSchema,
  entidadId: prismaCuidOrUuidSchema,
  cajaDestinoId: prismaCuidOrUuidSchema,
  observacion: z.string().max(2000).default(""),
});

export type ActualizarCobroPorSucursalInput = z.infer<
  typeof actualizarCobroPorSucursalSchema
>;

export const eliminarCobroPorSucursalSchema = z.object({
  pagoId: prismaCuidOrUuidSchema,
  entidadId: prismaCuidOrUuidSchema,
});

export type EliminarCobroPorSucursalInput = z.infer<
  typeof eliminarCobroPorSucursalSchema
>;
