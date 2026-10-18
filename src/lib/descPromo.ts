import type { TipoDescPromo } from "@prisma/client";
import { APP_ROUTES } from "./appRoutes";

export const DESC_PROMOS_PATH = APP_ROUTES.administrador.descPromos.descuentos;

export const TIPOS_DESC_PROMO = ["POR_ITEM", "POR_FORMA_PAGO"] as const;

export type TipoDescPromoValor = (typeof TIPOS_DESC_PROMO)[number];

export const ETIQUETA_TIPO_DESC_PROMO: Record<TipoDescPromoValor, string> = {
  POR_ITEM: "POR ITEM",
  POR_FORMA_PAGO: "POR FORMA PAGO",
};

export const DESC_PROMO_SUBRUBRO_TODOS = "todos";

export type DescPromoItemRef = {
  codTienda: string;
  descripcion: string;
};

export type DescPromoFormaPagoRef = {
  pagoId: string;
  nombre: string;
};

export type DescPromoReglaRef = {
  id: string;
  idRubro: string;
  rubroNombre: string;
  idSubRubro: string | null;
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

/** Cuerpo de columna: `RUBRO - 25%` o `RUBRO / SUB - 20%`. */
export function etiquetaReglaDescPromoFactura(regla: DescPromoReglaRef): string {
  const rubro = regla.rubroNombre;
  const cuerpo = regla.subRubroNombre
    ? `${rubro} / ${regla.subRubroNombre}`
    : rubro;
  return `${cuerpo} - ${regla.descuento}%`;
}

export function textoDescuentosDescPromo(fila: DescPromoFila): string {
  if (fila.tipo === "POR_ITEM") {
    return fila.descuento == null ? "" : `${fila.descuento} %`;
  }
  return fila.reglas
    .map((regla) => {
      const sub = regla.subRubroNombre
        ? ` / ${regla.subRubroNombre}`
        : " / TODOS";
      return `${regla.rubroNombre}${sub} ${regla.descuento} %`;
    })
    .join(" · ");
}
