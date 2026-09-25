/**
 * Rutas canónicas del área Facturación.
 * Prefijo: `/facturacion/{módulo}/{submódulo?}`.
 */

export const FACTURACION_ROUTES = {
  defaultEntry: "/facturacion/factura/facturas",
  factura: {
    crear: "/facturacion/factura/crear",
    facturas: "/facturacion/factura/facturas",
    presupuestos: "/facturacion/factura/presupuestos",
  },
  clientes: {
    lista: "/facturacion/clientes/lista",
    cuentaCorriente: "/facturacion/clientes/cuenta-corriente",
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
