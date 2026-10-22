import type {
  AlcanceDescPromo,
  DescPromoCategoria,
  DescPromoCostoTipo,
} from "@prisma/client";
import { APP_ROUTES } from "./appRoutes";
import { fmtCantidad } from "./cantidadUnDecimal";
import { formatIsoYmdDdMmYyArgentina } from "./fechaArgentina";
export const DESC_PROMOS_PATH = APP_ROUTES.administrador.cobrosDesc.descuentos;

export const CATEGORIAS_DESC_PROMO = ["BASE", "FECHA", "STOCK"] as const;

export type CategoriaDescPromoValor = (typeof CATEGORIAS_DESC_PROMO)[number];

export const ETIQUETA_CATEGORIA_DESC_PROMO: Record<CategoriaDescPromoValor, string> = {
  BASE: "DESC. BASE",
  FECHA: "DESC. POR FECHA",
  STOCK: "DESC. POR STOCK",
};

export const COSTO_TIPOS_DESC_PROMO = ["PORCENTAJE", "FIJO"] as const;

export type CostoTipoDescPromoValor = (typeof COSTO_TIPOS_DESC_PROMO)[number];

export const ETIQUETA_COSTO_TIPO_DESC_PROMO: Record<CostoTipoDescPromoValor, string> = {
  PORCENTAJE: "%",
  FIJO: "FIJO",
};

/** Lote de un ítem DESC. POR STOCK. Costos sin IVA. */
export type DescPromoLoteRef = {
  cantidad: number;
  consumida: number;
  saldo: number;
  costoTipo: DescPromoCostoTipo;
  /** % (0–100) o precio fijo según `costoTipo`. */
  costoValor: number;
  /** PORCENTAJE: costo vigente congelado al cargar el ítem. */
  costoBase: number | null;
  costoUnitario: number;
};

/** Costo nuevo sin IVA del lote (4 decimales). */
export function costoNuevoLoteDescPromo(
  costoTipo: CostoTipoDescPromoValor,
  costoValor: number,
  costoBase: number
): number {
  const bruto =
    costoTipo === "FIJO" ? costoValor : costoBase * (1 - costoValor / 100);
  return Math.round(Math.max(0, bruto) * 10_000) / 10_000;
}

export type EstadoDescPromo =
  | "VIGENTE"
  | "PROGRAMADO"
  | "VENCIDO"
  | "CON_SALDO"
  | "AGOTADO";

/** FECHA: vigente si `hoyIso` ∈ [desde, hasta] (inclusive). BASE siempre; STOCK por saldo. */
export function estadoDescPromo(
  fila: Pick<DescPromoFila, "categoria" | "fechaDesdeIso" | "fechaHastaIso" | "items">,
  hoyIso: string
): EstadoDescPromo {
  if (fila.categoria === "FECHA") {
    if (fila.fechaDesdeIso && hoyIso < fila.fechaDesdeIso) return "PROGRAMADO";
    if (fila.fechaHastaIso && hoyIso > fila.fechaHastaIso) return "VENCIDO";
    return "VIGENTE";
  }
  if (fila.categoria === "STOCK") {
    return fila.items.some((i) => (i.lote?.saldo ?? 0) > 0) ? "CON_SALDO" : "AGOTADO";
  }
  return "VIGENTE";
}

/** Texto de la columna ESTADO de la tabla Descuentos. */
export function textoEstadoDescPromo(
  fila: Pick<DescPromoFila, "categoria" | "fechaDesdeIso" | "fechaHastaIso" | "items">,
  hoyIso: string
): string {
  const estado = estadoDescPromo(fila, hoyIso);
  if (estado === "CON_SALDO") {
    const saldo = fila.items.reduce((s, i) => s + (i.lote?.saldo ?? 0), 0);
    const total = fila.items.reduce((s, i) => s + (i.lote?.cantidad ?? 0), 0);
    return `SALDO ${fmtCantidad(saldo)} / ${fmtCantidad(total)}`;
  }
  const rango = textoRangoFechasDescPromo(fila);
  return rango ? `${estado} · ${rango}` : estado;
}

