import { z } from "zod";
import { prismaCuidOrUuidSchema } from "@/lib/validations/common";

/** Texto libre de cuotas (número y/o descripción). Se normaliza a MAYÚSCULAS es-AR. */
const cuotasTextoSchema = z
  .string()
  .trim()
  .min(1, "Ingresá las cuotas.")
  .max(60, "El texto es demasiado largo.")
  .transform((value) => value.replace(/\s+/g, " ").toLocaleUpperCase("es-AR"))
  .refine((value) => value.length > 0, "Ingresá las cuotas.");

export const crearCobrosCuotaSchema = z.object({
  cuotas: cuotasTextoSchema,
});

export const editarCobrosCuotaSchema = z.object({
  id: prismaCuidOrUuidSchema,
  cuotas: cuotasTextoSchema,
});

export const eliminarCobrosCuotaSchema = z.object({
  id: prismaCuidOrUuidSchema,
});

export type CrearCobrosCuotaInput = z.infer<typeof crearCobrosCuotaSchema>;
export type EditarCobrosCuotaInput = z.infer<typeof editarCobrosCuotaSchema>;
export type EliminarCobrosCuotaInput = z.infer<typeof eliminarCobrosCuotaSchema>;
