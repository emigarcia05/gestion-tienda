import { z } from "zod";
import { esCuitValido } from "@/lib/facturaFiscal";

export const consultarConstanciaArcaSchema = z.object({
  cuit: z
    .string()
    .trim()
    .transform((s) => s.replace(/\D/g, ""))
    .refine((s) => esCuitValido(s), "CUIT inválido."),
});

export type ConsultarConstanciaArcaInput = z.infer<typeof consultarConstanciaArcaSchema>;
