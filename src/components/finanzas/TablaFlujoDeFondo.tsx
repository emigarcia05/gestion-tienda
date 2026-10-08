"use client";

/**
 * Flujo De Fondo (`/finanzas/venc-por-fecha`) — tablas con el **mismo cascarón** que
 * `TablaControlComprobantes` (`contenedor-tabla-gestion` → scroll →
 * `<Table variant="compact" scrollX={false}>`). Clase `tabla-flujo-de-fondo`: columna **FECHA**
 * centrada; importes con `TD_NUM`. **SALDO** negativo: `text-destructive font-semibold` en la celda.
 * El detalle del día se abre con el ícono Ver de **ACCIONES**.
 */

import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatMesDiaMayusculasDesdeIsoYmd,
} from "@/lib/fechaArgentina";
import type { FilaFlujoDeFondoCalculada } from "@/lib/flujoDeFondoFilas";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { FlujoFondoIngresoCajaFila } from "@/services/tesoreriaMovimientos.service";
import type { FlujoFondoDetalleDiaFila } from "@/services/vencimientosPorFecha.service";
import {
  EmptyTableRow,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function fmtMontoAr(n: number): string {
  return `$${n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const COL_WIDTH_CLASSES_MAIN = [
  "w-[22%]",
  "w-[22%]",
  "w-[22%]",
  "w-[22%]",
  "w-[12%]",
] as const;
const COL_WIDTH_CLASSES_INGRESOS = ["w-[58%]", "w-[28%]", "w-[14%]"] as const;
const COL_WIDTH_CLASSES_MODAL = ["w-[26%]", "w-[36%]", "w-[24%]", "w-[14%]"] as const;

const TH_NUM = "text-right whitespace-nowrap";
const TD_NUM = "celda-datos text-right tabular-nums";
const CELL_MIN = "min-w-0";

function ColgroupAnchos({ anchos }: { anchos: readonly string[] }) {
  return (
    <colgroup>
      {anchos.map((cls, i) => (
        <col key={i} className={cls} />
      ))}
    </colgroup>
  );
}

export type FilaFlujoDeFondoVista = FilaFlujoDeFondoCalculada;

export interface TablaFlujoDeFondoProps {
  filas: FilaFlujoDeFondoVista[];
  montoVencimientoPorDia: Record<string, number>;
  onVerDia: (isoYmd: string) => void;
}

/**
 * Grilla paginada principal. El detalle del día se abre con el ícono Ver de ACCIONES.
 */
export function TablaFlujoDeFondo({
  filas,
  montoVencimientoPorDia,
  onVerDia,
}: TablaFlujoDeFondoProps) {
  return (
    <div className="contenedor-tabla-gestion overflow-hidden">
      <div className="flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-auto [scrollbar-gutter:stable]">
        <Table
          variant="compact"
          scrollX={false}
          className="tabla-flujo-de-fondo table-fixed w-full"
        >
          <ColgroupAnchos anchos={COL_WIDTH_CLASSES_MAIN} />
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={CELL_MIN}>FECHA</TableHead>
              <TableHead className={cn(TH_NUM, CELL_MIN)}>VENCIMIENTOS</TableHead>
              <TableHead className={cn(TH_NUM, CELL_MIN)}>INGRESOS</TableHead>
              <TableHead className={cn(TH_NUM, CELL_MIN)}>SALDO</TableHead>
              <TableHead className={cn(CELL_MIN, "text-center")}>ACCIONES</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 ? (
              <EmptyTableRow
                colSpan={5}
                message="Sin vencimientos en los próximos 150 días."
              />
            ) : (
              filas.map((fila) => (
                <TableRow key={fila.isoYmd}>
                  <TableCell
                    className={cn("celda-datos celda-destacado text-center", CELL_MIN)}
                  >
                    {formatMesDiaMayusculasDesdeIsoYmd(fila.isoYmd)}
                  </TableCell>
                  <TableCell className={cn(TD_NUM, CELL_MIN)}>
                    {fmtMontoAr(montoVencimientoPorDia[fila.isoYmd] ?? 0)}
                  </TableCell>
                  <TableCell className={cn(TD_NUM, CELL_MIN)}>
                    {fmtMontoAr(fila.ingresosDelDia)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      TD_NUM,
                      "celda-destacado",
                      fila.saldo < 0 && "text-destructive font-semibold",
                      CELL_MIN
                    )}
                  >
                    {fmtMontoAr(fila.saldo)}
                  </TableCell>
                  <TableCell className={cn("celda-datos text-center", CELL_MIN)}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Ver detalle del día"
                      className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                      onClick={() => onVerDia(fila.isoYmd)}
                    >
                      <Eye className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export interface TablaFlujoDeFondoDetalleDiaProps {
  filas: FlujoFondoDetalleDiaFila[];
  /**
   * Texto de fila vacía (`EmptyTableRow`). Por defecto: detalle por día en Flujo de Fondo.
   * En **Venc. Provee. Gastos** pasar mensaje acorde al filtro por proveedor.
   */
  emptyMessage?: string;
  /** La tabla ocupa el alto libre del panel (modal partido en dos). */
  llenarAlto?: boolean;
  /** Flujo De Fondo: fechas `dd/mm/aa` y proveedor = prefijo de 3 letras. */
  fechaDdMmAa?: boolean;
  onVerDetalle?: (fila: FlujoFondoDetalleDiaFila) => void;
}

/**
 * Modal “Detalle del día”: **FECHA DEVENGADA** + **FECHA VENCIMIENTO** + **PROVEEDOR** + **DETALLE** + **MONTO**;
 * el scroll va en un ancestro del `Table` (misma regla que el resto de modales con tabla).
 */
export function TablaFlujoDeFondoDetalleDia({
  filas,
  emptyMessage = "Sin vencimientos para el día seleccionado.",
  llenarAlto = false,
  fechaDdMmAa = false,
  onVerDetalle,
}: TablaFlujoDeFondoDetalleDiaProps) {
  return (
    <div
      className={cn(
        "contenedor-tabla-gestion overflow-hidden",
        llenarAlto ? "min-h-0 flex-1" : "max-h-full"
      )}
    >
      <div
        className={cn(
          "no-scrollbar min-w-0 overflow-x-auto overflow-y-auto",
          llenarAlto
            ? "h-full min-h-0 flex-1"
            : "min-h-[14rem] max-h-[min(28rem,70vh)] flex-1"
        )}
      >
        <Table
          variant="compact"
          scrollX={false}
          className="tabla-flujo-de-fondo table-fixed w-full"
        >
          <ColgroupAnchos anchos={COL_WIDTH_CLASSES_MODAL} />
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={CELL_MIN}>PROVEEDOR</TableHead>
              <TableHead className={CELL_MIN}>DETALLE</TableHead>
              <TableHead className={cn(TH_NUM, CELL_MIN)}>MONTO</TableHead>
              <TableHead className={cn(CELL_MIN, "text-center")}>ACCIONES</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 ? (
              <EmptyTableRow colSpan={4} message={emptyMessage} />
            ) : (
              filas.map((fila) => (
                <TableRow key={fila.sortId}>
                  <TableCell
                    className={cn("celda-datos max-w-[14rem] text-left celda-destacado", CELL_MIN)}
                    title={fila.proveedor}
                  >
                    <span className="block truncate">
                      {fechaDdMmAa && fila.proveedorPrefijo
                        ? fila.proveedorPrefijo
                        : fila.proveedor}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn("celda-datos max-w-[18rem] text-left", CELL_MIN)}
                    title={fila.detalle}
                  >
                    <span className="block truncate">{fila.detalle}</span>
                  </TableCell>
                  <TableCell className={cn(TD_NUM, CELL_MIN)}>
                    {fmtMontoAr(fila.monto)}
                  </TableCell>
                  <TableCell className={cn("celda-datos text-center", CELL_MIN)}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Ver detalle de vencimiento"
                      className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                      onClick={() => onVerDetalle?.(fila)}
                    >
                      <Eye className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const TITULO_SECCION_MODAL =
  "shrink-0 text-center text-xs font-bold uppercase tracking-wide text-foreground";

export function TituloSeccionDetalleDia({ children }: { children: string }) {
  return <h3 className={TITULO_SECCION_MODAL}>{children}</h3>;
}

export interface TablaFlujoDeFondoIngresosCajaProps {
  filas: FlujoFondoIngresoCajaFila[];
  onVerMovimiento?: (movimientoId: string) => void;
}

/** Ingresos de caja del día: fecha de acreditación, categoría, caja y monto acreditado. */
export function TablaFlujoDeFondoIngresosCaja({
  filas,
  onVerMovimiento,
}: TablaFlujoDeFondoIngresosCajaProps) {
  return (
    <div className="contenedor-tabla-gestion min-h-0 flex-1 overflow-hidden">
      <div className="no-scrollbar h-full min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto">
        <Table
          variant="compact"
          scrollX={false}
          className="tabla-flujo-de-fondo table-fixed w-full"
        >
          <ColgroupAnchos anchos={COL_WIDTH_CLASSES_INGRESOS} />
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={CELL_MIN}>CAJA</TableHead>
              <TableHead className={cn(TH_NUM, CELL_MIN)}>MONTO A ACREDITAR</TableHead>
              <TableHead className={cn(CELL_MIN, "text-center")}>ACCIONES</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 ? (
              <EmptyTableRow colSpan={3} message="Sin ingresos de caja para el día seleccionado." />
            ) : (
              filas.map((fila) => (
                <TableRow key={fila.id}>
                  <TableCell
                    className={cn("celda-datos text-left celda-destacado", CELL_MIN)}
                    title={fila.cajaEtiqueta}
                  >
                    <span className="block truncate">{fila.cajaEtiqueta}</span>
                  </TableCell>
                  <TableCell className={cn(TD_NUM, CELL_MIN)}>
                    {fmtMontoAr(fila.montoAcreditado)}
                  </TableCell>
                  <TableCell className={cn("celda-datos text-center", CELL_MIN)}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Ver detalle de ingreso"
                      className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                      onClick={() => onVerMovimiento?.(fila.id)}
                    >
                      <Eye className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
