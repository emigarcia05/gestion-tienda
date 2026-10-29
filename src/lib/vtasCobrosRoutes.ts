import { APP_ROUTES } from "./appRoutes";

/** Rutas de cobros del módulo **COBROS & DESC.** (área Administrador). */
export const VTAS_COBROS_ROUTES = {
  ptosVenta: APP_ROUTES.administrador.cobrosDesc.ptosVtas,
  cxFinCobros: APP_ROUTES.administrador.cobrosDesc.cobrosCxFina,
  cobrosPorSucursal: APP_ROUTES.administrador.cobrosDesc.cobrosCajas,
} as const;
