import { z } from "zod";
import { TIPOS_DESC_PROMO } from "@/lib/descPromo";
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

const reglaDescPromoSchema = z.object({
  idRubro: prismaCuidOrUuidSchema,
  idSubRubro: prismaIdOptionalNullableSchema,
  descuento: descuentoDescPromoSchema,
});

const camposDescPromoSchema = z.object({
  tipo: z.enum(TIPOS_DESC_PROMO),
  nombre: nombreDescPromoSchema,
  descuento: descuentoDescPromoSchema.nullable(),
  codTiendas: z
    .array(listaPreciosCodTiendaSchema)
    .superRefine(idsUnicos("Hay productos duplicados.")),
  pagoIds: z
    .array(prismaCuidOrUuidSchema)
    .superRefine(idsUnicos("Hay formas de pago duplicadas.")),
  reglas: z.array(reglaDescPromoSchema),
});

function claveRegla(regla: { idRubro: string; idSubRubro?: string | null }) {
  return `${regla.idRubro}::${regla.idSubRubro ?? ""}`;
}

function refineTipoVinculos(
  data: {
    tipo: string;
    descuento: number | null;
    codTiendas: string[];
    pagoIds: string[];
    reglas: { idRubro: string; idSubRubro?: string | null; descuento: number }[];
  },
  ctx: z.RefinementCtx
) {
  const claves = data.reglas.map(claveRegla);
  if (new Set(claves).size !== claves.length) {
    ctx.addIssue({
      code: "custom",
      message: "Hay reglas duplicadas de rubro y sub-rubro.",
    });
  }

  if (data.tipo === "POR_ITEM") {
    if (data.descuento == null) {
      ctx.addIssue({ code: "custom", message: "Ingresá el descuento." });
    }
    if (data.codTiendas.length === 0) {
      ctx.addIssue({ code: "custom", message: "Elegí al menos un producto." });
    }
    if (data.pagoIds.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "Una promo POR ITEM no puede tener formas de pago.",
      });
    }
    if (data.reglas.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "Una promo POR ITEM no puede tener reglas por rubro.",
      });
    }
    return;
  }

  if (data.descuento != null) {
    ctx.addIssue({
      code: "custom",
      message: "Una promo POR FORMA PAGO no usa un descuento único.",
    });
  }
  if (data.pagoIds.length === 0) {
    ctx.addIssue({ code: "custom", message: "Elegí al menos una forma de pago." });
  }
  if (data.codTiendas.length > 0) {
    ctx.addIssue({
      code: "custom",
      message: "Una promo POR FORMA PAGO no puede tener productos.",
    });
  }
  if (data.reglas.length === 0) {
    ctx.addIssue({
      code: "custom",
      message: "Agregá al menos un descuento por rubro.",
    });
  }
}

export const crearDescPromoSchema = camposDescPromoSchema.superRefine(refineTipoVinculos);

export const editarDescPromoSchema = camposDescPromoSchema
  .extend({ id: prismaCuidOrUuidSchema })
  .superRefine(refineTipoVinculos);

export const eliminarDescPromoSchema = z.object({
  id: prismaCuidOrUuidSchema,
});

export type CrearDescPromoInput = z.infer<typeof crearDescPromoSchema>;
export type EditarDescPromoInput = z.infer<typeof editarDescPromoSchema>;
export type EliminarDescPromoInput = z.infer<typeof eliminarDescPromoSchema>;
