import { z } from "zod";
import { PX_LISTAS_COMP_REF_NINGUNO } from "@/lib/pxListasCompetenciaRef";
import { listaPreciosCodTiendaSchema, prismaCuidSchema } from "@/lib/validations/common";

/** Parámetros de URL del listado Px Listas (`/administrador/productos/px-listas`). */
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

const cambioPxListasBase = {
  codTienda: listaPreciosCodTiendaSchema,
  idLista: z.coerce.number().int().positive("Lista inválida."),
};

/** Cambio pendiente de una celda (PX o PORC. UTILIDAD); `null` elimina el staging. */
export const cambioPxListasSchema = z.discriminatedUnion("tipo", [
  z.object({
    ...cambioPxListasBase,
    tipo: z.literal("px"),
    pxEdicion: z.union([pxListaEdicionSchema, z.null()]),
  }),
  z.object({
    ...cambioPxListasBase,
    tipo: z.literal("margen"),
    margenManual: z.union([margenListaTiendaSchema, z.null()]),
  }),
]);

export type CambioPxListas = z.infer<typeof cambioPxListasSchema>;

/**
 * **Guardar Cambios** publica en `prod_lista_precios` los productos visibles
 * cuya edición ya difiere del precio de Ventas. Tope: una página de la grilla.
 */
export const publicarPxListasPreciosDefinitivosSchema = z.object({
  codTiendas: z
    .array(listaPreciosCodTiendaSchema)
    .min(1, "No hay precios de venta para actualizar.")
    .max(120, "Demasiados productos en una sola vez."),
});

/** **Guardar Cambios** de Px Listas: todos los pendientes en una llamada. */
export const guardarPxListasCambiosSchema = z.object({
  cambios: z
    .array(cambioPxListasSchema)
    .min(1, "No hay cambios para guardar.")
    .max(2000, "Demasiados cambios en una sola vez."),
});

/**
 * PX VENTA de Nuevo / Editar Item: staging de PX o PORC. y, si cambió, el competidor de GENERAL.
 * `cambios` puede ir vacío cuando solo se actualiza el vínculo.
 */
export const guardarPxVentaDesdeItemSchema = z
  .object({
    codTienda: listaPreciosCodTiendaSchema,
    cambios: z.array(cambioPxListasSchema).max(50, "Demasiadas listas."),
    competenciaId: z.union([
      prismaCuidSchema,
      z.literal(PX_LISTAS_COMP_REF_NINGUNO),
      z.null(),
    ]),
    actualizarCompetencia: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.cambios.length === 0 && !value.actualizarCompetencia) {
      ctx.addIssue({ code: "custom", message: "No hay cambios de PX VENTA." });
    }
    for (const cambio of value.cambios) {
      if (cambio.codTienda !== value.codTienda) {
        ctx.addIssue({
          code: "custom",
          message: "El cambio de precio no corresponde al producto.",
        });
        break;
      }
    }
  });

/** Lectura de la fila PX VENTA en Nuevo (`null`) o Editar Item. */
export const getPxVentaItemModalSchema = z.object({
  codTienda: listaPreciosCodTiendaSchema.nullable(),
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
