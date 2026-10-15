import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EstPorProdPresentacionItem } from "@/lib/estPorProdPresentacion";
import type {
  EstPorProdPosicionUnidad,
  EstPorProdUnPresentacionItem,
} from "@/lib/estPorProdUnPresentacion";
import {
  extraerLiteralNumeroPresentacion,
  formatearPresentacionConUnidad,
  literalNumeroDesdeTextoGuardado,
} from "@/lib/estPorProdUnPresentacion";
import type {
  CrearEstPorProdPresentacionInput,
  EditarEstPorProdPresentacionInput,
} from "@/lib/validations/estPorProdPresentacion";
import type { ServiceResult } from "@/types";

const unidadSelect = {
  id: true,
  unidad: true,
  posicionUnidad: true,
  suma: true,
} as const;

const presentacionInclude = {
  unidadMedida: { select: unidadSelect },
  conversionAUnidad: { select: unidadSelect },
} as const;

function normalizarTexto(texto: string): string {
  return texto.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

function toNumber(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : Number(value);
}

function mapUnidad(r: {
  id: string;
  unidad: string;
  posicionUnidad: EstPorProdPosicionUnidad;
  suma: boolean;
}): EstPorProdUnPresentacionItem {
  return {
    id: r.id,
    unidad: r.unidad.toLocaleUpperCase("es-AR"),
    posicionUnidad: r.posicionUnidad,
    suma: r.suma,
  };
}

function mapRow(r: {
  id: string;
  texto: string;
  unidadMedidaId: string;
  presentacionNumerica: Prisma.Decimal;
  conversionAUnidadId: string | null;
  conversionAUnidadPresentacion: Prisma.Decimal | null;
  unidadMedida: {
    id: string;
    unidad: string;
    posicionUnidad: EstPorProdPosicionUnidad;
    suma: boolean;
  };
  conversionAUnidad: {
    id: string;
    unidad: string;
    posicionUnidad: EstPorProdPosicionUnidad;
    suma: boolean;
  } | null;
}): EstPorProdPresentacionItem {
  const presentacionNumerica = toNumber(r.presentacionNumerica);
  return {
    id: r.id,
    texto: r.texto.toLocaleUpperCase("es-AR"),
    unidadMedidaId: r.unidadMedidaId,
    presentacionNumerica,
    presentacionNumericaTexto:
      extraerLiteralNumeroPresentacion(r.texto, r.unidadMedida) ||
      formatearPresentacionConUnidad(presentacionNumerica, { unidad: "", posicionUnidad: "SUFIJO" }),
    conversionAUnidadId: r.conversionAUnidadId,
    conversionAUnidadPresentacion:
      r.conversionAUnidadPresentacion == null
        ? null
        : toNumber(r.conversionAUnidadPresentacion),
    unidadMedida: mapUnidad(r.unidadMedida),
    conversionAUnidad: r.conversionAUnidad ? mapUnidad(r.conversionAUnidad) : null,
  };
}

function mapDbError(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    if (code === "P2002") return "Ya existe una presentación con ese texto.";
    if (code === "P2025") return "Presentación no encontrada.";
    if (code === "P2003") return "Unidad de medida o conversión inválida.";
  }
  return error instanceof Error ? error.message : fallback;
}

/**
 * Valida unidad de medida y, si hay conversión, que exista, sea distinta y `suma = true`.
 */
async function validarUnidadesPresentacion(
  unidadMedidaId: string,
  conversionAUnidadId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const medida = await prisma.prodPresentacionUnidad.findUnique({
    where: { id: unidadMedidaId },
    select: { id: true },
  });
  if (!medida) {
    return { ok: false, error: "Seleccioná una unidad de medida válida." };
  }
  if (conversionAUnidadId == null) {
    return { ok: true };
  }
  if (conversionAUnidadId === unidadMedidaId) {
    return {
      ok: false,
      error: "Convertir a un. debe ser distinta de la unidad medida.",
    };
  }
  const destino = await prisma.prodPresentacionUnidad.findUnique({
    where: { id: conversionAUnidadId },
    select: { id: true, suma: true },
  });
  if (!destino) {
    return { ok: false, error: "Seleccioná una unidad de conversión válida." };
  }
  if (!destino.suma) {
    return {
      ok: false,
      error: "Solo se puede convertir a unidades con suma habilitada.",
    };
  }
  return { ok: true };
}

