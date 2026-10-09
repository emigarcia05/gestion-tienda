"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRol, esEditor } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import type { ActionResult } from "@/lib/types";
import { prismaCuidSchema, uuidSchema } from "@/lib/validations/common";
import { revalidatePath } from "next/cache";

export interface TipoPinturaRendimiento {
  id: string;
  tipoPintura: string;
  rendimiento: number;
}

const idSchema = z.union([prismaCuidSchema, uuidSchema]);

const upsertSchema = z.object({
  id: idSchema.optional(),
  tipoPintura: z
    .string()
    .trim()
    .min(1, "El tipo de pintura es obligatorio.")
    .max(120, "El tipo de pintura es demasiado largo.")
    .transform((value) => value.toUpperCase()),
  rendimiento: z
    .number()
    .int("El rendimiento debe ser un número entero.")
    .min(0, "El rendimiento no puede ser negativo.")
    .max(999999, "El rendimiento es demasiado grande."),
});

function mapDbError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  const lower = message.toLowerCase();
  if (lower.includes("duplicate") || lower.includes("unique")) {
    return "Ya existe un tipo de pintura con ese nombre.";
  }
  return message;
}

export async function getTiposPinturaRendimientosAction(): Promise<TipoPinturaRendimiento[]> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.tienda.tintoLts)) return [];

  const rows = await prisma.$queryRaw<TipoPinturaRendimiento[]>`
    SELECT
      id,
      tipo_pintura AS "tipoPintura",
      rendimiento
    FROM prod_rendimientos
    ORDER BY tipo_pintura ASC
  `;
  return rows;
}

export async function upsertTipoPinturaRendimientoAction(
  raw: unknown
): Promise<ActionResult<TipoPinturaRendimiento>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.tienda.tintoLts)) {
    return { ok: false, error: "Sin acceso al módulo de litros." };
  }
  if (!(await esEditor())) return { ok: false, error: "Sin permisos de editor." };

  const parsed = upsertSchema.safeParse(raw);
  if (!parsed.success) {
    const first =
      [...Object.values(parsed.error.flatten().fieldErrors).flat(), ...parsed.error.flatten().formErrors][0] ??
      "Datos inválidos.";
    return { ok: false, error: first };
  }

  const { id, tipoPintura, rendimiento } = parsed.data;
  try {
    let row: TipoPinturaRendimiento;
    if (id) {
      const updated = await prisma.$queryRaw<TipoPinturaRendimiento[]>`
        UPDATE prod_rendimientos
        SET
          tipo_pintura = ${tipoPintura},
          rendimiento = ${rendimiento},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING
          id,
          tipo_pintura AS "tipoPintura",
          rendimiento
      `;
      row = updated[0]!;
    } else {
      const inserted = await prisma.$queryRaw<TipoPinturaRendimiento[]>`
        INSERT INTO prod_rendimientos (tipo_pintura, rendimiento)
        VALUES (${tipoPintura}, ${rendimiento})
        RETURNING
          id,
          tipo_pintura AS "tipoPintura",
          rendimiento
      `;
      row = inserted[0]!;
    }

    revalidatePath("/ventas/herramientas/calculadora-lts");
    return { ok: true, data: row };
  } catch (error: unknown) {
    return { ok: false, error: mapDbError(error, "No se pudo guardar el tipo de pintura.") };
  }
}

export async function deleteTipoPinturaRendimientoAction(idRaw: string): Promise<ActionResult> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.tienda.tintoLts)) {
    return { ok: false, error: "Sin acceso al módulo de litros." };
  }
  if (!(await esEditor())) return { ok: false, error: "Sin permisos de editor." };
  const id = idSchema.safeParse(idRaw);
  if (!id.success) return { ok: false, error: "ID inválido." };

  try {
    await prisma.$executeRaw`
      DELETE FROM prod_rendimientos
      WHERE id = ${id.data}
    `;
    revalidatePath("/ventas/herramientas/calculadora-lts");
    return { ok: true, data: undefined };
  } catch (error: unknown) {
    return { ok: false, error: mapDbError(error, "No se pudo eliminar el tipo de pintura.") };
  }
}
