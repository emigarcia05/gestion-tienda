import { z } from "zod";
import { COD_COLOR_MAX_LEN } from "@/lib/codColorTintometrico";
import { listaPreciosCodExtSchema, listaPreciosCodTiendaSchema } from "@/lib/validations/common";
import { sucursalPedidoCodigoSchema } from "@/lib/validations/pedidosLectura";
import { proveedorIdPedidoSchema } from "@/lib/validations/pedidosMutaciones";

const cantidadCompraSchema = z.number().positive("La cantidad debe ser mayor a 0.").max(1_000_000);

export const listarProveedoresCompraVentaSchema = z.object({
  codTiendas: z.array(listaPreciosCodTiendaSchema).min(1).max(500),
});

/** Confirmar Compra (modal Movimientos de la venta): suma la cantidad al PEDIDO URGENTE. */
export const confirmarCompraUrgenteVentaSchema = z.object({
  sucursal: sucursalPedidoCodigoSchema,
  codTienda: listaPreciosCodTiendaSchema,
  listaPrecioProveedorId: listaPreciosCodExtSchema,
  cantidad: cantidadCompraSchema,
});

/** Confirmar Compra de un ítem rubro Tintométrico: suma cada COD. COLOR al pedido TINTOMETRICO. */
export const confirmarCompraTintometricoVentaSchema = z.object({
  sucursal: sucursalPedidoCodigoSchema,
  codTienda: listaPreciosCodTiendaSchema,
  proveedorId: proveedorIdPedidoSchema,
  colores: z
    .array(
      z.object({
        codColor: z.string().trim().min(1).max(COD_COLOR_MAX_LEN),
        codColorIdMarca: z.string().trim().max(64).nullable(),
        cantidad: cantidadCompraSchema,
      })
    )
    .min(1, "El ítem no tiene COD. COLOR; pedilo desde Pedir Mercadería → Agregar Tintométrico.")
    .max(200),
});
