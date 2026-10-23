import { z } from "zod";

/** Cotización USD→ARS única (`cotizacion_usd.valor`). */
export const actualizarCotizacionUsdSchema = z.object({
  valor: z
    .number()
    .positive("La cotización debe ser mayor a 0.")
    .max(1_000_000, "La cotización es demasiado alta."),
});

export type ActualizarCotizacionUsdInput = z.infer<typeof actualizarCotizacionUsdSchema>;
