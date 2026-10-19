import type { AlcanceDescPromo } from "@prisma/client";
import { matchByMultiTerm } from "./busqueda";
import { APP_ROUTES } from "./appRoutes";

export const DESC_PROMOS_PATH = APP_ROUTES.administrador.descPromos.descuentos;

export const ALCANCES_DESC_PROMO = [
  "TODOS",
  "MARCA",
  "RUBRO",
  "MARCA_RUBRO",
  "ITEMS",
] as const;

export type AlcanceDescPromoValor = (typeof ALCANCES_DESC_PROMO)[number];

export const ETIQUETA_ALCANCE_DESC_PROMO: Record<AlcanceDescPromoValor, string> = {
  TODOS: "TODOS LOS ÍTEMS",
  MARCA: "MARCA",
  RUBRO: "RUBRO",
  MARCA_RUBRO: "MARCA Y RUBRO",
  ITEMS: "ÍTEMS",
};

export type DescPromoItemRef = {
  codTienda: string;
  descripcion: string;
  idRubro: string | null;
  rubroNombre: string | null;
};

export type DescPromoFormaPagoRef = {
  pagoId: string;
  nombre: string;
  cuotaId: string | null;
  cuotaEtiqueta: string | null;
};

export type DescPromoFila = {
  id: string;
  alcance: AlcanceDescPromo;
  alcanceEtiqueta: string;
  nombre: string;
  descuento: number;
  prioridad: number;
  idMarca: string | null;
  marcaNombre: string | null;
  idRubro: string | null;
  rubroNombre: string | null;
  items: DescPromoItemRef[];
  formasPago: DescPromoFormaPagoRef[];
};

export type DescPromoItemMatch = {
  codTienda: string;
  idMarca: string | null;
  idRubro: string | null;
};

export type DescPromoCandidataFactura = {
  id: string;
  prioridad: number;
  alcance: AlcanceDescPromo;
  idMarca: string | null;
  idRubro: string | null;
  codTiendas: string[];
  descuento: number;
};

export function etiquetaAlcanceDescPromo(alcance: AlcanceDescPromo): string {
  return ETIQUETA_ALCANCE_DESC_PROMO[alcance];
}

export function claveFormaPagoCuotaDescPromo(
  pagoId: string,
  cuotaId: string | null
): string {
  return `${pagoId}:${cuotaId ?? ""}`;
}

export function etiquetaFormaPagoCuotaDescPromo(fp: DescPromoFormaPagoRef): string {
  return fp.cuotaEtiqueta ? `${fp.nombre} · ${fp.cuotaEtiqueta}` : fp.nombre;
}

export function textoVinculosDescPromo(fila: DescPromoFila): string {
  const formas = fila.formasPago.map(etiquetaFormaPagoCuotaDescPromo).join(" · ");
  if (fila.alcance === "ITEMS") {
    const items = fila.items
      .map((item) => item.descripcion || item.codTienda)
      .join(" · ");
    return [formas, items].filter(Boolean).join(" · ");
  }
  const cond = etiquetaAlcanceCondicion(fila);
  return [formas, cond].filter(Boolean).join(" · ");
}

export function textoDescuentosDescPromo(fila: DescPromoFila): string {
  return `${fila.descuento} %`;
}

export function etiquetaAlcanceCondicion(fila: {
  alcance: AlcanceDescPromo;
  marcaNombre?: string | null;
  rubroNombre?: string | null;
  items?: DescPromoItemRef[];
}): string {
  if (fila.alcance === "TODOS") return ETIQUETA_ALCANCE_DESC_PROMO.TODOS;
  if (fila.alcance === "MARCA") {
    return fila.marcaNombre || ETIQUETA_ALCANCE_DESC_PROMO.MARCA;
  }
  if (fila.alcance === "RUBRO") {
    return fila.rubroNombre || ETIQUETA_ALCANCE_DESC_PROMO.RUBRO;
  }
  if (fila.alcance === "MARCA_RUBRO") {
    const marca = fila.marcaNombre || "MARCA";
    const rubro = fila.rubroNombre || "RUBRO";
    return `${marca} · ${rubro}`;
  }
  const n = fila.items?.length ?? 0;
  return n === 1 ? "1 ÍTEM" : `${n} ÍTEMS`;
}

