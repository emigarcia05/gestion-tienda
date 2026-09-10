import { z } from "zod";
import { prismaCuidOrUuidSchema, prismaCuidSchema, globalSucursalIdSchema } from "@/lib/validations/common";
import { titularCajaTesoreriaSchema } from "@/lib/cajasTesoreriaTitulares";

export const tipoCajaTesoreriaSchema = z.enum([
  "BANCO",
  "BILLETERA_DIGITAL",
  "CHEQUE",
  "EFECTIVO",
  "TARJETAS_A_COBRAR",
]);

export const tipoValorTesoreriaSchema = z.enum(["DIGITAL", "EFECTIVO", "CHEQUE"]);

export const disponibilidadCajaTesoreriaSchema = z.enum(["INMEDIATA", "DIFERIDO"]);

export const montoCajaTesoreriaSchema = z
  .coerce
  .number()
  .int("El monto debe ser un número entero.")
  .min(-999_999_999, "El monto es demasiado bajo.")
  .max(999_999_999, "El monto es demasiado alto.");

const sucursalCajaTesoreriaSchema = z.preprocess(
  (value) => (value === "none" || value === "" || value == null ? null : value),
  globalSucursalIdSchema.nullable()
);

const nombreFinTesoreriaEntidadSchema = z
  .string()
  .trim()
  .min(1, "Ingresá un nombre.")
  .max(200, "El nombre es demasiado largo.");

export const crearFinTesoreriaEntidadSchema = z.object({
  nombre: nombreFinTesoreriaEntidadSchema,
});

export const editarFinTesoreriaEntidadSchema = z.object({
  id: prismaCuidOrUuidSchema,
  nombre: nombreFinTesoreriaEntidadSchema,
});

export const eliminarFinTesoreriaEntidadSchema = z.object({
  id: prismaCuidOrUuidSchema,
});

function refinSucursalSegunTipoCaja(
  data: { tipoCaja: string; sucursalId: string | null },
  ctx: z.RefinementCtx
): void {
  if (data.tipoCaja === "CHEQUE") {
    if (data.sucursalId != null) {
      ctx.addIssue({
        code: "custom",
        message: "Las cajas CHEQUE no tienen sucursal.",
        path: ["sucursalId"],
      });
    }
    return;
  }
  if (data.sucursalId == null) {
    ctx.addIssue({
      code: "custom",
      message: "Seleccioná una sucursal.",
      path: ["sucursalId"],
    });
  }
}

const cajaTesoreriaCamposSchema = z.object({
  entidadId: prismaCuidOrUuidSchema,
  titular: titularCajaTesoreriaSchema,
  sucursalId: sucursalCajaTesoreriaSchema,
  tipoCaja: tipoCajaTesoreriaSchema,
  tipoValor: tipoValorTesoreriaSchema,
  disponibilidad: disponibilidadCajaTesoreriaSchema,
  monto: montoCajaTesoreriaSchema.optional().default(0),
});

export const crearCajaTesoreriaSchema = cajaTesoreriaCamposSchema.superRefine(
  refinSucursalSegunTipoCaja
);

export const editarCajaTesoreriaSchema = cajaTesoreriaCamposSchema
  .extend({ id: prismaCuidSchema })
  .superRefine(refinSucursalSegunTipoCaja);

export const eliminarCajaTesoreriaSchema = z.object({
  id: prismaCuidSchema,
});

export type CrearCajaTesoreriaInput = z.infer<typeof crearCajaTesoreriaSchema>;
export type EditarCajaTesoreriaInput = z.infer<typeof editarCajaTesoreriaSchema>;
