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

const cuitSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/\D/g, ""))
  .refine((s) => s === "" || /^\d{11}$/.test(s), {
    message: "El CUIT debe tener exactamente 11 dígitos (sin guiones).",
  })
  .transform((s) => (s === "" ? null : s));

const iiBbSchema = z
  .string()
  .trim()
  .max(64, "IIBB es demasiado largo.")
  .transform((s) => (s === "" ? null : s.toLocaleUpperCase("es-AR")));

const condicionIvaSchema = z.preprocess((value) => {
  if (value === "" || value === "none" || value === "__none__" || value == null) {
    return null;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }
  return value;
}, z
  .number({ error: "Seleccioná una condición IVA válida." })
  .int("Seleccioná una condición IVA válida.")
  .positive("Seleccioná una condición IVA válida.")
  .nullable());

const domicilioComercialSchema = z
  .string()
  .trim()
  .max(500, "El domicilio es demasiado largo.")
  .transform((s) => (s === "" ? null : s.toLocaleUpperCase("es-AR")));

const isoYmdOpcionalSchema = z
  .union([
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (use YYYY-MM-DD).")
      .refine((s) => {
        const [y, m, d] = s.split("-").map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d));
        return (
          dt.getUTCFullYear() === y &&
          dt.getUTCMonth() === m - 1 &&
          dt.getUTCDate() === d
        );
      }, "Fecha de calendario inválida."),
    z.literal(""),
    z.null(),
  ])
  .transform((v) => (v === "" || v == null ? null : v));

const camposFiscalesSchema = {
  cuit: cuitSchema,
  iiBb: iiBbSchema,
  iiBbMultilateral: z.boolean(),
  condicionIva: condicionIvaSchema,
  domicilioComercial: domicilioComercialSchema,
  inicioActividades: isoYmdOpcionalSchema,
} as const;

export const crearGlobalPtoVtaSchema = z.object({
  ptoVenta: ptoVentaSchema,
  nombreTitular: nombreTitularSchema,
  sucursalIds: sucursalIdsSchema,
  ...camposFiscalesSchema,
});

export const editarGlobalPtoVtaSchema = z.object({
  id: prismaCuidSchema,
  ptoVenta: ptoVentaSchema,
  nombreTitular: nombreTitularSchema,
  sucursalIds: sucursalIdsSchema,
  ...camposFiscalesSchema,
});

export const eliminarGlobalPtoVtaSchema = z.object({
  id: prismaCuidSchema,
});

export type CrearGlobalPtoVtaInput = z.infer<typeof crearGlobalPtoVtaSchema>;
export type EditarGlobalPtoVtaInput = z.infer<typeof editarGlobalPtoVtaSchema>;
export type EliminarGlobalPtoVtaInput = z.infer<typeof eliminarGlobalPtoVtaSchema>;
