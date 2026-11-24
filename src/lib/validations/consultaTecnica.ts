import { z } from "zod";
import { prismaCuidSchema } from "@/lib/validations/common";

function campo(max: number, mensaje: string) {
  return z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max, mensaje));
}

export const guardarConsultaTecnicaSchema = z
  .object({
    id: prismaCuidSchema.optional(),
    idMarca: prismaCuidSchema,
    idRubro: prismaCuidSchema,
    uso: campo(400, "El uso es demasiado largo."),
    dilucion: campo(240, "La dilución es demasiado larga."),
    aplicacion: campo(400, "La aplicación es demasiado larga."),
    rendimiento: campo(160, "El rendimiento es demasiado largo."),
    activo: z.boolean(),
  })
  .refine(
    (valor) =>
      valor.uso.length > 0 ||
      valor.dilucion.length > 0 ||
      valor.aplicacion.length > 0 ||
      valor.rendimiento.length > 0,
    { message: "Cargá al menos uso, dilución, aplicación o rendimiento." }
  );

export const eliminarConsultaTecnicaSchema = z.object({
  id: prismaCuidSchema,
});
