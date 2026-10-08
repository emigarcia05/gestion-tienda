import { z } from "zod";
import { esCobroNotaCreditoNombre } from "@/lib/factura";
import { prismaCuidSchema } from "@/lib/validations/common";
import {
  PLAZOS_PAGO_DIAS_PERMITIDOS,
  PLAZOS_PAGO_DIAS_PERMITIDOS_LABEL,
} from "@/lib/comprobanteCuotasPlazoPago";
import {
  idPersonalSchema,
  sucursalPorDefectoSchema,
} from "@/lib/validations/globalPersonal";

const plazoOpcionalSchema = z
  .union([z.literal(""), z.literal("none"), z.null(), z.coerce.number().int()])
  .transform((v) => {
    if (v === "" || v === "none" || v === null) return null;
    return v;
  })
  .refine(
    (v) =>
      v === null ||
      PLAZOS_PAGO_DIAS_PERMITIDOS.includes(v as (typeof PLAZOS_PAGO_DIAS_PERMITIDOS)[number]),
    { message: `Plazo inválido (${PLAZOS_PAGO_DIAS_PERMITIDOS_LABEL}).` }
  );

const plazoObligatorioSchema = z.coerce
  .number()
  .int()
  .refine(
    (v) => PLAZOS_PAGO_DIAS_PERMITIDOS.includes(v as (typeof PLAZOS_PAGO_DIAS_PERMITIDOS)[number]),
    { message: `El 1.er plazo es obligatorio (${PLAZOS_PAGO_DIAS_PERMITIDOS_LABEL}).` }
  );

function refinePlanCreciente(
  plan: { plazo1: number | null; plazo2: number | null; plazo3: number | null; plazo4: number | null },
  ctx: z.RefinementCtx
) {
  const seq = [plan.plazo1, plan.plazo2, plan.plazo3, plan.plazo4];
  let last: number | null = null;
  for (let i = 0; i < seq.length; i++) {
    const cur = seq[i] ?? null;
    if (cur == null) {
      for (let j = i + 1; j < seq.length; j++) {
        if (seq[j] != null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "No puede haber un plazo posterior si falta uno intermedio.",
            path: [`plazo${j + 1}`],
          });
          return;
        }
      }
      return;
    }
    if (last != null && cur <= last) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Los plazos deben ir en orden creciente.",
        path: [`plazo${i + 1}`],
      });
      return;
    }
    last = cur;
  }
}

export const toggleControladoSchema = z.object({
  id: prismaCuidSchema,
  controlado: z.boolean(),
});

/** Override por factura: `default` = usar plan del proveedor; si no, plan con 1.º obligatorio. */
export const actualizarPlazoPagoComprobanteSchema = z.discriminatedUnion("modo", [
  z.object({
    id: prismaCuidSchema,
    modo: z.literal("default"),
  }),
  z.object({
    id: prismaCuidSchema,
    modo: z.literal("custom"),
    plazo1: plazoObligatorioSchema,
    plazo2: plazoOpcionalSchema,
    plazo3: plazoOpcionalSchema,
    plazo4: plazoOpcionalSchema,
  }).superRefine((data, ctx) => refinePlanCreciente(data, ctx)),
]);

export const actualizarPlazosPagosMercaderiaSchema = z.object({
  items: z
    .array(
      z
        .object({
          id: prismaCuidSchema,
          plazo1: plazoObligatorioSchema,
          plazo2: plazoOpcionalSchema,
          plazo3: plazoOpcionalSchema,
          plazo4: plazoOpcionalSchema,
        })
        .superRefine((data, ctx) => refinePlanCreciente(data, ctx))
    )
    .min(1),
});

export const listarCatalogoPagoProveedorSchema = z.object({
  sucursalCodigo: sucursalPorDefectoSchema,
});

export const registrarPagoCuentaCorrienteProveedoresSchema = z
  .object({
    pagoNombre: z.string().trim().min(1).max(200),
    entidadNombre: z.string().trim().max(200).optional().default(""),
    cuotaEtiqueta: z.string().trim().max(100).nullable(),
    montoCents: z.number().int().positive(),
    personalId: idPersonalSchema,
    sucursalCodigo: sucursalPorDefectoSchema,
  })
  .superRefine((data, ctx) => {
    if (esCobroNotaCreditoNombre(data.pagoNombre)) {
      ctx.addIssue({
        code: "custom",
        path: ["pagoNombre"],
        message: "El pago a proveedores no se registra como nota de crédito.",
      });
    }
  });

export type RegistrarPagoCuentaCorrienteProveedoresInput = z.infer<
  typeof registrarPagoCuentaCorrienteProveedoresSchema
>;
