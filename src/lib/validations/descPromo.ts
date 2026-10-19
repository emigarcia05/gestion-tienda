import { z } from "zod";
import { ALCANCES_DESC_PROMO } from "@/lib/descPromo";
import {
  listaPreciosCodTiendaSchema,
  prismaCuidOrUuidSchema,
  prismaIdOptionalNullableSchema,
} from "@/lib/validations/common";

const nombreDescPromoSchema = z
  .string()
  .trim()
  .min(1, "Ingresá un nombre.")
  .max(120, "El nombre es demasiado largo.");

const descuentoDescPromoSchema = z
  .number()
  .int("El descuento debe ser un entero.")
  .min(0, "El descuento no puede ser menor a 0.")
  .max(100, "El descuento no puede ser mayor a 100.");

function idsUnicos(mensaje: string) {
  return (ids: string[], ctx: z.RefinementCtx) => {
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", message: mensaje });
    }
  };
}

const camposDescPromoSchema = z.object({
  alcance: z.enum(ALCANCES_DESC_PROMO),
  nombre: nombreDescPromoSchema,
  descuento: descuentoDescPromoSchema,
  idMarca: prismaIdOptionalNullableSchema,
  idRubro: prismaIdOptionalNullableSchema,
  codTiendas: z
    .array(listaPreciosCodTiendaSchema)
    .superRefine(idsUnicos("Hay productos duplicados.")),
  vinculosCobro: z
    .array(
      z.object({
        pagoId: prismaCuidOrUuidSchema,
        cuotaId: prismaIdOptionalNullableSchema,
      })
    )
    .superRefine((vinculos, ctx) => {
      const claves = vinculos.map(
        (v) => `${v.pagoId}:${v.cuotaId ?? ""}`
      );
      if (new Set(claves).size !== claves.length) {
        ctx.addIssue({
          code: "custom",
          message: "Hay formas de cobro duplicadas.",
        });
      }
    }),
});

function refineAlcance(
  data: z.infer<typeof camposDescPromoSchema>,
  ctx: z.RefinementCtx
) {
  if (data.vinculosCobro.length === 0) {
    ctx.addIssue({
      code: "custom",
      message: "Elegí al menos una forma de cobro.",
    });
  }

  const marca = data.idMarca ?? null;
  const rubro = data.idRubro ?? null;

  if (data.alcance === "TODOS") {
    if (marca || rubro) {
      ctx.addIssue({
        code: "custom",
        message: "TODOS LOS ÍTEMS no lleva marca ni rubro.",
      });
    }
    if (data.codTiendas.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "TODOS LOS ÍTEMS no lleva productos puntuales.",
      });
    }
    return;
  }

  if (data.alcance === "MARCA") {
    if (!marca) {
      ctx.addIssue({ code: "custom", message: "Elegí una marca." });
    }
    if (rubro) {
      ctx.addIssue({
        code: "custom",
        message: "El alcance MARCA no lleva rubro.",
      });
    }
    if (data.codTiendas.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "El alcance MARCA no lleva productos puntuales.",
      });
    }
    return;
  }

  if (data.alcance === "RUBRO") {
    if (!rubro) {
      ctx.addIssue({ code: "custom", message: "Elegí un rubro." });
    }
    if (marca) {
      ctx.addIssue({
        code: "custom",
        message: "El alcance RUBRO no lleva marca.",
      });
    }
    if (data.codTiendas.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "El alcance RUBRO no lleva productos puntuales.",
      });
    }
    return;
  }

  if (data.alcance === "MARCA_RUBRO") {
    if (!marca) {
      ctx.addIssue({ code: "custom", message: "Elegí una marca." });
    }
    if (!rubro) {
      ctx.addIssue({ code: "custom", message: "Elegí un rubro." });
    }
    if (data.codTiendas.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "El alcance MARCA Y RUBRO no lleva productos puntuales.",
      });
    }
    return;
  }

  if (data.codTiendas.length === 0) {
    ctx.addIssue({ code: "custom", message: "Elegí al menos un producto." });
  }
  if (marca || rubro) {
    ctx.addIssue({
      code: "custom",
      message: "El alcance ÍTEMS no lleva marca ni rubro.",
    });
  }
}

export const crearDescPromoSchema = camposDescPromoSchema.superRefine(refineAlcance);

export const editarDescPromoSchema = camposDescPromoSchema
  .extend({ id: prismaCuidOrUuidSchema })
  .superRefine(refineAlcance);

export const eliminarDescPromoSchema = z.object({
  id: prismaCuidOrUuidSchema,
});

export const moverPrioridadDescPromoSchema = z.object({
  id: prismaCuidOrUuidSchema,
  direccion: z.enum(["up", "down"]),
});

export type CrearDescPromoInput = z.infer<typeof crearDescPromoSchema>;
export type EditarDescPromoInput = z.infer<typeof editarDescPromoSchema>;
export type EliminarDescPromoInput = z.infer<typeof eliminarDescPromoSchema>;
export type MoverPrioridadDescPromoInput = z.infer<typeof moverPrioridadDescPromoSchema>;
