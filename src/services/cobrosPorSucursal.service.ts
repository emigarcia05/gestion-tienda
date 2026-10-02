import { prisma } from "@/lib/prisma";
import { etiquetaTipoCajaEnPantalla } from "@/lib/cajasTesoreriaTipos";
import type {
  ActualizarCobroPorSucursalInput,
  CrearCobroPorSucursalInput,
  EliminarCobroPorSucursalInput,
} from "@/lib/validations/cobrosPorSucursal";
import { Prisma, type TipoCajaTesoreria } from "@prisma/client";
import type { ServiceResult } from "@/types";

export type CobrosPorSucursalSucursalCol = {
  id: string;
  nombre: string;
};

export type CobrosPorSucursalCajaOption = {
  id: string;
  entidadId: string | null;
  sucursalId: string;
  tipoCaja: string;
  entidadNombre: string;
  sucursalNombre: string;
  titular: string;
  /** `TIPO CAJA - ENTIDAD - SUCURSAL - TITULAR`. Sin entidad: `SIN ENTIDAD`. */
  etiqueta: string;
};

export type CobrosPorSucursalCatalogoItem = {
  id: string;
  nombre: string;
};

export type CobrosPorSucursalPagoCatalogo = CobrosPorSucursalCatalogoItem;

export type CobrosPorSucursalVinculoPagoEntidad = {
  pagoId: string;
  entidadId: string;
};

/**
 * Una fila = un registro `cobros_vinc_cajas` (forma [× entidad] × una sola sucursal).
 * Si la forma no tiene entidades vinculadas, `entidadId` es null.
 */
export type CobrosPorSucursalFila = {
  id: string;
  pagoId: string;
  pagoNombre: string;
  entidadId: string | null;
  entidadNombre: string;
  sucursalId: string;
  sucursalNombre: string;
  cajaDestinoId: string | null;
  cajaEtiqueta: string;
  observacion: string;
};

export type CobrosPorSucursalVista = {
  filas: CobrosPorSucursalFila[];
  sucursales: CobrosPorSucursalSucursalCol[];
  cajas: CobrosPorSucursalCajaOption[];
  pagos: CobrosPorSucursalPagoCatalogo[];
  entidades: CobrosPorSucursalCatalogoItem[];
  vinculosPagoEntidad: CobrosPorSucursalVinculoPagoEntidad[];
};

function mapDbError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2003") return "Hay referencias inválidas (forma, entidad, sucursal o caja).";
    if (code === "P2025") return "Registro no encontrado.";
    if (code === "P2002") {
      return "Ya existe esa forma de pago para esa sucursal.";
    }
  }
  return error instanceof Error ? error.message : fallback;
}

function etiquetaCajaLista(row: {
  entidad: { nombre: string } | null;
  titular: string;
  sucursal: { nombre: string } | null;
  tipoCaja: TipoCajaTesoreria;
}): string {
  const tipo = etiquetaTipoCajaEnPantalla(row.tipoCaja);
  const entidad = row.entidad
    ? row.entidad.nombre.toLocaleUpperCase("es-AR")
    : "SIN ENTIDAD";
  const suc = row.sucursal?.nombre.toLocaleUpperCase("es-AR") ?? "SIN SUC.";
  const titular = row.titular.toLocaleUpperCase("es-AR");
  return `${tipo} - ${entidad} - ${suc} - ${titular}`;
}

function normalizarObservacion(raw: string): string {
  return raw.trim();
}

function sortFilas(a: CobrosPorSucursalFila, b: CobrosPorSucursalFila): number {
  const byPago = a.pagoNombre.localeCompare(b.pagoNombre, "es", {
    sensitivity: "base",
  });
  if (byPago !== 0) return byPago;
  const byEntidad = a.entidadNombre.localeCompare(b.entidadNombre, "es", {
    sensitivity: "base",
  });
  if (byEntidad !== 0) return byEntidad;
  return a.sucursalNombre.localeCompare(b.sucursalNombre, "es", {
    sensitivity: "base",
  });
}

function mensajeDuplicado(conEntidad: boolean): string {
  return conEntidad
    ? "Ya existe esa forma de pago × entidad para esa sucursal."
    : "Ya existe esa forma de pago para esa sucursal.";
}

async function buscarDuplicado(input: {
  pagoId: string;
  entidadId: string | null;
  sucursalId: string;
  excludeId?: string;
}): Promise<boolean> {
  const where: Prisma.CobrosPorSucursalWhereInput = input.entidadId
    ? {
        pagoId: input.pagoId,
        entidadId: input.entidadId,
        sucursalId: input.sucursalId,
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      }
    : {
        pagoId: input.pagoId,
        entidadId: null,
        sucursalId: input.sucursalId,
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      };
  const row = await prisma.cobrosPorSucursal.findFirst({
    where,
    select: { id: true },
  });
  return Boolean(row);
}

