import { z } from "zod";
import { listaPreciosCodTiendaSchema } from "@/lib/validations/common";
import { EST_POR_PROD_CARGA_DESDE } from "@/lib/estPorProdPeriodo";

const VTAS_EN_UN_MAX = 999_999_999.9999;
const MAX_LINEAS_IMPORT = 20_000;

/**
 * ID de sucursal para este módulo: acepta cuid/uuid/`suc_corporativo` y otros ids
 * legados de `sucursales` (no forzar solo cuid/uuid).
 */
export const estPorProdSucursalIdSchema = z
  .string()
  .trim()
  .min(1, "Seleccioná una sucursal.")
  .max(64, "ID de sucursal inválido.");

/** Periodo válido para Carga de Datos (desde Mayo 2026). */
export const estPorProdMesAnioSchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce
    .number()
    .int()
    .min(EST_POR_PROD_CARGA_DESDE.anio)
    .max(2046),
}).superRefine((val, ctx) => {
  const { mes, anio } = EST_POR_PROD_CARGA_DESDE;
  if (val.anio < anio || (val.anio === anio && val.mes < mes)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El periodo debe ser desde Mayo 2026 en adelante.",
      path: ["mes"],
    });
  }
});

const estPorProdLineaImportSchema = z.object({
  codTienda: listaPreciosCodTiendaSchema,
  vtasEnUn: z.coerce
    .number()
    .min(0, "Las ventas en unidades no pueden ser negativas.")
    .max(VTAS_EN_UN_MAX, "El valor de ventas en unidades es demasiado grande."),
});

export const importarEstPorProdSchema = estPorProdMesAnioSchema.extend({
  sucursalId: estPorProdSucursalIdSchema,
  /** Si true, borra todos los registros del periodo+sucursal antes de importar. */
  reemplazarPeriodo: z.boolean().optional().default(false),
  lineas: z
    .array(estPorProdLineaImportSchema)
    .min(1, "La planilla no contiene filas válidas.")
    .max(MAX_LINEAS_IMPORT, `Máximo ${MAX_LINEAS_IMPORT.toLocaleString("es-AR")} filas por importación.`),
});
export type ImportarEstPorProdInput = z.infer<typeof importarEstPorProdSchema>;

export const verificarEstPorProdPeriodoSchema = estPorProdMesAnioSchema.extend({
  sucursalId: estPorProdSucursalIdSchema,
});
export type VerificarEstPorProdPeriodoInput = z.infer<typeof verificarEstPorProdPeriodoSchema>;

export const eliminarEstPorProdPorPeriodoSchema = estPorProdMesAnioSchema.extend({
  sucursalId: estPorProdSucursalIdSchema,
});
export type EliminarEstPorProdPorPeriodoInput = z.infer<
  typeof eliminarEstPorProdPorPeriodoSchema
>;
