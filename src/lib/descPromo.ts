import type { TipoDescPromo } from "@prisma/client";
import { APP_ROUTES } from "./appRoutes";

export const DESC_PROMOS_PATH = APP_ROUTES.administrador.descPromos.descuentos;

export const TIPOS_DESC_PROMO = ["POR_ITEM", "POR_FORMA_PAGO"] as const;

export type TipoDescPromoValor = (typeof TIPOS_DESC_PROMO)[number];

export const ETIQUETA_TIPO_DESC_PROMO: Record<TipoDescPromoValor, string> = {
  POR_ITEM: "POR ITEM",
  POR_FORMA_PAGO: "POR FORMA PAGO",
};

export type DescPromoItemRef = {
  codTienda: string;
  descripcion: string;
};

export type DescPromoFormaPagoRef = {
  pagoId: string;
  nombre: string;
};

export type DescPromoFila = {
  id: string;
  tipo: TipoDescPromo;
  tipoEtiqueta: string;
  nombre: string;
  descuento: number;
  items: DescPromoItemRef[];
  formasPago: DescPromoFormaPagoRef[];
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
