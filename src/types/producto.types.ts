/**
 * Tipos para Producto + Proveedor (contrato UI / servicios).
 * En modo reset no dependen de Prisma; al reactivar la BD se pueden volver a inferir del schema.
 */
export interface ProveedorResumen {
  id: string;
  nombre: string;
  prefijo: string;
}

export interface ProductoCompleto {
  /** `proveedor_prod_lista.cod_ext` (PK lista proveedor). */
  id: string;
  codProdProv: string;
  codigoExterno: string;
  descripcion: string;
  precioLista: number;
  precioVentaSugerido: number;
  descuentoRubro: number;
  descuentoCantidad: number;
  cxTransporte: number;
  /** Precio de compra sin IVA desde proveedor_prod_lista.px_compra_final_sin_iva. Si viene null, se usa cálculo en cliente. */
  pxCompraFinalSinIva?: number | null;
  disponible: boolean;
  proveedorId: string;
  proveedor: ProveedorResumen;
  createdAt: Date;
  updatedAt: Date;
}
