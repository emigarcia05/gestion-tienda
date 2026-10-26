import { resumenBalanceMensualDesdeFilas } from "@/lib/balanceMensual";
import {
  montoFilaBalanceHistorial,
  ventanaMesesHastaFinAsc,
  type BalanceMensualFilaHistorialId,
} from "@/lib/balanceMensualHistorialFila";
import { listarFilasBalanceMensual } from "@/services/balanceMensualLibros.service";
import type { HistoricoMontoGastoFinalBalanceItem } from "@/services/finBalGastoMensualBalance.service";
import {
  listarSucursalesGeneraBalance,
  ventasPorSucursalNombreMes,
} from "@/services/ventasMensuales.service";

const MESES_CORTO_ES: Record<number, string> = {
  1: "ene",
  2: "feb",
  3: "mar",
  4: "abr",
  5: "may",
  6: "jun",
  7: "jul",
  8: "ago",
  9: "sep",
  10: "oct",
  11: "nov",
  12: "dic",
};

const BATCH_PERIODOS = 4;

export type ColumnaSerieHistorialFila =
  | { ambito: "global" }
  | { ambito: "sucursal"; nombre: string };

/**
 * Serie mensual del **total de la fila** (ventas, costos, resultados, margen %, punto de equilibrio)
 * para la misma columna que la grilla, recalculando `resumenBalanceMensualDesdeFilas` en cada mes.
 */
export async function listarSerieHistorialFilaBalanceMensual(params: {
  filaConceptoId: BalanceMensualFilaHistorialId;
  columna: ColumnaSerieHistorialFila;
  mesFin: number;
  anioFin: number;
  cantidadMeses: number;
}): Promise<HistoricoMontoGastoFinalBalanceItem[]> {
  const sucursales = await listarSucursalesGeneraBalance();
  const periodos = ventanaMesesHastaFinAsc(
    params.mesFin,
    params.anioFin,
    params.cantidadMeses,
  );
  const items: HistoricoMontoGastoFinalBalanceItem[] = [];

  for (let i = 0; i < periodos.length; i += BATCH_PERIODOS) {
    const slice = periodos.slice(i, i + BATCH_PERIODOS);
    const chunk = await Promise.all(
      slice.map(async ({ mes, anio }) => {
        const [filas, ventasPorSucursalNombre] = await Promise.all([
          listarFilasBalanceMensual(mes, anio),
          ventasPorSucursalNombreMes(mes, anio, sucursales),
        ]);
        const resumen = resumenBalanceMensualDesdeFilas(
          filas,
          ventasPorSucursalNombre,
          sucursales,
        );
        const col = params.columna;
        const bloque =
          col.ambito === "global"
            ? resumen.global
            : resumen.sucursales.find((s) => s.nombre === col.nombre)?.bloque;
        const monto = bloque
          ? montoFilaBalanceHistorial(params.filaConceptoId, bloque)
          : 0;
        return {
          mes,
          anio,
          monto,
          etiquetaMes: `${MESES_CORTO_ES[mes] ?? String(mes)} ${anio}`,
        } satisfies HistoricoMontoGastoFinalBalanceItem;
      }),
    );
    items.push(...chunk);
  }

  return items;
}
