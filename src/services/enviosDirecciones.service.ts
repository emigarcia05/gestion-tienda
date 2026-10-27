import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  NOMBRE_PROYECTO_DEFAULT,
  capitalizarTextoEnvio,
  direccionEnvioTieneDato,
  nombreProyectoPersistido,
  properTextoEnvio,
  type EnviosDireccionItem,
} from "@/lib/envios";
import type {
  CrearEnviosDireccionInput,
  EditarEnviosDireccionInput,
} from "@/lib/validations/envios";
import type { ServiceResult } from "@/types/service.types";

const select = {
  id: true,
  personaId: true,
  nombreProyecto: true,
  direccion: true,
  distrito: true,
  departamento: true,
  urlMaps: true,
  referencia: true,
} as const;

export function mapEnviosDireccionItem(row: {
  id: string;
  personaId: string;
  nombreProyecto: string;
  direccion: string;
  distrito: string;
  departamento: EnviosDireccionItem["departamento"];
  urlMaps: string | null;
  referencia: string | null;
}): EnviosDireccionItem {
  return {
    id: row.id,
    personaId: row.personaId,
    nombreProyecto: nombreProyectoPersistido(row.nombreProyecto),
    direccion: properTextoEnvio(row.direccion),
    distrito: properTextoEnvio(row.distrito),
    departamento: row.departamento,
    urlMaps: (row.urlMaps ?? "").trim(),
    referencia: row.referencia ? capitalizarTextoEnvio(row.referencia) : "",
  };
}

function prismaErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2025") return "El proyecto no existe.";
    if (code === "P2003") {
      return "No se puede eliminar: el proyecto está asociado a un envío, un comprobante o el cliente no existe.";
    }
  }
  return error instanceof Error ? error.message : fallback;
}

export async function listarEnviosDirecciones(
  personaId?: string
): Promise<EnviosDireccionItem[]> {
  try {
    const rows = await prisma.enviosDireccion.findMany({
      where: personaId ? { personaId } : undefined,
      orderBy: [{ nombreProyecto: "asc" }, { direccion: "asc" }, { createdAt: "asc" }],
      select,
    });
    return rows.map(mapEnviosDireccionItem);
  } catch (e) {
    console.error("[enviosDirecciones][listar]", e);
    return [];
  }
}

export async function crearEnviosDireccion(
  input: CrearEnviosDireccionInput
): Promise<ServiceResult<EnviosDireccionItem>> {
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: input.personaId },
      select: { id: true },
    });
    if (!cliente) {
      return { success: false, error: "El cliente del proyecto no existe." };
    }
    if (!direccionEnvioTieneDato(input)) {
      return { success: false, error: "Completá al menos un dato del proyecto." };
    }
    const row = await prisma.enviosDireccion.create({
      data: {
        personaId: input.personaId,
        nombreProyecto: nombreProyectoPersistido(input.nombreProyecto),
        direccion: properTextoEnvio(input.direccion),
        distrito: properTextoEnvio(input.distrito),
        departamento: input.departamento,
        urlMaps: input.urlMaps.trim() === "" ? null : input.urlMaps.trim(),
        referencia:
          input.referencia.trim() === "" ? null : capitalizarTextoEnvio(input.referencia),
      },
      select,
    });
    return { success: true, data: mapEnviosDireccionItem(row) };
  } catch (error) {
    console.error("[enviosDirecciones][crear]", error);
    return { success: false, error: prismaErrorMessage(error, "No se pudo crear el proyecto.") };
  }
}

export async function editarEnviosDireccion(
  input: EditarEnviosDireccionInput
): Promise<ServiceResult<EnviosDireccionItem>> {
  try {
    if (!direccionEnvioTieneDato(input)) {
      return { success: false, error: "Completá al menos un dato del proyecto." };
    }
    const row = await prisma.enviosDireccion.update({
      where: { id: input.id },
      data: {
        personaId: input.personaId,
        nombreProyecto: nombreProyectoPersistido(input.nombreProyecto),
        direccion: properTextoEnvio(input.direccion),
        distrito: properTextoEnvio(input.distrito),
        departamento: input.departamento,
        urlMaps: input.urlMaps.trim() === "" ? null : input.urlMaps.trim(),
        referencia:
          input.referencia.trim() === "" ? null : capitalizarTextoEnvio(input.referencia),
      },
      select,
    });
    return { success: true, data: mapEnviosDireccionItem(row) };
  } catch (error) {
    console.error("[enviosDirecciones][editar]", error);
    return {
      success: false,
      error: prismaErrorMessage(error, "No se pudo actualizar el proyecto."),
    };
  }
}

/**
 * Domicilio fiscal de ARCA → `clientes_proyectos.direccion` del cliente.
 * Sin proyectos crea PRINCIPAL; con proyectos completa el PRINCIPAL (o el único) si no tiene dirección.
 * No pisa direcciones ya cargadas. Devuelve el proyecto creado/actualizado, o null si no hubo cambios.
 */
export async function guardarDomicilioFiscalEnProyecto(
  db: Prisma.TransactionClient | typeof prisma,
  personaId: string,
  domicilio: string
): Promise<EnviosDireccionItem | null> {
  const direccion = properTextoEnvio(domicilio);
  if (direccion === "") return null;
  const proyectos = await db.enviosDireccion.findMany({
    where: { personaId },
    orderBy: { createdAt: "asc" },
    select,
  });
  const clave = direccion.toLocaleLowerCase("es-AR");
  if (proyectos.some((p) => p.direccion.trim().toLocaleLowerCase("es-AR") === clave)) {
    return null;
  }
  if (proyectos.length === 0) {
    const row = await db.enviosDireccion.create({
      data: {
        personaId,
        nombreProyecto: NOMBRE_PROYECTO_DEFAULT,
        direccion,
        distrito: "",
      },
      select,
    });
    return mapEnviosDireccionItem(row);
  }
  const sinDireccion = proyectos.filter((p) => p.direccion.trim() === "");
  const destino =
    sinDireccion.find((p) => nombreProyectoPersistido(p.nombreProyecto) === NOMBRE_PROYECTO_DEFAULT) ??
    (proyectos.length === 1 ? sinDireccion[0] : undefined);
  if (!destino) return null;
  const row = await db.enviosDireccion.update({
    where: { id: destino.id },
    data: { direccion },
    select,
  });
  return mapEnviosDireccionItem(row);
}

export async function eliminarEnviosDireccion(
  id: string
): Promise<ServiceResult<{ id: string }>> {
  try {
    await prisma.enviosDireccion.delete({ where: { id } });
    return { success: true, data: { id } };
  } catch (error) {
    console.error("[enviosDirecciones][eliminar]", error);
    return {
      success: false,
      error: prismaErrorMessage(error, "No se pudo eliminar el proyecto."),
    };
  }
}
