import { prisma } from "@/lib/prisma";
import { etiquetaTipoCajaEnPantalla } from "@/lib/cajasTesoreriaTipos";
import type {
  ActualizarCobroPorSucursalInput,
  CrearCobroPorSucursalInput,
  EliminarCobroPorSucursalInput,
} from "@/lib/validations/cobrosPorSucursal";
import type { TipoCajaTesoreria } from "@prisma/client";
import type { ServiceResult } from "@/types";

export type CobrosPorSucursalSucursalCol = {
  id: string;
  nombre: string;
};

export type CobrosPorSucursalCajaOption = {
  id: string;
  entidadId: string;
  sucursalId: string;
  tipoCaja: string;
  entidadNombre: string;
  sucursalNombre: string;
  titular: string;
  /** `TIPO CAJA - ENTIDAD - SUCURSAL - TITULAR` */
  etiqueta: string;
};

export type CobrosPorSucursalCatalogoItem = {
  id: string;
  nombre: string;
};

export type CobrosPorSucursalVinculoPagoEntidad = {
  pagoId: string;
  entidadId: string;
};

/** Una fila de tabla = forma de pago × entidad creada manualmente. */
export type CobrosPorSucursalFila = {
  pagoId: string;
  pagoNombre: string;
  entidadId: string;
  entidadNombre: string;
  observacion: string;
  /** sucursalId → cajaDestinoId (null = sin configurar en esa sucursal). */
  destinosPorSucursalId: Record<string, string | null>;
};

export type CobrosPorSucursalVista = {
  filas: CobrosPorSucursalFila[];
  sucursales: CobrosPorSucursalSucursalCol[];
  cajas: CobrosPorSucursalCajaOption[];
  pagos: CobrosPorSucursalCatalogoItem[];
  entidades: CobrosPorSucursalCatalogoItem[];
  vinculosPagoEntidad: CobrosPorSucursalVinculoPagoEntidad[];
};

function mapDbError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2003") return "Hay referencias inválidas (forma, entidad, sucursal o caja).";
    if (code === "P2025") return "Registro no encontrado.";
    if (code === "P2002") return "Ya existe esa combinación forma × entidad × sucursal.";
  }
  return error instanceof Error ? error.message : fallback;
}

function etiquetaCajaLista(row: {
  entidad: { nombre: string };
  titular: string;
  sucursal: { nombre: string } | null;
  tipoCaja: TipoCajaTesoreria;
}): string {
  const tipo = etiquetaTipoCajaEnPantalla(row.tipoCaja);
  const entidad = row.entidad.nombre.toLocaleUpperCase("es-AR");
  const suc = row.sucursal?.nombre.toLocaleUpperCase("es-AR") ?? "SIN SUC.";
  const titular = row.titular.toLocaleUpperCase("es-AR");
  return `${tipo} - ${entidad} - ${suc} - ${titular}`;
}

function normalizarObservacion(raw: string): string {
  return raw.trim();
}

/** Sucursales operativas (con depósito): columnas de la grilla. */
export async function listarSucursalesCobrosPorSucursal(): Promise<
  CobrosPorSucursalSucursalCol[]
> {
  const rows = await prisma.sucursal.findMany({
    where: { idDeposito: { not: null } },
    orderBy: [{ nombre: "asc" }],
    select: { id: true, nombre: true },
  });
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre.toLocaleUpperCase("es-AR"),
  }));
}

async function validarCajaDestino(
  cajaDestinoId: string,
  entidadId: string,
  sucursalesValidas: Set<string>
): Promise<ServiceResult<{ id: string; sucursalId: string }>> {
  const caja = await prisma.cajaTesoreria.findFirst({
    where: {
      id: cajaDestinoId,
      tipoCaja: { not: "CHEQUE" },
    },
    select: { id: true, entidadId: true, sucursalId: true },
  });
  if (!caja) {
    return { success: false, error: "Caja vinculada inválida." };
  }
  if (caja.entidadId !== entidadId) {
    return {
      success: false,
      error: "La caja debe ser de la misma entidad seleccionada.",
    };
  }
  if (!caja.sucursalId || !sucursalesValidas.has(caja.sucursalId)) {
    return {
      success: false,
      error: "La caja debe pertenecer a una sucursal operativa (con depósito).",
    };
  }
  return { success: true, data: { id: caja.id, sucursalId: caja.sucursalId } };
}

