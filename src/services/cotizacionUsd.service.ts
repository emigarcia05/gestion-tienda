import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types/service.types";

/** PK fija del singleton `global_cotizacion_usd`. */
export const GLOBAL_COTIZACION_USD_ID = "USD" as const;

const FALLBACK_COTIZACION_USD = 1;

export interface CotizacionUsdEstado {
  valor: number;
  updatedAt: string;
}

function valorDesdeEnvSeed(): number {
  const raw = process.env.COTIZACION_DOLAR;
  if (!raw) return FALLBACK_COTIZACION_USD;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : FALLBACK_COTIZACION_USD;
}

/** Valor global vigente USD→ARS. Crea fila `USD` si no existe (seed env o 1). */
export async function getCotizacionUsd(): Promise<number> {
  const row = await prisma.globalCotizacionUsd.findUnique({
    where: { id: GLOBAL_COTIZACION_USD_ID },
    select: { valor: true },
  });
  if (!row) {
    const valor = valorDesdeEnvSeed();
    await prisma.globalCotizacionUsd.create({
      data: { id: GLOBAL_COTIZACION_USD_ID, valor },
    });
    return valor;
  }
  const valor = Number(row.valor);
  return valor > 0 ? valor : FALLBACK_COTIZACION_USD;
}

export async function getCotizacionUsdEstado(): Promise<CotizacionUsdEstado> {
  const row = await prisma.globalCotizacionUsd.findUnique({
    where: { id: GLOBAL_COTIZACION_USD_ID },
    select: { valor: true, updatedAt: true },
  });
  if (!row) {
    await getCotizacionUsd();
    const created = await prisma.globalCotizacionUsd.findUniqueOrThrow({
      where: { id: GLOBAL_COTIZACION_USD_ID },
      select: { valor: true, updatedAt: true },
    });
    return { valor: Number(created.valor), updatedAt: created.updatedAt.toISOString() };
  }
  return { valor: Number(row.valor), updatedAt: row.updatedAt.toISOString() };
}

/** Cotización a persistir en caché de ítem según flag `px_dolares`. */
export async function resolverCotizacionDolarParaItem(pxDolares: boolean): Promise<number> {
  if (!pxDolares) return 1;
  return getCotizacionUsd();
}

/**
 * Actualiza cotización global y propaga a `prod_precios_provee.cotizacion_dolar`
 * en filas con `px_dolares = true` (caché para columna GENERATED).
 */
export async function actualizarCotizacionUsd(
  valor: number
): Promise<ServiceResult<{ actualizados: number; estado: CotizacionUsdEstado }>> {
  if (!Number.isFinite(valor) || valor <= 0) {
    return { success: false, error: "La cotización debe ser un número mayor a 0." };
  }

  try {
    const estado = await prisma.globalCotizacionUsd.upsert({
      where: { id: GLOBAL_COTIZACION_USD_ID },
      create: { id: GLOBAL_COTIZACION_USD_ID, valor },
      update: { valor },
      select: { valor: true, updatedAt: true },
    });

    const actualizados = await prisma.$executeRawUnsafe(
      `
      UPDATE prod_precios_provee
      SET cotizacion_dolar = $1::numeric, updated_at = CURRENT_TIMESTAMP
      WHERE px_dolares = true
      `,
      valor
    );

    return {
      success: true,
      data: {
        actualizados: Number(actualizados),
        estado: {
          valor: Number(estado.valor),
          updatedAt: estado.updatedAt.toISOString(),
        },
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo actualizar la cotización USD.";
    return { success: false, error: msg };
  }
}
