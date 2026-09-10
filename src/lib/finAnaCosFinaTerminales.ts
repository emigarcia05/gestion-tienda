/** Catálogo `fin_ana_cos_fina_terminales`. */
export interface FinAnaCosFinaTerminalItem {
  id: string;
  nombre: string;
  /** `id_terminal` DUX; null si aún no está asociado. */
  idDux: string | null;
  orden: number;
}