export function etiquetaReglaDescPromoFactura(fila: DescPromoFila): string {
  return `DESC. ${fila.descuento}% - ${etiquetaAlcanceCondicion(fila)}`;
}

export function tituloPctDescPromoFactura(fila: DescPromoFila): string {
  return `DESC. ${fila.descuento}%`;
}

export function alcanceDescPromoMatcheaItem(
  promo: Pick<
    DescPromoCandidataFactura,
    "alcance" | "idMarca" | "idRubro" | "codTiendas"
  >,
  item: DescPromoItemMatch
): boolean {
  if (promo.alcance === "TODOS") return true;
  if (promo.alcance === "MARCA") {
    return promo.idMarca != null && promo.idMarca === item.idMarca;
  }
  if (promo.alcance === "RUBRO") {
    return promo.idRubro != null && promo.idRubro === item.idRubro;
  }
  if (promo.alcance === "MARCA_RUBRO") {
    return (
      promo.idMarca != null &&
      promo.idRubro != null &&
      promo.idMarca === item.idMarca &&
      promo.idRubro === item.idRubro
    );
  }
  return promo.codTiendas.includes(item.codTienda);
}

/** Entre las reglas que matchean el ítem, gana la de mayor `prioridad`. Sin match = 0 %. */
export function descuentoPctPorPrioridad(
  promos: readonly DescPromoCandidataFactura[],
  item: DescPromoItemMatch
): number {
  let mejor: DescPromoCandidataFactura | null = null;
  for (const promo of promos) {
    if (!alcanceDescPromoMatcheaItem(promo, item)) continue;
    if (mejor == null || promo.prioridad > mejor.prioridad) {
      mejor = promo;
    }
  }
  return mejor?.descuento ?? 0;
}

export function aCandidataFactura(fila: DescPromoFila): DescPromoCandidataFactura {
  return {
    id: fila.id,
    prioridad: fila.prioridad,
    alcance: fila.alcance,
    idMarca: fila.idMarca,
    idRubro: fila.idRubro,
    codTiendas: fila.items.map((i) => i.codTienda),
    descuento: fila.descuento,
  };
}

export function promosParaFormaPago(
  filas: readonly DescPromoFila[],
  pagoId: string,
  cuotaId?: string | null
): DescPromoFila[] {
  return filas
    .filter((fila) =>
      fila.formasPago.some((fp) => {
        if (fp.pagoId !== pagoId) return false;
        if (cuotaId === undefined) return true;
        return (fp.cuotaId ?? null) === (cuotaId ?? null);
      })
    )
    .slice()
    .sort((a, b) => b.prioridad - a.prioridad);
}

export type DescPromoFormaPagoColumna = {
  pagoId: string;
  cuotaId: string | null;
  nombre: string;
  etiqueta: string;
  promos: DescPromoFila[];
};

export function snapshotCobroDescPromo(formas: readonly DescPromoFormaPagoRef[]): {
  promoVinculos: DescPromoFormaPagoRef[];
  promoPagoIds: string[];
  promoPagoNombres: string[];
} {
  const unicas = [...formas];
  const pagoIds: string[] = [];
  const nombres: string[] = [];
  for (const fp of unicas) {
    if (!pagoIds.includes(fp.pagoId)) pagoIds.push(fp.pagoId);
    const nom = fp.nombre.trim().toLocaleUpperCase("es-AR");
    if (nom && !nombres.includes(nom)) nombres.push(nom);
  }
  return {
    promoVinculos: [...unicas],
    promoPagoIds: pagoIds,
    promoPagoNombres: nombres,
  };
}

/** Pares forma × cuota únicos de un conjunto de reglas (para el cobro). */
export function formasPagoUnicasDescPromo(
  filas: readonly DescPromoFila[]
): DescPromoFormaPagoRef[] {
  const vistos = new Map<string, DescPromoFormaPagoRef>();
  for (const fila of filas) {
    for (const fp of fila.formasPago) {
      const clave = claveFormaPagoCuotaDescPromo(fp.pagoId, fp.cuotaId);
      if (!vistos.has(clave)) vistos.set(clave, fp);
    }
  }
  return [...vistos.values()].sort((a, b) =>
    etiquetaFormaPagoCuotaDescPromo(a).localeCompare(
      etiquetaFormaPagoCuotaDescPromo(b),
      "es"
    )
  );
}

