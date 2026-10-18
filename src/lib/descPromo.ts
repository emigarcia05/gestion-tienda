import type { TipoDescPromo } from "@prisma/client";
import { APP_ROUTES } from "./appRoutes";

export const DESC_PROMOS_PATH = APP_ROUTES.administrador.descPromos.descuentos;

export const TIPOS_DESC_PROMO = ["POR_ITEM", "POR_FORMA_PAGO"] as const;

export type TipoDescPromoValor = (typeof TIPOS_DESC_PROMO)[number];

export const ETIQUETA_TIPO_DESC_PROMO: Record<TipoDescPromoValor, string> = {
  POR_ITEM: "POR ITEM",
  POR_FORMA_PAGO: "POR FORMA PAGO",
};

export const DESC_PROMO_EJE_TODOS = "todos";
export const DESC_PROMO_SUBRUBRO_TODOS = DESC_PROMO_EJE_TODOS;

export type DescPromoItemRef = {
  codTienda: string;
  descripcion: string;
};

export type DescPromoFormaPagoRef = {
  pagoId: string;
  nombre: string;
};

export type DescPromoReglaCondicion = {
  idMarca: string | null;
  idRubro: string | null;
  idSubRubro: string | null;
};

export type DescPromoReglaRef = DescPromoReglaCondicion & {
  id: string;
  marcaNombre: string | null;
  rubroNombre: string | null;
  subRubroNombre: string | null;
  descuento: number;
};

export type DescPromoFila = {
  id: string;
  tipo: TipoDescPromo;
  tipoEtiqueta: string;
  nombre: string;
  descuento: number | null;
  items: DescPromoItemRef[];
  formasPago: DescPromoFormaPagoRef[];
  reglas: DescPromoReglaRef[];
};

export type DescPromoItemMatch = DescPromoReglaCondicion;

export function etiquetaTipoDescPromo(tipo: TipoDescPromo): string {
  return ETIQUETA_TIPO_DESC_PROMO[tipo];
}

export function textoVinculosDescPromo(fila: DescPromoFila): string {
  if (fila.tipo === "POR_ITEM") {
    return fila.items
      .map((item) => item.descripcion || item.codTienda)
      .join(" · ");
  }
  return fila.formasPago.map((fp) => fp.nombre).join(" · ");
}

/** Encabezado de columna en Factura · Desc.: nombres de formas de pago. */
export function tituloFormasPagoDescPromo(fila: DescPromoFila): string {
  return fila.formasPago.map((fp) => fp.nombre).join(" / ");
}

export function claveReglaDescPromo(c: DescPromoReglaCondicion): string {
  return `${c.idMarca ?? ""}::${c.idRubro ?? ""}::${c.idSubRubro ?? ""}`;
}

export function especificidadReglaDescPromo(c: DescPromoReglaCondicion): number {
  return (c.idMarca ? 1 : 0) + (c.idRubro ? 1 : 0) + (c.idSubRubro ? 1 : 0);
}

export function reglaDescPromoTieneEje(c: DescPromoReglaCondicion): boolean {
  return c.idMarca != null || c.idRubro != null;
}

export function reglasDescPromoSeSolapan(
  a: DescPromoReglaCondicion,
  b: DescPromoReglaCondicion
): boolean {
  const marcaOk = a.idMarca == null || b.idMarca == null || a.idMarca === b.idMarca;
  const rubroOk = a.idRubro == null || b.idRubro == null || a.idRubro === b.idRubro;
  const subOk =
    a.idSubRubro == null || b.idSubRubro == null || a.idSubRubro === b.idSubRubro;
  return marcaOk && rubroOk && subOk;
}

export function interseccionReglaDescPromo(
  a: DescPromoReglaCondicion,
  b: DescPromoReglaCondicion
): DescPromoReglaCondicion {
  return {
    idMarca: a.idMarca ?? b.idMarca,
    idRubro: a.idRubro ?? b.idRubro,
    idSubRubro: a.idSubRubro ?? b.idSubRubro,
  };
}

export function condicionesReglaDescPromoIguales(
  a: DescPromoReglaCondicion,
  b: DescPromoReglaCondicion
): boolean {
  return claveReglaDescPromo(a) === claveReglaDescPromo(b);
}

function reglaCubreInterseccion(
  regla: DescPromoReglaCondicion,
  cruce: DescPromoReglaCondicion
): boolean {
  return claveReglaDescPromo(regla) === claveReglaDescPromo(cruce);
}

/**
 * Pares de excepciones del mismo nivel que se solapan y aún no tienen
 * una fila más específica para el cruce.
 */
