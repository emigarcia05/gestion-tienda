/** Ítem del catálogo `cobros_forma_pago`. */
export type FinAnaCosFinaPagoItem = {
  id: string;
  nombre: string;
  orden: number;
  enCostosFinancieros: boolean;
  enMargenContribucion: boolean;
  asociadoTerminal: boolean;
  asociadoBanco: boolean;
};

/** Id de forma de pago en simuladores (FK `cobros_forma_pago`). */
export type FormaPagoMargenContribucion = string;

export function filtrarPagosMargenContribucion(
  pagos: FinAnaCosFinaPagoItem[]
): FinAnaCosFinaPagoItem[] {
  return pagos
    .filter((p) => p.enMargenContribucion)
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));
}

export function filtrarPagosCostosFinancieros(
  pagos: FinAnaCosFinaPagoItem[]
): FinAnaCosFinaPagoItem[] {
  return pagos
    .filter((p) => p.enCostosFinancieros)
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));
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

export function etiquetaAsociacionPago(item: FinAnaCosFinaPagoItem): string {
  const partes: string[] = [];
  if (item.asociadoTerminal) partes.push("TERMINAL");
  if (item.asociadoBanco) partes.push("BANCO");
  return partes.join(" · ");
}
