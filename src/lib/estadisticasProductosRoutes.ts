import { APP_ROUTES } from "./appRoutes";

/**
 * Rutas del módulo **ESTADÍSTICAS** (área Administrador):
 * VENTAS · Carga De Datos · Configuracion.
 */
export const ESTADISTICAS_PRODUCTOS_ROUTES = {
  estadisticasVtas: APP_ROUTES.administrador.estadisticas.ventas,
  ventasPorProducto: APP_ROUTES.administrador.estadisticas.cargaDeDatos,
  categorizacion: APP_ROUTES.administrador.estadisticas.configuracion,
} as const;
