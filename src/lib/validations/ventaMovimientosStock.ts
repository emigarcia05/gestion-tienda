import { z } from "zod";
import { listaPreciosCodExtSchema, listaPreciosCodTiendaSchema } from "@/lib/validations/common";
import { sucursalPedidoCodigoSchema } from "@/lib/validations/pedidosLectura";

export const listarProveedoresCompraVentaSchema = z.object({
  codTiendas: z.array(listaPreciosCodTiendaSchema).min(1).max(500),
});

/** Confirmar Compra (modal Movimientos de la venta): suma la cantidad al PEDIDO URGENTE. */
export const confirmarCompraUrgenteVentaSchema = z.object({
  sucursal: sucursalPedidoCodigoSchema,
  codTienda: listaPreciosCodTiendaSchema,
  listaPrecioProveedorId: listaPreciosCodExtSchema,
  cantidad: z.number().positive("La cantidad debe ser mayor a 0.").max(1_000_000),
});
