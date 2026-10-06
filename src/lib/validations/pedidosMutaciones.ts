import { z } from "zod";
import {
  listaPreciosCodExtSchema,
  prismaCuidSchema,
  uuidSchema,
} from "@/lib/validations/common";
import {
  sucursalPedidoCodigoSchema,
  tiposPedidoMercaderiaSchema,
} from "@/lib/validations/pedidosLectura";
import { reposicionFormaPedidoFabricaSchema } from "@/lib/validations/reposicion";

/** FECHA FACTURA de Recepción de Compra (`YYYY-MM-DD`). */
export const fechaFacturaIsoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida. Formato esperado: YYYY-MM-DD");

/** Proveedor del flujo Generar Pedido / envío (`Proveedor.id` = CUID). */
export const proveedorIdPedidoSchema = prismaCuidSchema;

export const listarProveedoresConPedidoActivoSchema = z.object({
  sucursal: sucursalPedidoCodigoSchema,
  tipos: tiposPedidoMercaderiaSchema,
  soloNoFabrica: z.boolean().optional().default(false),
});

export const comprobarItemsParaGenerarPedidoSchema = z.object({
  proveedorId: proveedorIdPedidoSchema,
  sucursal: sucursalPedidoCodigoSchema,
  tipos: tiposPedidoMercaderiaSchema,
});

export const getSobreStockReposicionParaModalSchema = z.object({
  proveedorId: proveedorIdPedidoSchema,
  sucursal: sucursalPedidoCodigoSchema,
  tipos: tiposPedidoMercaderiaSchema,
  forzarIdsReposicionAlProveedor: z.array(uuidSchema).max(5_000).optional(),
});

export const getReposicionProveedorPrioritarioParaModalSchema = z.object({
  proveedorId: proveedorIdPedidoSchema,
  sucursal: sucursalPedidoCodigoSchema,
});

export const itemReposicionProveedorPrioritarioSchema = z.object({
  idItemPedidoEnvio: uuidSchema,
  proveedorPrioritarioId: proveedorIdPedidoSchema,
});

export const generarPdfEnviarPedidoSchema = z.object({
  proveedorId: proveedorIdPedidoSchema,
  sucursal: sucursalPedidoCodigoSchema,
  tipos: tiposPedidoMercaderiaSchema,
  /**
   * Si algún ítem con `cod_tienda` tiene sobrestock en la otra sucursal, no se persiste
   * historial/PDF hasta que `confirmarSobreStock` sea true (segunda llamada tras el modal).
   */
  confirmarSobreStock: z.boolean().optional().default(false),
  ajustesSobreStock: z
    .array(
      z.object({
        idItemPedidoEnvio: uuidSchema,
        cantPedir: z.number().int().min(0).max(1_000_000),
      })
    )
    .max(5_000)
    .optional(),
  /**
   * Reposición: si hay ítems con proveedor prioritario distinto al elegido, no se genera el PDF
   * hasta `confirmarReposicionProveedorPrioritario` (modal previo). Los ítems marcados se incluyen
   * en el mismo PDF del proveedor elegido en el modal Generar Pedido.
   */
  confirmarReposicionProveedorPrioritario: z.boolean().optional().default(false),
  itemsReposicionProveedorPrioritario: z
    .array(itemReposicionProveedorPrioritarioSchema)
    .max(5_000)
    .optional(),
});

export const upsertPedidoUrgenteItemSchema = z.object({
  sucursal: sucursalPedidoCodigoSchema,
  listaPrecioProveedorId: listaPreciosCodExtSchema,
  cant: z.number().int().min(0),
});

/** Pedido A Fáb.: cantidad total a pedir (`cod_ext` de lista del proveedor fábrica). */
export const upsertPedidoAFabricaItemSchema = z.object({
  listaPrecioProveedorId: listaPreciosCodExtSchema,
  cant: z.number().int().min(0),
  formaPedir: reposicionFormaPedidoFabricaSchema.optional(),
});

export const pedidoTintometricoItemSchema = z.object({
  sucursalCodigo: sucursalPedidoCodigoSchema,
  proveedorId: proveedorIdPedidoSchema,
  codTienda: z.string().min(1, "Cod. Tienda requerido.").max(200),
  codTintometrico: z.string().min(1, "Código tintométrico requerido.").max(120),
  cantidad: z.number().int().min(1, "Cant. debe ser mayor a 0."),
  descripcion: z.string().min(1, "Descripción requerida.").max(500),
});

export const upsertPedidoTintometricoItemsSchema = z
  .array(pedidoTintometricoItemSchema)
  .min(1, "No hay ítems para guardar.")
  .max(5_000);

export const deleteTintometricoItemByIdSchema = z.object({
  id: uuidSchema,
});

export const deleteTintometricoItemLegacySchema = z.object({
  sucursalCodigo: sucursalPedidoCodigoSchema,
  proveedorId: proveedorIdPedidoSchema,
  codExt: z.string().min(1, "Cod. ext. requerido.").max(200),
});

export const deleteTintometricoItemSchema = z.union([
  deleteTintometricoItemByIdSchema,
  deleteTintometricoItemLegacySchema,
]);
