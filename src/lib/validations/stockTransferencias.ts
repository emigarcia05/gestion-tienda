import { z } from "zod";
import {
  cantidadUnDecimalNoNegativaSchema,
  cantidadUnDecimalPositivaSchema,
} from "@/lib/cantidadUnDecimal";
import {
  listaPreciosCodTiendaSchema,
  prismaCuidSchema,
} from "@/lib/validations/common";
import {
  idPersonalSchema,
  sucursalPorDefectoSchema,
} from "@/lib/validations/globalPersonal";

const motivoSchema = z
  .string()
  .trim()
  .max(500, "El motivo es demasiado largo.")
  .optional()
  .transform((v) => (v ? v : undefined));

export const crearStockTransferenciaSchema = z
  .object({
    origenCodigo: sucursalPorDefectoSchema,
    destinoCodigo: sucursalPorDefectoSchema,
    personalId: idPersonalSchema,
    items: z
      .array(
        z.object({
          codItem: listaPreciosCodTiendaSchema,
          cantidad: cantidadUnDecimalPositivaSchema,
        })
      )
      .min(1, "No hay ítems para transferir.")
      .max(2000),
  })
  .superRefine((v, ctx) => {
    if (v.origenCodigo === v.destinoCodigo) {
      ctx.addIssue({
        code: "custom",
        message: "Origen y destino deben ser distintos.",
        path: ["destinoCodigo"],
      });
    }
    const codigos = new Set<string>();
    for (const item of v.items) {
      if (codigos.has(item.codItem)) {
        ctx.addIssue({
          code: "custom",
          message: `Ítem repetido: ${item.codItem}.`,
          path: ["items"],
        });
        return;
      }
      codigos.add(item.codItem);
    }
  });

export const aceptarStockTransferenciaSchema = z.object({
  personalId: idPersonalSchema,
  /** Ítems omitidos se confirman con la cantidad enviada. */
  items: z
    .array(
      z.object({
        itemId: prismaCuidSchema,
        cantidadConfirmada: cantidadUnDecimalNoNegativaSchema,
      })
    )
    .max(2000)
    .default([]),
});

export const resolverStockTransferenciaSchema = z.object({
  personalId: idPersonalSchema,
  motivo: motivoSchema,
});

export const notificacionesSucursalSchema = z.object({
  sucursalCodigo: sucursalPorDefectoSchema,
});

export const marcarNotificacionLeidaSchema = z.object({
  personalId: idPersonalSchema,
});

export type CrearStockTransferenciaInput = z.infer<typeof crearStockTransferenciaSchema>;
export type AceptarStockTransferenciaInput = z.infer<typeof aceptarStockTransferenciaSchema>;
export type ResolverStockTransferenciaInput = z.infer<typeof resolverStockTransferenciaSchema>;
