import { z } from "zod";

/** Parámetros de URL del listado Px Competencia (`/administrador/productos/px-competencia`). */
export const getPxCompetenciaPageParamsSchema = z.object({
  q: z.string().max(500).optional(),
  rubro: z.string().max(200).optional(),
  marca: z.string().max(200).optional(),
  /** `mayor-promedio` | `menor-promedio` (DIF TIENDA vs promedio). */
  filtroPxPromedio: z.string().max(32).optional(),
  pagina: z.string().max(20).optional(),
});
