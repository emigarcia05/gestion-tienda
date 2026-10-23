import {
  VISTA_CX_FIN_COBROS_DEFAULT,
  type VistaCxFinCobros,
} from "@/lib/validations/balCxFinanciero";

export const ETIQUETA_VISTA_CX_FIN_COBROS: Record<VistaCxFinCobros, string> = {
  sucursal: "Cobros Por Suc",
  forma: "Cobros Por Forma de Pago",
  detalle: "Cobros Por Detalle",
};

/**
 * Query string de Cx Fin Cobros. Omite valores por defecto (vista, mes actual) y vacíos.
 * Sin `pagina`: la agrega `PaginacionTabla`.
 */
export function paramsCxFinCobros(
  f: { vista: VistaCxFinCobros; periodo: string; pago: string; sucursal: string; q: string },
  periodoDefault: string
): Record<string, string> {
  return {
    vista: f.vista === VISTA_CX_FIN_COBROS_DEFAULT ? "" : f.vista,
    periodo: f.periodo === periodoDefault ? "" : f.periodo,
    pago: f.pago,
    sucursal: f.sucursal,
    q: f.q,
  };
}
