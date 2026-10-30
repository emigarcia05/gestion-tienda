import type { CambioPxListas } from "@/lib/validations/pxListasPrecios";
import { limpiarCompetenciaRefSiListaGeneral } from "@/services/pxListasCompetenciaRef.service";
import {
  guardarPrecioListaEdicionDesdeMargen,
  guardarPrecioListaEdicionDesdePx,
} from "@/services/pxListasPrecioEdicion.service";

export type ResultadoCambioPxListas = { codTienda: string; idLista: number } & (
  | { ok: true; pxEdicion: number | null }
  | { ok: false; error: string }
);

/**
 * **Guardar Cambios** de Px Listas: aplica cada cambio en `prod_listas_precios_edicion` (en orden).
 * Un error no corta el lote: se devuelve por celda para que la UI deje pendientes solo las fallidas.
 * Edición manual en 1 - GENERAL quita el competidor de referencia (igual que la edición por celda).
 */
export async function guardarCambiosPxListasLote(
  cambios: readonly CambioPxListas[]
): Promise<ResultadoCambioPxListas[]> {
  const resultados: ResultadoCambioPxListas[] = [];
  for (const cambio of cambios) {
    const { codTienda, idLista } = cambio;
    try {
      const res =
        cambio.tipo === "px"
          ? await guardarPrecioListaEdicionDesdePx(codTienda, idLista, cambio.pxEdicion)
          : await guardarPrecioListaEdicionDesdeMargen(codTienda, idLista, cambio.margenManual);
      if (!res.success) {
        resultados.push({ codTienda, idLista, ok: false, error: res.error });
        continue;
      }
      await limpiarCompetenciaRefSiListaGeneral(codTienda, idLista);
      resultados.push({ codTienda, idLista, ok: true, pxEdicion: res.data.pxEdicion });
    } catch (e: unknown) {
      console.error("[pxListasCambiosLote] guardarCambiosPxListasLote:", e);
      resultados.push({
        codTienda,
        idLista,
        ok: false,
        error: e instanceof Error ? e.message : "No se pudo guardar el precio.",
      });
    }
  }
  return resultados;
}
