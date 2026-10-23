import { z } from "zod";
import { periodoCxMercVendSchema } from "@/lib/validations/balCxMercaderia";

export const VISTAS_CX_FIN_COBROS = ["sucursal", "forma", "detalle"] as const;
export type VistaCxFinCobros = (typeof VISTAS_CX_FIN_COBROS)[number];
export const VISTA_CX_FIN_COBROS_DEFAULT: VistaCxFinCobros = "sucursal";

/** Query params de Finanzas · Balance · Cx Fin Cobros. */
export const cxFinCobrosParamsSchema = z.object({
  vista: z.enum(VISTAS_CX_FIN_COBROS).default(VISTA_CX_FIN_COBROS_DEFAULT),
  periodo: periodoCxMercVendSchema,
  pago: z.string().trim().max(64).default(""),
  sucursal: z.string().trim().max(64).default(""),
  q: z.string().trim().max(200).default(""),
  pagina: z.coerce.number().int().min(1).default(1),
});

export type CxFinCobrosParams = z.infer<typeof cxFinCobrosParamsSchema>;