/**
 * `texto` de match = número literal escrito (conserva `080`) + unidad de medida (prefijo/sufijo),
 * en MAYÚSCULAS. No lo envía el cliente; se recalcula en create/update.
 */
async function derivarTextoPresentacion(
  presentacionNumerica: string,
  unidadMedidaId: string
): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const unidad = await prisma.prodPresentacionUnidad.findUnique({
    where: { id: unidadMedidaId },
    select: { unidad: true, posicionUnidad: true },
  });
  if (!unidad) {
    return { ok: false, error: "Seleccioná una unidad de medida válida." };
  }
  const texto = normalizarTexto(
    formatearPresentacionConUnidad(presentacionNumerica, {
      unidad: unidad.unidad,
      posicionUnidad: unidad.posicionUnidad as EstPorProdPosicionUnidad,
    })
  );
  if (!texto) {
    return { ok: false, error: "No se pudo generar el texto de la presentación." };
  }
  return { ok: true, texto };
}

type UnidadTexto = Pick<EstPorProdUnPresentacionItem, "unidad" | "posicionUnidad">;

export interface CambioTextoPresentacion {
  id: string;
  antes: string;
  despues: string;
}

export interface ConflictoTextoPresentacion extends CambioTextoPresentacion {
  /** `texto` actual de la otra presentación que terminaría con el mismo texto. */
  conflictoCon: string;
}

export interface PlanTextosPresentaciones {
  cambios: CambioTextoPresentacion[];
  conflictos: ConflictoTextoPresentacion[];
}

/**
 * Calcula el `texto` que corresponde a cada presentación según su unidad en `prod_un_medida`
 * (conserva el literal escrito, p. ej. `080`). Con `unidadEditada` solo evalúa las presentaciones
 * de esa unidad usando sus valores nuevos (antes de guardarlos). No escribe.
 */
