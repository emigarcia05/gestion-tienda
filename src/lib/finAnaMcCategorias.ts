/** Categoría por rango de PORC. UTILIDAD de la lista 1 - GENERAL (`fin_ana_mc_cat`). */
export type FinAnaMcCategoriaItem = {
  id: string;
  categoria: string;
  /** Límite inferior inclusivo. En la fila siguiente es el máximo de la anterior. */
  desdePct: number;
  /** Límite superior exclusivo, salvo la última categoría, que lo incluye. */
  hastaPct: number;
  orden: number;
};

export const FIN_ANA_MC_CATEGORIA_PCT_MIN = 0;
/** Tope del MÁX. Alineado a la escala de PORC. UTILIDAD del gráfico (0…300). */
export const FIN_ANA_MC_CATEGORIA_PCT_MAX = 300;

export type RangoMcCategoriaInput = {
  id?: string;
  categoria?: string;
  desdePct: number;
  hastaPct: number;
};

/**
 * Valida rangos continuos sin huecos ni solapes.
 * No exige empezar en 0 ni terminar en un tope fijo.
 * Ordenados por `desdePct`: cada `desde` debe ser igual al `hasta` anterior.
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
      rango.hastaPct > FIN_ANA_MC_CATEGORIA_PCT_MAX ||
      rango.desdePct > FIN_ANA_MC_CATEGORIA_PCT_MAX
    ) {
      return `Los rangos deben estar entre ${FIN_ANA_MC_CATEGORIA_PCT_MIN} y ${FIN_ANA_MC_CATEGORIA_PCT_MAX}.`;
    }
    if (rango.desdePct >= rango.hastaPct) {
      return "El límite inferior debe ser menor que el superior.";
    }
  }

  const sorted = [...rangos].sort((a, b) => a.desdePct - b.desdePct);

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

  return null;
}

/**
 * Resuelve la categoría para un PORC. UTILIDAD de la lista 1 - GENERAL.
 * Regla: `[desde, hasta)` y la última categoría incluye su máximo.
 * El valor igual al máximo de una categoría pertenece a la siguiente.
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

/** Recalcula `desde` desde la segunda fila: cada mínimo = máximo de la anterior. */
export function sincronizarMinimosCategoriasMc(
  filas: BorradorCategoriaMc[]
): BorradorCategoriaMc[] {
  if (filas.length === 0) return filas;
  const next: BorradorCategoriaMc[] = [];
  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]!;
    const desdePct =
      i === 0
        ? Math.max(
            FIN_ANA_MC_CATEGORIA_PCT_MIN,
            Math.min(
              FIN_ANA_MC_CATEGORIA_PCT_MAX - 1,
              Math.trunc(fila.desdePct)
            )
          )
        : next[i - 1]!.hastaPct;
    if (desdePct >= FIN_ANA_MC_CATEGORIA_PCT_MAX) break;
    let hastaPct = Math.trunc(fila.hastaPct);
    if (!Number.isFinite(hastaPct) || hastaPct <= desdePct) {
      hastaPct = Math.min(FIN_ANA_MC_CATEGORIA_PCT_MAX, desdePct + 1);
    }
    if (hastaPct > FIN_ANA_MC_CATEGORIA_PCT_MAX) {
      hastaPct = FIN_ANA_MC_CATEGORIA_PCT_MAX;
    }
    next.push({
      ...fila,
      desdePct,
      hastaPct,
    });
  }
  return next;
}

/** Cambia el mínimo de la primera categoría. El resto sigue el máximo anterior. */
export function actualizarMinPrimeraCategoriaMc(
  filas: BorradorCategoriaMc[],
  desdePctRaw: number
): BorradorCategoriaMc[] {
  if (filas.length === 0) return filas;
  const copia = filas.map((fila) => ({ ...fila }));
  const tope = Math.max(
    FIN_ANA_MC_CATEGORIA_PCT_MIN,
    copia[0]!.hastaPct - 1
  );
  const desdePct = Math.max(
    FIN_ANA_MC_CATEGORIA_PCT_MIN,
    Math.min(tope, Math.trunc(desdePctRaw))
  );
  copia[0] = { ...copia[0]!, desdePct };
  return sincronizarMinimosCategoriasMc(copia);
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
      hastaPct: Math.min(FIN_ANA_MC_CATEGORIA_PCT_MAX, lastHasta + 1),
    },
  ];
}

export function quitarUltimaCategoriaMc(
  filas: BorradorCategoriaMc[]
): BorradorCategoriaMc[] {
  if (filas.length <= 1) return filas;
  return filas.slice(0, -1);
}
