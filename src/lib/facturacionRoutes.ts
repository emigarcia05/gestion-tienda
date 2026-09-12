/**
 * Rutas canónicas del área Facturación.
 * Prefijo: `/facturacion/{módulo}/{submódulo?}`.
 */

export const FACTURACION_ROUTES = {
  defaultEntry: "/facturacion/factura/crear",
  factura: {
    crear: "/facturacion/factura/crear",
    facturas: "/facturacion/factura/facturas",
    presupuestos: "/facturacion/factura/presupuestos",
  },
} as const;
