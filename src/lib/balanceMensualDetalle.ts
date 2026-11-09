import type { BalanceGastoMensualFila } from "@/services/finBalGastoMensualBalance.service";
import {
  partCostosVariablesFijos,
  repartoIgualEnteros,
} from "@/lib/balanceMensual";

/** Clave sintética para la fila de reparto de lo que no tiene sucursal (pool). */
export const BALANCE_MENSUAL_RUBRO_REPARTO_CC = "__reparto_cc__" as const;

export type BalanceMensualColumnaDetalle =
  | { ambito: "global" }
  | { ambito: "sucursal"; nombre: string };

export interface BalanceMensualFilaDetalleGasto {
  imputacionId: string;
  gastoFinalId: string;
  gastoNombre: string;
  proveedorNombre: string;
  sucursalNombre: string;
  rubroNombre: string;
  tipoGastoNombre: string;
  monto: number;
}

/**
 * Misma lista ordenada que usa `resumenBalanceMensualDesdeFilas` para columnas por sucursal.
 */
function sucursalesOrdenadasComoResumen(
  filas: BalanceGastoMensualFila[],
  sucursalesGeneranBalance: { id: string; nombre: string }[],
): string[] {
  const nombresSet = new Set<string>();
  for (const s of sucursalesGeneranBalance) nombresSet.add(s.nombre);
  for (const f of filas) {
    if (f.sucursalGeneraBalance) nombresSet.add(f.sucursalNombre);
  }
  return [...nombresSet].sort((a, b) => a.localeCompare(b, "es"));
}

function montoTipo(f: BalanceGastoMensualFila, tipo: "variables" | "fijos"): number {
  const { costosVariables, costosFijos } = partCostosVariablesFijos(
    f.tipoGastoNombre,
    f.monto,
  );
  return tipo === "variables" ? costosVariables : costosFijos;
}

/** Orden de filas en modales de detalle (CV/CF, rubro, tipo, líneas): mayor monto primero. */
function ordenarDetalleBalancePorMontoDesc<T extends { monto: number }>(
  items: T[],
  desempate: (a: T, b: T) => number,
): void {
  items.sort((a, b) => {
    const d = b.monto - a.monto;
    if (d !== 0) return d;
    return desempate(a, b);
  });
}

/** Totales directos, pool y reparto por sucursal (misma lógica que el resumen del balance). */
export function contextoRepartoBalanceMensual(
  filas: BalanceGastoMensualFila[],
  sucursalesGeneranBalance: { id: string; nombre: string }[],
): {
  sucursalesOrdenadas: string[];
  /** Solo la parte repartida del pool (sin sumar imputación directa). */
  repartoPoolCv: number[];
  repartoPoolCf: number[];
  directCv: Record<string, number>;
  directCf: Record<string, number>;
  poolCvTotal: number;
  poolCfTotal: number;
} {
  const sucursalesOrdenadas = sucursalesOrdenadasComoResumen(
    filas,
    sucursalesGeneranBalance,
  );
  const n = sucursalesOrdenadas.length;
  let poolCvTotal = 0;
  let poolCfTotal = 0;
  const directCv: Record<string, number> = Object.fromEntries(
    sucursalesOrdenadas.map((nombre) => [nombre, 0]),
  );
  const directCf: Record<string, number> = Object.fromEntries(
    sucursalesOrdenadas.map((nombre) => [nombre, 0]),
  );

  for (const f of filas) {
    const { costosVariables, costosFijos } = partCostosVariablesFijos(
      f.tipoGastoNombre,
      f.monto,
    );
    if (f.sucursalCentroCosto && !f.sucursalGeneraBalance) {
      poolCvTotal += costosVariables;
      poolCfTotal += costosFijos;
    } else if (f.sucursalGeneraBalance) {
      const k = f.sucursalNombre;
      directCv[k] = (directCv[k] ?? 0) + costosVariables;
      directCf[k] = (directCf[k] ?? 0) + costosFijos;
    }
  }

  const repartoPoolCv = n > 0 ? repartoIgualEnteros(poolCvTotal, n) : [];
  const repartoPoolCf = n > 0 ? repartoIgualEnteros(poolCfTotal, n) : [];

  return {
    sucursalesOrdenadas,
    repartoPoolCv,
    repartoPoolCf,
    directCv,
    directCf,
    poolCvTotal,
    poolCfTotal,
  };
}

