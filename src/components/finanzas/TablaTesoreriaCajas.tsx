"use client";

import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtCelda, fmtPrecio } from "@/lib/format";
import { Banknote, Pencil, ScrollText } from "lucide-react";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import type { TipoCajaTesoreria } from "@prisma/client";
import { etiquetaTipoCajaEnPantalla } from "@/lib/cajasTesoreriaTipos";

export interface TesoreriaCajaFila {
  id: string;
  entidadId: string;
  entidadNombre: string;
  titular: string;
  sucursalId: string | null;
  sucursalNombre: string;
  tipoCaja: string;
  tipoValor: string;
  /** Valor persistido en BD (p. ej. edición de caja); no usar para totales si existe `montoDisponible`. */
  monto: number;
  /** Monto que cuenta hoy para totales y columna MONTO (cajas CHEQUE: cheques con fecha de acreditación ≤ hoy AR). */
  montoDisponible: number;
  /** Solo cajas CHEQUE: cheques con fecha de acreditación > hoy AR (diferidos). */
  montoChequesDiferidos: number;
  /** Solo para ordenar en cliente; no se muestra en la grilla. */
  ultActualizacionIso: string;
}

interface Props {
  filas: TesoreriaCajaFila[];
  esEditor?: boolean;
  /** Caja tipo CHEQUE: abrir detalle de cheques (botón en ACCIONES). */
  onChequeRowClick?: (fila: TesoreriaCajaFila) => void;
  /** Cajas no CHEQUE: abrir modal de actualización de monto. */
  onEditMontoClick?: (fila: TesoreriaCajaFila) => void;
  onEditDataClick?: (fila: TesoreriaCajaFila) => void;
}

/** Orden: TIPO CAJA, ENTIDAD, SUCURSAL, TITULAR, MONTO [, ACCIONES]. */
const COLS = 5;

const COL_WIDTHS_PCT_CON_ACCIONES = [16, 18, 16, 18, 18, 14] as const;
const COL_WIDTHS_PCT_SIN_ACCIONES = [18, 22, 18, 22, 20] as const;

const TH_NUM = "text-right whitespace-nowrap";
const TD_NUM = "celda-datos text-right tabular-nums";
const CELL_MIN = "min-w-0";

function ColgroupAnchos({ anchos }: { anchos: readonly number[] }) {
  return (
    <colgroup>
      {anchos.map((pct, i) => (
        <col key={i} style={{ width: `${pct}%` }} />
      ))}
    </colgroup>
  );
}

/**
 * Pie de resumen (filas ya filtradas en cliente).
 * Subtotales por `tipoValor` (**CHEQUE** = disponible + diferido por caja según
 * `fecha_acreditacion` ≤ / > hoy AR en cheques no transferidos).
 */
function totalesPieResumenTesoreria(filas: TesoreriaCajaFila[]): {
  efectivoTipoValor: number;
  digitalTipoValor: number;
  chequeTipoValor: number;
} {
  let efectivoTipoValor = 0;
  let digitalTipoValor = 0;
  let chequeTipoValor = 0;

  for (const f of filas) {
    const m = f.montoDisponible;
    const cheqDif = f.montoChequesDiferidos;

    if (f.tipoValor === "EFECTIVO") efectivoTipoValor += m;
    else if (f.tipoValor === "DIGITAL") digitalTipoValor += m;
    else if (f.tipoValor === "CHEQUE") chequeTipoValor += m + cheqDif;
  }

  return { efectivoTipoValor, digitalTipoValor, chequeTipoValor };
}

function TarjetaResumenTesoreria({
  etiqueta,
  children,
  valorDestacado,
  compact,
  etiquetaClassName,
}: {
  etiqueta: string;
  children: ReactNode;
  valorDestacado?: boolean;
  compact?: boolean;
  etiquetaClassName?: string;
}) {
  return (
    <div
      className={cn(
        "finanzas-resumen-tarjeta",
        compact && "finanzas-resumen-tarjeta--compact"
      )}
    >
      <span
        className={cn(
          "w-full font-semibold uppercase tracking-wide text-muted-foreground",
          compact
            ? "finanzas-resumen-tarjeta--compact-etiqueta leading-tight"
            : "text-[10px] leading-none",
          etiquetaClassName
        )}
      >
        {etiqueta}
      </span>
      <span
        className={cn(
          "celda-destacado w-full text-center text-sm tabular-nums leading-tight",
          compact && "finanzas-resumen-tarjeta--compact-valor",
          valorDestacado ? "font-bold" : "font-medium"
        )}
      >
        {children}
      </span>
    </div>
  );
}

/** Etiqueta a la izquierda de cada fila de tarjetas del pie de Tesorería. */
function EtiquetaFilaResumenTesoreria({
  linea1,
  linea2,
}: {
  linea1: string;
  linea2: string;
}) {
  return (
    <div className="flex min-h-0 min-w-0 items-center justify-center text-center">
      <p className="text-xs font-semibold uppercase leading-tight text-foreground">
        {linea1}
        <br />
        {linea2}
      </p>
    </div>
  );
}

const RESUMEN_FILA_GRID_CLASS =
  "grid w-full grid-cols-[6.75rem_1fr_1fr_1fr] items-stretch gap-2";

