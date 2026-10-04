import { z } from "zod";
import { cantidadUnDecimalPositivaSchema } from "@/lib/cantidadUnDecimal";
import {
  globalSucursalIdSchema,
  listaPreciosCodTiendaSchema,
  prismaCuidSchema,
} from "@/lib/validations/common";
import {
  idPersonalSchema,
  sucursalPorDefectoSchema,
} from "@/lib/validations/globalPersonal";

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

export const listarStockMovimientosSucursalSchema = z.object({
  sucursalCodigo: sucursalPorDefectoSchema,
});

export const lineaAjusteControlStockSchema = z.object({
  codItem: listaPreciosCodTiendaSchema,
  cantidad: cantidadUnDecimalPositivaSchema,
  tipoMovimiento: stockMovimientoTipoSchema,
});

export const confirmarAjusteControlStockSchema = z.object({
  sucursalCodigo: sucursalPorDefectoSchema,
  personalId: idPersonalSchema,
  lineas: z.array(lineaAjusteControlStockSchema).min(1).max(2000),
});

export const registrarStockMovimientosSchema = z
  .object({
    comprobanteTipo: stockComprobanteTipoSchema,
    sucursalId: globalSucursalIdSchema,
    sucursalDestinoId: globalSucursalIdSchema.optional(),
    personalId: idPersonalSchema.optional(),
    comprobanteVtaId: prismaCuidSchema.optional(),
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
