import { z } from "zod";
import { listaPreciosCodExtSchema, prismaCuidSchema } from "@/lib/validations/common";
import { filaPdfMatrizNormalizadaSchema } from "@/lib/validations/parseListaPreciosPdfMatriz";

const filasPdfSchema = z.array(filaPdfMatrizNormalizadaSchema).min(1).max(50_000);

export const previsualizarImportListaPdfSchema = z.object({
  proveedorId: prismaCuidSchema,
  filas: filasPdfSchema,
});

export const aplicarImportListaPdfSchema = z.object({
  proveedorId: prismaCuidSchema,
  filas: filasPdfSchema,
  vinculos: z
    .array(z.object({ clave: z.string().min(1).max(560), codExt: listaPreciosCodExtSchema }))
    .min(1, "Seleccioná al menos un ítem para actualizar.")
    .max(20_000),
});

export const guardarVinculoListaPdfSchema = z
  .object({
    proveedorId: prismaCuidSchema,
    codExt: listaPreciosCodExtSchema,
    clave: z.string().min(1).max(560).nullable(),
    precio: z.number().positive().max(999_999_999).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.clave != null && v.precio == null) {
      ctx.addIssue({ code: "custom", message: "Falta el precio del ítem del PDF.", path: ["precio"] });
    }
  });
