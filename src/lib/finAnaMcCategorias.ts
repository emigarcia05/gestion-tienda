/** Categoría por rango de PORC. UTILIDAD de la lista 1 - GENERAL (`fin_ana_mc_cat`, escala 0…100). */
export type FinAnaMcCategoriaItem = {
  id: string;
  categoria: string;
  /** Límite inferior inclusivo (0…99). */
  desdePct: number;
  /** Límite superior exclusivo (salvo la última: 100 inclusivo). */
  hastaPct: number;
  orden: number;
};

export const FIN_ANA_MC_CATEGORIA_PCT_MIN = 0;
export const FIN_ANA_MC_CATEGORIA_PCT_MAX = 100;

export type RangoMcCategoriaInput = {
  id?: string;
  categoria?: string;
  desdePct: number;
  hastaPct: number;
};

/**
 * Valida rangos continuos sin huecos ni solapes.
 * Ordenados por `desdePct`: cada `desde` debe ser igual al `hasta` anterior.
 * Si hay filas: la primera empieza en 0 y la última termina en 100.
 */
export function validarContinuidadRangosMcCategorias(
  rangos: RangoMcCategoriaInput[]
): string | null {
  if (rangos.length === 0) return null;

  for (const rango of rangos) {
    if (
      !Number.isInteger(rango.desdePct) ||
      !Number.isInteger(rango.hastaPct)
    ) {
      return "Los límites del rango deben ser enteros.";
    }
    if (
      rango.desdePct < FIN_ANA_MC_CATEGORIA_PCT_MIN ||
      rango.hastaPct > FIN_ANA_MC_CATEGORIA_PCT_MAX
    ) {
      return "Los rangos deben estar entre 0 y 100.";
    }
    if (rango.desdePct >= rango.hastaPct) {
      return "El límite inferior debe ser menor que el superior.";
    }
  }

  const sorted = [...rangos].sort((a, b) => a.desdePct - b.desdePct);

  if (sorted[0]!.desdePct !== FIN_ANA_MC_CATEGORIA_PCT_MIN) {
    return "La primera categoría debe comenzar en 0.";
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    if (curr.desdePct < prev.hastaPct) {
      return `El rango se solapa con el que termina en ${prev.hastaPct}. El inferior debe ser ${prev.hastaPct} (no ${curr.desdePct}).`;
    }
    if (curr.desdePct > prev.hastaPct) {
      return `Hay un hueco entre ${prev.hastaPct} y ${curr.desdePct}. El inferior debe ser ${prev.hastaPct} para mantener continuidad.`;
    }
  }

  const last = sorted[sorted.length - 1]!;
  if (last.hastaPct !== FIN_ANA_MC_CATEGORIA_PCT_MAX) {
    return "La última categoría debe terminar en 100.";
  }

  return null;
}

/**
 * Resuelve la categoría para un PORC. UTILIDAD (lista 1 - GENERAL, recortado a 0…100).
 * Regla: `[desde, hasta)` y la última (`hasta === 100`) incluye 100.
 */
export function resolverCategoriaMcPorPct(
  porcUtilidad: number,
  categorias: FinAnaMcCategoriaItem[]
): FinAnaMcCategoriaItem | null {
  if (!Number.isFinite(porcUtilidad) || categorias.length === 0) return null;
  const sorted = [...categorias].sort((a, b) => a.desdePct - b.desdePct);
  for (let i = 0; i < sorted.length; i++) {
    const cat = sorted[i]!;
    const esUltima = i === sorted.length - 1;
    const dentro =
      porcUtilidad >= cat.desdePct &&
      (esUltima ? porcUtilidad <= cat.hastaPct : porcUtilidad < cat.hastaPct);
    if (dentro) return cat;
  }
  return null;
}

