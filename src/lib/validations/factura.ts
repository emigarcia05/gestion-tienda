import { z } from "zod";
import { FACTURA_TIPOS } from "@/lib/factura";

/** Cabecera de Crear factura (UI local; aún sin Action de persistencia). */
export const facturaCrearCabeceraSchema = z.object({
  fechaIso: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
  tipo: z.enum(FACTURA_TIPOS, "Elegí el tipo de factura."),
  cliente: z.string().trim().max(200, "El cliente es demasiado largo."),
  /** Solo lectura en UI; vacío hasta numeración automática. */
  nroComprobante: z.string().trim().max(50).optional(),
});

export type FacturaCrearCabeceraInput = z.infer<typeof facturaCrearCabeceraSchema>;

/**
 * Búsqueda typeahead de productos para Factura · Crear.
 * Tokens separados por espacio: AND de `contains` case-insensitive sobre descripción.
 */
export const buscarProductosFacturaSchema = z.object({
  q: z.string().trim().min(1, "Escribí al menos un término.").max(200),
  take: z.coerce.number().int().min(1).max(10).optional().default(10),
});

export type BuscarProductosFacturaInput = z.infer<typeof buscarProductosFacturaSchema>;
