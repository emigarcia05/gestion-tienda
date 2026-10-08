import { z } from "zod";
import { idPersonalSchema } from "@/lib/validations/globalPersonal";

export const CONTRASENA_MIN = 4;
export const CONTRASENA_MAX = 128;

const contrasenaSchema = z
  .string()
  .min(CONTRASENA_MIN, `La contraseña debe tener al menos ${CONTRASENA_MIN} caracteres.`)
  .max(CONTRASENA_MAX, "La contraseña es demasiado larga.");

export const ingresarUsuarioSchema = z.object({
  idPersonal: idPersonalSchema,
  contrasena: z.string().min(1, "Ingresá la contraseña.").max(CONTRASENA_MAX),
});

export const crearContrasenaUsuarioSchema = z
  .object({
    idPersonal: idPersonalSchema,
    contrasena: contrasenaSchema,
    confirmacion: z.string(),
  })
  .refine((v) => v.contrasena === v.confirmacion, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmacion"],
  });

export const restablecerContrasenaUsuarioSchema = z.object({
  idPersonal: idPersonalSchema,
});

export type IngresarUsuarioInput = z.infer<typeof ingresarUsuarioSchema>;
export type CrearContrasenaUsuarioInput = z.infer<typeof crearContrasenaUsuarioSchema>;
export type RestablecerContrasenaUsuarioInput = z.infer<
  typeof restablecerContrasenaUsuarioSchema
>;
