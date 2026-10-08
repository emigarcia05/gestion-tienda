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
  "area-finanzas",
]);

export const idPersonalSchema = z.coerce
  .number({ error: "Ingresá el ID Personal." })
  .int("El ID Personal debe ser un número entero.")
  .positive("El ID Personal debe ser mayor a 0.")
  .max(2_147_483_647, "El ID Personal es demasiado grande.");

const nombrePersonalSchema = z
  .string()
  .trim()
  .min(1, "Ingresá el nombre.")
  .max(200, "El nombre es demasiado largo.");

const idDuxPersonalOpcionalSchema = z.preprocess((value) => {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}, z.union([
  z
    .string()
    .regex(/^\d+$/, "Ingresá un ID DUX numérico.")
    .max(20, "El ID DUX es demasiado largo."),
  z.null(),
]));

const modulosPermitidosSchema = z
  .array(moduloPermitidoUsuarioSchema)
  .max(4)
  .refine((mods) => new Set(mods).size === mods.length, {
    message: "Módulos duplicados.",
  });

/** SUPER no exige módulos (los tiene todos); sin SUPER, al menos uno. */
function exigirModuloSiNoSuper(
  data: { modulosPermitidos: string[]; superUsuario: boolean },
  ctx: z.RefinementCtx
) {
  if (!data.superUsuario && data.modulosPermitidos.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["modulosPermitidos"],
      message: "Elegí al menos un módulo.",
    });
  }
}

export const crearUsuarioPersonalSchema = z
  .object({
    nombrePersonal: nombrePersonalSchema,
    idDux: idDuxPersonalOpcionalSchema,
    sucursalPorDefecto: sucursalPorDefectoOpcionalSchema,
    modulosPermitidos: modulosPermitidosSchema,
    titularFinanciero: z.boolean(),
    superUsuario: z.boolean(),
  })
  .superRefine(exigirModuloSiNoSuper);

export const actualizarUsuarioPersonalSchema = z
  .object({
    idPersonal: idPersonalSchema,
    idDux: idDuxPersonalOpcionalSchema,
    sucursalPorDefecto: sucursalPorDefectoOpcionalSchema,
    modulosPermitidos: modulosPermitidosSchema,
    titularFinanciero: z.boolean(),
    superUsuario: z.boolean(),
  })
  .superRefine(exigirModuloSiNoSuper);

export const eliminarUsuarioPersonalSchema = z.object({
  idPersonal: idPersonalSchema,
});

export type CrearUsuarioPersonalInput = z.infer<typeof crearUsuarioPersonalSchema>;
export type ActualizarUsuarioPersonalInput = z.infer<
  typeof actualizarUsuarioPersonalSchema
>;
export type EliminarUsuarioPersonalInput = z.infer<
  typeof eliminarUsuarioPersonalSchema
>;
