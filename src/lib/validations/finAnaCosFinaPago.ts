import { z } from "zod";
import { prismaCuidOrUuidSchema } from "@/lib/validations/common";

const nombreFinAnaCosFinaPagoSchema = z
  .string()
  .trim()
  .min(1, "Ingresá un nombre.")
  .max(120, "El nombre es demasiado largo.");

const entidadIdsFormaPagoSchema = z
  .array(prismaCuidOrUuidSchema)
  .superRefine((ids, ctx) => {
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        message: "Hay entidades duplicadas.",
      });
    }
  });

function refineEntidadObligatoria(
  data: { entidadObligatoria: boolean; entidadIds: string[] },
  ctx: z.RefinementCtx
): void {
  if (data.entidadObligatoria && data.entidadIds.length === 0) {
    ctx.addIssue({
      code: "custom",
      message: "Seleccioná al menos una entidad.",
      path: ["entidadIds"],
    });
  }
}

export const crearFinAnaCosFinaPagoSchema = z
  .object({
    nombre: nombreFinAnaCosFinaPagoSchema,
    entidadIds: entidadIdsFormaPagoSchema,
    aceptaCuotas: z.boolean().optional().default(false),
    entidadObligatoria: z.boolean().optional().default(true),
  })
  .superRefine(refineEntidadObligatoria);

export const editarFinAnaCosFinaPagoSchema = z
  .object({
    id: prismaCuidOrUuidSchema,
    nombre: nombreFinAnaCosFinaPagoSchema,
    entidadIds: entidadIdsFormaPagoSchema,
    aceptaCuotas: z.boolean(),
    entidadObligatoria: z.boolean(),
  })
  .superRefine(refineEntidadObligatoria);

export const eliminarFinAnaCosFinaPagoSchema = z.object({
  id: prismaCuidOrUuidSchema,
});

export type CrearFinAnaCosFinaPagoInput = z.infer<typeof crearFinAnaCosFinaPagoSchema>;
export type EditarFinAnaCosFinaPagoInput = z.infer<typeof editarFinAnaCosFinaPagoSchema>;
export type EliminarFinAnaCosFinaPagoInput = z.infer<typeof eliminarFinAnaCosFinaPagoSchema>;