/** Sucursales para filtro/listado de Cobros & Cajas. */
export async function listarSucursalesCobrosPorSucursal(): Promise<
  CobrosPorSucursalSucursalCol[]
> {
  const rows = await prisma.sucursal.findMany({
    orderBy: [{ nombre: "asc" }],
    select: { id: true, nombre: true },
  });
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre.toLocaleUpperCase("es-AR"),
  }));
}

async function validarCajaDestino(
  cajaDestinoId: string
): Promise<
  ServiceResult<{
    id: string;
    sucursalId: string;
    etiqueta: string;
    sucursalNombre: string;
  }>
> {
  const caja = await prisma.cajaTesoreria.findFirst({
    where: { id: cajaDestinoId },
    select: {
      id: true,
      entidadId: true,
      sucursalId: true,
      titular: true,
      tipoCaja: true,
      entidad: { select: { nombre: true } },
      sucursal: { select: { nombre: true } },
    },
  });
  if (!caja) {
    return { success: false, error: "Caja vinculada inválida." };
  }
  if (!caja.sucursalId) {
    return {
      success: false,
      error: "La caja seleccionada no tiene sucursal asociada.",
    };
  }
  return {
    success: true,
    data: {
      id: caja.id,
      sucursalId: caja.sucursalId,
      etiqueta: etiquetaCajaLista(caja),
      sucursalNombre: caja.sucursal?.nombre.toLocaleUpperCase("es-AR") ?? "SIN SUC.",
    },
  };
}

export async function listarVistaCobrosPorSucursal(): Promise<CobrosPorSucursalVista> {
  const [sucursales, cajasRows, destinos, pagosRows, entidadesRows, vinculosRows] =
    await Promise.all([
      listarSucursalesCobrosPorSucursal(),
      prisma.cajaTesoreria.findMany({
        where: {
          sucursalId: { not: null },
        },
        orderBy: [{ titular: "asc" }],
        select: {
          id: true,
          entidadId: true,
          sucursalId: true,
          titular: true,
          tipoCaja: true,
          entidad: { select: { nombre: true } },
          sucursal: { select: { nombre: true } },
        },
      }),
      prisma.cobrosPorSucursal.findMany({
        select: {
          id: true,
          pagoId: true,
          entidadId: true,
          sucursalId: true,
          cajaDestinoId: true,
          observacion: true,
          sucursal: { select: { nombre: true } },
          cajaDestino: {
            select: {
              titular: true,
              tipoCaja: true,
              entidad: { select: { nombre: true } },
              sucursal: { select: { nombre: true } },
            },
          },
          pago: { select: { nombre: true } },
          entidad: { select: { nombre: true } },
        },
      }),
      prisma.finAnaCosFinaPagoCat.findMany({
        orderBy: [{ nombre: "asc" }],
        select: { id: true, nombre: true },
      }),
      prisma.finAnaCosFinaTerminalMarca.findMany({
        orderBy: [{ nombre: "asc" }],
        select: { id: true, nombre: true },
      }),
      prisma.cobrosFormaPagoEntidad.findMany({
        select: { pagoId: true, entidadId: true },
      }),
    ]);

  const sucursalIds = new Set(sucursales.map((s) => s.id));

  const filas: CobrosPorSucursalFila[] = destinos
    .filter((d) => sucursalIds.has(d.sucursalId))
    .map((d) => ({
      id: d.id,
      pagoId: d.pagoId,
      pagoNombre: d.pago.nombre.toLocaleUpperCase("es-AR"),
      entidadId: d.entidadId,
      entidadNombre: d.entidad
        ? d.entidad.nombre.toLocaleUpperCase("es-AR")
        : "",
      sucursalId: d.sucursalId,
      sucursalNombre: d.sucursal.nombre.toLocaleUpperCase("es-AR"),
      cajaDestinoId: d.cajaDestinoId,
      cajaEtiqueta: d.cajaDestino ? etiquetaCajaLista(d.cajaDestino) : "",
      observacion: d.observacion,
    }))
    .sort(sortFilas);

  const cajas: CobrosPorSucursalCajaOption[] = cajasRows
    .filter(
      (row): row is typeof row & { sucursalId: string } =>
        row.sucursalId != null && sucursalIds.has(row.sucursalId)
    )
    .map((row) => ({
      id: row.id,
      entidadId: row.entidadId,
      sucursalId: row.sucursalId,
      tipoCaja: row.tipoCaja,
      entidadNombre: row.entidad
        ? row.entidad.nombre.toLocaleUpperCase("es-AR")
        : "",
      sucursalNombre: row.sucursal?.nombre.toLocaleUpperCase("es-AR") ?? "SIN SUC.",
      titular: row.titular.toLocaleUpperCase("es-AR"),
      etiqueta: etiquetaCajaLista(row),
    }));

  return {
    filas,
    sucursales,
    cajas,
    pagos: pagosRows.map((p) => ({
      id: p.id,
      nombre: p.nombre.toLocaleUpperCase("es-AR"),
    })),
    entidades: entidadesRows.map((e) => ({
      id: e.id,
      nombre: e.nombre.toLocaleUpperCase("es-AR"),
    })),
    vinculosPagoEntidad: vinculosRows,
  };
}

