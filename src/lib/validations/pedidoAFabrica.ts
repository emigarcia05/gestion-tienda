import { z } from "zod";
import { prismaCuidSchema } from "@/lib/validations/common";

const filtroOpcionalTexto = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

export const productosPedidoAFabricaFiltrosSchema = z.object({
  proveedorId: prismaCuidSchema,
  pagina: z.coerce.number().int().min(1).optional().default(1),
  /** `prod_propios.marca` vía vínculo `cod_tienda`. */
  marca: filtroOpcionalTexto,
  /** `prod_propios.rubro` vía vínculo. */
  rubro: filtroOpcionalTexto,
  /** `prod_propios.sub_rubro` vía vínculo. */
  subRubro: filtroOpcionalTexto,
  /** Buscar en descripcion_tienda (vínculo) o descripcion_proveedor. */
  q: filtroOpcionalTexto,
  /**
   * SI = hay fila `prod_propios` vía `cod_tienda`.
   * NO = sin vínculo. Ausente = sin filtrar.
   */
  prodVinculado: z.enum(["si", "no"]).optional(),
  /**
   * SI = **CANT. PED.** persistida > 0 (`prod_ped_merc` A FÁBRICA).
   * NO = sin cantidad o 0. Ausente = sin filtrar.
   */
  pedido: z.enum(["si", "no"]).optional(),
});

export type ProductosPedidoAFabricaFiltrosInput = z.infer<
  typeof productosPedidoAFabricaFiltrosSchema
>;
