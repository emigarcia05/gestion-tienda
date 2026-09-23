import { z } from "zod";
import {
  FACTURA_CLIENTE_CONSUMIDOR_FINAL,
  FACTURA_TIPOS,
  esFacturaTipoNotaCredito,
  mensajeClienteFacturaNoSeleccionado,
} from "@/lib/factura";
import { prismaCuidSchema, prismaIdOptionalNullableSchema } from "@/lib/validations/common";
import {
  idPersonalSchema,
  sucursalPorDefectoSchema,
} from "@/lib/validations/globalPersonal";

const isoYmdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.")
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, "Fecha de calendario inválida.");

/** Cabecera de Crear factura (UI). */
export const facturaCrearCabeceraSchema = z.object({
  fechaIso: isoYmdSchema,
  tipo: z.enum(FACTURA_TIPOS, "Elegí el tipo de factura."),
    cliente: z
      .string()
      .trim()
      .max(200, "El cliente es demasiado largo.")
      .transform((s) => s || FACTURA_CLIENTE_CONSUMIDOR_FINAL),
  /** Solo lectura en UI; vacío hasta numeración automática. */
  nroComprobante: z.string().trim().max(50).optional(),
});

export type FacturaCrearCabeceraInput = z.infer<typeof facturaCrearCabeceraSchema>;

/**
 * Búsqueda typeahead de productos para Factura · Crear.
 * Tokens separados por espacio: AND de `contains` case-insensitive sobre descripción.
 */
export const buscarProductosFacturaSchema = z.object({
  q: z
    .string()
    .trim()
    .min(3, "Escribí al menos 3 letras.")
    .max(200),
  take: z.coerce.number().int().min(1).max(10).optional().default(10),
  /** Sucursal del usuario (columna Stock del typeahead). */
  sucursalCodigo: sucursalPorDefectoSchema.optional(),
});

export type BuscarProductosFacturaInput = z.infer<typeof buscarProductosFacturaSchema>;

/**
 * Búsqueda typeahead de clientes para Factura · Crear.
 * Tokens separados por espacio: AND sobre nombre / CEL / CUIT / `SIN NOMBRE`.
 */
export const buscarClientesFacturaSchema = z.object({
  q: z
    .string()
    .trim()
    .min(3, "Escribí al menos 3 caracteres.")
    .max(200),
  take: z.coerce.number().int().min(1).max(10).optional().default(10),
});

export type BuscarClientesFacturaInput = z.infer<typeof buscarClientesFacturaSchema>;

const facturaLineaEmitirSchema = z.object({
  codTienda: z.string().trim().min(1, "Falta el código de tienda.").max(200),
  descripcion: z.string().trim().min(1, "Falta la descripción.").max(500),
  cantidad: z.number().positive("La cantidad debe ser mayor a 0.").max(1_000_000),
  pxLista: z.number().nonnegative("El precio no puede ser negativo.").max(1_000_000_000),
  descuentoPct: z.number().min(0).max(100),
  comentario: z.string().trim().max(2000).optional().default(""),
  alicuotaIva: z.number().min(0).max(27).optional(),
});

const descuentoEmitirSchema = z
  .object({
    fuente: z.enum(["porcentaje", "total_fac"]),
    porcentaje: z.number().min(0).max(100),
    totalFacObjetivo: z.number().nonnegative().nullable(),
  })
  .nullable();

const cobroFacturaEmitirSchema = z.object({
  pagoNombre: z.string().trim().min(1).max(200),
  entidadNombre: z.string().trim().max(200).optional().default(""),
  cuotaEtiqueta: z.string().trim().max(100).nullable(),
  montoCents: z.number().int().positive(),
});

export type CobroFacturaEmitirInput = z.infer<typeof cobroFacturaEmitirSchema>;

export const emitirFacturaComprobanteSchema = z
  .object({
    fechaIso: isoYmdSchema,
    tipo: z.enum(FACTURA_TIPOS, "Elegí el tipo de factura."),
    cliente: z
      .string()
      .trim()
      .max(200, "El cliente es demasiado largo.")
      .transform((s) => s || FACTURA_CLIENTE_CONSUMIDOR_FINAL),
    /** FK opcional a `clientes`. Null = Consumidor Final. */
    clienteId: prismaIdOptionalNullableSchema,
    /** FK opcional a `clientes_proyectos`. Null si no hay proyecto. */
    proyectoId: prismaIdOptionalNullableSchema,
    comentarios: z.string().trim().max(5000).optional().default(""),
    ptoVtaId: prismaCuidSchema,
    personalId: idPersonalSchema,
    /** Solo fallback interno (NC desde original sin cliente). La UI no los envía. */
    receptorDocTipo: z.number().int().positive().optional(),
    receptorDocNro: z.string().trim().max(20).optional(),
    receptorCondicionIva: z.number().int().positive().optional(),
    cbteAsocId: prismaCuidSchema.optional(),
    lineas: z.array(facturaLineaEmitirSchema).min(1, "Agregá al menos un ítem.").max(200),
    descuento: descuentoEmitirSchema.optional().default(null),
    cobros: z.array(cobroFacturaEmitirSchema).max(50).optional().default([]),
  })
  .superRefine((data, ctx) => {
    const clienteMsg = mensajeClienteFacturaNoSeleccionado(
      data.cliente,
      data.clienteId
    );
    if (clienteMsg) {
      ctx.addIssue({
        code: "custom",
        path: ["clienteId"],
        message: clienteMsg,
      });
    }
    if (data.proyectoId && !data.clienteId) {
      ctx.addIssue({
        code: "custom",
        path: ["proyectoId"],
        message: "El proyecto requiere un cliente de catálogo.",
      });
    }
    if (esFacturaTipoNotaCredito(data.tipo) && !data.cbteAsocId) {
      ctx.addIssue({
        code: "custom",
        path: ["cbteAsocId"],
        message: "La nota de crédito requiere el comprobante original autorizado.",
      });
    }
  });

export type EmitirFacturaComprobanteInput = z.infer<typeof emitirFacturaComprobanteSchema>;

export const facturaComprobanteIdSchema = z.object({
  id: prismaCuidSchema,
});

export type FacturaComprobanteIdInput = z.infer<typeof facturaComprobanteIdSchema>;

export const emitirNotaCreditoFacturaSchema = z.object({
  id: prismaCuidSchema,
  personalId: idPersonalSchema,
});

export type EmitirNotaCreditoFacturaInput = z.infer<
  typeof emitirNotaCreditoFacturaSchema
>;

const cobroFacturaPersistirSchema = cobroFacturaEmitirSchema.extend({
  esCuentaCorriente: z.boolean(),
  plazoDias: z.union([
    z.null(),
    z.coerce.number().int().min(1).max(365),
  ]),
});

export const guardarDiasVencimientoFacturaSchema = z.object({
  id: prismaCuidSchema,
  diasVencimiento: z.union([
    z.null(),
    z.coerce
      .number()
      .int()
      .min(1, "Ingresá los días de vencimiento.")
      .max(365, "Máximo 365 días."),
  ]),
  cobros: z.array(cobroFacturaPersistirSchema).max(50).optional().default([]),
});

export type GuardarDiasVencimientoFacturaInput = z.infer<
  typeof guardarDiasVencimientoFacturaSchema
>;
