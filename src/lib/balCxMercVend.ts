import { fmtPrecio } from "@/lib/format";
import {
  VISTA_CX_MERC_VEND_DEFAULT,
  type VistaCxMercVend,
} from "@/lib/validations/balCxMercaderia";

export const ETIQUETA_VISTA_CX_MERC_VEND: Record<VistaCxMercVend, string> = {
  sucursal: "Vtas Por Suc",
  rubro: "Vtas Por Rubro",
  detalle: "Vtas Por Detalle",
};

/** CX con signo: `-$1.234` para NC / totales negativos. */
export function fmtCx(n: number): string {
  return `${n < 0 ? "-" : ""}$${fmtPrecio(Math.abs(n))}`;
}

/**
 * Query string de Cx Merc. Vend. Omite valores por defecto (vista, mes actual) y vacíos.
 * Sin `pagina`: la agrega `PaginacionTabla`.
 */
export function paramsCxMercVend(
  f: { vista: VistaCxMercVend; periodo: string; rubro: string; sucursal: string; q: string },
  periodoDefault: string
): Record<string, string> {
  return {
    vista: f.vista === VISTA_CX_MERC_VEND_DEFAULT ? "" : f.vista,
    periodo: f.periodo === periodoDefault ? "" : f.periodo,
    rubro: f.rubro,
    sucursal: f.sucursal,
    q: f.q,
  };
}

export function hrefCxMercVend(basePath: string, params: Record<string, string>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) p.set(k, v);
  }
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