export async function listarVistaCobrosPorSucursal(): Promise<CobrosPorSucursalVista> {
  const [sucursales, cajasRows, destinos, pagosRows, entidadesRows, vinculosRows] =
    await Promise.all([
      listarSucursalesCobrosPorSucursal(),
      prisma.cajaTesoreria.findMany({
        where: {
          tipoCaja: { not: "CHEQUE" },
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
          pagoId: true,
          entidadId: true,
          sucursalId: true,
          cajaDestinoId: true,
          observacion: true,
          formaPagoEntidad: {
            select: {
              pago: { select: { nombre: true } },
              entidad: { select: { nombre: true } },
            },
          },
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

  type GrupoAcc = {
    pagoId: string;
    pagoNombre: string;
    entidadId: string;
    entidadNombre: string;
    observacion: string;
    destinosPorSucursalId: Record<string, string | null>;
  };

  const grupos = new Map<string, GrupoAcc>();

  for (const d of destinos) {
    if (!sucursalIds.has(d.sucursalId)) continue;
    const key = `${d.pagoId}:${d.entidadId}`;
    let grupo = grupos.get(key);
    if (!grupo) {
      const destinosPorSucursalId: Record<string, string | null> = {};
      for (const suc of sucursales) {
        destinosPorSucursalId[suc.id] = null;
      }
      grupo = {
        pagoId: d.pagoId,
        pagoNombre: d.formaPagoEntidad.pago.nombre.toLocaleUpperCase("es-AR"),
        entidadId: d.entidadId,
        entidadNombre: d.formaPagoEntidad.entidad.nombre.toLocaleUpperCase("es-AR"),
        observacion: d.observacion,
        destinosPorSucursalId,
      };
      grupos.set(key, grupo);
    }
    grupo.destinosPorSucursalId[d.sucursalId] = d.cajaDestinoId;
    if (d.observacion.trim().length > 0) {
      grupo.observacion = d.observacion;
    }
  }

  const filas: CobrosPorSucursalFila[] = [...grupos.values()].sort((a, b) => {
    const byPago = a.pagoNombre.localeCompare(b.pagoNombre, "es", {
      sensitivity: "base",
    });
    if (byPago !== 0) return byPago;
    return a.entidadNombre.localeCompare(b.entidadNombre, "es", {
      sensitivity: "base",
    });
  });

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
      entidadNombre: row.entidad.nombre.toLocaleUpperCase("es-AR"),
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

    const vinculo = await prisma.cobrosFormaPagoEntidad.findUnique({
      where: {
        pagoId_entidadId: {
          pagoId: input.pagoId,
          entidadId: input.entidadId,
        },
      },
      select: {
        pagoId: true,
        entidadId: true,
        pago: { select: { nombre: true } },
        entidad: { select: { nombre: true } },
      },
    });
    if (!vinculo) {
      return { success: false, error: "Combinación forma de pago × entidad inválida." };
    }

    const yaExiste = await prisma.cobrosPorSucursal.findFirst({
      where: { pagoId: input.pagoId, entidadId: input.entidadId },
      select: { id: true },
    });
    if (yaExiste) {
      return {
        success: false,
        error: "Ya existe ese cobro. Usá Editar para cambiar la caja u observación.",
      };
    }

    const sucursales = await listarSucursalesCobrosPorSucursal();
    const sucursalesValidas = new Set(sucursales.map((s) => s.id));
    const cajaRes = await validarCajaDestino(
      input.cajaDestinoId,
      input.entidadId,
      sucursalesValidas
    );
    if (!cajaRes.success) return cajaRes;

    await prisma.cobrosPorSucursal.create({
      data: {
        pagoId: input.pagoId,
        entidadId: input.entidadId,
        sucursalId: cajaRes.data.sucursalId,
        cajaDestinoId: cajaRes.data.id,
        observacion,
      },
    });

    const destinosPorSucursalId: Record<string, string | null> = {};
    for (const suc of sucursales) {
      destinosPorSucursalId[suc.id] =
        suc.id === cajaRes.data.sucursalId ? cajaRes.data.id : null;
    }

    return {
      success: true,
      data: {
        pagoId: input.pagoId,
        pagoNombre: vinculo.pago.nombre.toLocaleUpperCase("es-AR"),
        entidadId: input.entidadId,
        entidadNombre: vinculo.entidad.nombre.toLocaleUpperCase("es-AR"),
        observacion,
        destinosPorSucursalId,
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

    const existentes = await prisma.cobrosPorSucursal.findMany({
      where: { pagoId: input.pagoId, entidadId: input.entidadId },
      select: {
        id: true,
        sucursalId: true,
        cajaDestinoId: true,
        formaPagoEntidad: {
          select: {
            pago: { select: { nombre: true } },
            entidad: { select: { nombre: true } },
          },
        },
      },
    });
    if (existentes.length === 0) {
      return { success: false, error: "Cobro no encontrado." };
    }

    const sucursales = await listarSucursalesCobrosPorSucursal();
    const sucursalesValidas = new Set(sucursales.map((s) => s.id));
    const cajaRes = await validarCajaDestino(
      input.cajaDestinoId,
      input.entidadId,
      sucursalesValidas
    );
    if (!cajaRes.success) return cajaRes;

    await prisma.$transaction(async (tx) => {
      await tx.cobrosPorSucursal.upsert({
        where: {
          pagoId_entidadId_sucursalId: {
            pagoId: input.pagoId,
            entidadId: input.entidadId,
            sucursalId: cajaRes.data.sucursalId,
          },
        },
        create: {
          pagoId: input.pagoId,
          entidadId: input.entidadId,
          sucursalId: cajaRes.data.sucursalId,
          cajaDestinoId: cajaRes.data.id,
          observacion,
        },
        update: {
          cajaDestinoId: cajaRes.data.id,
          observacion,
        },
      });

      await tx.cobrosPorSucursal.updateMany({
        where: { pagoId: input.pagoId, entidadId: input.entidadId },
        data: { observacion },
      });
    });

    const destinosActualizados = await prisma.cobrosPorSucursal.findMany({
      where: { pagoId: input.pagoId, entidadId: input.entidadId },
      select: { sucursalId: true, cajaDestinoId: true },
    });

    const destinosPorSucursalId: Record<string, string | null> = {};
    for (const suc of sucursales) {
      destinosPorSucursalId[suc.id] = null;
    }
    for (const d of destinosActualizados) {
      if (sucursalesValidas.has(d.sucursalId)) {
        destinosPorSucursalId[d.sucursalId] = d.cajaDestinoId;
      }
    }

    const sample = existentes[0];
    return {
      success: true,
      data: {
        pagoId: input.pagoId,
        pagoNombre: sample.formaPagoEntidad.pago.nombre.toLocaleUpperCase("es-AR"),
        entidadId: input.entidadId,
        entidadNombre: sample.formaPagoEntidad.entidad.nombre.toLocaleUpperCase("es-AR"),
        observacion,
        destinosPorSucursalId,
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
): Promise<ServiceResult<{ pagoId: string; entidadId: string }>> {
  try {
    const result = await prisma.cobrosPorSucursal.deleteMany({
      where: { pagoId: input.pagoId, entidadId: input.entidadId },
    });
    if (result.count === 0) {
      return { success: false, error: "Cobro no encontrado." };
    }
    return {
      success: true,
      data: { pagoId: input.pagoId, entidadId: input.entidadId },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo eliminar el cobro."),
    };
  }
}
