import type {
  CompetidorFalloRelevamientoFila,
  CompetidorPrecioFila,
} from "@/lib/competenciaPreciosFilaResumen";
import type { VinculoPxCompetencia } from "@/lib/pxCompetenciaVinculos";

/** Opción de competidor con precio (armado en servidor para resumen/detalle). */
export type OpcionPxCompetencia = {
  competenciaId: string;
  nombre: string;
  px: number | null;
};

export type ItemPxCompetenciaTabla = {
  id: string;
  codItem: string;
  descripcion: string;
  costoCompra: number;
  /** Precio lista principal DUX (`prod_propios_listas_precios`, id lista principal). Referencia DIF TIENDA vs promedio. */
  pxListaTienda: number;
  pxPromedio: number | null;
  difPctTiendaVsPromedio: number | null;
  competidoresPrecioDetalle: CompetidorPrecioFila[];
  competidoresFalloDetalle: CompetidorFalloRelevamientoFila[];
  vinculosCompetencia: VinculoPxCompetencia[];
};
