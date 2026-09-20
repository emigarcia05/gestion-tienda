import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types";
import {
  SUCURSAL_LABEL_TRANSF,
  TRANSF_DEPOSITOS_VENTANA_DUPLICADO_DIAS,
  TRANSF_DEPOSITOS_VENTANA_HISTORIAL_DIAS,
} from "@/lib/transfDepositosControl";

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
  /** Ej. `GUAYMALLÉN → MAIPÚ`. */
  titulo: string;
  items: HistorialTransfDepositosItem[];
};

function desdeVentanaDuplicado(): Date {
  const d = new Date();
  d.setDate(d.getDate() - TRANSF_DEPOSITOS_VENTANA_DUPLICADO_DIAS);
  return d;
}

function desdeVentanaHistorial(): Date {
  const d = new Date();
  d.setDate(d.getDate() - TRANSF_DEPOSITOS_VENTANA_HISTORIAL_DIAS);
  return d;
}

function esSucursalCodigoTransf(
  codigo: string
): codigo is SucursalCodigoTransf {
  return codigo === "guaymallen" || codigo === "maipu";
}

function labelSucursal(codigo: string): string {
  if (esSucursalCodigoTransf(codigo)) {
    return SUCURSAL_LABEL_TRANSF[codigo];
  }
  return codigo.toUpperCase();
}

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

/**
 * Controles recientes del par origen→destino (ventana anti-duplicado),
 * para pintar advertencias en la grilla.
 */
export async function listarControlesRecientesTransfDepositos(
  origen: SucursalCodigoTransf,
  destino: SucursalCodigoTransf,
  codTiendas: string[]
): Promise<ControlTransfDepositosReciente[]> {
  if (origen === destino || codTiendas.length === 0) return [];
  const sucursales = await idsSucursalesPorCodigo(origen, destino);
  if (!sucursales.success) return [];
  const desde = desdeVentanaDuplicado();
  const rows = await prisma.stockTrasnDeposito.findMany({
    where: {
      sucOrigen: sucursales.data.sucOrigen,
      sucDestino: sucursales.data.sucDestino,
      codTienda: { in: codTiendas },
      createdAt: { gte: desde },
    },
    orderBy: { createdAt: "desc" },
    select: {
      codTienda: true,
      cant: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    codTienda: r.codTienda,
    cantidad: r.cant,
    createdAtIso: r.createdAt.toISOString(),
  }));
}

/**
 * Historial de transferencias de un producto (cualquier par origen→destino)
 * en la ventana de historial, agrupado por sección.
 */
export async function listarHistorialTransfDepositosPorProducto(
  codTienda: string
): Promise<HistorialTransfDepositosSeccion[]> {
  const desde = desdeVentanaHistorial();
  const rows = await prisma.stockTrasnDeposito.findMany({
    where: {
      codTienda,
      createdAt: { gte: desde },
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      cant: true,
      createdAt: true,
      sucursalOrigen: { select: { codigo: true } },
      sucursalDestino: { select: { codigo: true } },
    },
  });

  const porPar = new Map<string, HistorialTransfDepositosSeccion>();
  for (const r of rows) {
    const origenCodigo = r.sucursalOrigen.codigo;
    const destinoCodigo = r.sucursalDestino.codigo;
    if (
      !esSucursalCodigoTransf(origenCodigo) ||
      !esSucursalCodigoTransf(destinoCodigo)
    ) {
      continue;
    }
    const key = `${origenCodigo}|${destinoCodigo}`;
    let seccion = porPar.get(key);
    if (!seccion) {
      seccion = {
        origenCodigo,
        destinoCodigo,
        titulo: `${labelSucursal(origenCodigo)} → ${labelSucursal(destinoCodigo)}`,
        items: [],
      };
      porPar.set(key, seccion);
    }
    seccion.items.push({
      createdAtIso: r.createdAt.toISOString(),
      cantidad: r.cant,
    });
  }

  return Array.from(porPar.values()).sort((a, b) =>
    a.titulo.localeCompare(b.titulo, "es")
  );
}

/**
 * Reemplaza el lote pendiente del par origen→destino en `stock_trasn_depositos`
 * (delete + create). Re-Generar Transf. no duplica filas.
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
    if (!sucursales.success) {
      return sucursales;
    }

    await prisma.$transaction(async (tx) => {
      await tx.stockTrasnDeposito.deleteMany({
        where: {
          sucOrigen: sucursales.data.sucOrigen,
          sucDestino: sucursales.data.sucDestino,
        },
      });
      await tx.stockTrasnDeposito.createMany({
        data: input.items.map((it) => ({
          codTienda: it.codTienda,
          cant: it.cantidad,
          sucOrigen: sucursales.data.sucOrigen,
          sucDestino: sucursales.data.sucDestino,
        })),
      });
    });

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
  /** `sucursales.id_deposito` no nulo. */
  tieneDeposito: boolean;
};

