import { z } from "zod";
import {
  globalSucursalIdSchema,
  prismaCuidOrUuidSchema,
  prismaCuidSchema,
} from "@/lib/validations/common";
import { ivaPoliticaFormSchema } from "@/lib/validations/iva";

/**
 * Validaciones para el catálogo jerárquico Finanzas → Balance → Gastos:
 * fin_bal_gasto_tipo (1) ─→ fin_bal_gasto_rubro (N) ─→ fin_bal_cat_gasto (N) + fin_bal_gasto_final (gasto + proveedor + sucursal opcional si gasto eventual; la terna puede repetirse entre filas).
 *
 * Convención de normalización: todos los `nombre` se normalizan con `trim + toUpperCase`,
 * consistente con tesoreria_cajas y demás catálogos financieros.
 */

const nombreCatalogoSchema = z
  .string()
  .trim()
  .min(1, "El nombre es obligatorio.")
  .max(120, "El nombre es demasiado largo.")
  .transform((value) => value.toUpperCase());

// ─── Tipo (raíz) ──────────────────────────────────────────────────────────

export const crearFinBalGastoTipoSchema = z.object({
  nombre: nombreCatalogoSchema,
});
export type CrearFinBalGastoTipoInput = z.infer<typeof crearFinBalGastoTipoSchema>;

export const editarFinBalGastoTipoSchema = z.object({
  id: prismaCuidSchema,
  nombre: nombreCatalogoSchema,
});
export type EditarFinBalGastoTipoInput = z.infer<typeof editarFinBalGastoTipoSchema>;

export const eliminarFinBalGastoTipoSchema = z.object({
  id: prismaCuidSchema,
});
export type EliminarFinBalGastoTipoInput = z.infer<typeof eliminarFinBalGastoTipoSchema>;

// ─── Rubro (intermedio) ───────────────────────────────────────────────────

export const crearFinBalGastoRubroSchema = z.object({
  nombre: nombreCatalogoSchema,
  tipoId: prismaCuidSchema,
});
export type CrearFinBalGastoRubroInput = z.infer<typeof crearFinBalGastoRubroSchema>;

export const editarFinBalGastoRubroSchema = z.object({
  id: prismaCuidSchema,
  nombre: nombreCatalogoSchema,
  tipoId: prismaCuidSchema,
});
export type EditarFinBalGastoRubroInput = z.infer<typeof editarFinBalGastoRubroSchema>;

export const eliminarFinBalGastoRubroSchema = z.object({
  id: prismaCuidSchema,
});
export type EliminarFinBalGastoRubroInput = z.infer<typeof eliminarFinBalGastoRubroSchema>;

// ─── Gasto (hoja) ─────────────────────────────────────────────────────────

export const crearFinBalGastoSchema = z.object({
  nombre: nombreCatalogoSchema,
  rubroId: prismaCuidSchema,
});
export type CrearFinBalGastoInput = z.infer<typeof crearFinBalGastoSchema>;

export const editarFinBalGastoSchema = z.object({
  id: prismaCuidSchema,
  nombre: nombreCatalogoSchema,
  rubroId: prismaCuidSchema,
});
export type EditarFinBalGastoInput = z.infer<typeof editarFinBalGastoSchema>;

export const eliminarFinBalGastoSchema = z.object({
  id: prismaCuidSchema,
});
export type EliminarFinBalGastoInput = z.infer<typeof eliminarFinBalGastoSchema>;

// ─── Gasto final (`fin_bal_gasto_final`: gasto + proveedor + sucursal según mensual) ─

/** Entrada HTTP: vacío / null se normaliza según `gasto_mensual` en el schema refinado. */
const gastoFinalSucursalEntradaSchema = z
  .union([globalSucursalIdSchema, z.literal(""), z.null()])
  .optional();

const diaDevengadoSchema = z.coerce
  .number()
  .int("El día devengado debe ser un número entero.")
  .min(1, "El día devengado debe ser entre 1 y 28.")
  .max(28, "El día devengado debe ser entre 1 y 28.");

const vencimientoSchema = z.coerce
  .number()
  .int("El plazo de pago debe ser un número entero de días.")
  .min(0, "El plazo de pago debe ser entre 0 y 30 días.")
  .max(30, "El plazo de pago debe ser entre 0 y 30 días.");

const comentariosFinBalGastoFinalSchema = z
  .string()
  .max(10000, "Los comentarios no pueden superar 10000 caracteres.")
  .optional()
  .nullable()
  .transform((v) => {
    if (v == null) return null;
    const t = v.trim().toLocaleUpperCase("es-AR");
    return t === "" ? null : t;
  });

