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

export const listarPreciosRexParaVincularSchema = z.object({
  proveedorId: prismaCuidSchema,
  codExtLista: listaPreciosCodExtSchema,
  q: z.string().max(500).optional(),
});

export const vincularListaPrecioConPrecioRexSchema = z.object({
  codExtLista: listaPreciosCodExtSchema,
  idPrecioRex: prismaCuidSchema,
});

export type ListarPreciosRexParaVincularInput = z.infer<typeof listarPreciosRexParaVincularSchema>;
export type VincularListaPrecioConPrecioRexInput = z.infer<typeof vincularListaPrecioConPrecioRexSchema>;
