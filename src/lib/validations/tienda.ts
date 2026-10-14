import { z } from "zod";

export const getTiendaPageParamsSchema = z.object({
  q: z.string().max(500).optional(),
  rubro: z.string().max(200).optional(),
  subRubro: z.string().max(200).optional(),
  /** Filtro CX COMPRA (Cx Compra): id (CUID) del proveedor elegido en CX PROD. (`costo_compra_cod_ext`). */
  cxCompra: z.string().max(200).optional(),
  marca: z.string().max(200).optional(),
  /** Filtro PROV. VINC.: id (CUID) del proveedor; la action ignora valores que no parsean como CUID (URLs legacy con texto). */
  proveedor: z.string().max(200).optional(),
  /** Query `vinculado=no` | `vinculado=si`: SI = hay CX (`costo_compra_cod_ext`); NO = sin CX. Otro valor se ignora. */
  vinculado: z.string().max(5).optional(),
  pagina: z.string().max(20).optional(),
});
