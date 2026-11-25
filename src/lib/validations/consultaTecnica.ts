import { z } from "zod";
import { listaPreciosCodTiendaSchema, prismaCuidSchema } from "@/lib/validations/common";

function campo(max: number, mensaje: string) {
  return z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max, mensaje));
}

export const guardarConsultaTecnicaSchema = z
  .object({
    id: prismaCuidSchema.optional(),
    idMarca: prismaCuidSchema,
    idRubro: prismaCuidSchema,
    uso: campo(400, "El uso es demasiado largo."),
    dilucion: campo(240, "La dilución es demasiado larga."),
    aplicacion: campo(400, "La aplicación es demasiado larga."),
    rendimiento: campo(160, "El rendimiento es demasiado largo."),
    activo: z.boolean(),
  })
  .refine(
    (valor) =>
      valor.uso.length > 0 ||
      valor.dilucion.length > 0 ||
      valor.aplicacion.length > 0 ||
      valor.rendimiento.length > 0,
    { message: "Cargá al menos uso, dilución, aplicación o rendimiento." }
  );

export const eliminarConsultaTecnicaSchema = z.object({
  id: prismaCuidSchema,
});

export const leerMensajesConsultaTecnicaSchema = z.object({
  conversacionId: prismaCuidSchema,
});

export const eliminarConversacionConsultaTecnicaSchema = z.object({
  conversacionId: prismaCuidSchema,
});

export const buscarItemsConsultaTecnicaSchema = z.object({
  q: z.string().trim().min(3, "Escribí al menos 3 letras.").max(80, "La búsqueda es demasiado larga."),
});

export const crearFichaItemConsultaTecnicaSchema = z.object({
  codTienda: listaPreciosCodTiendaSchema,
});

export const conversarConsultaTecnicaSchema = z.object({
  conversacionId: prismaCuidSchema,
  texto: z.string().trim().min(1, "Escribí la consulta.").max(2000, "La consulta es demasiado larga."),
});

export const agregarItemConsultaTecnicaSchema = z.object({
  conversacionId: prismaCuidSchema,
  codTienda: listaPreciosCodTiendaSchema,
});

export const elegirCoincidenciaConsultaTecnicaSchema = z.discriminatedUnion("tipo", [
  z.object({
    conversacionId: prismaCuidSchema,
    tipo: z.literal("familia"),
    id: prismaCuidSchema,
  }),
  z.object({
    conversacionId: prismaCuidSchema,
    tipo: z.literal("item"),
    codTienda: listaPreciosCodTiendaSchema,
  }),
]);

export const enviarMensajeConsultaTecnicaSchema = z.object({
  conversacionId: prismaCuidSchema.optional(),
  texto: z
    .string()
    .trim()
    .min(1, "Escribí la consulta.")
    .max(2000, "La consulta es demasiado larga."),
});
