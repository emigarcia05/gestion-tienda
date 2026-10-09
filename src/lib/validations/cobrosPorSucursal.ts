import { z } from "zod";
import { prismaCuidOrUuidSchema } from "@/lib/validations/common";

export const crearCobroPorSucursalSchema = z.object({
  pagoId: prismaCuidOrUuidSchema,
  entidadId: prismaCuidOrUuidSchema.nullable().optional(),
  sucursalId: prismaCuidOrUuidSchema,
  cajaDestinoId: prismaCuidOrUuidSchema,
  discriminaIva: z.boolean(),
  /** Atributo de la forma de pago (`cobros_forma_pago.es_cheque`): aplica a todas las sucursales. */
  esCheque: z.boolean().default(false),
  observacion: z.string().max(2000).default(""),
});

export type CrearCobroPorSucursalInput = z.infer<typeof crearCobroPorSucursalSchema>;

export const actualizarCobroPorSucursalSchema = z.object({
  id: prismaCuidOrUuidSchema,
  cajaDestinoId: prismaCuidOrUuidSchema,
  discriminaIva: z.boolean(),
  esCheque: z.boolean().default(false),
  observacion: z.string().max(2000).default(""),
});

export type ActualizarCobroPorSucursalInput = z.infer<
  typeof actualizarCobroPorSucursalSchema
>;

export const eliminarCobroPorSucursalSchema = z.object({
  id: prismaCuidOrUuidSchema,
});

export type EliminarCobroPorSucursalInput = z.infer<
  typeof eliminarCobroPorSucursalSchema
>;

export const actualizarFechaAcreditacionVariablePagoSchema = z.object({
  pagoId: prismaCuidOrUuidSchema,
  fechaAcreditacionVariable: z.boolean(),
});

export type ActualizarFechaAcreditacionVariablePagoInput = z.infer<
  typeof actualizarFechaAcreditacionVariablePagoSchema
>;
