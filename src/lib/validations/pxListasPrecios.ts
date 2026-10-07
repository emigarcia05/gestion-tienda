import { z } from "zod";
import { PX_LISTAS_COMP_REF_NINGUNO } from "@/lib/pxListasCompetenciaRef";
import { listaPreciosCodTiendaSchema, prismaCuidSchema } from "@/lib/validations/common";

/** Parámetros de URL del listado Px Listas (`/gestion-productos/tienda/px-listas`). */
export const getPxListasPreciosPageParamsSchema = z.object({
  q: z.string().max(500).optional(),
  rubro: z.string().max(200).optional(),
  marca: z.string().max(200).optional(),
  subRubro: z.string().max(200).optional(),
  actualizar: z.string().max(8).optional(),
  /** Competidor de referencia en 1 - GENERAL (`competencia_id_px_lista_general`). */
  pxVinculado: z.string().max(64).optional(),
  pagina: z.string().max(20).optional(),
});

const margenListaTiendaSchema = z
  .number()
  .finite()
  .min(0, "El margen no puede ser negativo.");

const pxListaEdicionSchema = z
  .number()
  .finite()
  .positive("El precio debe ser mayor a cero.")
  .max(999_999_999, "Precio demasiado alto.");

/** Guardar margen en UI → persiste PX en `prod_propios_listas_precios_edicion`. `margenManual: null` elimina staging. */
export const guardarPxListaMargenEdicionSchema = z.object({
  codTienda: listaPreciosCodTiendaSchema,
  idLista: z.coerce.number().int().positive("Lista inválida."),
  margenManual: z.union([margenListaTiendaSchema, z.null()]),
});

/** Guardar PX entero en UI → persiste staging y deriva margen %. `pxEdicion: null` elimina staging. */
export const guardarPxListaPrecioEdicionSchema = z.object({
  codTienda: listaPreciosCodTiendaSchema,
  idLista: z.coerce.number().int().positive("Lista inválida."),
  pxEdicion: z.union([pxListaEdicionSchema, z.null()]),
});

/** Competidor de referencia para **1 - GENERAL**. `"-"` / null = sin referencia (no toca PX). */
export const guardarPxListaCompetenciaRefSchema = z.object({
  codTienda: listaPreciosCodTiendaSchema,
  competenciaId: z.union([
    prismaCuidSchema,
    z.literal(PX_LISTAS_COMP_REF_NINGUNO),
    z.null(),
  ]),
});
