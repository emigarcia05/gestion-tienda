/** Fila de Categorización (`prod_lista` + color/terminación/presentación calculados). */
export type EstCategorizacionItem = {
  codTienda: string;
  descripcionTienda: string;
  marca: string;
  rubro: string;
  subRubro: string;
  /** Nombres de color detectados (MAYÚSCULAS). */
  colores: string[];
  /** Texto para columna COLOR (` · ` si hay varios). */
  colorEtiqueta: string;
  /** Terminaciones detectadas (MAYÚSCULAS). */
  terminaciones: string[];
  /** Texto para columna TERMINACION (` · ` si hay varias). */
  terminacionEtiqueta: string;
  /** Etiqueta de presentación medida (p. ej. `20 LTS` / `Nº 20`); vacío si no hay match. */
  presentacionEtiqueta: string;
};
