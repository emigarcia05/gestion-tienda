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
  clientes: {
    lista: "/facturacion/clientes/lista",
    cuentaCorriente: "/facturacion/clientes/cuenta-corriente",
  },
} as const;
