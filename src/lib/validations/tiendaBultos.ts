import { z } from "zod";
import { listaPreciosCodTiendaSchema } from "@/lib/validations/common";

/** Persistencia de BULTO en Cx Compra. `null` = vacío (`prod_lista.bulto`). */
export const guardarBultoTiendaSchema = z.object({
  codTienda: listaPreciosCodTiendaSchema,
  bulto: z.number().int().positive().max(1_000_000).nullable(),
});
