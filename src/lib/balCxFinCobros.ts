/**
 * Query string de Cx Fin Cobros. Omite el mes actual y los vacíos.
 * Sin `pagina`: la agrega `PaginacionTabla`.
 */
export function paramsCxFinCobros(
  f: { periodo: string; pago: string; sucursal: string; q: string },
  periodoDefault: string
): Record<string, string> {
  return {
    periodo: f.periodo === periodoDefault ? "" : f.periodo,
    pago: f.pago,
    sucursal: f.sucursal,
    q: f.q,
  };
}