export default function TablaTesoreriaCajas({
  filas,
  esEditor = false,
  onChequeRowClick,
  onEditMontoClick,
  onEditDataClick,
}: Props) {
  const { efectivoTipoValor, digitalTipoValor, chequeTipoValor } =
    totalesPieResumenTesoreria(filas);
  const colCount = esEditor ? COLS + 1 : COLS;
  const anchosColPct = esEditor ? COL_WIDTHS_PCT_CON_ACCIONES : COL_WIDTHS_PCT_SIN_ACCIONES;

  return (
    <div className="flex flex-1 min-h-0 flex-col pb-4">
      <div className="contenedor-tabla-gestion contenedor-tabla-gestion--pie-fijo flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-card">
        <div className="contenedor-tabla-gestion--pie-fijo-scroll">
          <Table variant="compact" scrollX={false} className="table-fixed w-full">
            <ColgroupAnchos anchos={anchosColPct} />
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={CELL_MIN}>TIPO CAJA</TableHead>
                <TableHead className={CELL_MIN}>ENTIDAD</TableHead>
                <TableHead className={CELL_MIN}>SUCURSAL</TableHead>
                <TableHead className={CELL_MIN}>TITULAR</TableHead>
                <TableHead className={cn(TH_NUM, CELL_MIN)}>MONTO</TableHead>
                {esEditor ? (
                  <TableHead className={cn("text-center tabla-bloque-secundario-head-divider", CELL_MIN)}>
                    ACCIONES
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.length === 0 ? (
                <EmptyTableRow colSpan={colCount} message="No hay cajas de tesorería registradas." />
              ) : (
                filas.map((f) => (
                  <TableRow
                    key={f.id}
                    onDoubleClick={
                      !esEditor && f.tipoCaja === "CHEQUE" && onChequeRowClick
                        ? () => onChequeRowClick(f)
                        : undefined
                    }
                    title={
                      !esEditor && f.tipoCaja === "CHEQUE" && onChequeRowClick
                        ? "Doble clic para ver los cheques de esta caja"
                        : undefined
                    }
                    className={cn(
                      !esEditor && f.tipoCaja === "CHEQUE" && onChequeRowClick && "cursor-pointer"
                    )}
                  >
                    <TableCell className={cn("celda-datos whitespace-nowrap", CELL_MIN)}>
                      {etiquetaTipoCajaEnPantalla(f.tipoCaja as TipoCajaTesoreria)}
                    </TableCell>
                    <TableCell className={cn("celda-datos", CELL_MIN)} title={f.entidadNombre}>
                      <span className="celda-destacado block truncate">{f.entidadNombre}</span>
                    </TableCell>
                    <TableCell className={cn("celda-datos", CELL_MIN)} title={f.sucursalNombre || undefined}>
                      <span className="block truncate">{fmtCelda(f.sucursalNombre)}</span>
                    </TableCell>
                    <TableCell className={cn("celda-datos", CELL_MIN)} title={f.titular}>
                      <span className="block truncate">{f.titular}</span>
                    </TableCell>
                    <TableCell className={cn(TD_NUM, "celda-destacado", CELL_MIN)}>
                      ${fmtPrecio(f.montoDisponible)}
                    </TableCell>
                    {esEditor ? (
                      <TableCell
                        className={cn(
                          "celda-datos celda-datos--accion-relleno-fila tabla-bloque-secundario-cell-divider",
                          CELL_MIN
                        )}
                      >
                        <div className={cn(TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS, "flex-wrap justify-center gap-1")}>
                          {f.tipoCaja === "CHEQUE" && onChequeRowClick ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              onClick={(event) => {
                                event.stopPropagation();
                                onChequeRowClick(f);
                              }}
                              aria-label="Ver cheques de la caja"
                              title="Ver cheques"
                            >
                              <ScrollText className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                            </Button>
                          ) : onEditMontoClick ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              onClick={(event) => {
                                event.stopPropagation();
                                onEditMontoClick(f);
                              }}
                              aria-label="Editar monto"
                              title="Editar monto"
                            >
                              <Banknote className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                            onClick={(event) => {
                              event.stopPropagation();
                              onEditDataClick?.(f);
                            }}
                            aria-label="Editar caja"
                            title="Editar caja"
                          >
                            <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {filas.length > 0 ? (
          <div
            className="w-full shrink-0 border-t border-border px-2 py-1"
            role="region"
            aria-label="Totales por tipo de valor"
            aria-live="polite"
          >
            <div
              className={cn(
                "flex w-full flex-col gap-2",
                "[&_.finanzas-resumen-tarjeta]:!w-full [&_.finanzas-resumen-tarjeta]:!min-w-0 [&_.finanzas-resumen-tarjeta]:!max-w-none"
              )}
            >
              <div className={RESUMEN_FILA_GRID_CLASS}>
                <EtiquetaFilaResumenTesoreria
                  linea1="Totales por"
                  linea2="tipo de valor"
                />
                <TarjetaResumenTesoreria etiqueta="EFECTIVO" compact>
                  ${fmtPrecio(efectivoTipoValor)}
                </TarjetaResumenTesoreria>
                <TarjetaResumenTesoreria etiqueta="DIGITAL" compact>
                  ${fmtPrecio(digitalTipoValor)}
                </TarjetaResumenTesoreria>
                <TarjetaResumenTesoreria etiqueta="CHEQUE" compact>
                  ${fmtPrecio(chequeTipoValor)}
                </TarjetaResumenTesoreria>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
