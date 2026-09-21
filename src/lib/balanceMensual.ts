import type { BalanceGastoMensualFila } from "@/services/finBalGastoMensualBalance.service";

export interface BalanceMensualBloque {
  ventas: number;
  costosVariables: number;
  costosFijos: number;
  resultadoOperativo: number;
  /** Porcentaje sobre ventas; `null` si no hay ventas. */
  margenContribucionPct: number | null;
  resultadoEjercicio: number;
}

export interface BalanceMensualSucursalBloque {
  /** `sucursalNombre` en MAYÚSCULAS (como en imputaciones). */
  nombre: string;
  /** `sucursales.id` si la sucursal está en el listado con `genera_balance` (vacío si solo aparece por imputaciones huérfanas). */
  sucursalId: string;
  bloque: BalanceMensualBloque;
}

export interface BalanceMensualResumen {
  global: BalanceMensualBloque;
  /**
   * Una entrada por sucursal con `genera_balance = true` en DB, orden alfabético por nombre.
   * Cada bloque = imputaciones directas a esa sucursal + parte **igual** del pool de
   * sucursales con `centro_costo = true` y `genera_balance = false`.
   */
  sucursales: BalanceMensualSucursalBloque[];
}

export function partCostosVariablesFijos(tipoGastoNombre: string, monto: number): {
  costosVariables: number;
  costosFijos: number;
} {
  const u = tipoGastoNombre.toUpperCase();
  if (u.includes("VARIABLE")) return { costosVariables: monto, costosFijos: 0 };
  if (u.includes("FIJO")) return { costosVariables: 0, costosFijos: monto };
  return { costosVariables: 0, costosFijos: monto };
}

/** Texto para UI: porcentaje de margen de contribución sobre ventas. */
export function fmtMargenContribucionPct(p: number | null): string {
  if (p === null) return "—";
  return `${p.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

/**
 * Ventas mínimas en pesos para cubrir costos fijos, con el mix actual
 * (ratio de contribución = resultado operativo / ventas).
 * `null` si no es calculable (sin ventas, sin margen positivo o sin costos fijos).
 */
export function puntoEquilibrioVentasPesos(b: BalanceMensualBloque): number | null {
  const { ventas, resultadoOperativo, costosFijos } = b;
  if (ventas <= 0 || resultadoOperativo <= 0 || costosFijos <= 0) return null;
  const ratio = resultadoOperativo / ventas;
  if (ratio <= 0) return null;
  return Math.round(costosFijos / ratio);
}

function construirBloque(ventas: number, cv: number, cf: number): BalanceMensualBloque {
  const resultadoOperativo = ventas - cv;
  const resultadoEjercicio = ventas - cv - cf;
  const margenContribucionPct =
    ventas > 0 ? Math.round((resultadoOperativo / ventas) * 10000) / 100 : null;
  return {
    ventas,
    costosVariables: cv,
    costosFijos: cf,
    resultadoOperativo,
    margenContribucionPct,
    resultadoEjercicio,
  };
}

/**
 * Reparte `total` en `cantidad` partes enteras lo más iguales posible (el resto se suma
 * a las primeras entradas del arreglo).
 */
export function repartoIgualEnteros(total: number, cantidad: number): number[] {
  if (cantidad <= 0) return [];
  if (total === 0) return Array(cantidad).fill(0);
  const base = Math.floor(total / cantidad);
  const rem = total - base * cantidad;
  const out: number[] = [];
  for (let i = 0; i < cantidad; i++) {
    out.push(base + (i < rem ? 1 : 0));
  }
  return out;
}

/**
 * Resume imputaciones del mes para balance mensual.
 *
 * - **Global:** todas las imputaciones (cualquier sucursal).
 * - **Por sucursal:** solo sucursales con `genera_balance === true`. A cada una se le suman
 *   los montos imputados directamente a esa sucursal **más** una parte **igual** del total de
 *   costos variables/fijos imputados a sucursales con `centro_costo === true` y `genera_balance === false`.
 *
 * Clasificación costos: tipo contiene `VARIABLE` → variable; `FIJO` → fijo; si no, **fijo**.
 *
 * **Ventas:** montos cargados en `fin_bal_vtas` por sucursal / mes / año (`ventasPorSucursalNombre`).
 * El bloque **Global** usa la suma de esas ventas (solo sucursales que generan balance en el periodo).
 */
export function resumenBalanceMensualDesdeFilas(
  filas: BalanceGastoMensualFila[],
  ventasPorSucursalNombre: Record<string, number>,
  sucursalesGeneranBalance: { id: string; nombre: string }[]
): BalanceMensualResumen {
  let gCv = 0;
  let gCf = 0;
  let poolCv = 0;
  let poolCf = 0;

  const byNombreFromDb = new Map(sucursalesGeneranBalance.map((s) => [s.nombre, s.id] as const));
  const nombresSet = new Set<string>();
  for (const s of sucursalesGeneranBalance) nombresSet.add(s.nombre);
  for (const f of filas) {
    if (f.sucursalGeneraBalance) nombresSet.add(f.sucursalNombre);
  }
  const sucursalesOrdenadas = [...nombresSet].sort((a, b) => a.localeCompare(b, "es"));

  const directCv: Record<string, number> = Object.fromEntries(
    sucursalesOrdenadas.map((n) => [n, 0])
  );
  const directCf: Record<string, number> = Object.fromEntries(
    sucursalesOrdenadas.map((n) => [n, 0])
  );

  for (const f of filas) {
    const { costosVariables: cv, costosFijos: cf } = partCostosVariablesFijos(
      f.tipoGastoNombre,
      f.monto
    );
    gCv += cv;
    gCf += cf;

    if (f.sucursalCentroCosto && !f.sucursalGeneraBalance) {
      poolCv += cv;
      poolCf += cf;
    } else if (f.sucursalGeneraBalance) {
      const k = f.sucursalNombre;
      directCv[k] = (directCv[k] ?? 0) + cv;
      directCf[k] = (directCf[k] ?? 0) + cf;
    }
  }

  const n = sucursalesOrdenadas.length;
  const addCv = n > 0 ? repartoIgualEnteros(poolCv, n) : [];
  const addCf = n > 0 ? repartoIgualEnteros(poolCf, n) : [];

  const sucursales: BalanceMensualSucursalBloque[] = sucursalesOrdenadas.map((nombre, i) => {
    const v = ventasPorSucursalNombre[nombre] ?? 0;
    const cv = (directCv[nombre] ?? 0) + (addCv[i] ?? 0);
    const cf = (directCf[nombre] ?? 0) + (addCf[i] ?? 0);
    return {
      nombre,
      sucursalId: byNombreFromDb.get(nombre) ?? "",
      bloque: construirBloque(v, cv, cf),
    };
  });

  const ventasGlobal = sucursales.reduce((acc, s) => acc + s.bloque.ventas, 0);
  return {
    global: construirBloque(ventasGlobal, gCv, gCf),
    sucursales,
  };
}
