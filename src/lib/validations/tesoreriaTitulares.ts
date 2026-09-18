import { z } from "zod";
import { prismaCuidOrUuidSchema } from "@/lib/validations/common";

const nombreCompletoTesoreriaTitularSchema = z
  .string()
  .trim()
  .min(1, "Ingresá un nombre completo.")
  .max(200, "El nombre es demasiado largo.");

export const crearTesoreriaTitularSchema = z.object({
  nombreCompleto: nombreCompletoTesoreriaTitularSchema,
});

export const editarTesoreriaTitularSchema = z.object({
  id: prismaCuidOrUuidSchema,
  nombreCompleto: nombreCompletoTesoreriaTitularSchema,
});

export const eliminarTesoreriaTitularSchema = z.object({
  id: prismaCuidOrUuidSchema,
});

export type CrearTesoreriaTitularInput = z.infer<typeof crearTesoreriaTitularSchema>;
export type EditarTesoreriaTitularInput = z.infer<typeof editarTesoreriaTitularSchema>;
export type EliminarTesoreriaTitularInput = z.infer<typeof eliminarTesoreriaTitularSchema>;
