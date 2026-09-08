import { prisma } from "@/lib/prisma";
import type { GlobalPtoVtaItem, GlobalPtoVtaSucursalOption } from "@/lib/globalPtoVtas";
import type {
  CrearGlobalPtoVtaInput,
  EditarGlobalPtoVtaInput,
} from "@/lib/validations/globalPtoVtas";
import type { ServiceResult } from "@/types/service.types";

const sucursalSelect = { id: true, nombre: true } as const;

const ptoVtaInclude = {
  sucursales: {
    include: { sucursal: { select: sucursalSelect } },
  },
} as const;

type PtoVtaRow = {
  id: string;
  ptoVenta: number;
  nombrePtoVenta: string;
  sucursales: {
    sucursal: { id: string; nombre: string };
  }[];
};

function mapSucursal(s: { id: string; nombre: string }): GlobalPtoVtaSucursalOption {
  return { id: s.id, nombre: s.nombre };
}

function mapRow(row: PtoVtaRow): GlobalPtoVtaItem {
  return {
    id: row.id,
    ptoVenta: row.ptoVenta,
    nombrePtoVenta: row.nombrePtoVenta.toLocaleUpperCase("es-AR"),
    sucursales: row.sucursales
      .map((link) => mapSucursal(link.sucursal))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es-AR")),
  };
}

function mapDbError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") return "Ya existe un punto de venta con ese número.";
    if (code === "P2003") return "Hay sucursales inválidas.";
    if (code === "P2025") return "El punto de venta no existe.";
  }
  return error instanceof Error ? error.message : fallback;
}

function normalizarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

async function validarSucursales(
  sucursalIds: string[]
): Promise<ServiceResult<void>> {
  const encontradas = await prisma.sucursal.findMany({
    where: { id: { in: sucursalIds } },
    select: { id: true },
  });
  if (encontradas.length !== sucursalIds.length) {
    return { success: false, error: "Hay sucursales inválidas." };
  }
  return { success: true, data: undefined };
}

export async function listarSucursalesParaPtoVtas(): Promise<
  GlobalPtoVtaSucursalOption[]
> {
  const rows = await prisma.sucursal.findMany({
    select: sucursalSelect,
    orderBy: { nombre: "asc" },
  });
  return rows.map(mapSucursal);
}

export async function listarGlobalPtoVtas(): Promise<GlobalPtoVtaItem[]> {
  const rows = await prisma.globalPtoVta.findMany({
    include: ptoVtaInclude,
    orderBy: { ptoVenta: "asc" },
  });
  return rows.map(mapRow);
}

export async function crearGlobalPtoVta(
  input: CrearGlobalPtoVtaInput
): Promise<ServiceResult<GlobalPtoVtaItem>> {
  const sucursalesOk = await validarSucursales(input.sucursalIds);
  if (!sucursalesOk.success) return sucursalesOk;
  try {
    const row = await prisma.globalPtoVta.create({
      data: {
        ptoVenta: input.ptoVenta,
        nombrePtoVenta: normalizarNombre(input.nombrePtoVenta),
        sucursales: {
          create: input.sucursalIds.map((sucursalId) => ({ sucursalId })),
        },
      },
      include: ptoVtaInclude,
    });
    return { success: true, data: mapRow(row) };
  } catch (error) {
    console.error("[globalPtoVtas][crear]", error);
    return { success: false, error: mapDbError(error, "No se pudo crear el punto de venta.") };
  }
}

export async function editarGlobalPtoVta(
  input: EditarGlobalPtoVtaInput
): Promise<ServiceResult<GlobalPtoVtaItem>> {
  const sucursalesOk = await validarSucursales(input.sucursalIds);
  if (!sucursalesOk.success) return sucursalesOk;
  try {
    const row = await prisma.$transaction(async (tx) => {
      await tx.globalPtoVtaSucursal.deleteMany({ where: { ptoVtaId: input.id } });
      return tx.globalPtoVta.update({
        where: { id: input.id },
        data: {
          ptoVenta: input.ptoVenta,
          nombrePtoVenta: normalizarNombre(input.nombrePtoVenta),
          sucursales: {
            create: input.sucursalIds.map((sucursalId) => ({ sucursalId })),
          },
        },
        include: ptoVtaInclude,
      });
    });
    return { success: true, data: mapRow(row) };
  } catch (error) {
    console.error("[globalPtoVtas][editar]", error);
    return { success: false, error: mapDbError(error, "No se pudo actualizar el punto de venta.") };
  }
}

export async function eliminarGlobalPtoVta(
  id: string
): Promise<ServiceResult<{ id: string }>> {
  try {
    await prisma.globalPtoVta.delete({ where: { id } });
    return { success: true, data: { id } };
  } catch (error) {
    console.error("[globalPtoVtas][eliminar]", error);
    return { success: false, error: mapDbError(error, "No se pudo eliminar el punto de venta.") };
  }
}
