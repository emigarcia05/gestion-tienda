import { z } from "zod";

export const sucursalPorDefectoSchema = z.enum(["guaymallen", "maipu"]);

export const moduloPermitidoUsuarioSchema = z.enum([
  "gestion-productos",
  "finanzas",
  "marketing",
]);

export const actualizarUsuarioPersonalSchema = z.object({
  idPersonal: z.coerce.number().int().positive(),
  sucursalPorDefecto: sucursalPorDefectoSchema,
  modulosPermitidos: z
    .array(moduloPermitidoUsuarioSchema)
    .min(1, "Elegí al menos un módulo.")
    .max(3)
    .refine((mods) => new Set(mods).size === mods.length, {
      message: "Módulos duplicados.",
    }),
  titularFinanciero: z.boolean(),
});

export type ActualizarUsuarioPersonalInput = z.infer<
  typeof actualizarUsuarioPersonalSchema
>;
