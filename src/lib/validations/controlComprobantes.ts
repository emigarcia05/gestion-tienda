import { z } from "zod";
import { prismaCuidSchema } from "@/lib/validations/common";
import {
  PLAZOS_PAGO_DIAS_PERMITIDOS,
  PLAZOS_PAGO_DIAS_PERMITIDOS_LABEL,
} from "@/lib/comprobanteCuotasPlazoPago";
import { NUMERO_COMPROBANTE_COMPRA_REGEX } from "@/lib/numeroComprobanteCompra";
import { idPersonalSchema } from "@/lib/validations/globalPersonal";

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

/** `fin_compras_comprobante.id_proveedor` = `proveedores.id_proveedor_dux`. */
const idProveedorDuxSchema = z.string().trim().min(1, "Filtrá un proveedor.").max(100);

export const comprobantesPendientesProveedorSchema = z.object({
  idProveedorDux: idProveedorDuxSchema,
});

/** Pago CC desde una caja de tesorería con saldo disponible (egreso inmediato). */
export const registrarPagoCuentaCorrienteProveedoresSchema = z.object({
  idProveedorDux: idProveedorDuxSchema,
  cajaId: prismaCuidSchema,
  montoCents: z.number().int().positive("Ingresá un monto a pagar."),
  personalId: idPersonalSchema,
});

export type RegistrarPagoCuentaCorrienteProveedoresInput = z.infer<
  typeof registrarPagoCuentaCorrienteProveedoresSchema
>;

const isoYmdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (use YYYY-MM-DD).");

/** Pago CC con eCheq propio: imputa al proveedor y se debita de la caja en `fechaPago`. */
export const emitirEcheqPagoProveedorSchema = z
  .object({
    idProveedorDux: idProveedorDuxSchema,
    cajaId: prismaCuidSchema,
    montoCents: z.number().int().positive("Ingresá un monto a pagar."),
    fechaEmision: isoYmdSchema,
    fechaPago: isoYmdSchema,
    numero: z.string().trim().max(50).default(""),
    observacion: z.string().trim().max(2000).default(""),
  })
  .superRefine((data, ctx) => {
    if (data.fechaPago < data.fechaEmision) {
      ctx.addIssue({
        code: "custom",
        path: ["fechaPago"],
        message: "La fecha de pago no puede ser anterior a la de emisión.",
      });
    }
  });

export type EmitirEcheqPagoProveedorInput = z.infer<typeof emitirEcheqPagoProveedorSchema>;

/** NC del proveedor por bonificación comercial: cancela saldo de un comprobante; sin stock ni tesorería. */
export const registrarNotaCreditoBonificacionSchema = z.object({
  idProveedorDux: idProveedorDuxSchema,
  comprobanteId: prismaCuidSchema,
  numero: z
    .string()
    .trim()
    .regex(NUMERO_COMPROBANTE_COMPRA_REGEX, "Ingresá el N° de la nota de crédito (0000-00000000)."),
  fecha: isoYmdSchema,
  montoCents: z.number().int().positive("Ingresá el monto de la nota de crédito."),
});

export type RegistrarNotaCreditoBonificacionInput = z.infer<
  typeof registrarNotaCreditoBonificacionSchema
>;

export const chequeEmitidoIdSchema = z.object({ id: prismaCuidSchema });

export const chequesEmitidosCajaSchema = z.object({ cajaId: prismaCuidSchema });
