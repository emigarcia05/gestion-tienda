import { z } from "zod";
import { prismaCuidOrUuidSchema, prismaCuidSchema } from "@/lib/validations/common";
import { titularCajaTesoreriaSchema } from "@/lib/cajasTesoreriaTitulares";

export const tipoCajaTesoreriaSchema = z.enum([
  "BANCO",
  "BILLETERA_DIGITAL",
  "CHEQUE",
  "EFECTIVO",
  "TARJETAS_A_COBRAR",
]);

export const tipoValorTesoreriaSchema = z.enum(["DIGITAL", "EFECTIVO", "CHEQUE"]);

export const disponibilidadCajaTesoreriaSchema = z.enum(["INMEDIATA", "DIFERIDO"]);

export const montoCajaTesoreriaSchema = z
  .coerce
  .number()
  .int("El monto debe ser un número entero.")
  .min(-999_999_999, "El monto es demasiado bajo.")
  .max(999_999_999, "El monto es demasiado alto.");

const nombreFinTesoreriaEntidadSchema = z
  .string()
  .trim()
  .min(1, "Ingresá un nombre.")
  .max(200, "El nombre es demasiado largo.");

export const crearFinTesoreriaEntidadSchema = z.object({
  nombre: nombreFinTesoreriaEntidadSchema,
});

export const editarFinTesoreriaEntidadSchema = z.object({
  id: prismaCuidOrUuidSchema,
  nombre: nombreFinTesoreriaEntidadSchema,
});

export const eliminarFinTesoreriaEntidadSchema = z.object({
  id: prismaCuidOrUuidSchema,
});

export const crearCajaTesoreriaSchema = z.object({
  entidadId: prismaCuidOrUuidSchema,
  titular: titularCajaTesoreriaSchema,
  tipoCaja: tipoCajaTesoreriaSchema,
  tipoValor: tipoValorTesoreriaSchema,
  disponibilidad: disponibilidadCajaTesoreriaSchema,
  monto: montoCajaTesoreriaSchema.optional().default(0),
});

export const editarCajaTesoreriaSchema = crearCajaTesoreriaSchema.extend({
  id: prismaCuidSchema,
});

export const eliminarCajaTesoreriaSchema = z.object({
  id: prismaCuidSchema,
});

export type CrearCajaTesoreriaInput = z.infer<typeof crearCajaTesoreriaSchema>;
export type EditarCajaTesoreriaInput = z.infer<typeof editarCajaTesoreriaSchema>;
