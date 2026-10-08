import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  parseCompetenciaConfigExtraccion,
  type CompetenciaConfigExtraccion,
} from "@/lib/competenciaConfigExtraccion";

export interface CompetenciaParaCliente {
  id: string;
  nombre: string;
  web: string;
  idProveedor: string | null;
  /** `proveedores.prefijo` del proveedor asociado (abreviatura en grilla). */
  prefijoProveedor: string | null;
  ultimaComparacionAt: string | null;
  configExtraccion: CompetenciaConfigExtraccion | null;
}

export const competenciaSelect = {
  id: true,
  nombre: true,
  web: true,
  idProveedor: true,
  ultimaComparacionAt: true,
  configExtraccion: true,
  proveedor: { select: { prefijo: true } },
} as const;

export async function listCompetencias(): Promise<CompetenciaParaCliente[]> {
  const rows = await prisma.prodCompetencia.findMany({
    orderBy: { nombre: "asc" },
    select: competenciaSelect,
  });
  return rows.map(mapCompetenciaRow);
}

async function resolveIdProveedorCompetencia(
  idProveedor: string | null | undefined
): Promise<string | null> {
  if (idProveedor == null) return null;
  const existe = await prisma.proveedor.findUnique({
    where: { id: idProveedor },
    select: { id: true },
  });
  if (!existe) {
    throw new Error("El proveedor asociado no existe.");
  }
  return idProveedor;
}

export async function createCompetencia(data: {
  nombre: string;
  web?: string;
  idProveedor?: string | null;
  configExtraccion?: CompetenciaConfigExtraccion | null;
}): Promise<CompetenciaParaCliente> {
  const idProveedor = await resolveIdProveedorCompetencia(data.idProveedor ?? null);
  const row = await prisma.prodCompetencia.create({
    data: {
      nombre: data.nombre.trim(),
      web: normalizeWebUrlOptional(data.web ?? ""),
      idProveedor,
      configExtraccion: toJsonInput(data.configExtraccion),
    },
    select: competenciaSelect,
  });
  return mapCompetenciaRow(row);
}

export async function updateCompetencia(data: {
  id: string;
  nombre: string;
  web?: string;
  idProveedor?: string | null;
  configExtraccion?: CompetenciaConfigExtraccion | null;
}): Promise<CompetenciaParaCliente> {
  const idProveedor =
    data.idProveedor !== undefined
      ? await resolveIdProveedorCompetencia(data.idProveedor)
      : undefined;
  const row = await prisma.prodCompetencia.update({
    where: { id: data.id },
    data: {
      nombre: data.nombre.trim(),
      web: normalizeWebUrlOptional(data.web ?? ""),
      ...(idProveedor !== undefined ? { idProveedor } : {}),
      ...(data.configExtraccion !== undefined
        ? { configExtraccion: toJsonInput(data.configExtraccion) }
        : {}),
    },
    select: competenciaSelect,
  });
  return mapCompetenciaRow(row);
}

function toJsonInput(
  config: CompetenciaConfigExtraccion | null | undefined
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (config === undefined) return undefined;
  if (config == null || config.reglas.length === 0) return Prisma.DbNull;
  return config as Prisma.InputJsonValue;
}

export function mapCompetenciaRow(row: {
  id: string;
  nombre: string;
  web: string | null;
  idProveedor: string | null;
  ultimaComparacionAt: Date | null;
  configExtraccion: unknown;
  proveedor?: { prefijo: string | null } | null;
}): CompetenciaParaCliente {
  const prefijo = row.proveedor?.prefijo?.trim();
  return {
    id: row.id,
    nombre: row.nombre,
    web: row.web ?? "",
    idProveedor: row.idProveedor,
    prefijoProveedor: prefijo || null,
    ultimaComparacionAt: row.ultimaComparacionAt?.toISOString() ?? null,
    configExtraccion: parseCompetenciaConfigExtraccion(row.configExtraccion),
  };
}

export async function deleteCompetencia(id: string): Promise<void> {
  await prisma.prodCompetencia.delete({ where: { id } });
}

export function normalizeWebUrlOptional(web: string): string | null {
  const trimmed = web.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/\/+$/, "");
  }
  return `https://${trimmed.replace(/\/+$/, "")}`;
}

/** @deprecated Usar `normalizeWebUrlOptional`; mantiene compatibilidad con scripts seed. */
export function normalizeWebUrl(web: string): string {
  const n = normalizeWebUrlOptional(web);
  if (!n) throw new Error("La URL del sitio es obligatoria.");
  return n;
}
