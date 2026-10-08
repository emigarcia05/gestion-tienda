import { z } from "zod";
import { prismaCuidSchema } from "@/lib/validations/common";

const nombreEstPorProdColorSchema = z
  .string()
  .trim()
  .min(1, "Ingresá un nombre de color.")
  .max(200, "El nombre es demasiado largo.");

/**
 * PK de `prod_colores`: CUID (altas desde el modal) o id fijo de seed
 * (`est_color_*`, migración `20260804152000_add_est_por_prod_colores`).
 * Todos son editables/eliminables desde **Gestion Colores**.
 */
export const estPorProdColorIdSchema = z.union([
  prismaCuidSchema,
  z
    .string()
    .regex(/^est_color_[a-z0-9_]+$/, "ID inválido."),
]);

export const crearEstPorProdColorSchema = z.object({
  nombre: nombreEstPorProdColorSchema,
});

export const editarEstPorProdColorSchema = z.object({
  id: estPorProdColorIdSchema,
  nombre: nombreEstPorProdColorSchema,
});

export const eliminarEstPorProdColorSchema = z.object({
  id: estPorProdColorIdSchema,
});

export type CrearEstPorProdColorInput = z.infer<typeof crearEstPorProdColorSchema>;
export type EditarEstPorProdColorInput = z.infer<typeof editarEstPorProdColorSchema>;
export type EliminarEstPorProdColorInput = z.infer<typeof eliminarEstPorProdColorSchema>;