export interface BalanceMensualRubroAgrupado {
  clave: string;
  etiqueta: string;
  monto: number;
  esRepartoPool: boolean;
}

/** Selección de rubro dentro de una sección por tipo (modal 1 → 2). */
export type ElegirRubroBalancePayload = {
  rubro: BalanceMensualRubroAgrupado;
  tipoGastoNombre: string | null;
  etiquetaTipo: string;
};

/** Rubros con montos coherentes con la celda del balance (global o sucursal × variable/fijo). */
export function agruparRubrosCostoMensual(
  filas: BalanceGastoMensualFila[],
  sucursalesGeneranBalance: { id: string; nombre: string }[],
  columna: BalanceMensualColumnaDetalle,
  tipo: "variables" | "fijos",
): BalanceMensualRubroAgrupado[] {
  const ctx = contextoRepartoBalanceMensual(filas, sucursalesGeneranBalance);
  const mapa = new Map<string, number>();

  if (columna.ambito === "global") {
    for (const f of filas) {
      const m = montoTipo(f, tipo);
      if (m <= 0) continue;
      const r = f.rubroNombre.trim() || "Sin rubro";
      mapa.set(r, (mapa.get(r) ?? 0) + m);
    }
  } else {
    const nombre = columna.nombre;
    const idx = ctx.sucursalesOrdenadas.indexOf(nombre);
    if (idx < 0) return [];

    for (const f of filas) {
      const m = montoTipo(f, tipo);
      if (m <= 0) continue;
      if (f.sucursalGeneraBalance && f.sucursalNombre === nombre) {
        const r = f.rubroNombre.trim() || "Sin rubro";
        mapa.set(r, (mapa.get(r) ?? 0) + m);
      }
    }

    const poolPart =
      tipo === "variables"
        ? ctx.repartoPoolCv[idx] ?? 0
        : ctx.repartoPoolCf[idx] ?? 0;

    if (poolPart > 0) {
      mapa.set(BALANCE_MENSUAL_RUBRO_REPARTO_CC, poolPart);
    }
  }

  const filasOut: BalanceMensualRubroAgrupado[] = [];
  for (const [clave, monto] of mapa) {
    if (monto <= 0) continue;
    filasOut.push({
      clave,
      etiqueta:
        clave === BALANCE_MENSUAL_RUBRO_REPARTO_CC
          ? "Sin sucursal (reparto entre sucursales)"
          : clave,
      monto,
      esRepartoPool: clave === BALANCE_MENSUAL_RUBRO_REPARTO_CC,
    });
  }
  ordenarDetalleBalancePorMontoDesc(filasOut, (a, b) =>
    a.etiqueta.localeCompare(b.etiqueta, "es"),
  );
  return filasOut;
}

/** Sección por tipo de gasto con rubros (modal 1 del balance mensual). */
export interface BalanceMensualSeccionTipoRubros {
  /** `null` solo en el bloque de reparto de centros de costo (sucursal). */
  tipoGastoNombre: string | null;
  etiquetaTipo: string;
  rubros: BalanceMensualRubroAgrupado[];
}

