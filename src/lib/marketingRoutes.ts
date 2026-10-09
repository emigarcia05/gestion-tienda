import { APP_ROUTES } from "./appRoutes";

/** Rutas del área Marketing (`/marketing/{módulo}/{función}`). */
export const MARKETING_ROUTES = {
  publicaciones: {
    calendario: APP_ROUTES.marketing.publicaciones.calendario,
    ideas: APP_ROUTES.marketing.publicaciones.ideasContenido,
    objetivos: APP_ROUTES.marketing.publicaciones.objetivos,
  },
  baseMultimedia: {
    contenido: APP_ROUTES.marketing.baseMultimedia.baseMultimedia,
    coloresMarca: APP_ROUTES.marketing.baseMultimedia.coloresMarca,
  },
} as const;
