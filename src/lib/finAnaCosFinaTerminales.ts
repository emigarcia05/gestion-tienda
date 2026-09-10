/** Terminal DUX (`fin_ana_cos_fina_terminales`): id_dux + marca + titular. */
export type FinAnaCosFinaTerminalItem = {
  id: string;
  idDux: string;
  marcaId: string;
  marcaNombre: string;
  titularId: string;
  titularPtoVenta: number;
  titularNombre: string;
};

export function etiquetaTitularPtoVta(ptoVenta: number, nombreTitular: string): string {
  return `${ptoVenta} · ${nombreTitular}`;
}

export function etiquetaTerminalDux(item: FinAnaCosFinaTerminalItem): string {
  return `${item.idDux} · ${item.marcaNombre} · ${etiquetaTitularPtoVta(item.titularPtoVenta, item.titularNombre)}`;
}