export function agruparTiposYRubrosCostoMensual(
  filas: BalanceGastoMensualFila[],
  sucursalesGeneranBalance: { id: string; nombre: string }[],
  columna: BalanceMensualColumnaDetalle,
  tipoCosto: "variables" | "fijos",
): BalanceMensualSeccionTipoRubros[] {
  const secciones: BalanceMensualSeccionTipoRubros[] = [];
  const tiposOrden: string[] = [];
  const mapaTipoRubro = new Map<string, Map<string, number>>();

  function acumular(tipo: string, rubro: string, m: number) {
    if (!mapaTipoRubro.has(tipo)) {
      mapaTipoRubro.set(tipo, new Map());
      tiposOrden.push(tipo);
    }
    const mr = mapaTipoRubro.get(tipo)!;
    mr.set(rubro, (mr.get(rubro) ?? 0) + m);
  }

  if (columna.ambito === "global") {
    for (const f of filas) {
      const m = montoTipo(f, tipoCosto);
      if (m <= 0) continue;
      const r = f.rubroNombre.trim() || "Sin rubro";
      acumular(f.tipoGastoNombre, r, m);
    }
  } else {
    const nombre = columna.nombre;
    const ctx = contextoRepartoBalanceMensual(filas, sucursalesGeneranBalance);
    const idx = ctx.sucursalesOrdenadas.indexOf(nombre);
    if (idx < 0) return [];

    for (const f of filas) {
      const m = montoTipo(f, tipoCosto);
      if (m <= 0) continue;
      if (f.sucursalGeneraBalance && f.sucursalNombre === nombre) {
        const r = f.rubroNombre.trim() || "Sin rubro";
        acumular(f.tipoGastoNombre, r, m);
      }
    }
  }

  function sumaMontosTipo(t: string): number {
    let s = 0;
    for (const m of mapaTipoRubro.get(t)!.values()) s += m;
    return s;
  }
  tiposOrden.sort((a, b) => {
    const d = sumaMontosTipo(b) - sumaMontosTipo(a);
    if (d !== 0) return d;
    return a.localeCompare(b, "es");
  });
  for (const tipo of tiposOrden) {
    const mr = mapaTipoRubro.get(tipo)!;
    const rubros: BalanceMensualRubroAgrupado[] = [];
    for (const [clave, monto] of mr) {
      if (monto <= 0) continue;
      rubros.push({
        clave,
        etiqueta: clave,
        monto,
        esRepartoPool: false,
      });
    }
    ordenarDetalleBalancePorMontoDesc(rubros, (a, b) =>
      a.etiqueta.localeCompare(b.etiqueta, "es"),
    );
    secciones.push({
      tipoGastoNombre: tipo,
      etiquetaTipo: tipo,
      rubros,
    });
  }

  if (columna.ambito === "sucursal") {
    const ctx = contextoRepartoBalanceMensual(filas, sucursalesGeneranBalance);
    const idx = ctx.sucursalesOrdenadas.indexOf(columna.nombre);
    if (idx >= 0) {
      const poolPart =
        tipoCosto === "variables"
          ? ctx.repartoPoolCv[idx] ?? 0
          : ctx.repartoPoolCf[idx] ?? 0;
      if (poolPart > 0) {
        secciones.push({
          tipoGastoNombre: null,
          etiquetaTipo: "Reparto entre sucursales",
          rubros: [
            {
              clave: BALANCE_MENSUAL_RUBRO_REPARTO_CC,
              etiqueta: "Sin sucursal (reparto entre sucursales)",
              monto: poolPart,
              esRepartoPool: true,
            },
          ],
        });
      }
    }
  }

  return secciones;
}

/**
 * Total del tipo de gasto en la celda del balance (para % sobre tipo).
 * En sucursal incluye la parte proporcional del pool de centros de costo.
 */
export function totalMontoTipoEnCelda(
  filas: BalanceGastoMensualFila[],
  sucursalesGeneranBalance: { id: string; nombre: string }[],
  columna: BalanceMensualColumnaDetalle,
  tipoCosto: "variables" | "fijos",
  tipoGastoNombre: string,
): number {
  if (columna.ambito === "global") {
    let t = 0;
    for (const f of filas) {
      if (f.tipoGastoNombre !== tipoGastoNombre) continue;
      const m = montoTipo(f, tipoCosto);
      if (m > 0) t += m;
    }
    return t;
  }

  const ctx = contextoRepartoBalanceMensual(filas, sucursalesGeneranBalance);
  const nombre = columna.nombre;
  const idx = ctx.sucursalesOrdenadas.indexOf(nombre);
  if (idx < 0) return 0;

  const poolTotal = tipoCosto === "variables" ? ctx.poolCvTotal : ctx.poolCfTotal;
  const repartoPart =
    tipoCosto === "variables"
      ? ctx.repartoPoolCv[idx] ?? 0
      : ctx.repartoPoolCf[idx] ?? 0;
  const factor = poolTotal > 0 ? repartoPart / poolTotal : 0;

  let direct = 0;
  for (const f of filas) {
    if (f.tipoGastoNombre !== tipoGastoNombre) continue;
    const m = montoTipo(f, tipoCosto);
    if (m <= 0) continue;
    if (f.sucursalGeneraBalance && f.sucursalNombre === nombre) direct += m;
  }

  let poolTipo = 0;
  for (const f of filas) {
    if (f.tipoGastoNombre !== tipoGastoNombre) continue;
    const m = montoTipo(f, tipoCosto);
    if (m <= 0) continue;
    if (f.sucursalCentroCosto && !f.sucursalGeneraBalance) poolTipo += m;
  }

  return direct + poolTipo * factor;
}

