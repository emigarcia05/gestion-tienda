/** Ítem del catálogo `tesoreria_tipo_caja`. */
export interface TesoreriaTipoCajaItem {
  id: string;
  codigo: string;
  nombre: string;
  orden: number;
}

export function normalizarNombreTipoCaja(value: string): string {
  return value.trim().toLocaleUpperCase("es-AR");
}

export function normalizarCodigoTipoCaja(value: string): string {
  return value.trim().toLocaleUpperCase("es-AR").replace(/\s+/g, "_");
}
