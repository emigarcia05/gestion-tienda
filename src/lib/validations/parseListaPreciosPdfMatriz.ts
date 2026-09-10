import { z } from "zod";

export const PAGINA_INICIO_PDF_MATRIZ_DEFAULT = 9;

export const MAX_PDF_LISTA_PRECIOS_BYTES = 15 * 1024 * 1024;

export const parseListaPreciosPdfMatrizQuerySchema = z.object({
  paginaInicio: z.coerce
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .default(PAGINA_INICIO_PDF_MATRIZ_DEFAULT),
  /** Filas tabulares a omitir al inicio (índice, encabezados previos a la matriz). */
  filasIgnorar: z.coerce.number().int().min(0).max(10_000).optional().default(0),
});

export const filaPdfMatrizNormalizadaSchema = z.object({
  descripcionBase: z.string().min(1).max(512),
  presentacion: z.string().min(1).max(32),
  descripcionExport: z.string().min(1).max(560),
  precio: z.number().positive().max(999_999_999),
});

export type FilaPdfMatrizNormalizadaDto = z.infer<typeof filaPdfMatrizNormalizadaSchema>;