export interface BalanceMensualGastoAgregado {
  gastoNombre: string;
  monto: number;
  /** Cantidad de imputaciones (líneas) agrupadas bajo este nombre de gasto. */
  cantidadLineas: number;
  /** Al menos una línea tiene gasto final vinculado (permite evolución / histórico). */
  tieneHistorialDisponible: boolean;
  /**
   * `gastoFinalId` representativo para evolución mensual (línea con mayor monto entre las del mismo nombre).
   * Vacío si no hay historial.
   */
  gastoFinalId: string;
}

/** Gastos agregados por nombre para un rubro (y tipo, salvo reparto CC). Orden: mayor monto primero. */
export function listarGastosAgregadosPorRubroTipo(
  filas: BalanceGastoMensualFila[],
  columna: BalanceMensualColumnaDetalle,
  tipoCosto: "variables" | "fijos",
  rubroClave: string,
  tipoGastoNombre: string | null,
): BalanceMensualGastoAgregado[] {
  const lineas = listarGastosDetalleRubro(filas, columna, tipoCosto, rubroClave, {
    tipoGastoNombre,
  });
  const mapa = new Map<
    string,
    {
      monto: number;
      cantidadLineas: number;
      tieneHistorialDisponible: boolean;
      gastoFinalId: string;
      maxMontoHistorial: number;
    }
  >();
  for (const L of lineas) {
    const cur = mapa.get(L.gastoNombre) ?? {
      monto: 0,
      cantidadLineas: 0,
      tieneHistorialDisponible: false,
      gastoFinalId: "",
      maxMontoHistorial: -1,
    };
    cur.monto += L.monto;
    cur.cantidadLineas += 1;
    const gid = L.gastoFinalId.trim();
    if (gid) {
      cur.tieneHistorialDisponible = true;
      if (L.monto > cur.maxMontoHistorial) {
        cur.maxMontoHistorial = L.monto;
        cur.gastoFinalId = L.gastoFinalId.trim();
      }
    }
    mapa.set(L.gastoNombre, cur);
  }
  const out: BalanceMensualGastoAgregado[] = [];
  for (const [gastoNombre, v] of mapa) {
    if (v.monto <= 0) continue;
    out.push({
      gastoNombre,
      monto: v.monto,
      cantidadLineas: v.cantidadLineas,
      tieneHistorialDisponible: v.tieneHistorialDisponible,
      gastoFinalId: v.tieneHistorialDisponible ? v.gastoFinalId : "",
    });
  }
  ordenarDetalleBalancePorMontoDesc(out, (a, b) =>
    a.gastoNombre.localeCompare(b.gastoNombre, "es"),
  );
  return out;
}

export type ListarGastosDetalleRubroFiltros = {
  tipoGastoNombre?: string | null;
  gastoNombre?: string | null;
};

