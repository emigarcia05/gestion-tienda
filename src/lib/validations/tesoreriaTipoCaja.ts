import { z } from "zod";
import { prismaCuidOrUuidSchema } from "@/lib/validations/common";

const TIPOS_CAJA_CODIGO = [
  "BANCO",
  "BILLETERA_DIGITAL",
  "CHEQUE",
  "EFECTIVO",
  "TARJETAS_A_COBRAR",
] as const;

const codigoTipoCajaSchema = z
  .string()
  .trim()
  .transform((v) => v.toLocaleUpperCase("es-AR").replace(/\s+/g, "_"))
  .pipe(z.enum(TIPOS_CAJA_CODIGO, "Código inválido. Debe coincidir con un TipoCajaTesoreria."));

const nombreTipoCajaSchema = z
  .string()
  .trim()
  .min(1, "Ingresá un nombre.")
  .max(120, "El nombre es demasiado largo.");

const ordenTipoCajaSchema = z.coerce
  .number()
  .int("El orden debe ser entero.")
  .min(0, "El orden no puede ser negativo.")
  .max(9999, "El orden es demasiado grande.");

export const crearTesoreriaTipoCajaSchema = z.object({
  codigo: codigoTipoCajaSchema,
  nombre: nombreTipoCajaSchema,
  orden: ordenTipoCajaSchema.optional(),
});

export const editarTesoreriaTipoCajaSchema = z.object({
  id: prismaCuidOrUuidSchema,
  nombre: nombreTipoCajaSchema,
  orden: ordenTipoCajaSchema.optional(),
});

export const eliminarTesoreriaTipoCajaSchema = z.object({
  id: prismaCuidOrUuidSchema,
});

export type CrearTesoreriaTipoCajaInput = z.infer<typeof crearTesoreriaTipoCajaSchema>;
export type EditarTesoreriaTipoCajaInput = z.infer<typeof editarTesoreriaTipoCajaSchema>;
export type EliminarTesoreriaTipoCajaInput = z.infer<typeof eliminarTesoreriaTipoCajaSchema>;