export function columnasFormaPagoDescPromo(
  filas: readonly DescPromoFila[]
): DescPromoFormaPagoColumna[] {
  const porPar = new Map<string, DescPromoFormaPagoColumna>();
  for (const fila of filas) {
    for (const fp of fila.formasPago) {
      const clave = claveFormaPagoCuotaDescPromo(fp.pagoId, fp.cuotaId);
      const actual = porPar.get(clave);
      if (actual) {
        if (!actual.promos.some((p) => p.id === fila.id)) {
          actual.promos.push(fila);
        }
      } else {
        porPar.set(clave, {
          pagoId: fp.pagoId,
          cuotaId: fp.cuotaId,
          nombre: fp.nombre,
          etiqueta: etiquetaFormaPagoCuotaDescPromo(fp),
          promos: [fila],
        });
      }
    }
  }
  return [...porPar.values()]
    .map((col) => ({
      ...col,
      promos: col.promos.slice().sort((a, b) => b.prioridad - a.prioridad),
    }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
}

export type GrupoDescPromoPorPct = {
  descuento: number;
  promos: DescPromoFila[];
};

/** Agrupa reglas por % (mayor primero; dentro, mayor prioridad). */
export function gruposPorPctDescPromo(
  filas: readonly DescPromoFila[]
): GrupoDescPromoPorPct[] {
  const ordenadas = filas
    .slice()
    .sort(
      (a, b) =>
        b.descuento - a.descuento ||
        b.prioridad - a.prioridad ||
        a.nombre.localeCompare(b.nombre, "es")
    );
  const porPct = new Map<number, DescPromoFila[]>();
  for (const fila of ordenadas) {
    const actual = porPct.get(fila.descuento);
    if (actual) actual.push(fila);
    else porPct.set(fila.descuento, [fila]);
  }
  return [...porPct.entries()].map(([descuento, promos]) => ({
    descuento,
    promos,
  }));
}

export function claveAlcanceGrupoDescPromo(fila: DescPromoFila): string {
  if (fila.alcance === "ITEMS") {
    return `ITEMS:${fila.items
      .map((item) => item.codTienda)
      .slice()
      .sort()
      .join(",")}`;
  }
  return `${fila.alcance}:${fila.idMarca ?? ""}:${fila.idRubro ?? ""}`;
}

export type GrupoDescPromoPorAlcance = {
  clave: string;
  etiqueta: string;
  promos: DescPromoFila[];
};

/** Agrupa reglas por rubro / ítems (etiqueta de alcance). */
export function gruposPorAlcanceDescPromo(
  filas: readonly DescPromoFila[]
): GrupoDescPromoPorAlcance[] {
  const porClave = new Map<string, GrupoDescPromoPorAlcance>();
  const ordenadas = filas
    .slice()
    .sort(
      (a, b) =>
        etiquetaAlcanceCondicion(a).localeCompare(etiquetaAlcanceCondicion(b), "es") ||
        b.prioridad - a.prioridad
    );
  for (const fila of ordenadas) {
    const clave = claveAlcanceGrupoDescPromo(fila);
    const actual = porClave.get(clave);
    if (actual) {
      actual.promos.push(fila);
    } else {
      porClave.set(clave, {
        clave,
        etiqueta: etiquetaAlcanceCondicion(fila),
        promos: [fila],
      });
    }
  }
  return [...porClave.values()];
}

export function filtrarPromosDescPromoFactura(
  filas: readonly DescPromoFila[],
  filtros: {
    pagoId: string;
    cuotaId: string | null;
    idRubro: string;
    qDescripcion: string;
  }
): DescPromoFila[] {
  const q = filtros.qDescripcion.trim();
  return filas.filter((fila) => {
    if (filtros.pagoId) {
      const coincidePago = fila.formasPago.some((fp) => {
        if (fp.pagoId !== filtros.pagoId) return false;
        return (fp.cuotaId ?? null) === filtros.cuotaId;
      });
      if (!coincidePago) return false;
    }
    if (filtros.idRubro) {
      const porRegla = fila.idRubro === filtros.idRubro;
      const porItem = fila.items.some((item) => item.idRubro === filtros.idRubro);
      const todos = fila.alcance === "TODOS";
      if (!todos && !porRegla && !porItem) return false;
    }
    if (q) {
      const textos = fila.items.map((item) => item.descripcion);
      if (textos.length === 0 || !matchByMultiTerm(textos, q)) return false;
    }
    return true;
  });
}
