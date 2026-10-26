import { z } from "zod";
import { periodoCxMercVendSchema } from "@/lib/validations/balCxMercaderia";
import { prismaCuidSchema } from "@/lib/validations/common";

/** Query params de Finanzas · Balance · Balance IIBB. */
export const balIibbParamsSchema = z.object({
  periodo: periodoCxMercVendSchema,
});

/** IIBB solo tiene débito: el ajuste suma (+) o resta (−). */
export const SENTIDOS_AJUSTE_BAL_IIBB = ["SUMA", "RESTA"] as const;
export type SentidoAjusteBalIibb = (typeof SENTIDOS_AJUSTE_BAL_IIBB)[number];

/** Botón AJUSTE SALDO: fila AJUSTE en DÉBITO por un monto entero (positivo si SUMA, negativo si RESTA). */
export const crearAjusteBalIibbSchema = z.object({
  fechaIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ingresá la fecha."),
  sentido: z.enum(SENTIDOS_AJUSTE_BAL_IIBB, { message: "Elegí SUMA o RESTA." }),
  monto: z
    .number({ message: "Ingresá el monto." })
    .int("El monto debe ser un número entero.")
    .positive("El monto debe ser mayor a 0.")
    .max(999_999_999_999, "Monto demasiado grande."),
});

export type CrearAjusteBalIibbInput = z.infer<typeof crearAjusteBalIibbSchema>;

export const eliminarAjusteBalIibbSchema = z.object({ id: prismaCuidSchema });
