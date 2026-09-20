import { prisma } from "@/lib/prisma";
import type { GuardarCobroPorSucursalDestinoInput } from "@/lib/validations/cobrosPorSucursal";
import { ensureFinAnaCosFinaSeed } from "@/services/finAnaCosFina.service";
import type { ServiceResult } from "@/types";

export type CobrosPorSucursalSucursalCol = {
  id: string;
  nombre: string;
};

export type CobrosPorSucursalCajaOption = {
  id: string;
  entidadId: string;
  etiqueta: string;
};

/** Una fila = forma de pago × entidad (todas las cuotas comparten destino). */
export type CobrosPorSucursalFila = {
  pagoId: string;
  pagoNombre: string;
  entidadId: string;
  entidadNombre: string;
  /** sucursalId → cajaDestinoId (null = sin configurar). */
  destinosPorSucursalId: Record<string, string | null>;
};

export type CobrosPorSucursalVista = {
  filas: CobrosPorSucursalFila[];
  sucursales: CobrosPorSucursalSucursalCol[];
  cajas: CobrosPorSucursalCajaOption[];
};

function mapDbError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2003") return "Hay referencias inválidas (forma, entidad, sucursal o caja).";
    if (code === "P2025") return "Registro no encontrado.";
  }
  return error instanceof Error ? error.message : fallback;
}

function etiquetaCaja(row: {
  entidad: { nombre: string };
  titular: string;
  sucursal: { nombre: string } | null;
  tipoCaja: string;
}): string {
  const suc = row.sucursal?.nombre.toLocaleUpperCase("es-AR") ?? "SIN SUC.";
  return `${row.entidad.nombre.toLocaleUpperCase("es-AR")} · ${row.titular.toLocaleUpperCase("es-AR")} · ${suc} · ${row.tipoCaja}`;
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

export async function listarVistaCobrosPorSucursal(): Promise<CobrosPorSucursalVista> {
  await ensureFinAnaCosFinaSeed();

  const [sucursales, cajasRows, cxHabilitados, destinos] = await Promise.all([
    listarSucursalesCobrosPorSucursal(),
    prisma.cajaTesoreria.findMany({
      where: { tipoCaja: { not: "CHEQUE" } },
      orderBy: [{ titular: "asc" }],
      select: {
        id: true,
        entidadId: true,
        titular: true,
        tipoCaja: true,
        entidad: { select: { nombre: true } },
        sucursal: { select: { nombre: true } },
      },
    }),
    prisma.finAnaCosFina.findMany({
      where: { habilitado: true },
      distinct: ["pagoId", "terminalId"],
      select: {
        pagoId: true,
        terminalId: true,
        pago: { select: { nombre: true } },
        terminal: { select: { nombre: true } },
      },
    }),
    prisma.cobrosPorSucursal.findMany({
      select: {
        pagoId: true,
        entidadId: true,
        sucursalId: true,
        cajaDestinoId: true,
      },
    }),
  ]);

  const destinosPorClave = new Map(
    destinos.map(
      (d) => [`${d.pagoId}:${d.entidadId}:${d.sucursalId}`, d.cajaDestinoId] as const
    )
  );

  const filas: CobrosPorSucursalFila[] = cxHabilitados
    .map((row) => {
      const destinosPorSucursalId: Record<string, string | null> = {};
      for (const suc of sucursales) {
        destinosPorSucursalId[suc.id] =
          destinosPorClave.get(`${row.pagoId}:${row.terminalId}:${suc.id}`) ?? null;
      }
      return {
        pagoId: row.pagoId,
        pagoNombre: row.pago.nombre.toLocaleUpperCase("es-AR"),
        entidadId: row.terminalId,
        entidadNombre: row.terminal.nombre.toLocaleUpperCase("es-AR"),
        destinosPorSucursalId,
      };
    })
    .sort((a, b) => {
      const byPago = a.pagoNombre.localeCompare(b.pagoNombre, "es", {
        sensitivity: "base",
      });
      if (byPago !== 0) return byPago;
      return a.entidadNombre.localeCompare(b.entidadNombre, "es", {
        sensitivity: "base",
      });
    });

  const cajas: CobrosPorSucursalCajaOption[] = cajasRows.map((row) => ({
    id: row.id,
    entidadId: row.entidadId,
    etiqueta: etiquetaCaja(row),
  }));

  return { filas, sucursales, cajas };
}

export async function guardarCobroPorSucursalDestino(
  input: GuardarCobroPorSucursalDestinoInput
): Promise<
  ServiceResult<{
    pagoId: string;
    entidadId: string;
    sucursalId: string;
    cajaDestinoId: string | null;
  }>
> {
  try {
    const vinculo = await prisma.cobrosFormaPagoEntidad.findUnique({
      where: {
        pagoId_entidadId: {
          pagoId: input.pagoId,
          entidadId: input.entidadId,
        },
      },
      select: { pagoId: true, entidadId: true },
    });
    if (!vinculo) {
      return { success: false, error: "Combinación forma de pago × entidad inválida." };
    }

    const hayHabilitado = await prisma.finAnaCosFina.findFirst({
      where: {
        pagoId: input.pagoId,
        terminalId: input.entidadId,
        habilitado: true,
      },
      select: { id: true },
    });
    if (!hayHabilitado) {
      return {
        success: false,
        error: "No hay filas habilitadas en Cx. Fin. para esa forma × entidad.",
      };
    }

    const sucursal = await prisma.sucursal.findFirst({
      where: { id: input.sucursalId, idDeposito: { not: null } },
      select: { id: true },
    });
    if (!sucursal) {
      return { success: false, error: "Sucursal inválida." };
    }

    if (input.cajaDestinoId != null) {
      const caja = await prisma.cajaTesoreria.findFirst({
        where: {
          id: input.cajaDestinoId,
          tipoCaja: { not: "CHEQUE" },
        },
        select: { id: true, entidadId: true },
      });
      if (!caja) {
        return { success: false, error: "Caja destino inválida." };
      }
      if (caja.entidadId !== input.entidadId) {
        return {
          success: false,
          error: "La caja debe ser de la misma entidad que la forma de pago.",
        };
      }
    }

    await prisma.cobrosPorSucursal.upsert({
      where: {
        pagoId_entidadId_sucursalId: {
          pagoId: input.pagoId,
          entidadId: input.entidadId,
          sucursalId: input.sucursalId,
        },
      },
      create: {
        pagoId: input.pagoId,
        entidadId: input.entidadId,
        sucursalId: input.sucursalId,
        cajaDestinoId: input.cajaDestinoId,
      },
      update: {
        cajaDestinoId: input.cajaDestinoId,
      },
    });

    return {
      success: true,
      data: {
        pagoId: input.pagoId,
        entidadId: input.entidadId,
        sucursalId: input.sucursalId,
        cajaDestinoId: input.cajaDestinoId,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo guardar el destino."),
    };
  }
}
