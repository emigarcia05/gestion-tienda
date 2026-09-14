import { prisma } from "@/lib/prisma";
import { isoYmdFromPrismaDateOnly } from "@/lib/fechaArgentina";
import type {
  GlobalPtoVtaItem,
  GlobalPtoVtaSucursalOption,
  PtoVentasCodArcaItem,
} from "@/lib/globalPtoVtas";
import type {
  CrearGlobalPtoVtaInput,
  EditarGlobalPtoVtaInput,
} from "@/lib/validations/globalPtoVtas";
import type { ServiceResult } from "@/types/service.types";
import type { Prisma } from "@prisma/client";

const sucursalSelect = { id: true, nombre: true } as const;

const ptoVtaInclude = {
  sucursales: {
    include: { sucursal: { select: sucursalSelect } },
  },
  condicionIvaArca: { select: { codigo: true, descripcion: true, activo: true } },
} as const;

type PtoVtaRow = Prisma.GlobalPtoVtaGetPayload<{ include: typeof ptoVtaInclude }>;

function mapSucursal(s: { id: string; nombre: string }): GlobalPtoVtaSucursalOption {
  return { id: s.id, nombre: s.nombre };
}

function mapRow(row: PtoVtaRow): GlobalPtoVtaItem {
  return {
    id: row.id,
    ptoVenta: row.ptoVenta,
    nombreTitular: row.nombreTitular.toLocaleUpperCase("es-AR"),
    cuit: row.cuit,
    iiBb: row.iiBb,
    iiBbMultilateral: row.iiBbMultilateral,
    condicionIva: row.condicionIva,
    condicionIvaDescripcion: row.condicionIvaArca?.descripcion ?? null,
    domicilioComercial: row.domicilioComercial,
    inicioActividades: row.inicioActividades
      ? isoYmdFromPrismaDateOnly(row.inicioActividades)
      : null,
    sucursales: row.sucursales
      .map((link) => mapSucursal(link.sucursal))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es-AR")),
  };
}

function mapDbError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") return "Ya existe un punto de venta con ese número.";
    if (code === "P2003") return "Hay sucursales o condición IVA inválidas.";
    if (code === "P2025") return "El punto de venta no existe.";
  }
  return error instanceof Error ? error.message : fallback;
}

function normalizarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

function datosFiscalesDesdeInput(
  input: Pick<
    CrearGlobalPtoVtaInput,
    | "cuit"
    | "iiBb"
    | "iiBbMultilateral"
    | "condicionIva"
    | "domicilioComercial"
    | "inicioActividades"
  >
) {
  return {
    cuit: input.cuit,
    iiBb: input.iiBb,
    iiBbMultilateral: input.iiBbMultilateral,
    condicionIva: input.condicionIva,
    domicilioComercial: input.domicilioComercial,
    inicioActividades: input.inicioActividades
      ? new Date(`${input.inicioActividades}T12:00:00.000Z`)
      : null,
  };
}

async function validarSucursales(
  sucursalIds: string[]
): Promise<ServiceResult<void>> {
  const encontradas = await prisma.sucursal.findMany({
    where: { id: { in: sucursalIds }, generaEst: true },
    select: { id: true },
  });
  if (encontradas.length !== sucursalIds.length) {
    return { success: false, error: "Solo se pueden asociar sucursales que generan estadísticas." };
  }
  return { success: true, data: undefined };
}

async function validarCondicionIva(
  codigo: number | null,
  codigoPersistido?: number | null
): Promise<ServiceResult<void>> {
  if (codigo == null) return { success: true, data: undefined };
  const row = await prisma.ptoVentasCodArca.findUnique({
    where: { codigo },
    select: { codigo: true, activo: true },
  });
  if (!row) {
    return { success: false, error: "Seleccioná una condición IVA válida." };
  }
  if (!row.activo && row.codigo !== codigoPersistido) {
    return { success: false, error: "Seleccioná una condición IVA válida." };
  }
  return { success: true, data: undefined };
}

/** Catálogo ARCA de condiciones frente al IVA (para el Select de pto. vta.). */
export async function listarPtoVentasCodArca(): Promise<PtoVentasCodArcaItem[]> {
  const rows = await prisma.ptoVentasCodArca.findMany({
    orderBy: { codigo: "asc" },
    select: { codigo: true, descripcion: true, activo: true },
  });
  return rows.map((r) => ({
    codigo: r.codigo,
    descripcion: r.descripcion,
    activo: r.activo,
  }));
}

/** Sucursales elegibles para asociar a un pto. vta.: `genera_est = true`. */
export async function listarSucursalesParaPtoVtas(): Promise<
  GlobalPtoVtaSucursalOption[]
> {
  const rows = await prisma.sucursal.findMany({
    where: { generaEst: true },
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
  const condicionOk = await validarCondicionIva(input.condicionIva);
  if (!condicionOk.success) return condicionOk;
  try {
    const row = await prisma.globalPtoVta.create({
      data: {
        ptoVenta: input.ptoVenta,
        nombreTitular: normalizarNombre(input.nombreTitular),
        ...datosFiscalesDesdeInput(input),
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
    const existente = await prisma.globalPtoVta.findUnique({
      where: { id: input.id },
      select: { condicionIva: true },
    });
    if (!existente) {
      return { success: false, error: "El punto de venta no existe." };
    }
    const condicionOk = await validarCondicionIva(
      input.condicionIva,
      existente.condicionIva
    );
    if (!condicionOk.success) return condicionOk;

    const row = await prisma.$transaction(async (tx) => {
      await tx.globalPtoVtaSucursal.deleteMany({ where: { ptoVtaId: input.id } });
      return tx.globalPtoVta.update({
        where: { id: input.id },
        data: {
          ptoVenta: input.ptoVenta,
          nombreTitular: normalizarNombre(input.nombreTitular),
          ...datosFiscalesDesdeInput(input),
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
    const usados = await prisma.finFactCobrosPtoVtaMes.count({
      where: { ptoVtaId: id },
    });
    if (usados > 0) {
      return {
        success: false,
        error: "No se puede eliminar: hay totales de Fact & Cobros.",
      };
    }
    const terminales = await prisma.finAnaCosFinaTerminal.count({
      where: { titularId: id },
    });
    if (terminales > 0) {
      return {
        success: false,
        error: "No se puede eliminar: hay terminales asociadas.",
      };
    }
    await prisma.globalPtoVta.delete({ where: { id } });
    return { success: true, data: { id } };
  } catch (error) {
    console.error("[globalPtoVtas][eliminar]", error);
    return { success: false, error: mapDbError(error, "No se pudo eliminar el punto de venta.") };
  }
}
