/**
 * Progreso de importación en BD para que el polling desde la sidebar
 * funcione en serverless (misma fuente para POST y GET).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const IMPORT_PROGRESS_ID = "lista-precios";

export interface ImportProgressResult {
  creados: number;
  actualizados: number;
  eliminados: number;
  errores: string[];
}

export interface ImportProgressState {
  running: boolean;
  processed: number;
  total: number;
  done: boolean;
  error: string | null;
  result: ImportProgressResult | null;
}

/** Respuesta neutra para clientes sin permiso de import (evita 403 en polling). */
export function importProgressIdleState(): ImportProgressState {
  return {
    running: false,
    processed: 0,
    total: 0,
    done: false,
    error: null,
    result: null,
  };
}

export async function getImportProgressFromDb(): Promise<ImportProgressState> {
  const row = await prisma.importProgress.findUnique({
    where: { id: IMPORT_PROGRESS_ID },
  });
  if (!row) {
    return importProgressIdleState();
  }
  const result: ImportProgressResult | null =
    row.resultCreados != null
      ? {
          creados: row.resultCreados,
          actualizados: row.resultActualizados ?? 0,
          eliminados: row.resultEliminados ?? 0,
          errores: Array.isArray(row.resultErrores) ? (row.resultErrores as string[]) : [],
        }
      : null;
  return {
    running: row.running,
    processed: row.processed,
    total: row.total,
    done: !row.running && (row.error != null || result != null),
    error: row.error,
    result,
  };
}

export async function startImportInDb(total: number): Promise<void> {
  await prisma.importProgress.upsert({
    where: { id: IMPORT_PROGRESS_ID },
    create: {
      id: IMPORT_PROGRESS_ID,
      running: true,
      processed: 0,
      total,
      updatedAt: new Date(),
    },
    update: {
      running: true,
      processed: 0,
      total,
      resultCreados: null,
      resultActualizados: null,
      resultEliminados: null,
      resultErrores: Prisma.DbNull,
      resultResumen: Prisma.DbNull,
      error: null,
      updatedAt: new Date(),
    },
  });
}

export async function setImportProgressInDb(processed: number, total: number): Promise<void> {
  await prisma.importProgress.update({
    where: { id: IMPORT_PROGRESS_ID },
    data: { processed, total, updatedAt: new Date() },
  });
}

export async function setImportResultInDb(
  result: ImportProgressResult,
  resumen: Prisma.InputJsonValue | null
): Promise<void> {
  await prisma.importProgress.update({
    where: { id: IMPORT_PROGRESS_ID },
    data: {
      running: false,
      resultCreados: result.creados,
      resultActualizados: result.actualizados,
      resultEliminados: result.eliminados,
      resultErrores: result.errores,
      resultResumen: resumen ?? Prisma.DbNull,
      error: null,
      updatedAt: new Date(),
    },
  });
}

export async function getResumenAumentosImportFromDb(): Promise<unknown> {
  const row = await prisma.importProgress.findUnique({
    where: { id: IMPORT_PROGRESS_ID },
    select: { resultResumen: true, running: true },
  });
  if (!row || row.running || row.resultResumen == null) return null;
  return row.resultResumen;
}

export async function setImportErrorInDb(message: string): Promise<void> {
  await prisma.importProgress.upsert({
    where: { id: IMPORT_PROGRESS_ID },
    update: { running: false, error: message, updatedAt: new Date() },
    create: {
      id: IMPORT_PROGRESS_ID,
      running: false,
      error: message,
      updatedAt: new Date(),
    },
  });
}