export type PendienteTransfDepositoItem = {
  codTienda: string;
  descripcionTienda: string;
  cantidad: number;
};

/** Sucursales de `sucursales` para selectores origen/destino. */
export async function listarSucursalesTransfDepositos(): Promise<
  SucursalTransfDepositoOption[]
> {
  try {
    const rows = await prisma.sucursal.findMany({
      select: { id: true, codigo: true, nombre: true, idDeposito: true },
      orderBy: { nombre: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      tieneDeposito: r.idDeposito != null,
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
    select: { id: true, idDeposito: true },
  });
  if (rows.length !== 2) {
    return { success: false, error: "Sucursal origen o destino no encontrada." };
  }
  const destino = rows.find((r) => r.id === sucDestinoId);
  if (!destino || destino.idDeposito == null) {
    return {
      success: false,
      error: "La sucursal destino no tiene depósito.",
    };
  }
  return { success: true, data: undefined };
}

/**
 * Pendientes del par origen→destino por código de sucursal (grilla / hidratar borrador).
 */
export async function listarPendientesTransfDepositosPorCodigos(
  origen: SucursalCodigoTransf,
  destino: SucursalCodigoTransf
): Promise<PendienteTransfDepositoItem[]> {
  if (origen === destino) return [];
  const sucursales = await idsSucursalesPorCodigo(origen, destino);
  if (!sucursales.success) return [];
  return listarPendientesTransfDepositos({
    sucOrigenId: sucursales.data.sucOrigen,
    sucDestinoId: sucursales.data.sucDestino,
  });
}

/**
 * Ítems pendientes de `stock_trasn_depositos` para un par origen→destino,
 * agrupados por `cod_tienda` (suma `cant`).
 */
export async function listarPendientesTransfDepositos(input: {
  sucOrigenId: string;
  sucDestinoId: string;
}): Promise<PendienteTransfDepositoItem[]> {
  const ok = await validarParSucursales(input.sucOrigenId, input.sucDestinoId);
  if (!ok.success) return [];
  try {
    const rows = await prisma.stockTrasnDeposito.findMany({
        where: {
        sucOrigen: input.sucOrigenId,
        sucDestino: input.sucDestinoId,
      },
      select: {
        cant: true,
        prodTienda: {
          select: { codTienda: true, descripcionTienda: true },
        },
      },
    });
    const porCodigo = new Map<string, PendienteTransfDepositoItem>();
    for (const r of rows) {
      const prev = porCodigo.get(r.prodTienda.codTienda);
      if (prev) {
        prev.cantidad += r.cant;
        continue;
      }
      porCodigo.set(r.prodTienda.codTienda, {
        codTienda: r.prodTienda.codTienda,
        descripcionTienda: r.prodTienda.descripcionTienda ?? "",
        cantidad: r.cant,
      });
    }
    return Array.from(porCodigo.values()).sort((a, b) =>
      a.descripcionTienda.localeCompare(b.descripcionTienda, "es")
    );
  } catch (e) {
    console.error("[listarPendientesTransfDepositos]", e);
    return [];
  }
}

/**
 * Marca el lote como transferido: borra las filas del par origen→destino.
 */
export async function marcarTransferidoTransfDepositos(input: {
  sucOrigenId: string;
  sucDestinoId: string;
}): Promise<ServiceResult<{ borrados: number }>> {
  try {
    const ok = await validarParSucursales(input.sucOrigenId, input.sucDestinoId);
    if (!ok.success) return ok;
    const result = await prisma.stockTrasnDeposito.deleteMany({
      where: {
        sucOrigen: input.sucOrigenId,
        sucDestino: input.sucDestinoId,
      },
    });
    if (result.count === 0) {
      return { success: false, error: "No hay transferencias para marcar." };
    }
    return { success: true, data: { borrados: result.count } };
  } catch (e) {
    console.error("[marcarTransferidoTransfDepositos]", e);
    const message =
      e instanceof Error ? e.message : "Error al marcar transferido.";
    return { success: false, error: message };
  }
}

/**
 * True si la sucursal (código) figura como **SUC. ORIGEN** en `stock_trasn_depositos`.
 */
export async function hayPendientesTransfDepositosComoOrigen(
  sucursalCodigo: SucursalCodigoTransf
): Promise<boolean> {
  try {
    const suc = await prisma.sucursal.findUnique({
      where: { codigo: sucursalCodigo },
      select: { id: true },
    });
    if (!suc) return false;
    const n = await prisma.stockTrasnDeposito.count({
      where: { sucOrigen: suc.id },
    });
    return n > 0;
  } catch (e) {
    console.error("[hayPendientesTransfDepositosComoOrigen]", e);
    return false;
  }
}