/** Líneas de gasto para un rubro (o listado del pool CC para la clave sintética). */
export function listarGastosDetalleRubro(
  filas: BalanceGastoMensualFila[],
  columna: BalanceMensualColumnaDetalle,
  tipo: "variables" | "fijos",
  rubroClave: string,
  filtros?: ListarGastosDetalleRubroFiltros,
): BalanceMensualFilaDetalleGasto[] {
  const tipoGastoNombre = filtros?.tipoGastoNombre;
  const gastoNombre = filtros?.gastoNombre;

  const out: BalanceMensualFilaDetalleGasto[] = [];

  const pasaTipo = (f: BalanceGastoMensualFila) => {
    if (rubroClave === BALANCE_MENSUAL_RUBRO_REPARTO_CC) return true;
    if (tipoGastoNombre === undefined || tipoGastoNombre === null) return true;
    return f.tipoGastoNombre === tipoGastoNombre;
  };

  const pasaGasto = (f: BalanceGastoMensualFila) => {
    if (gastoNombre === undefined || gastoNombre === null) return true;
    return f.gastoNombre === gastoNombre;
  };

  if (rubroClave === BALANCE_MENSUAL_RUBRO_REPARTO_CC) {
    if (columna.ambito !== "sucursal") return [];
    for (const f of filas) {
      if (!(f.sucursalCentroCosto && !f.sucursalGeneraBalance)) continue;
      const m = montoTipo(f, tipo);
      if (m <= 0) continue;
      if (!pasaGasto(f)) continue;
      out.push({
        imputacionId: f.id,
        gastoFinalId: f.gastoFinalId,
        gastoNombre: f.gastoNombre,
        proveedorNombre: f.proveedorNombre,
        sucursalNombre: f.sucursalNombre,
        rubroNombre: f.rubroNombre,
        tipoGastoNombre: f.tipoGastoNombre,
        monto: m,
      });
    }
    ordenarDetalleBalancePorMontoDesc(out, (a, b) =>
      `${a.gastoNombre}|${a.sucursalNombre}`.localeCompare(
        `${b.gastoNombre}|${b.sucursalNombre}`,
        "es",
      ),
    );
    return out;
  }

  if (columna.ambito === "global") {
    for (const f of filas) {
      const r = f.rubroNombre.trim() || "Sin rubro";
      if (r !== rubroClave) continue;
      if (!pasaTipo(f)) continue;
      if (!pasaGasto(f)) continue;
      const m = montoTipo(f, tipo);
      if (m <= 0) continue;
      out.push({
        imputacionId: f.id,
        gastoFinalId: f.gastoFinalId,
        gastoNombre: f.gastoNombre,
        proveedorNombre: f.proveedorNombre,
        sucursalNombre: f.sucursalNombre,
        rubroNombre: f.rubroNombre,
        tipoGastoNombre: f.tipoGastoNombre,
        monto: m,
      });
    }
  } else {
    const nombre = columna.nombre;
    for (const f of filas) {
      if (!f.sucursalGeneraBalance || f.sucursalNombre !== nombre) continue;
      const r = f.rubroNombre.trim() || "Sin rubro";
      if (r !== rubroClave) continue;
      if (!pasaTipo(f)) continue;
      if (!pasaGasto(f)) continue;
      const m = montoTipo(f, tipo);
      if (m <= 0) continue;
      out.push({
        imputacionId: f.id,
        gastoFinalId: f.gastoFinalId,
        gastoNombre: f.gastoNombre,
        proveedorNombre: f.proveedorNombre,
        sucursalNombre: f.sucursalNombre,
        rubroNombre: f.rubroNombre,
        tipoGastoNombre: f.tipoGastoNombre,
        monto: m,
      });
    }
  }

  ordenarDetalleBalancePorMontoDesc(out, (a, b) =>
    `${a.gastoNombre}|${a.proveedorNombre}`.localeCompare(
      `${b.gastoNombre}|${b.proveedorNombre}`,
      "es",
    ),
  );
  return out;
}

/**
 * `gastoFinalId` de la línea con mayor monto (entre las que tienen id) dentro del rubro,
 * para abrir evolución mensual desde el modal por rubro.
 */
export function resolverGastoFinalIdHistorialRubro(
  filas: BalanceGastoMensualFila[],
  columna: BalanceMensualColumnaDetalle,
  tipoCosto: "variables" | "fijos",
  rubroClave: string,
): string | null {
  const lineas = listarGastosDetalleRubro(filas, columna, tipoCosto, rubroClave, {});
  let bestId: string | null = null;
  let bestMonto = -1;
  for (const L of lineas) {
    const id = L.gastoFinalId?.trim() ?? "";
    if (!id) continue;
    if (L.monto > bestMonto) {
      bestMonto = L.monto;
      bestId = id;
    }
  }
  return bestId;
}
