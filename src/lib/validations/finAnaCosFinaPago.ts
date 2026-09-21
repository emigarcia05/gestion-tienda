import { z } from "zod";
import { prismaCuidOrUuidSchema } from "@/lib/validations/common";

const nombreFinAnaCosFinaPagoSchema = z
  .string()
  .trim()
  .min(1, "Ingresá un nombre.")
  .max(120, "El nombre es demasiado largo.");

<<<<<<< HEAD
const flagsAsociacionPagoSchema = {
  asociadoTerminal: z.boolean(),
  asociadoBanco: z.boolean(),
};

export const crearFinAnaCosFinaPagoSchema = z.object({
  nombre: nombreFinAnaCosFinaPagoSchema,
  ...flagsAsociacionPagoSchema,
=======
const entidadIdsFormaPagoSchema = z
  .array(prismaCuidOrUuidSchema)
  .min(1, "Seleccioná al menos una entidad.")
  .superRefine((ids, ctx) => {
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        message: "Hay entidades duplicadas.",
      });
    }
  });

export const crearFinAnaCosFinaPagoSchema = z.object({
  nombre: nombreFinAnaCosFinaPagoSchema,
  entidadIds: entidadIdsFormaPagoSchema,
  aceptaCuotas: z.boolean().optional().default(false),
>>>>>>> facturacion
});

export const editarFinAnaCosFinaPagoSchema = z.object({
  id: prismaCuidOrUuidSchema,
  nombre: nombreFinAnaCosFinaPagoSchema,
<<<<<<< HEAD
  ...flagsAsociacionPagoSchema,
=======
  entidadIds: entidadIdsFormaPagoSchema,
  aceptaCuotas: z.boolean(),
>>>>>>> facturacion
});

export const eliminarFinAnaCosFinaPagoSchema = z.object({
  id: prismaCuidOrUuidSchema,
});

export type CrearFinAnaCosFinaPagoInput = z.infer<typeof crearFinAnaCosFinaPagoSchema>;
export type EditarFinAnaCosFinaPagoInput = z.infer<typeof editarFinAnaCosFinaPagoSchema>;
export type EliminarFinAnaCosFinaPagoInput = z.infer<typeof eliminarFinAnaCosFinaPagoSchema>;
