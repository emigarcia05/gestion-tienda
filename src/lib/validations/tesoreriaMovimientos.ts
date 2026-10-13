import { z } from "zod";
import { globalSucursalIdSchema, prismaIdSchema } from "@/lib/validations/common";
import { idPersonalSchema } from "@/lib/validations/globalPersonal";

const isoYmdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (use YYYY-MM-DD).");

const categoriasConCobro = ["COBRO", "NOTA_CREDITO"] as const;
const categoriasSinTransferencia = [
  "COBRO",
  "NOTA_CREDITO",
  "PAGO_PROVEEDOR",
  "PAGO_GASTOS",
  "AJUSTE_CAJA",
] as const;

export const crearMovimientoTesoreriaSchema = z
  .object({
    cajaId: prismaIdSchema,
    catMovimiento: z.enum(categoriasSinTransferencia),
    tipoMovimiento: z.enum(["INGRESO", "EGRESO"]).optional(),
    monto: z.number().int().positive("El monto tiene que ser mayor a cero."),
    fecha: isoYmdSchema,
    sucursalId: globalSucursalIdSchema,
    /** Usuario de pestaña que registra el movimiento. */
    personalId: idPersonalSchema,
    observacion: z.string().max(2000).default(""),
    pagoId: prismaIdSchema.optional(),
    entidadId: prismaIdSchema.nullable().optional(),
    cuotaId: prismaIdSchema.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const esCobro = (categoriasConCobro as readonly string[]).includes(data.catMovimiento);
    if (esCobro && !data.pagoId) {
      ctx.addIssue({
        code: "custom",
        path: ["pagoId"],
        message: "Seleccioná la forma de pago.",
      });
    }
    if (!esCobro && (data.pagoId || data.entidadId || data.cuotaId)) {
      ctx.addIssue({
        code: "custom",
        path: ["pagoId"],
        message: "Esta categoría no lleva datos de cobro.",
      });
    }
    if (data.catMovimiento === "AJUSTE_CAJA" && !data.tipoMovimiento) {
      ctx.addIssue({
        code: "custom",
        path: ["tipoMovimiento"],
        message: "El ajuste tiene que ser ingreso o egreso.",
      });
    }
  });

export type CrearMovimientoTesoreriaInput = z.infer<typeof crearMovimientoTesoreriaSchema>;

/**
 * Egreso en origen + ingreso en destino. Sucursal del movimiento: la de la caja origen,
 * si no la de destino, si no `sucursalCodigo` del operador (cajas CHEQUE no tienen sucursal).
 */
export const crearTransferenciaEntreCajasSchema = z.object({
  cajaOrigenId: prismaIdSchema,
  cajaDestinoId: prismaIdSchema,
  monto: z.number().int().positive("El monto tiene que ser mayor a cero."),
  /** Por defecto, hoy (AR). */
  fecha: isoYmdSchema.optional(),
  sucursalCodigo: z.enum(["guaymallen", "maipu"]).optional(),
  personalId: idPersonalSchema,
  observacion: z.string().max(2000).default(""),
}).superRefine((data, ctx) => {
  if (data.cajaOrigenId === data.cajaDestinoId) {
    ctx.addIssue({
      code: "custom",
      path: ["cajaDestinoId"],
      message: "La caja destino tiene que ser otra caja.",
    });
  }
});

export type CrearTransferenciaEntreCajasInput = z.infer<
  typeof crearTransferenciaEntreCajasSchema
>;

/**
 * El usuario carga el monto al que quiere dejar la caja.
 * Se genera un AJUSTE_CAJA por la diferencia (ingreso o egreso).
 */
export const ajustarMontoCajaTesoreriaSchema = z.object({
  cajaId: prismaIdSchema,
  /** Saldo deseado de la caja (≥ 0). */
  montoObjetivo: z.number().int().min(0, "El monto no puede ser negativo."),
  /** Usuario de pestaña que registra el ajuste. */
  personalId: idPersonalSchema,
  /**
   * Código de sucursal del operador (`guaymallen` | `maipu`).
   * Obligatorio si la caja no tiene `sucursal_id` (p. ej. CHEQUE).
   */
  sucursalCodigo: z.enum(["guaymallen", "maipu"]).optional(),
  fecha: isoYmdSchema.optional(),
  observacion: z.string().max(2000).default(""),
});

export type AjustarMontoCajaTesoreriaInput = z.infer<
  typeof ajustarMontoCajaTesoreriaSchema
>;

export const eliminarMovimientoTesoreriaSchema = z.object({
  id: prismaIdSchema,
});

export const pendientesAcreditacionCajaSchema = z.object({
  cajaId: prismaIdSchema,
});

export type EliminarMovimientoTesoreriaInput = z.infer<
  typeof eliminarMovimientoTesoreriaSchema
>;
