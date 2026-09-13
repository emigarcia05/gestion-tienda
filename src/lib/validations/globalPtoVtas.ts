import { z } from "zod";
import { normalizarPtoVentaCodigo } from "@/lib/globalPtoVtas";
import { globalSucursalIdSchema, prismaCuidSchema } from "@/lib/validations/common";

const ptoVentaSchema = z
  .union([z.string(), z.number()])
  .transform((raw, ctx) => {
    const codigo = normalizarPtoVentaCodigo(raw);
    if (!codigo) {
      ctx.addIssue({
        code: "custom",
        message: "El punto de venta debe ser un entero entre 1 y 99999.",
      });
      return z.NEVER;
    }
    return codigo;
  });

const nombreTitularSchema = z
  .string()
  .trim()
  .min(1, "Ingresá el titular.")
  .max(200, "El titular es demasiado largo.");

const sucursalIdsSchema = z
  .array(globalSucursalIdSchema)
  .min(1, "Asociá al menos una sucursal.")
  .max(50, "Demasiadas sucursales.")
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Hay sucursales duplicadas.",
  });

export const crearGlobalPtoVtaSchema = z.object({
  ptoVenta: ptoVentaSchema,
  nombreTitular: nombreTitularSchema,
  sucursalIds: sucursalIdsSchema,
});

export const editarGlobalPtoVtaSchema = z.object({
  id: prismaCuidSchema,
  ptoVenta: ptoVentaSchema,
  nombreTitular: nombreTitularSchema,
  sucursalIds: sucursalIdsSchema,
});

export const eliminarGlobalPtoVtaSchema = z.object({
  id: prismaCuidSchema,
});

export type CrearGlobalPtoVtaInput = z.infer<typeof crearGlobalPtoVtaSchema>;
export type EditarGlobalPtoVtaInput = z.infer<typeof editarGlobalPtoVtaSchema>;
export type EliminarGlobalPtoVtaInput = z.infer<typeof eliminarGlobalPtoVtaSchema>;