export function conflictosReglasDescPromo(
  reglas: readonly DescPromoReglaCondicion[]
): { i: number; j: number; cruce: DescPromoReglaCondicion }[] {
  const out: { i: number; j: number; cruce: DescPromoReglaCondicion }[] = [];
  const vistos = new Set<string>();
  for (let i = 0; i < reglas.length; i += 1) {
    for (let j = i + 1; j < reglas.length; j += 1) {
      const a = reglas[i];
      const b = reglas[j];
      if (condicionesReglaDescPromoIguales(a, b)) continue;
      if (!reglasDescPromoSeSolapan(a, b)) continue;
      if (especificidadReglaDescPromo(a) !== especificidadReglaDescPromo(b)) {
        continue;
      }
      const cruce = interseccionReglaDescPromo(a, b);
      if (especificidadReglaDescPromo(cruce) <= especificidadReglaDescPromo(a)) {
        continue;
      }
      if (reglas.some((r) => reglaCubreInterseccion(r, cruce))) continue;
      const clave = claveReglaDescPromo(cruce);
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      out.push({ i, j, cruce });
    }
  }
  return out;
}

export function reglaDescPromoMatcheaItem(
  regla: DescPromoReglaCondicion,
  item: DescPromoItemMatch
): boolean {
  if (regla.idMarca != null && regla.idMarca !== item.idMarca) return false;
  if (regla.idRubro != null && regla.idRubro !== item.idRubro) return false;
  if (regla.idSubRubro != null && regla.idSubRubro !== item.idSubRubro) {
    return false;
  }
  return true;
}

/** Gana la excepción más específica; si no hay match, el % general. */
export function descuentoPctDesdeReglasPromo(
  reglas: readonly (DescPromoReglaCondicion & { descuento: number })[],
  item: DescPromoItemMatch,
  generalPct: number
): number {
  let mejor: { spec: number; descuento: number } | null = null;
  for (const regla of reglas) {
    if (!reglaDescPromoMatcheaItem(regla, item)) continue;
    const spec = especificidadReglaDescPromo(regla);
    if (mejor == null || spec > mejor.spec) {
      mejor = { spec, descuento: regla.descuento };
    }
  }
  if (mejor == null) return generalPct;
  return mejor.descuento;
}

function partesEtiquetaRegla(regla: {
  marcaNombre?: string | null;
  rubroNombre?: string | null;
  subRubroNombre?: string | null;
  idMarca?: string | null;
  idRubro?: string | null;
  idSubRubro?: string | null;
}): string[] {
  const partes: string[] = [];
  if (regla.marcaNombre) partes.push(regla.marcaNombre);
  else if (regla.idMarca) partes.push("MARCA");
  if (regla.rubroNombre) {
    partes.push(
      regla.subRubroNombre
        ? `${regla.rubroNombre} / ${regla.subRubroNombre}`
        : regla.rubroNombre
    );
  } else if (regla.idRubro) {
    partes.push(regla.subRubroNombre ? `RUBRO / ${regla.subRubroNombre}` : "RUBRO");
  }
  return partes;
}

export function etiquetaCondicionDescPromo(regla: {
  marcaNombre?: string | null;
  rubroNombre?: string | null;
  subRubroNombre?: string | null;
  idMarca?: string | null;
  idRubro?: string | null;
  idSubRubro?: string | null;
}): string {
  const partes = partesEtiquetaRegla(regla);
  return partes.join(" · ");
}

export function etiquetaGeneralDescPromoFactura(descuento: number | null): string {
  return `GENERAL - ${descuento ?? 0}%`;
}

/** Cuerpo de columna: `GENERAL - 25%` / `MARCA · RUBRO - 20%`. */
export function etiquetaReglaDescPromoFactura(
  regla: DescPromoReglaRef
): string {
  const cuerpo = etiquetaCondicionDescPromo(regla) || "EXCEPCIÓN";
  return `${cuerpo} - ${regla.descuento}%`;
}

export function etiquetasCuerpoPromoFormaPagoFactura(
  fila: DescPromoFila
): string[] {
  return [
    etiquetaGeneralDescPromoFactura(fila.descuento),
    ...fila.reglas.map(etiquetaReglaDescPromoFactura),
  ];
}

export function textoDescuentosDescPromo(fila: DescPromoFila): string {
  if (fila.tipo === "POR_ITEM") {
    return fila.descuento == null ? "" : `${fila.descuento} %`;
  }
  const general = `${fila.descuento ?? 0} %`;
  const extras = fila.reglas.map((regla) => {
    const cond = etiquetaCondicionDescPromo(regla);
    return cond ? `${cond} ${regla.descuento} %` : `${regla.descuento} %`;
  });
  return [general, ...extras].join(" · ");
}
