/** Ítem del catálogo `cobros_forma_pago` (con entidades N:M). */
export type FinAnaCosFinaPagoItem = {
  id: string;
  nombre: string;
  enCostosFinancieros: boolean;
  enMargenContribucion: boolean;
  /** Si true, Cx. Fin. Cobros genera filas por cada cuota del catálogo. */
  aceptaCuotas: boolean;
  /** IDs de `tesoreria_cobros_entidades` vinculados (mín. 1). */
  entidadIds: string[];
  /** Nombres MAYÚSCULAS de las entidades vinculadas (mismo orden que `entidadIds`). */
  entidadNombres: string[];
};

/** Id de forma de pago en simuladores (FK `cobros_forma_pago`). */
export type FormaPagoMargenContribucion = string;

export function filtrarPagosMargenContribucion(
  pagos: FinAnaCosFinaPagoItem[]
): FinAnaCosFinaPagoItem[] {
  return pagos
    .filter((p) => p.enMargenContribucion)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export function filtrarPagosCostosFinancieros(
  pagos: FinAnaCosFinaPagoItem[]
): FinAnaCosFinaPagoItem[] {
  return pagos
    .filter((p) => p.enCostosFinancieros)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export function etiquetaPagoDesdeItem(item: FinAnaCosFinaPagoItem): string {
  return item.nombre;
}

export function buscarPagoPorId(
  pagos: FinAnaCosFinaPagoItem[],
  id: string
): FinAnaCosFinaPagoItem | undefined {
  return pagos.find((p) => p.id === id);
}
