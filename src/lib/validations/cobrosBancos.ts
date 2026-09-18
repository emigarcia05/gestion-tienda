import { z } from "zod";
import { prismaCuidOrUuidSchema } from "@/lib/validations/common";

const nombreCobrosBancoSchema = z
  .string()
  .trim()
  .min(1, "Ingresá un nombre.")
  .max(200, "El nombre es demasiado largo.");

export const crearCobrosBancoSchema = z.object({
  nombre: nombreCobrosBancoSchema,
});

export const editarCobrosBancoSchema = z.object({
  id: prismaCuidOrUuidSchema,
  nombre: nombreCobrosBancoSchema,
});

export const eliminarCobrosBancoSchema = z.object({
  id: prismaCuidOrUuidSchema,
});

export type CrearCobrosBancoInput = z.infer<typeof crearCobrosBancoSchema>;
export type EditarCobrosBancoInput = z.infer<typeof editarCobrosBancoSchema>;
export type EliminarCobrosBancoInput = z.infer<typeof eliminarCobrosBancoSchema>;
