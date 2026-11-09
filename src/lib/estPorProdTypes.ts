/** Tipos compartidos UI ↔ servidor para estadísticas por producto (`est_por_prod`). */

/** Sucursal (columna de Carga de Datos). */
export interface SucursalEstOption {
  id: string;
  nombre: string;
}

/** Celda de la grilla Carga de Datos (ocupación por periodo × sucursal). */
export interface EstPorProdCeldaCarga {
  sucursalId: string;
  mes: number;
  anio: number;
  cantidad: number;
}

/** Resultado de `POST /api/import-est-por-prod` / `importarEstPorProd`. */
export interface ImportarEstPorProdResultado {
  importados: number;
  omitidosCodTiendaInexistente: number;
  codigosOmitidos: string[];
  reemplazados: number;
}
