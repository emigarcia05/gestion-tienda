import { prisma } from "@/lib/prisma";
import {
  capitalizarTextoEnvio,
  direccionEnvioTieneDato,
  normalizarNombreCliente,
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
  calleNombre: true,
  numeracion: true,
  distrito: true,
  departamento: true,
  urlMaps: true,
  referencia: true,
} as const;

export function mapEnviosDireccionItem(row: {
  id: string;
  personaId: string;
  nombreProyecto: string;
  calleNombre: string;
  numeracion: string;
  distrito: string;
  departamento: EnviosDireccionItem["departamento"];
  urlMaps: string | null;
  referencia: string | null;
}): EnviosDireccionItem {
  return {
    id: row.id,
    personaId: row.personaId,
    nombreProyecto: normalizarNombreCliente(row.nombreProyecto),
    calleNombre: properTextoEnvio(row.calleNombre),
    numeracion: capitalizarTextoEnvio(row.numeracion),
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
<<<<<<< HEAD
      return "No se puede eliminar: el proyecto está asociado a un envío o el cliente no existe.";
=======
      return "No se puede eliminar: el proyecto está asociado a un envío, un comprobante o el cliente no existe.";
>>>>>>> facturacion
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
      orderBy: [{ nombreProyecto: "asc" }, { calleNombre: "asc" }, { numeracion: "asc" }, { createdAt: "asc" }],
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
        nombreProyecto: normalizarNombreCliente(input.nombreProyecto),
        calleNombre: properTextoEnvio(input.calleNombre),
        numeracion: capitalizarTextoEnvio(input.numeracion),
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
        nombreProyecto: normalizarNombreCliente(input.nombreProyecto),
        calleNombre: properTextoEnvio(input.calleNombre),
        numeracion: capitalizarTextoEnvio(input.numeracion),
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
