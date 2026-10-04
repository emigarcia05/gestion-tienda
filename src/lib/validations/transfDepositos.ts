import { z } from "zod";
import {
  cantidadUnDecimalPositivaSchema,
  esBorradorCantidadUnDecimal,
  formatCantidadInputValor,
} from "@/lib/cantidadUnDecimal";
import {
  globalSucursalIdSchema,
  listaPreciosCodTiendaSchema,
} from "@/lib/validations/common";

const sucursalCodigoSchema = z.enum(["guaymallen", "maipu"]);

export const listarHistorialTransfDepositosProductoSchema = z.object({
  codTienda: listaPreciosCodTiendaSchema,
});

export const registrarTransferenciasDepositosSchema = z
  .object({
    origen: sucursalCodigoSchema,
    destino: sucursalCodigoSchema,
    items: z
      .array(
        z.object({
          codTienda: listaPreciosCodTiendaSchema,
          cantidad: z.coerce.number().pipe(cantidadUnDecimalPositivaSchema),
        })
      )
      .min(1)
      .max(500),
  })
  .refine((v) => v.origen !== v.destino, {
    message: "Origen y destino deben ser distintos.",
    path: ["destino"],
  });

/** Ítem del borrador de grilla (localStorage) hasta Generar Transf. */
export const itemBorradorTransfDepositosSchema = z.object({
  cantidad: z
    .union([z.string(), z.number()])
    .transform((v) =>
      typeof v === "number" ? formatCantidadInputValor(v) : v.trim()
    )
    .refine((s) => s !== "" && esBorradorCantidadUnDecimal(s), "Cantidad inválida."),
  descripcion: z.string().max(500).optional().default(""),
});

export const parSucursalesTransfDepositosSchema = z
  .object({
    sucOrigenId: globalSucursalIdSchema,
    sucDestinoId: globalSucursalIdSchema,
  })
  .refine((v) => v.sucOrigenId !== v.sucDestinoId, {
    message: "Origen y destino deben ser distintos.",
    path: ["sucDestinoId"],
  });
