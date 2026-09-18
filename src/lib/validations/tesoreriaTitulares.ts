import { z } from "zod";
import { prismaCuidOrUuidSchema } from "@/lib/validations/common";

const nombreTesoreriaTitularSchema = z
  .string()
  .trim()
  .min(1, "Ingresá un nombre.")
  .max(200, "El nombre es demasiado largo.");

export const crearTesoreriaTitularSchema = z.object({
  nombre: nombreTesoreriaTitularSchema,
});

export const editarTesoreriaTitularSchema = z.object({
  id: prismaCuidOrUuidSchema,
  nombre: nombreTesoreriaTitularSchema,
});

export const eliminarTesoreriaTitularSchema = z.object({
  id: prismaCuidOrUuidSchema,
});

export type CrearTesoreriaTitularInput = z.infer<typeof crearTesoreriaTitularSchema>;
export type EditarTesoreriaTitularInput = z.infer<typeof editarTesoreriaTitularSchema>;
export type EliminarTesoreriaTitularInput = z.infer<typeof eliminarTesoreriaTitularSchema>;
