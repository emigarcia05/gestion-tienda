import { z } from "zod";
import { cantidadUnDecimalPositivaSchema } from "@/lib/cantidadUnDecimal";
import {
  globalSucursalIdSchema,
  listaPreciosCodTiendaSchema,
} from "@/lib/validations/common";

export const stockMovimientoTipoSchema = z.enum(["INGRESO", "EGRESO"]);

export const stockMovimientoCategoriaSchema = z.enum([
  "VENTA",
  "NOTA_CREDITO",
  "AJUSTE_STOCK",
  "TRANSF_DEPO_INGRESO",
  "TRANSF_DEPO_EGRESO",
  "COMPRA",
]);

export const stockComprobanteTipoSchema = z.enum([
  "VENTA",
  "NOTA_CREDITO",
  "COMPRA",
  "AJUSTE_STOCK",
  "TRANSFERENCIA_ENTRE_DEPOSITOS",
]);

export const lineaStockMovimientoSchema = z.object({
  tipoMovimiento: stockMovimientoTipoSchema,
  categoriaMovimiento: stockMovimientoCategoriaSchema,
  codItem: listaPreciosCodTiendaSchema,
  sucursalId: globalSucursalIdSchema,
  cantidad: cantidadUnDecimalPositivaSchema,
});

export const registrarStockMovimientosSchema = z
  .object({
    comprobanteTipo: stockComprobanteTipoSchema,
    sucursalId: globalSucursalIdSchema,
    sucursalDestinoId: globalSucursalIdSchema.optional(),
    lineas: z.array(lineaStockMovimientoSchema).min(1).max(2000),
  })
  .superRefine((v, ctx) => {
    if (v.comprobanteTipo === "TRANSFERENCIA_ENTRE_DEPOSITOS") {
      if (!v.sucursalDestinoId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La transferencia exige sucursal destino.",
          path: ["sucursalDestinoId"],
        });
      } else if (v.sucursalDestinoId === v.sucursalId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Origen y destino deben ser distintos.",
          path: ["sucursalDestinoId"],
        });
      }
    }
  });