const crearFinBalGastoFinalSchemaBase = z.object({
  gastoId: prismaCuidOrUuidSchema,
  proveedorId: prismaCuidOrUuidSchema,
  sucursalId: gastoFinalSucursalEntradaSchema,
  gastoMensual: z.boolean(),
  diaDevengado: diaDevengadoSchema.nullable(),
  vencimiento: vencimientoSchema.nullable(),
  comentarios: comentariosFinBalGastoFinalSchema,
  /** Política IVA del gasto final (default `PREGUNTA`). Reusa enum `IvaProveedor`. */
  iva: ivaPoliticaFormSchema,
}).superRefine((data, ctx) => {
  if (data.gastoMensual) {
    if (data.diaDevengado == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["diaDevengado"],
        message: "El día devengado es obligatorio para gasto mensual.",
      });
    }
    if (data.vencimiento == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vencimiento"],
        message: "El plazo de pago es obligatorio para gasto mensual.",
      });
    }
    return;
  }
  if (data.diaDevengado != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["diaDevengado"],
      message: "En gasto eventual, el día devengado debe quedar vacío.",
    });
  }
  if (data.vencimiento != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["vencimiento"],
      message: "En gasto eventual, el plazo de pago debe quedar vacío.",
    });
  }
});

export const crearFinBalGastoFinalSchema = crearFinBalGastoFinalSchemaBase
  .superRefine((data, ctx) => {
    const vacio = data.sucursalId == null || data.sucursalId === "";
    if (data.gastoMensual && vacio) {
      ctx.addIssue({
        code: "custom",
        message: "La sucursal es obligatoria cuando el gasto es mensual.",
        path: ["sucursalId"],
      });
    }
    if (!data.gastoMensual && !vacio) {
      ctx.addIssue({
        code: "custom",
        message: "Para gasto eventual no debe indicarse sucursal.",
        path: ["sucursalId"],
      });
    }
  })
  .transform((data) => ({
    gastoId: data.gastoId,
    proveedorId: data.proveedorId,
    gastoMensual: data.gastoMensual,
    diaDevengado: data.diaDevengado,
    vencimiento: data.vencimiento,
    comentarios: data.comentarios,
    sucursalId: data.gastoMensual ? (data.sucursalId as string) : null,
    iva: data.iva,
  }));
export type CrearFinBalGastoFinalInput = z.output<typeof crearFinBalGastoFinalSchema>;

const editarFinBalGastoFinalSchemaBase = z.object({
  id: prismaCuidSchema,
  proveedorId: prismaCuidOrUuidSchema,
  sucursalId: gastoFinalSucursalEntradaSchema,
  gastoMensual: z.boolean(),
  diaDevengado: diaDevengadoSchema.nullable(),
  vencimiento: vencimientoSchema.nullable(),
  comentarios: comentariosFinBalGastoFinalSchema,
  /** Política IVA del gasto final (default `PREGUNTA`). Reusa enum `IvaProveedor`. */
  iva: ivaPoliticaFormSchema,
}).superRefine((data, ctx) => {
  if (data.gastoMensual) {
    if (data.diaDevengado == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["diaDevengado"],
        message: "El día devengado es obligatorio para gasto mensual.",
      });
    }
    if (data.vencimiento == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vencimiento"],
        message: "El plazo de pago es obligatorio para gasto mensual.",
      });
    }
    return;
  }
  if (data.diaDevengado != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["diaDevengado"],
      message: "En gasto eventual, el día devengado debe quedar vacío.",
    });
  }
  if (data.vencimiento != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["vencimiento"],
      message: "En gasto eventual, el plazo de pago debe quedar vacío.",
    });
  }
});

export const editarFinBalGastoFinalSchema = editarFinBalGastoFinalSchemaBase
  .superRefine((data, ctx) => {
    const vacio = data.sucursalId == null || data.sucursalId === "";
    if (data.gastoMensual && vacio) {
      ctx.addIssue({
        code: "custom",
        message: "La sucursal es obligatoria cuando el gasto es mensual.",
        path: ["sucursalId"],
      });
    }
    if (!data.gastoMensual && !vacio) {
      ctx.addIssue({
        code: "custom",
        message: "Para gasto eventual no debe indicarse sucursal.",
        path: ["sucursalId"],
      });
    }
  })
  .transform((data) => ({
    id: data.id,
    proveedorId: data.proveedorId,
    gastoMensual: data.gastoMensual,
    diaDevengado: data.diaDevengado,
    vencimiento: data.vencimiento,
    comentarios: data.comentarios,
    sucursalId: data.gastoMensual ? (data.sucursalId as string) : null,
    iva: data.iva,
  }));
export type EditarFinBalGastoFinalInput = z.output<typeof editarFinBalGastoFinalSchema>;

export const eliminarFinBalGastoFinalSchema = z.object({
  id: prismaCuidSchema,
});
export type EliminarFinBalGastoFinalInput = z.infer<typeof eliminarFinBalGastoFinalSchema>;
