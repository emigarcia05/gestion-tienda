import { APP_ROUTES } from "./appRoutes";

/** Rutas de los módulos **VENTAS** (comprobantes) y **CLIENTES** del área Ventas. */
export const FACTURACION_ROUTES = {
  factura: {
    crear: APP_ROUTES.ventas.ventas.crear,
    facturas: APP_ROUTES.ventas.ventas.comprobantes,
    presupuestos: APP_ROUTES.ventas.ventas.presupuestos,
  },
  clientes: {
    lista: APP_ROUTES.ventas.clientes.listaClientes,
    cuentaCorriente: APP_ROUTES.ventas.clientes.cuentasCorrientes,
  },
} as const;

export const FACTURA_CREAR_QUERY_CLASE = "clase" as const;

export type FacturaCrearClaseQuery = "presupuesto" | "venta" | "nota_credito";

/** Alta desde listados (no hay hoja Crear en el sidenav). */
export function hrefFacturaCrear(opts?: {
  clase?: FacturaCrearClaseQuery;
  duplicar?: string;
  nc?: string;
}): string {
  const params = new URLSearchParams();
  if (opts?.clase) params.set(FACTURA_CREAR_QUERY_CLASE, opts.clase);
  if (opts?.duplicar) params.set("duplicar", opts.duplicar);
  if (opts?.nc) params.set("nc", opts.nc);
  const q = params.toString();
  return q ? `${FACTURACION_ROUTES.factura.crear}?${q}` : FACTURACION_ROUTES.factura.crear;
}
