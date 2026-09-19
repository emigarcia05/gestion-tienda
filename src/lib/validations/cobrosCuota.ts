import { z } from "zod";
import { prismaCuidOrUuidSchema } from "@/lib/validations/common";

const cantidadCuotaSchema = z.coerce
  .number({ error: "Ingresá la cantidad de cuotas." })
  .int("La cantidad debe ser un entero.")
  .min(1, "La cantidad mínima es 1.")
  .max(99, "La cantidad máxima es 99.");

export const crearCobrosCuotaSchema = z.object({
  cantidad: cantidadCuotaSchema,
});

export const editarCobrosCuotaSchema = z.object({
  id: prismaCuidOrUuidSchema,
  cantidad: cantidadCuotaSchema,
});

export const eliminarCobrosCuotaSchema = z.object({
  id: prismaCuidOrUuidSchema,
});

export type CrearCobrosCuotaInput = z.infer<typeof crearCobrosCuotaSchema>;
export type EditarCobrosCuotaInput = z.infer<typeof editarCobrosCuotaSchema>;
export type EliminarCobrosCuotaInput = z.infer<typeof eliminarCobrosCuotaSchema>;
