import { z } from "zod";
import { prismaCuidSchema } from "@/lib/validations/common";

/**
 * Validación de filas de `prod_presentaciones`.
 * `texto` se deriva en el servicio (presentacion_numerica + unidad medida).
 * Conversión opcional: si hay unidad o valor, ambos; destino ≠ medida y `suma = true` (servicio).
 */

/** Acepta número o string con coma/punto decimal (p. ej. «0,4» / «0.4»). */
function parseNumeroPresentacion(value: unknown): unknown {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return value;
  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
  if (!normalized) return value;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : value;
}

const numeroPresentacionSchema = z.preprocess(
  parseNumeroPresentacion,
  z
    .number({ error: "Ingresá un número válido." })
    .finite("El valor debe ser un número válido.")
    .min(0, "El valor no puede ser negativo.")
    .max(100_000_000, "El valor es demasiado grande.")
);

/** CUID, vacío o null → null (sin conversión). */
const conversionUnidadIdOpcionalSchema = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.union([prismaCuidSchema, z.null()])
);

/** Número, vacío o null → null (sin conversión). */
const conversionPresentacionOpcionalSchema = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "string" && !v.trim()) return null;
  return parseNumeroPresentacion(v);
}, z.union([
  z.null(),
  z
    .number({ error: "Ingresá un número válido." })
    .finite("El valor debe ser un número válido.")
    .min(0, "El valor no puede ser negativo.")
    .max(100_000_000, "El valor es demasiado grande."),
]));

const presentacionCamposBaseSchema = z.object({
  unidadMedidaId: prismaCuidSchema,
  presentacionNumerica: numeroPresentacionSchema,
  conversionAUnidadId: conversionUnidadIdOpcionalSchema,
  conversionAUnidadPresentacion: conversionPresentacionOpcionalSchema,
});

type PresentacionCamposBase = z.infer<typeof presentacionCamposBaseSchema>;

function refineConversionOpcional(
  v: PresentacionCamposBase,
  ctx: z.RefinementCtx
) {
  const tieneUnidad = v.conversionAUnidadId != null;
  const tieneValor = v.conversionAUnidadPresentacion != null;
  if (tieneUnidad !== tieneValor) {
    ctx.addIssue({
      code: "custom",
      message:
        "Completá convertir a un. y convertir a presentacion., o dejá ambos vacíos.",
      path: tieneUnidad
        ? ["conversionAUnidadPresentacion"]
        : ["conversionAUnidadId"],
    });
  }
  if (
    tieneUnidad &&
    v.conversionAUnidadId != null &&
    v.conversionAUnidadId === v.unidadMedidaId
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Convertir a un. debe ser distinta de la unidad medida.",
      path: ["conversionAUnidadId"],
    });
  }
}

export const crearEstPorProdPresentacionSchema =
  presentacionCamposBaseSchema.superRefine(refineConversionOpcional);

export const editarEstPorProdPresentacionSchema = presentacionCamposBaseSchema
  .extend({ id: prismaCuidSchema })
  .superRefine(refineConversionOpcional);

export const eliminarEstPorProdPresentacionSchema = z.object({
  id: prismaCuidSchema,
});

export type CrearEstPorProdPresentacionInput = z.infer<
  typeof crearEstPorProdPresentacionSchema
>;
export type EditarEstPorProdPresentacionInput = z.infer<
  typeof editarEstPorProdPresentacionSchema
>;
export type EliminarEstPorProdPresentacionInput = z.infer<
  typeof eliminarEstPorProdPresentacionSchema
>;
