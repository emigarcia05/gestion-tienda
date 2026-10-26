import { z } from "zod";
import { periodoCxMercVendSchema } from "@/lib/validations/balCxMercaderia";
import { prismaCuidSchema } from "@/lib/validations/common";

/** Query params de Finanzas · Balance · Balance IVA. */
export const balIvaParamsSchema = z.object({
  periodo: periodoCxMercVendSchema,
});

export type BalIvaParams = z.infer<typeof balIvaParamsSchema>;

export const COLUMNAS_AJUSTE_BAL_IVA = ["DEBITO", "CREDITO"] as const;
export type ColumnaAjusteBalIva = (typeof COLUMNAS_AJUSTE_BAL_IVA)[number];

/** Botón AJUSTE SALDO: fila AJUSTE en DÉBITO o CRÉDITO por un monto entero positivo. */
export const crearAjusteBalIvaSchema = z.object({
  fechaIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ingresá la fecha."),
  columna: z.enum(COLUMNAS_AJUSTE_BAL_IVA, { message: "Elegí DÉBITO o CRÉDITO." }),
  monto: z
    .number({ message: "Ingresá el monto." })
    .int("El monto debe ser un número entero.")
    .positive("El monto debe ser mayor a 0.")
    .max(999_999_999_999, "Monto demasiado grande."),
});

export type CrearAjusteBalIvaInput = z.infer<typeof crearAjusteBalIvaSchema>;

export const eliminarAjusteBalIvaSchema = z.object({ id: prismaCuidSchema });