export async function crearCobroPorSucursal(
  input: CrearCobroPorSucursalInput
): Promise<ServiceResult<CobrosPorSucursalFila>> {
  try {
    const observacion = normalizarObservacion(input.observacion);

    const pago = await prisma.finAnaCosFinaPagoCat.findUnique({
      where: { id: input.pagoId },
      select: { id: true, nombre: true },
    });
    if (!pago) {
      return { success: false, error: "Forma de pago inválida." };
    }

    const vinculos = await prisma.cobrosFormaPagoEntidad.findMany({
      where: { pagoId: input.pagoId },
      select: {
        entidadId: true,
        entidad: { select: { nombre: true } },
      },
    });
    const exigeEntidad = vinculos.length > 0;
    const entidadId = exigeEntidad ? (input.entidadId ?? null) : null;
    let entidadNombre = "";
    if (exigeEntidad) {
      if (!entidadId) {
        return { success: false, error: "Seleccioná una entidad." };
      }
      const vinculo = vinculos.find((v) => v.entidadId === entidadId);
      if (!vinculo) {
        return { success: false, error: "Combinación forma de pago × entidad inválida." };
      }
      entidadNombre = vinculo.entidad.nombre.toLocaleUpperCase("es-AR");
    }

    const cajaRes = await validarCajaDestino(
      input.cajaDestinoId
    );
    if (!cajaRes.success) return cajaRes;
    if (cajaRes.data.sucursalId !== input.sucursalId) {
      return { success: false, error: "La caja no pertenece a la sucursal elegida." };
    }

    const duplicado = await buscarDuplicado({
      pagoId: input.pagoId,
      entidadId,
      sucursalId: input.sucursalId,
    });
    if (duplicado) {
      return { success: false, error: mensajeDuplicado(Boolean(entidadId)) };
    }

    const created = await prisma.cobrosPorSucursal.create({
      data: {
        pagoId: input.pagoId,
        entidadId,
        sucursalId: cajaRes.data.sucursalId,
        cajaDestinoId: cajaRes.data.id,
        observacion,
      },
      select: { id: true },
    });

    return {
      success: true,
      data: {
        id: created.id,
        pagoId: input.pagoId,
        pagoNombre: pago.nombre.toLocaleUpperCase("es-AR"),
        entidadId,
        entidadNombre,
        sucursalId: cajaRes.data.sucursalId,
        sucursalNombre: cajaRes.data.sucursalNombre,
        cajaDestinoId: cajaRes.data.id,
        cajaEtiqueta: cajaRes.data.etiqueta,
        observacion,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo crear el cobro."),
    };
  }
}

export async function actualizarCobroPorSucursal(
  input: ActualizarCobroPorSucursalInput
): Promise<ServiceResult<CobrosPorSucursalFila>> {
  try {
    const observacion = normalizarObservacion(input.observacion);

    const existente = await prisma.cobrosPorSucursal.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        pagoId: true,
        entidadId: true,
        sucursalId: true,
        pago: { select: { nombre: true } },
        entidad: { select: { nombre: true } },
      },
    });
    if (!existente) {
      return { success: false, error: "Cobro no encontrado." };
    }

    const cajaRes = await validarCajaDestino(
      input.cajaDestinoId
    );
    if (!cajaRes.success) return cajaRes;

    if (cajaRes.data.sucursalId !== existente.sucursalId) {
      return { success: false, error: "La caja no pertenece a la sucursal del cobro." };
    }

    await prisma.cobrosPorSucursal.update({
      where: { id: existente.id },
      data: {
        sucursalId: cajaRes.data.sucursalId,
        cajaDestinoId: cajaRes.data.id,
        observacion,
      },
    });

    return {
      success: true,
      data: {
        id: existente.id,
        pagoId: existente.pagoId,
        pagoNombre: existente.pago.nombre.toLocaleUpperCase("es-AR"),
        entidadId: existente.entidadId,
        entidadNombre: existente.entidad
          ? existente.entidad.nombre.toLocaleUpperCase("es-AR")
          : "",
        sucursalId: cajaRes.data.sucursalId,
        sucursalNombre: cajaRes.data.sucursalNombre,
        cajaDestinoId: cajaRes.data.id,
        cajaEtiqueta: cajaRes.data.etiqueta,
        observacion,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo actualizar el cobro."),
    };
  }
}

export async function eliminarCobroPorSucursal(
  input: EliminarCobroPorSucursalInput
): Promise<ServiceResult<{ id: string }>> {
  try {
    await prisma.cobrosPorSucursal.delete({
      where: { id: input.id },
    });
    return { success: true, data: { id: input.id } };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo eliminar el cobro."),
    };
  }
}
