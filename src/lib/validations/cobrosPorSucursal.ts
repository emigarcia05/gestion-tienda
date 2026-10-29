import { z } from "zod";
import { prismaCuidOrUuidSchema } from "@/lib/validations/common";

export const crearCobroPorSucursalSchema = z.object({
  pagoId: prismaCuidOrUuidSchema,
  entidadId: prismaCuidOrUuidSchema.nullable().optional(),
  sucursalId: prismaCuidOrUuidSchema,
  cajaDestinoId: prismaCuidOrUuidSchema,
  /** TRUE → Cx Fin con CX TOTAL S/ IVA; FALSE → C/ IVA. */
  generaIvaCredito: z.boolean(),
  /** `cobros_vinc_cajas.seguimiento_fiscal`. */
  seguimientoFiscal: z.boolean().default(false),
  /** `cobros_vinc_cajas.pto_vta_id`: el servicio lo exige con seguimiento fiscal; si no, guarda null. */
  ptoVtaId: prismaCuidOrUuidSchema.nullable().default(null),
  /** De esta fila (`cobros_vinc_cajas.es_cheque`): no se hereda a otras sucursales. */
  esCheque: z.boolean().default(false),
  /** `cobros_vinc_cajas.alias`: el servicio lo exige si la forma tiene `alias`; si no, guarda null. */
  alias: z.string().max(100).default(""),
  observacion: z.string().max(2000).default(""),
});

export type CrearCobroPorSucursalInput = z.infer<typeof crearCobroPorSucursalSchema>;

export const actualizarCobroPorSucursalSchema = z.object({
  id: prismaCuidOrUuidSchema,
  cajaDestinoId: prismaCuidOrUuidSchema,
  generaIvaCredito: z.boolean(),
  seguimientoFiscal: z.boolean().default(false),
  ptoVtaId: prismaCuidOrUuidSchema.nullable().default(null),
  esCheque: z.boolean().default(false),
  alias: z.string().max(100).default(""),
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
