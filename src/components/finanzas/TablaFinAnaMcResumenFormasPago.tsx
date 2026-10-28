"use client";

import { useMemo } from "react";
import {
  EmptyTableRow,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LINEA_CABEZAL_SECUNDARIA_MC } from "@/components/finanzas/TablaFinAnaMargenContribucion";
import {
  ETIQUETA_PAR_ESCENARIOS_MC,
  fmtParEscenariosMargenContribucion,
  type ParametrosFormulaMargenContribucion,
} from "@/lib/finAnaMargenContribucion";
import {
  margenesPorEscenarioMargenContribucion,
  type ColumnaMargenContribucion,
} from "@/lib/finAnaMcColumnas";
import { cn } from "@/lib/utils";

interface Props {
  /** Todas las combinaciones habilitadas (no dependen de los filtros FORMA / ENTIDAD / CUOTAS). */
  columnas: ColumnaMargenContribucion[];
  descuentoPctPorColumna: Record<string, number>;
  porcUtilidadPct: number | null;
  pxLista: number;
  formulaParams: ParametrosFormulaMargenContribucion;
}

/** Mayor primero; sin valor (null) al final. */
function compararDesc(a: number | null, b: number | null): number {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return b - a;
}

/**
 * Resumen lateral de Margen Contribución: una fila por combinación con M.C y M.C POND. (CON IVA | SIN IVA),
 * ordenadas por M.C POND. CON IVA (desempata SIN IVA; empate total conserva el orden de `columnas`).
 * El punto de color es la referencia de la línea del gráfico.
 */
export default function TablaFinAnaMcResumenFormasPago({
  columnas,
  descuentoPctPorColumna,
  porcUtilidadPct,
  pxLista,
  formulaParams,
}: Props) {
  const filas = useMemo(
    () =>
      columnas
        .map((columna) => ({
          columna,
          margenes: margenesPorEscenarioMargenContribucion(columna, {
            pxLista,
            descuentoPct: descuentoPctPorColumna[columna.id] ?? 0,
            porcUtilidadPct,
            formulas: formulaParams,
          }),
        }))
        .sort(
          (a, b) =>
            compararDesc(a.margenes.mcPonderado.FACTURA_A, b.margenes.mcPonderado.FACTURA_A) ||
            compararDesc(a.margenes.mcPonderado.FACTURA_C, b.margenes.mcPonderado.FACTURA_C)
        ),
    [columnas, descuentoPctPorColumna, porcUtilidadPct, pxLista, formulaParams]
  );

  return (
    <div className="contenedor-tabla-gestion min-w-0 w-full">
      <Table variant="compact" scrollX={false} className="tabla-fin-ana-mc-resumen">
        <colgroup>
          <col className="w-1/2" />
          <col className="w-1/4" />
          <col className="w-1/4" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>FORMA PAGO</TableHead>
            <TableHead title={ETIQUETA_PAR_ESCENARIOS_MC}>
              <span className="block">M.C.</span>
              <span className={LINEA_CABEZAL_SECUNDARIA_MC}>{ETIQUETA_PAR_ESCENARIOS_MC}</span>
            </TableHead>
            <TableHead title={ETIQUETA_PAR_ESCENARIOS_MC}>
              <span className="block">M.C. POND.</span>
              <span className={LINEA_CABEZAL_SECUNDARIA_MC}>{ETIQUETA_PAR_ESCENARIOS_MC}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.length === 0 ? (
            <EmptyTableRow colSpan={3} message="Sin formas de pago habilitadas" />
          ) : (
            filas.map(({ columna, margenes }) => (
              <TableRow key={columna.id} className="tabla-fila-altura-auto">
                <TableCell className="celda-datos px-2 py-1 leading-tight" title={columna.etiqueta}>
                  {columna.cuotaEtiqueta ? (
                    <span className={cn(LINEA_CABEZAL_SECUNDARIA_MC, "text-muted-foreground")}>
                      {columna.cuotaEtiqueta}
                    </span>
                  ) : null}
                  <span className="flex min-w-0 items-center justify-center gap-1.5">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: columna.color }}
                      aria-hidden
                    />
                    <span className="truncate font-semibold">{columna.formaNombre}</span>
                  </span>
                  {columna.entidadNombre ? (
                    <span className={cn(LINEA_CABEZAL_SECUNDARIA_MC, "text-muted-foreground")}>
                      {columna.entidadNombre}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell
                  className="celda-datos celda-numero px-2 py-1 font-bold tabular-nums"
                  title={ETIQUETA_PAR_ESCENARIOS_MC}
                >
                  {fmtParEscenariosMargenContribucion(
                    margenes.mc.FACTURA_A,
                    margenes.mc.FACTURA_C
                  )}
                </TableCell>
                <TableCell
                  className="celda-datos celda-numero px-2 py-1 font-bold tabular-nums"
                  title={ETIQUETA_PAR_ESCENARIOS_MC}
                >
                  {fmtParEscenariosMargenContribucion(
                    margenes.mcPonderado.FACTURA_A,
                    margenes.mcPonderado.FACTURA_C,
                    "base100"
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
