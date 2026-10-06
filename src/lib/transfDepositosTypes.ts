/** Tipos de Trans. Depósitos (catálogo + saldos vía `transfDepositos.service`). */

export type SucursalTransf = "guaymallen" | "maipu";

export type ItemTransfDepositos = {
  /** `cod_tienda`; clave estable para tabla. */
  id: string;
  codItem: string;
  descripcion: string;
  marca: string | null;
  rubro: string | null;
  /** Saldo ledger en origen; `null` si no aplica (sin sucursal / fila de borrador). */
  stockOrigen: number | null;
  /** Saldo ledger en destino; `null` sin destino elegido. */
  stockDestino: number | null;
};

export type ControlTransfDepositosRecienteDto = {
  codTienda: string;
  cantidad: number;
  createdAtIso: string;
};

export type LoteAbiertoTransfDepositoItemDto = {
  codTienda: string;
  descripcionTienda: string;
  cantidad: number;
};

export type TransfDepositosData = {
  items: ItemTransfDepositos[];
  total: number;
  totalPaginas: number;
  marcas: string[];
  rubros: string[];
  controlesRecientes: ControlTransfDepositosRecienteDto[];
  loteAbierto: LoteAbiertoTransfDepositoItemDto[];
};

/** Catálogo vacío (sin origen o error de lectura). */
export const TRANSF_DEPOSITOS_DATA_VACIO: TransfDepositosData = {
  items: [],
  total: 0,
  totalPaginas: 0,
  marcas: [],
  rubros: [],
  controlesRecientes: [],
  loteAbierto: [],
};