export function normalizarNombreCategoriaMc(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

/** Fila editable en el modal Gestionar Cat. M.C. */
export type BorradorCategoriaMc = {
  key: string;
  id?: string;
  categoria: string;
  desdePct: number;
  hastaPct: number;
};

export function borradoresDesdeCategoriasMc(
  items: FinAnaMcCategoriaItem[]
): BorradorCategoriaMc[] {
  if (items.length === 0) {
    return [
      {
        key: "nuevo-0",
        categoria: "",
        desdePct: FIN_ANA_MC_CATEGORIA_PCT_MIN,
        hastaPct: FIN_ANA_MC_CATEGORIA_PCT_MAX,
      },
    ];
  }
  return [...items]
    .sort((a, b) => a.desdePct - b.desdePct)
    .map((item, index) => ({
      key: item.id || `row-${index}`,
      id: item.id,
      categoria: item.categoria,
      desdePct: item.desdePct,
      hastaPct: item.hastaPct,
    }));
}

/** Recalcula `desde` en cadena: cada mínimo = máximo de la fila anterior. */
export function sincronizarMinimosCategoriasMc(
  filas: BorradorCategoriaMc[]
): BorradorCategoriaMc[] {
  if (filas.length === 0) return filas;
  const next: BorradorCategoriaMc[] = [];
  for (let i = 0; i < filas.length; i++) {
    const prevHasta =
      i === 0 ? FIN_ANA_MC_CATEGORIA_PCT_MIN : next[i - 1]!.hastaPct;
    if (prevHasta >= FIN_ANA_MC_CATEGORIA_PCT_MAX) break;
    const desdePct = prevHasta;
    let hastaPct = Math.trunc(filas[i]!.hastaPct);
    if (hastaPct <= desdePct) {
      hastaPct = Math.min(FIN_ANA_MC_CATEGORIA_PCT_MAX, desdePct + 1);
    }
    if (hastaPct > FIN_ANA_MC_CATEGORIA_PCT_MAX) {
      hastaPct = FIN_ANA_MC_CATEGORIA_PCT_MAX;
    }
    next.push({
      ...filas[i]!,
      desdePct,
      hastaPct,
    });
  }
  return next;
}

/**
 * Actualiza el máximo de una fila (entero).
 * El máximo debe ser al menos `mínimo + 1` (ej. mín. 15 → máx. ≥ 16).
 */
export function actualizarMaxCategoriaMc(
  filas: BorradorCategoriaMc[],
  index: number,
  hastaPctRaw: number
): BorradorCategoriaMc[] {
  if (index < 0 || index >= filas.length) return filas;
  const copia = filas.map((f) => ({ ...f }));
  const desde = copia[index]!.desdePct;
  const hastaPct = Math.max(
    desde + 1,
    Math.min(FIN_ANA_MC_CATEGORIA_PCT_MAX, Math.trunc(hastaPctRaw))
  );
  copia[index] = { ...copia[index]!, hastaPct };
  return sincronizarMinimosCategoriasMc(copia);
}

export function puedeAgregarCategoriaMc(filas: BorradorCategoriaMc[]): boolean {
  if (filas.length === 0) return true;
  const last = filas[filas.length - 1]!;
  return last.hastaPct < FIN_ANA_MC_CATEGORIA_PCT_MAX;
}

export function agregarCategoriaMc(
  filas: BorradorCategoriaMc[]
): BorradorCategoriaMc[] {
  if (!puedeAgregarCategoriaMc(filas)) return filas;
  const lastHasta =
    filas.length === 0
      ? FIN_ANA_MC_CATEGORIA_PCT_MIN
      : filas[filas.length - 1]!.hastaPct;
  return [
    ...filas,
    {
      key: `nuevo-${Date.now()}-${filas.length}`,
      categoria: "",
      desdePct: lastHasta,
      hastaPct: FIN_ANA_MC_CATEGORIA_PCT_MAX,
    },
  ];
}

export function quitarUltimaCategoriaMc(
  filas: BorradorCategoriaMc[]
): BorradorCategoriaMc[] {
  if (filas.length <= 1) return filas;
  return filas.slice(0, -1);
}
