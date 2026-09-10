import { z } from "zod";
import { globalSucursalIdSchema, prismaCuidSchema } from "@/lib/validations/common";

const ptoVentaSchema = z.coerce
  .number({ error: "Ingresá el nro. de punto de venta." })
  .int("El punto de venta debe ser un número entero.")
  .min(1, "El punto de venta debe ser mayor a 0.")
  .max(99_999, "El punto de venta es demasiado grande.");

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
