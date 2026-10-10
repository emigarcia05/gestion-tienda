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
import {
  ArrowLeftRight,
  Banknote,
  CalendarClock,
  FileOutput,
  Pencil,
  ReceiptText,
  Trash2,
} from "lucide-react";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import type { TipoCajaTesoreria } from "@prisma/client";
import { etiquetaTipoCajaEnPantalla } from "@/lib/cajasTesoreriaTipos";

export interface TesoreriaCajaFila {
  id: string;
  entidadId: string | null;
  entidadNombre: string;
  titular: string;
  sucursalId: string | null;
  sucursalNombre: string;
  tipoCaja: string;
  tipoValor: string;
  recibeCheque: boolean;
  depositaCheque: boolean;
  emiteCheque: boolean;
  /** Caché legacy en BD; no se muestra. */
  monto: number;
  /** Saldo acreditado (`fecha_acreditacion` ≤ hoy). */
  montoDisponible: number;
  /** INGRESO aún no acreditado (`fecha_acreditacion` > hoy). */
  montoAAcreditar: number;
  /** ISO de `ult_actualizacion` (caché legacy); no se muestra ni ordena la grilla. */
  ultActualizacionIso: string;
}

interface Props {
  filas: TesoreriaCajaFila[];
  esEditor?: boolean;
  /** Cajas: abrir modal de actualización de monto. */
  onEditMontoClick?: (fila: TesoreriaCajaFila) => void;
  /** Transferir desde esta caja a otra; `disabled` sin monto disponible. */
  onTransferenciaClick?: (fila: TesoreriaCajaFila) => void;
  onEditDataClick?: (fila: TesoreriaCajaFila) => void;
  onDeleteClick?: (fila: TesoreriaCajaFila) => void;
  /** Abrir el modal CHEQUES. El ícono está en todas las filas; `disabled` si no RECIBE CHEQUE. */
  onChequesClick?: (fila: TesoreriaCajaFila) => void;
  /** Modal ECHEQS EMITIDOS. El ícono está en todas las filas; `disabled` si no EMITE CHEQUE. */
  onChequesEmitidosClick?: (fila: TesoreriaCajaFila) => void;
  /** Resumen de solo lectura del monto a acreditar (tarjetas / cheques). */
  onResumenAcreditacionClick?: (fila: TesoreriaCajaFila) => void;
}

/** Orden: TIPO CAJA, ENTIDAD, SUCURSAL, TITULAR, MONTO DISPONIBLE, MONTO A ACREDITAR [, ACCIONES]. */
const COLS = 6;

const COL_WIDTHS_PCT_CON_ACCIONES = [12, 12, 10, 12, 12, 12, 30] as const;
const COL_WIDTHS_PCT_SIN_ACCIONES = [16, 16, 14, 16, 19, 19] as const;

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
 * Subtotales por `tipoValor` usando el saldo disponible de cada caja.
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

    if (f.tipoValor === "EFECTIVO") efectivoTipoValor += m;
    else if (f.tipoValor === "DIGITAL") digitalTipoValor += m;
    else if (f.tipoValor === "CHEQUE") chequeTipoValor += m;
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

const RESUMEN_FILA_GRID_CLASS =
  "grid w-full grid-cols-3 items-stretch gap-2";

