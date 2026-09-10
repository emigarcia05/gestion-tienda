import { z } from "zod";

export const sucursalPorDefectoSchema = z.enum(["guaymallen", "maipu"]);

export const sucursalPorDefectoOpcionalSchema = z.preprocess(
  (value) => (value === "none" || value === "" || value == null ? null : value),
  sucursalPorDefectoSchema.nullable()
);

export const moduloPermitidoUsuarioSchema = z.enum([
  "gestion-productos",
  "finanzas",
  "marketing",
]);

const idPersonalSchema = z.coerce
  .number({ error: "Ingresá el ID Personal." })
  .int("El ID Personal debe ser un número entero.")
  .positive("El ID Personal debe ser mayor a 0.")
  .max(2_147_483_647, "El ID Personal es demasiado grande.");

const nombrePersonalSchema = z
  .string()
  .trim()
  .min(1, "Ingresá el nombre.")
  .max(200, "El nombre es demasiado largo.");

const modulosPermitidosSchema = z
  .array(moduloPermitidoUsuarioSchema)
  .min(1, "Elegí al menos un módulo.")
  .max(3)
  .refine((mods) => new Set(mods).size === mods.length, {
    message: "Módulos duplicados.",
  });

export const crearUsuarioPersonalSchema = z.object({
  idPersonal: idPersonalSchema,
  nombrePersonal: nombrePersonalSchema,
  sucursalPorDefecto: sucursalPorDefectoOpcionalSchema,
  modulosPermitidos: modulosPermitidosSchema,
  titularFinanciero: z.boolean(),
});

export const actualizarUsuarioPersonalSchema = z.object({
  idPersonal: idPersonalSchema,
  sucursalPorDefecto: sucursalPorDefectoOpcionalSchema,
  modulosPermitidos: modulosPermitidosSchema,
  titularFinanciero: z.boolean(),
});

export type CrearUsuarioPersonalInput = z.infer<typeof crearUsuarioPersonalSchema>;
export type ActualizarUsuarioPersonalInput = z.infer<
  typeof actualizarUsuarioPersonalSchema
>;
