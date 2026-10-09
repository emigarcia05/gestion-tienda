import { z } from "zod";
import { prismaCuidSchema } from "@/lib/validations/common";

export const sucursalPedidoCodigoSchema = z.enum(["guaymallen", "maipu"]);

export const tipoPedidoMercaderiaSchema = z.enum([
  "URGENTE",
  "TINTOMETRICO",
  "REPOSICION",
  "A FÁBRICA",
]);

export const tiposPedidoMercaderiaSchema = z
  .array(tipoPedidoMercaderiaSchema)
  .min(1, "Al menos un tipo de pedido.");

/** Filtro proveedor en URL de `/ventas/compras/pedir-mercaderia`: vacío = sin filtro, o CUID válido. */
export const proveedorFiltroPedidoSchema = z.union([z.literal(""), prismaCuidSchema]);

export const getPedidoUrgenteDataParamsSchema = z.object({
  sucursal: z.string().max(50).optional(),
  q: z.string().max(500).optional(),
  pagina: z.string().max(20).optional(),
  proveedor: z.string().max(128).optional(),
  /** `tintometrico` | `urgente` | `reposicion` | `reposicion_conf`; otro valor = sin filtro PEDIDO. */
  pedido: z.string().max(32).optional(),
});

export const getEnviarPedidoDataParamsSchema = z.object({
  sucursal: sucursalPedidoCodigoSchema.optional(),
  tipos: z.array(tipoPedidoMercaderiaSchema).max(10).optional(),
});

export const getEnviarPedidoTablaParamsSchema = z.object({
  sucursal: z.union([z.literal(""), sucursalPedidoCodigoSchema]).default(""),
  proveedor: proveedorFiltroPedidoSchema.default(""),
  tipos: z.array(tipoPedidoMercaderiaSchema).max(10).default([]),
  q: z.string().max(500).optional(),
});
