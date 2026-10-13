/** Sin CX elegido (ítem con varios vínculos pendiente de selección o sin vínculos). */
export const CX_PROD_SELECCION_PROM = "prom" as const;

export interface OpcionCostoCxProdProveedor {
  tipo: "proveedor";
  codExt: string;
  etiqueta: string;
  costo: number;
}

/** Datos de columna CX PROD. (Cx Compra). */
export type CxProdDatosFila = {
  opcionesProveedor: OpcionCostoCxProdProveedor[];
  /** `prom` = sin CX elegido; si no, `cod_ext` del proveedor persistido. */
  seleccion: typeof CX_PROD_SELECCION_PROM | string;
  /** Costo resuelto: proveedor elegido, o `costo_manual` si el ítem no tiene vínculos. */
  costoMostrado: number;
};

export function costoCxProdMostrado(item: CxProdDatosFila): number {
  return item.costoMostrado;
}