export async function planificarTextosPresentaciones(
  unidadEditada?: { id: string } & UnidadTexto,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<PlanTextosPresentaciones> {
  const rows = await db.prodPresentacion.findMany({
    select: {
      id: true,
      texto: true,
      presentacionNumerica: true,
      unidadMedidaId: true,
      unidadMedida: { select: { unidad: true, posicionUnidad: true } },
    },
    orderBy: { texto: "asc" },
  });

  const cambios: CambioTextoPresentacion[] = [];
  for (const r of rows) {
    if (unidadEditada && r.unidadMedidaId !== unidadEditada.id) continue;
    const unidad: UnidadTexto = unidadEditada ?? {
      unidad: r.unidadMedida.unidad,
      posicionUnidad: r.unidadMedida.posicionUnidad as EstPorProdPosicionUnidad,
    };
    const valor = toNumber(r.presentacionNumerica);
    const despues = normalizarTexto(
      formatearPresentacionConUnidad(
        literalNumeroDesdeTextoGuardado(r.texto, valor, unidad) ?? valor,
        unidad
      )
    );
    if (despues && despues !== r.texto) cambios.push({ id: r.id, antes: r.texto, despues });
  }

  const despuesPorId = new Map(cambios.map((c) => [c.id, c.despues]));
  const idsPorTextoFinal = new Map<string, string[]>();
  for (const r of rows) {
    const final = despuesPorId.get(r.id) ?? r.texto;
    idsPorTextoFinal.set(final, [...(idsPorTextoFinal.get(final) ?? []), r.id]);
  }
  const textoActualPorId = new Map(rows.map((r) => [r.id, r.texto]));
  const conflictos: ConflictoTextoPresentacion[] = [];
  for (const c of cambios) {
    const otro = (idsPorTextoFinal.get(c.despues) ?? []).find((id) => id !== c.id);
    if (otro) conflictos.push({ ...c, conflictoCon: textoActualPorId.get(otro) ?? "" });
  }
  return { cambios, conflictos };
}

/**
 * Aplica los cambios de `texto` en dos pasos (temporal → final) para no chocar con el índice
 * único cuando dos presentaciones intercambian texto. Llamar dentro de una transacción.
 */
export async function aplicarCambiosTextoPresentaciones(
  tx: Prisma.TransactionClient,
  cambios: CambioTextoPresentacion[]
): Promise<void> {
  for (const c of cambios) {
    await tx.prodPresentacion.update({ where: { id: c.id }, data: { texto: `__TMP__${c.id}` } });
  }
  for (const c of cambios) {
    await tx.prodPresentacion.update({ where: { id: c.id }, data: { texto: c.despues } });
  }
}

function datosConversion(input: {
  conversionAUnidadId: string | null;
  conversionAUnidadPresentacion: number | null;
}): {
  conversionAUnidadId: string | null;
  conversionAUnidadPresentacion: Prisma.Decimal | null;
} {
  if (
    input.conversionAUnidadId == null ||
    input.conversionAUnidadPresentacion == null
  ) {
    return { conversionAUnidadId: null, conversionAUnidadPresentacion: null };
  }
  return {
    conversionAUnidadId: input.conversionAUnidadId,
    conversionAUnidadPresentacion: new Prisma.Decimal(
      input.conversionAUnidadPresentacion
    ),
  };
}

export async function listarEstPorProdPresentaciones(): Promise<
  EstPorProdPresentacionItem[]
> {
  try {
    const rows = await prisma.prodPresentacion.findMany({
      orderBy: { texto: "asc" },
      include: presentacionInclude,
    });
    return rows.map(mapRow);
  } catch (e: unknown) {
    console.error(
      "[estPorProdPresentacion.service] listarEstPorProdPresentaciones:",
      e
    );
    return [];
  }
}

export async function crearEstPorProdPresentacion(
  input: CrearEstPorProdPresentacionInput
): Promise<ServiceResult<EstPorProdPresentacionItem>> {
  const unidadesOk = await validarUnidadesPresentacion(
    input.unidadMedidaId,
    input.conversionAUnidadId
  );
  if (!unidadesOk.ok) {
    return { success: false, error: unidadesOk.error };
  }
  const derivado = await derivarTextoPresentacion(
    input.presentacionNumerica.literal,
    input.unidadMedidaId
  );
  if (!derivado.ok) {
    return { success: false, error: derivado.error };
  }
  const conversion = datosConversion(input);
  try {
    const created = await prisma.prodPresentacion.create({
      data: {
        texto: derivado.texto,
        unidadMedidaId: input.unidadMedidaId,
        presentacionNumerica: new Prisma.Decimal(input.presentacionNumerica.valor),
        conversionAUnidadId: conversion.conversionAUnidadId,
        conversionAUnidadPresentacion: conversion.conversionAUnidadPresentacion,
      },
      include: presentacionInclude,
    });
    return { success: true, data: mapRow(created) };
  } catch (error) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo crear la presentación."),
    };
  }
}

export async function editarEstPorProdPresentacion(
  input: EditarEstPorProdPresentacionInput
): Promise<ServiceResult<EstPorProdPresentacionItem>> {
  const unidadesOk = await validarUnidadesPresentacion(
    input.unidadMedidaId,
    input.conversionAUnidadId
  );
  if (!unidadesOk.ok) {
    return { success: false, error: unidadesOk.error };
  }
  const derivado = await derivarTextoPresentacion(
    input.presentacionNumerica.literal,
    input.unidadMedidaId
  );
  if (!derivado.ok) {
    return { success: false, error: derivado.error };
  }
  const conversion = datosConversion(input);
  try {
    const updated = await prisma.prodPresentacion.update({
      where: { id: input.id },
      data: {
        texto: derivado.texto,
        unidadMedidaId: input.unidadMedidaId,
        presentacionNumerica: new Prisma.Decimal(input.presentacionNumerica.valor),
        conversionAUnidadId: conversion.conversionAUnidadId,
        conversionAUnidadPresentacion: conversion.conversionAUnidadPresentacion,
      },
      include: presentacionInclude,
    });
    return { success: true, data: mapRow(updated) };
  } catch (error) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo actualizar la presentación."),
    };
  }
}

export async function eliminarEstPorProdPresentacion(
  id: string
): Promise<ServiceResult<{ id: string }>> {
  try {
    await prisma.prodPresentacion.delete({ where: { id } });
    return { success: true, data: { id } };
  } catch (error) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo eliminar la presentación."),
    };
  }
}
