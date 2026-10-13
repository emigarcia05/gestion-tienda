import { APP_ROUTES } from "./appRoutes";

/** Rutas del módulo **COBROS** (área Finanzas). */
export const VTAS_COBROS_ROUTES = {
  ptosVenta: APP_ROUTES.finanzas.cobros.ptosVtas,
  cxFinCobros: APP_ROUTES.finanzas.cobros.cobrosCxFin,
  cobrosPorSucursal: APP_ROUTES.finanzas.cobros.cobrosCajas,
} as const;
