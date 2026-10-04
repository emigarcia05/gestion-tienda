import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types";

export type SucursalCodigoTransf = "guaymallen" | "maipu";

export type ControlTransfDepositosReciente = {
  codTienda: string;
  cantidad: number;
  createdAtIso: string;
};

export type HistorialTransfDepositosItem = {
  createdAtIso: string;
  cantidad: number;
};

export type HistorialTransfDepositosSeccion = {
  origenCodigo: SucursalCodigoTransf;
  destinoCodigo: SucursalCodigoTransf;
  titulo: string;
  items: HistorialTransfDepositosItem[];
};

async function idsSucursalesPorCodigo(
  origen: SucursalCodigoTransf,
  destino: SucursalCodigoTransf
): Promise<ServiceResult<{ sucOrigen: string; sucDestino: string }>> {
  const rows = await prisma.sucursal.findMany({
    where: { codigo: { in: [origen, destino] } },
    select: { id: true, codigo: true },
  });
  const origenRow = rows.find((r) => r.codigo === origen);
  const destinoRow = rows.find((r) => r.codigo === destino);
  if (!origenRow || !destinoRow) {
    return {
      success: false,
      error: "Sucursal origen o destino no encontrada.",
    };
  }
  return {
    success: true,
    data: { sucOrigen: origenRow.id, sucDestino: destinoRow.id },
  };
}

/** `stock_trasn_depositos` eliminada: no hay controles recientes persistidos. */
export async function listarControlesRecientesTransfDepositos(
  _origen: SucursalCodigoTransf,
  _destino: SucursalCodigoTransf,
  _codTiendas: string[]
): Promise<ControlTransfDepositosReciente[]> {
  return [];
}

/** `stock_trasn_depositos` eliminada: historial vacío. */
export async function listarHistorialTransfDepositosPorProducto(
  _codTienda: string
): Promise<HistorialTransfDepositosSeccion[]> {
  return [];
}

/**
 * Valida origen≠destino. Cada sucursal es depósito.
 * El ledger `stock_movimientos` se escribe al confirmar Transferido (próximo cableado con ítems).
 */
export async function registrarTransferenciasDepositos(input: {
  origen: SucursalCodigoTransf;
  destino: SucursalCodigoTransf;
  items: { codTienda: string; cantidad: number }[];
}): Promise<ServiceResult<{ creados: number }>> {
  try {
    if (input.origen === input.destino) {
      return { success: false, error: "Origen y destino deben ser distintos." };
    }
    if (input.items.length === 0) {
      return { success: false, error: "No hay cantidades para registrar." };
    }
    const sucursales = await idsSucursalesPorCodigo(input.origen, input.destino);
    if (!sucursales.success) return sucursales;
    const ok = await validarParSucursales(
      sucursales.data.sucOrigen,
      sucursales.data.sucDestino
    );
    if (!ok.success) return ok;
    return { success: true, data: { creados: input.items.length } };
  } catch (e) {
    console.error("[registrarTransferenciasDepositos]", e);
    const message =
      e instanceof Error ? e.message : "Error al registrar transferencias.";
    return { success: false, error: message };
  }
}

export type SucursalTransfDepositoOption = {
  id: string;
  codigo: string;
  nombre: string;
  /** Cada sucursal es depósito. Siempre `true`. */
  tieneDeposito: boolean;
};

export type LoteAbiertoTransfDepositoItem = {
  codTienda: string;
  descripcionTienda: string;
  cantidad: number;
};

export async function listarSucursalesTransfDepositos(): Promise<
  SucursalTransfDepositoOption[]
> {
  try {
    const rows = await prisma.sucursal.findMany({
      select: {
        id: true,
        codigo: true,
        nombre: true,
      },
      orderBy: { nombre: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      tieneDeposito: true,
    }));
  } catch (e) {
    console.error("[listarSucursalesTransfDepositos]", e);
    return [];
  }
}

async function validarParSucursales(
  sucOrigenId: string,
  sucDestinoId: string
): Promise<ServiceResult<void>> {
  if (sucOrigenId === sucDestinoId) {
    return { success: false, error: "Origen y destino deben ser distintos." };
  }
  const rows = await prisma.sucursal.findMany({
    where: { id: { in: [sucOrigenId, sucDestinoId] } },
    select: { id: true },
  });
  if (rows.length !== 2) {
    return { success: false, error: "Sucursal origen o destino no encontrada." };
  }
  return { success: true, data: undefined };
}

export async function listarLoteAbiertoTransfDepositosPorCodigos(
  _origen: SucursalCodigoTransf,
  _destino: SucursalCodigoTransf
): Promise<LoteAbiertoTransfDepositoItem[]> {
  return [];
}

export async function listarLoteAbiertoTransfDepositos(_input: {
  sucOrigenId: string;
  sucDestinoId: string;
}): Promise<LoteAbiertoTransfDepositoItem[]> {
  return [];
}

/** `stock_trasn_depositos` eliminada: no hay lote que borrar. */
export async function marcarTransferidoTransfDepositos(input: {
  sucOrigenId: string;
  sucDestinoId: string;
}): Promise<ServiceResult<{ borrados: number }>> {
  const ok = await validarParSucursales(input.sucOrigenId, input.sucDestinoId);
  if (!ok.success) return ok;
  return { success: true, data: { borrados: 0 } };
}
