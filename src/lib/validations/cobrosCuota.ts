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

const parCuotaSchema = z.object({
  pagoId: prismaCuidOrUuidSchema,
  entidadId: prismaCuidOrUuidSchema,
});

const vinculosCuotaSchema = z
  .array(parCuotaSchema)
  .min(1, "Vinculá al menos una forma de pago y una entidad.")
  .superRefine((vinculos, ctx) => {
    const vistos = new Set<string>();
    for (const vinculo of vinculos) {
      const clave = `${vinculo.pagoId}:${vinculo.entidadId}`;
      if (vistos.has(clave)) {
        ctx.addIssue({
          code: "custom",
          message: "Hay un par forma de pago y entidad repetido.",
        });
        return;
      }
      vistos.add(clave);
    }
  });

export const crearCobrosCuotaSchema = z.object({
  cuotas: cuotasTextoSchema,
  vinculos: vinculosCuotaSchema,
});

export const editarCobrosCuotaSchema = z.object({
  id: prismaCuidOrUuidSchema,
  cuotas: cuotasTextoSchema,
  vinculos: vinculosCuotaSchema,
});

export const eliminarCobrosCuotaSchema = z.object({
  id: prismaCuidOrUuidSchema,
});

export type CrearCobrosCuotaInput = z.infer<typeof crearCobrosCuotaSchema>;
export type EditarCobrosCuotaInput = z.infer<typeof editarCobrosCuotaSchema>;
export type EliminarCobrosCuotaInput = z.infer<typeof eliminarCobrosCuotaSchema>;
