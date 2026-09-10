/** Catálogo `global_pto_vtas` + sucursales asociadas (`global_pto_vta_sucursales`). */

export type GlobalPtoVtaSucursalOption = {
  id: string;
  nombre: string;
};

export type GlobalPtoVtaItem = {
  id: string;
  ptoVenta: number;
  nombreTitular: string;
  sucursales: GlobalPtoVtaSucursalOption[];
};
