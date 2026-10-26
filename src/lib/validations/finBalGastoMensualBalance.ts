import { z } from "zod";
import { globalSucursalIdSchema, prismaCuidSchema } from "@/lib/validations/common";

const IVA_POR_GASTO_MAX_KEYS = 500;

/** Periodo calendario para Balance · Gastos y acciones relacionadas (`bal_gasto_mensual`). */
export const mesAnioQuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2026).max(2046),
});
export type MesAnioQuery = z.infer<typeof mesAnioQuerySchema>;

export const cargarImputacionesMesParamsSchema = mesAnioQuerySchema
  .extend({
    /** Decisiones de discrimina IVA para gastos finales con política `PREGUNTA` al cargar el mes. */
    ivaPorGastoFinalId: z.record(prismaCuidSchema, z.boolean()).optional(),
  })
  .superRefine((data, ctx) => {
    const rec = data.ivaPorGastoFinalId;
    if (!rec) return;
    if (Object.keys(rec).length > IVA_POR_GASTO_MAX_KEYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Demasiadas decisiones de IVA en un solo envío.",
        path: ["ivaPorGastoFinalId"],
      });
    }
  });
export type CargarImputacionesMesParams = z.infer<typeof cargarImputacionesMesParamsSchema>;

export const editarMontoFinBalGastoMensualSchema = z.object({
  id: prismaCuidSchema,
  monto: z.coerce.number().int().min(0, "El monto no puede ser negativo."),
});
export type EditarMontoFinBalGastoMensualInput = z.infer<typeof editarMontoFinBalGastoMensualSchema>;

export const registrarPagoFinBalGastoMensualSchema = z.object({
  id: prismaCuidSchema,
  pagado: z.coerce.number().int().min(0, "El importe pagado no puede ser negativo."),
});
export type RegistrarPagoFinBalGastoMensualInput = z.infer<typeof registrarPagoFinBalGastoMensualSchema>;

export const eliminarFinBalGastoMensualSchema = z.object({
  id: prismaCuidSchema,
});
export type EliminarFinBalGastoMensualInput = z.infer<typeof eliminarFinBalGastoMensualSchema>;

export const obtenerMontoMesAnteriorSchema = z.object({
  gastoFinalId: prismaCuidSchema,
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2026).max(2046),
});
export type ObtenerMontoMesAnteriorInput = z.infer<typeof obtenerMontoMesAnteriorSchema>;

export const listarGastosFinalesNoMensualesParamsSchema = mesAnioQuerySchema;
export type ListarGastosFinalesNoMensualesParams = z.infer<
  typeof listarGastosFinalesNoMensualesParamsSchema
>;

export const historicoMontosGastoFinalBalanceSchema = z.object({
  gastoFinalId: prismaCuidSchema,
});
export type HistoricoMontosGastoFinalBalanceInput = z.infer<
  typeof historicoMontosGastoFinalBalanceSchema
>;

const filaConceptoHistorialBalanceEnum = z.enum([
  "ventas",
  "cv",
  "ro",
  "cf",
  "re",
  "mc",
  "pe",
]);

const columnaSerieHistorialFilaSchema = z.discriminatedUnion("ambito", [
  z.object({ ambito: z.literal("global") }),
  z.object({
    ambito: z.literal("sucursal"),
    nombre: z.string().min(1).max(200),
  }),
]);

/** Serie agregada por fila de la grilla (misma lógica que el resumen del balance). */
export const serieHistorialFilaBalanceSchema = z.object({
  filaConceptoId: filaConceptoHistorialBalanceEnum,
  columna: columnaSerieHistorialFilaSchema,
  mesFin: z.coerce.number().int().min(1).max(12),
  anioFin: z.coerce.number().int().min(2026).max(2046),
  cantidadMeses: z.coerce.number().int().min(1).max(60).optional().default(12),
});
export type SerieHistorialFilaBalanceInput = z.infer<typeof serieHistorialFilaBalanceSchema>;

export const crearImputacionGastoUnicoBalanceSchema = z
  .object({
    gastoFinalId: prismaCuidSchema,
    /** Sucursal de imputación (obligatoria en alta desde Balance · Gastos eventual). */
    sucursalId: globalSucursalIdSchema,
    mes: z.coerce.number().int().min(1).max(12),
    anio: z.coerce.number().int().min(2026).max(2046),
    monto: z.coerce.number().int().min(1, "El monto es obligatorio."),
    pagado: z.coerce.number().int().min(0).optional().default(0),
    /** ISO `YYYY-MM-DD`, obligatorio y acotado al período seleccionado. */
    fechaGasto: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de gasto es obligatoria."),
    /**
     * Plazo de pago en días (0..30). Si pagado === monto, puede omitirse
     * porque el gasto se considera cancelado en su totalidad.
     */
    plazoPago: z.coerce.number().int().min(0).max(30).optional(),
    /** Obligatorio si el gasto final tiene `iva = PREGUNTA` (discrimina IVA). */
    discriminaIva: z.boolean().optional(),
  })
  .refine((d) => d.pagado <= d.monto, {
    message: "El pagado no puede superar el monto.",
    path: ["pagado"],
  })
  .refine((d) => (d.pagado >= d.monto ? true : typeof d.plazoPago === "number"), {
    message: "El plazo de pago es obligatorio cuando no está pagado en su totalidad.",
    path: ["plazoPago"],
  })
  .refine((d) => {
    const [y, m, day] = d.fechaGasto.split("-").map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day)) return false;
    if (y !== d.anio || m !== d.mes) return false;
    const maxDia = new Date(y, m, 0).getDate();
    return day >= 1 && day <= maxDia;
  }, {
    message: "La fecha de gasto debe estar dentro del mes y año seleccionados.",
    path: ["fechaGasto"],
  });
export type CrearImputacionGastoUnicoBalanceInput = z.infer<
  typeof crearImputacionGastoUnicoBalanceSchema
>;