export default function TablaTesoreriaCajas({
  filas,
  esEditor = false,
  onEditMontoClick,
  onTransferenciaClick,
  onEditDataClick,
  onDeleteClick,
  onChequesClick,
  onChequesEmitidosClick,
  onResumenAcreditacionClick,
}: Props) {
  const { efectivoTipoValor, digitalTipoValor, chequeTipoValor } =
    totalesPieResumenTesoreria(filas);
  const mostrarAcciones =
    esEditor ||
    onChequesClick != null ||
    onChequesEmitidosClick != null ||
    onResumenAcreditacionClick != null;
  const colCount = mostrarAcciones ? COLS + 1 : COLS;
  const anchosColPct = mostrarAcciones ? COL_WIDTHS_PCT_CON_ACCIONES : COL_WIDTHS_PCT_SIN_ACCIONES;

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
                <TableHead className={cn(TH_NUM, CELL_MIN)}>MONTO DISPONIBLE</TableHead>
                <TableHead className={cn(TH_NUM, CELL_MIN)}>MONTO A ACREDITAR</TableHead>
                {mostrarAcciones ? (
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
                  <TableRow key={f.id}>
                    <TableCell className={cn("celda-datos whitespace-nowrap", CELL_MIN)}>
                      {etiquetaTipoCajaEnPantalla(f.tipoCaja as TipoCajaTesoreria)}
                    </TableCell>
                    <TableCell className={cn("celda-datos", CELL_MIN)} title={f.entidadNombre}>
                      <span className="celda-destacado block truncate">{fmtCelda(f.entidadNombre)}</span>
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
                    <TableCell className={cn(TD_NUM, CELL_MIN)}>
                      ${fmtPrecio(f.montoAAcreditar)}
                    </TableCell>
                    {mostrarAcciones ? (
                      <TableCell
                        className={cn(
                          "celda-datos celda-datos--accion-relleno-fila tabla-bloque-secundario-cell-divider",
                          CELL_MIN
                        )}
                      >
                        <div className={cn(TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS, "flex-nowrap justify-center gap-1")}>
                          {onEditMontoClick ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              onClick={(event) => {
                                event.stopPropagation();
                                onEditMontoClick(f);
                              }}
                              aria-label="Ajustar monto"
                              title="Ajustar monto"
                            >
                              <Banknote className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                            </Button>
                          ) : null}
                          {onTransferenciaClick ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              disabled={f.montoDisponible <= 0}
                              onClick={(event) => {
                                event.stopPropagation();
                                onTransferenciaClick(f);
                              }}
                              aria-label={
                                f.montoDisponible > 0
                                  ? "Transferencia"
                                  : "Transferencia (sin monto disponible)"
                              }
                              title={
                                f.montoDisponible > 0
                                  ? "Transferencia"
                                  : "No hay monto disponible para transferir"
                              }
                            >
                              <ArrowLeftRight className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                            </Button>
                          ) : null}
                          {onResumenAcreditacionClick ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              disabled={f.montoAAcreditar <= 0}
                              onClick={(event) => {
                                event.stopPropagation();
                                onResumenAcreditacionClick(f);
                              }}
                              aria-label={
                                f.montoAAcreditar > 0
                                  ? "Monto a acreditar"
                                  : "Monto a acreditar (sin pendientes)"
                              }
                              title={
                                f.montoAAcreditar > 0
                                  ? "Monto a acreditar"
                                  : "No hay montos a acreditar"
                              }
                            >
                              <CalendarClock className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                            </Button>
                          ) : null}
                          {onChequesClick ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              disabled={!f.recibeCheque}
                              onClick={(event) => {
                                event.stopPropagation();
                                onChequesClick(f);
                              }}
                              aria-label={
                                f.recibeCheque
                                  ? "Cheques"
                                  : "Cheques (la caja no recibe cheque)"
                              }
                              title={
                                f.recibeCheque
                                  ? "Cheques"
                                  : "La caja no recibe cheque"
                              }
                            >
                              <ReceiptText className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                            </Button>
                          ) : null}
                          {onChequesEmitidosClick ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              disabled={!f.emiteCheque}
                              onClick={(event) => {
                                event.stopPropagation();
                                onChequesEmitidosClick(f);
                              }}
                              aria-label={
                                f.emiteCheque
                                  ? "eCheqs emitidos"
                                  : "eCheqs emitidos (la caja no emite cheque)"
                              }
                              title={
                                f.emiteCheque
                                  ? "eCheqs emitidos"
                                  : "La caja no emite cheque"
                              }
                            >
                              <FileOutput className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                            </Button>
                          ) : null}
                          {onEditDataClick ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              onClick={(event) => {
                                event.stopPropagation();
                                onEditDataClick(f);
                              }}
                              aria-label="Editar caja"
                              title="Editar caja"
                            >
                              <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                            </Button>
                          ) : null}
                          {onDeleteClick ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              onClick={(event) => {
                                event.stopPropagation();
                                onDeleteClick(f);
                              }}
                              aria-label="Eliminar caja"
                              title="Eliminar caja"
                            >
                              <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                            </Button>
                          ) : null}
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
            className={cn("pie-pagina", "w-full shrink-0 px-2 py-1")}
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
