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

export type CobrosPorSucursalFila = {
  cobrosCxFinId: string;
  pagoNombre: string;
  entidadId: string;
  entidadNombre: string;
  cuotas: string | null;
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
    if (code === "P2003") return "Hay referencias inválidas (medio, sucursal o caja).";
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

  const [sucursales, cajasRows, cxRows, destinos] = await Promise.all([
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
      select: {
        id: true,
        terminalId: true,
        terminal: { select: { nombre: true } },
        pago: { select: { nombre: true } },
        cuota: { select: { cuotas: true } },
      },
    }),
    prisma.cobrosPorSucursal.findMany({
      select: {
        cobrosCxFinId: true,
        sucursalId: true,
        cajaDestinoId: true,
      },
    }),
  ]);

  const destinosPorClave = new Map(
    destinos.map((d) => [`${d.cobrosCxFinId}:${d.sucursalId}`, d.cajaDestinoId])
  );

  const filas: CobrosPorSucursalFila[] = cxRows
    .map((row) => {
      const destinosPorSucursalId: Record<string, string | null> = {};
      for (const suc of sucursales) {
        destinosPorSucursalId[suc.id] =
          destinosPorClave.get(`${row.id}:${suc.id}`) ?? null;
      }
      return {
        cobrosCxFinId: row.id,
        pagoNombre: row.pago.nombre.toLocaleUpperCase("es-AR"),
        entidadId: row.terminalId,
        entidadNombre: row.terminal.nombre.toLocaleUpperCase("es-AR"),
        cuotas: row.cuota?.cuotas ?? null,
        destinosPorSucursalId,
      };
    })
    .sort((a, b) => {
      const byPago = a.pagoNombre.localeCompare(b.pagoNombre, "es", {
        sensitivity: "base",
      });
      if (byPago !== 0) return byPago;
      const byEnt = a.entidadNombre.localeCompare(b.entidadNombre, "es", {
        sensitivity: "base",
      });
      if (byEnt !== 0) return byEnt;
      return (a.cuotas ?? "").localeCompare(b.cuotas ?? "", "es", {
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
): Promise<ServiceResult<{ cobrosCxFinId: string; sucursalId: string; cajaDestinoId: string | null }>> {
  try {
    const cx = await prisma.finAnaCosFina.findFirst({
      where: { id: input.cobrosCxFinId, habilitado: true },
      select: { id: true, terminalId: true },
    });
    if (!cx) {
      return { success: false, error: "Medio de cobro no encontrado o no habilitado." };
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
      if (caja.entidadId !== cx.terminalId) {
        return {
          success: false,
          error: "La caja debe ser de la misma entidad que el medio de cobro.",
        };
      }
    }

    await prisma.cobrosPorSucursal.upsert({
      where: {
        cobrosCxFinId_sucursalId: {
          cobrosCxFinId: input.cobrosCxFinId,
          sucursalId: input.sucursalId,
        },
      },
      create: {
        cobrosCxFinId: input.cobrosCxFinId,
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
        cobrosCxFinId: input.cobrosCxFinId,
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
