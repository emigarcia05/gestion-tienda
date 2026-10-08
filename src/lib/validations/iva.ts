import { z } from "zod";

/**
 * Valores cerrados del enum PostgreSQL/Prisma `IvaProveedor`.
 * Reutilizado como **política transversal de IVA** en todas las tablas que
 * lo necesiten (hoy `proveedores.iva` y `fin_bal_gasto_final.iva`).
 *
 * Convención: el enum NO se rebautiza en BD aunque ahora aplique fuera del
 * dominio de proveedor — ver docs/BACKEND_GUIDELINES.md §3.1. Documentar acá
 * cualquier nuevo consumidor.
 */
export const IVA_VALUES = ["SIEMPRE", "NUNCA", "PREGUNTA"] as const;
export type IvaValue = (typeof IVA_VALUES)[number];

/**
 * Schema Zod compartido para parsear el valor del Select IVA en formularios.
 * - Acepta `string` opcional (FormData o objeto JSON).
 * - Normaliza con `trim().toUpperCase()`.
 * - Si llega vacío o desconocido, cae a `PREGUNTA` (mismo default que la
 *   columna en BD: política indefinida; nunca produce error de validación).
 *
 * Es **el mismo** schema que antes vivía en `validations/proveedor.ts` como
 * `ivaProveedorFormSchema`; ese archivo lo re-exporta con ese alias para
 * mantener compatibilidad con los call sites históricos (formulario de
 * proveedor, tablas, modales). Para usos nuevos preferir este nombre.
 */
export const ivaPoliticaFormSchema = z
  .string()
  .optional()
  .default("")
  .transform((s) => (s ?? "").trim().toUpperCase())
  .transform((s): IvaValue =>
    s === "SIEMPRE" || s === "NUNCA" || s === "PREGUNTA" ? s : "PREGUNTA",
  );