/** `dd/mm/aa AL dd/mm/aa` (solo categoría FECHA). */
export function textoRangoFechasDescPromo(
  fila: Pick<DescPromoFila, "categoria" | "fechaDesdeIso" | "fechaHastaIso">
): string {
  if (fila.categoria !== "FECHA" || !fila.fechaDesdeIso || !fila.fechaHastaIso) {
    return "";
  }
  return `${formatIsoYmdDdMmYyArgentina(fila.fechaDesdeIso)} AL ${formatIsoYmdDdMmYyArgentina(fila.fechaHastaIso)}`;
}

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
  idMarca: string | null;
  marcaNombre: string | null;
  idRubro: string | null;
  rubroNombre: string | null;
  /** Solo categoría STOCK. */
  lote: DescPromoLoteRef | null;
};

export type DescPromoFormaPagoRef = {
  pagoId: string;
  nombre: string;
  cuotaId: string | null;
  cuotaEtiqueta: string | null;
};

export type DescPromoFila = {
  id: string;
  categoria: DescPromoCategoria;
  categoriaEtiqueta: string;
  /** `YYYY-MM-DD`; solo categoría FECHA. */
  fechaDesdeIso: string | null;
  fechaHastaIso: string | null;
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

/** Promo de alcance ITEMS adjunta al buscador de Factura · Crear (DESC. ESPECIAL). */
export type DescPromoEspecialFactura = {
  id: string;
  nombre: string;
  descuento: number;
  prioridad: number;
  formasPago: string;
};

export function itemTieneDescEspecial(item: {
  descEspeciales?: readonly DescPromoEspecialFactura[];
}): boolean {
  return (item.descEspeciales?.length ?? 0) > 0;
}

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

/** Entre las reglas que matchean el ítem, gana la de menor `prioridad` (1 = máxima). Sin match = 0 %. */
export function descuentoPctPorPrioridad(
  promos: readonly DescPromoCandidataFactura[],
  item: DescPromoItemMatch
): number {
  let mejor: DescPromoCandidataFactura | null = null;
  for (const promo of promos) {
    if (!alcanceDescPromoMatcheaItem(promo, item)) continue;
    if (mejor == null || promo.prioridad < mejor.prioridad) {
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
    .sort((a, b) => a.prioridad - b.prioridad);
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

/** Medios de pago únicos (sin cuota) para el filtro de Factura · DESCUENTOS. */
export function mediosPagoUnicosDescPromo(
  filas: readonly DescPromoFila[]
): { pagoId: string; nombre: string }[] {
  const vistos = new Map<string, string>();
  for (const fila of filas) {
    for (const fp of fila.formasPago) {
      if (!vistos.has(fp.pagoId)) vistos.set(fp.pagoId, fp.nombre);
    }
  }
  return [...vistos.entries()]
    .map(([pagoId, nombre]) => ({ pagoId, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** Primera palabra (00) y resto (DEBITO / CREDITO) de `cobros_cuotas.cuotas`. */
export function lineasEtiquetaCuotaDescPromo(cuotaEtiqueta: string | null): {
  linea1: string;
  linea2: string;
} {
  const t = (cuotaEtiqueta ?? "").trim().toLocaleUpperCase("es-AR");
  if (!t) return { linea1: "", linea2: "" };
  const sep = t.search(/\s+/);
  if (sep < 0) return { linea1: t, linea2: "" };
  return { linea1: t.slice(0, sep), linea2: t.slice(sep).trim() };
}

/** Cuotas distintas de un medio, según las promos que lo usan. */
export function cuotasDeMedioPagoDescPromo(
  filas: readonly DescPromoFila[],
  pagoId: string
): DescPromoFormaPagoRef[] {
  if (!pagoId) return [];
  const vistos = new Map<string, DescPromoFormaPagoRef>();
  for (const fila of filas) {
    for (const fp of fila.formasPago) {
      if (fp.pagoId !== pagoId || !fp.cuotaId) continue;
      if (!vistos.has(fp.cuotaId)) vistos.set(fp.cuotaId, fp);
    }
  }
  return [...vistos.values()].sort((a, b) => {
    const la = lineasEtiquetaCuotaDescPromo(a.cuotaEtiqueta);
    const lb = lineasEtiquetaCuotaDescPromo(b.cuotaEtiqueta);
    const na = Number.parseInt(la.linea1, 10);
    const nb = Number.parseInt(lb.linea1, 10);
    const aNum = Number.isFinite(na);
    const bNum = Number.isFinite(nb);
    if (aNum && bNum && na !== nb) return na - nb;
    if (aNum !== bNum) return aNum ? -1 : 1;
    return (a.cuotaEtiqueta ?? "").localeCompare(b.cuotaEtiqueta ?? "", "es");
  });
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
      promos: col.promos.slice().sort((a, b) => a.prioridad - b.prioridad),
    }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
}

export type GrupoDescPromoPorPct = {
  descuento: number;
  promos: DescPromoFila[];
};

/** Agrupa reglas por % (mayor primero; dentro, mayor prioridad = número menor). */
export function gruposPorPctDescPromo(
  filas: readonly DescPromoFila[]
): GrupoDescPromoPorPct[] {
  const ordenadas = filas
    .slice()
    .sort(
      (a, b) =>
        b.descuento - a.descuento ||
        a.prioridad - b.prioridad ||
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
        a.prioridad - b.prioridad
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

/** Mayor % primero; empate: mayor prioridad (número menor), luego nombre. */
export function ordenarPromosPorDescFactura(
  filas: readonly DescPromoFila[]
): DescPromoFila[] {
  return filas.slice().sort(
    (a, b) =>
      b.descuento - a.descuento ||
      a.prioridad - b.prioridad ||
      a.nombre.localeCompare(b.nombre, "es")
  );
}

export function esDescPromoEspecial(promo: Pick<DescPromoFila, "alcance">): boolean {
  return promo.alcance === "ITEMS";
}

export type ItemDescPromoEspecialFactura = {
  item: DescPromoItemRef;
  promos: DescPromoFila[];
};

/** Ítems únicos de promos alcance ITEMS (DESC. ESPECIAL), con sus promos. */
export function agruparItemsDescPromoEspeciales(
  filas: readonly DescPromoFila[]
): ItemDescPromoEspecialFactura[] {
  const porCodigo = new Map<string, ItemDescPromoEspecialFactura>();
  for (const fila of filas) {
    if (!esDescPromoEspecial(fila)) continue;
    for (const item of fila.items) {
      const actual = porCodigo.get(item.codTienda);
      if (actual) {
        if (!actual.promos.some((promo) => promo.id === fila.id)) {
          actual.promos.push(fila);
        }
      } else {
        porCodigo.set(item.codTienda, { item, promos: [fila] });
      }
    }
  }
  for (const grupo of porCodigo.values()) {
    grupo.promos = ordenarPromosPorDescFactura(grupo.promos);
  }
  return [...porCodigo.values()].sort((a, b) =>
    (a.item.descripcion || a.item.codTienda).localeCompare(
      b.item.descripcion || b.item.codTienda,
      "es"
    )
  );
}

export function filtrarItemsDescPromoEspeciales(
  items: readonly ItemDescPromoEspecialFactura[],
  filtros: { idMarca: string; idRubro: string; codTienda: string }
): ItemDescPromoEspecialFactura[] {
  return items.filter((fila) => {
    if (filtros.idMarca && fila.item.idMarca !== filtros.idMarca) return false;
    if (filtros.idRubro && fila.item.idRubro !== filtros.idRubro) return false;
    if (filtros.codTienda && fila.item.codTienda !== filtros.codTienda) {
      return false;
    }
    return true;
  });
}

export function filtrarPromosDescPromoFactura(
  filas: readonly DescPromoFila[],
  pagoId: string,
  cuotaId?: string
): DescPromoFila[] {
  if (!pagoId) return [];
  return filas.filter((fila) =>
    fila.formasPago.some((fp) => {
      if (fp.pagoId !== pagoId) return false;
      if (!cuotaId) return true;
      return fp.cuotaId === cuotaId;
    })
  );
}
