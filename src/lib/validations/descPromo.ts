import { z } from "zod";
import {
  ALCANCES_DESC_PROMO,
  CATEGORIAS_DESC_PROMO,
  COSTO_TIPOS_DESC_PROMO,
} from "@/lib/descPromo";
import { cantidadUnDecimalPositivaSchema } from "@/lib/cantidadUnDecimal";
import { parseIsoYmdParts } from "@/lib/fechaArgentina";
import {
  listaPreciosCodTiendaSchema,
  prismaCuidOrUuidSchema,
  prismaIdOptionalNullableSchema,
} from "@/lib/validations/common";

const fechaDescPromoSchema = z
  .string()
  .trim()
  .refine((v) => parseIsoYmdParts(v) != null, "Fecha inválida.")
  .nullable()
  .optional();

/** Lote DESC. POR STOCK de un ítem. Costo sin IVA. */
const loteDescPromoSchema = z
  .object({
    codTienda: listaPreciosCodTiendaSchema,
    cantidad: cantidadUnDecimalPositivaSchema,
    costoTipo: z.enum(COSTO_TIPOS_DESC_PROMO),
    costoValor: z
      .number()
      .min(0, "El costo no puede ser negativo.")
      .max(9_999_999_999, "El costo es demasiado grande."),
  })
  .superRefine((lote, ctx) => {
    if (lote.costoTipo === "PORCENTAJE" && lote.costoValor > 100) {
      ctx.addIssue({
        code: "custom",
        message: "El % de costo no puede ser mayor a 100.",
      });
    }
  });

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
  categoria: z.enum(CATEGORIAS_DESC_PROMO),
  fechaDesde: fechaDescPromoSchema,
  fechaHasta: fechaDescPromoSchema,
  lotes: z.array(loteDescPromoSchema).default([]),
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

function refineCategoria(
  data: z.infer<typeof camposDescPromoSchema>,
  ctx: z.RefinementCtx
) {
  const desde = data.fechaDesde ?? null;
  const hasta = data.fechaHasta ?? null;
  if (data.categoria === "FECHA") {
    if (!desde) ctx.addIssue({ code: "custom", message: "Elegí la fecha desde." });
    if (!hasta) ctx.addIssue({ code: "custom", message: "Elegí la fecha hasta." });
    if (desde && hasta && desde > hasta) {
      ctx.addIssue({
        code: "custom",
        message: "La fecha desde no puede ser posterior a la fecha hasta.",
      });
    }
  } else if (desde || hasta) {
    ctx.addIssue({
      code: "custom",
      message: "Solo DESC. POR FECHA lleva fechas.",
    });
  }

  if (data.categoria !== "STOCK") {
    if (data.lotes.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "Solo DESC. POR STOCK lleva cantidades y costo nuevo.",
      });
    }
    return;
  }
  if (data.alcance !== "ITEMS") {
    ctx.addIssue({
      code: "custom",
      message: "DESC. POR STOCK solo admite alcance ÍTEMS.",
    });
  }
  const codLotes = data.lotes.map((l) => l.codTienda);
  if (new Set(codLotes).size !== codLotes.length) {
    ctx.addIssue({ code: "custom", message: "Hay productos duplicados." });
  }
  const setLotes = new Set(codLotes);
  if (
    codLotes.length !== data.codTiendas.length ||
    data.codTiendas.some((c) => !setLotes.has(c))
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Cada producto debe tener cantidad y costo nuevo.",
    });
  }
}

function refineAlcance(
  data: z.infer<typeof camposDescPromoSchema>,
  ctx: z.RefinementCtx
) {
  refineCategoria(data, ctx);
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

export const costosVigentesDescPromoSchema = z.object({
  codTiendas: z
    .array(listaPreciosCodTiendaSchema)
    .min(1, "Elegí al menos un producto.")
    .max(500, "Demasiados productos."),
});

export const moverPrioridadDescPromoSchema = z.object({
  id: prismaCuidOrUuidSchema,
  direccion: z.enum(["up", "down"]),
});

export type CrearDescPromoInput = z.infer<typeof crearDescPromoSchema>;
export type EditarDescPromoInput = z.infer<typeof editarDescPromoSchema>;
export type EliminarDescPromoInput = z.infer<typeof eliminarDescPromoSchema>;
export type MoverPrioridadDescPromoInput = z.infer<typeof moverPrioridadDescPromoSchema>;
