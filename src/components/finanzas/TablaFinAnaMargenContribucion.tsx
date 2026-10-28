"use client";

import { useMemo, type CSSProperties } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PorcentajeEnteroMaskInput from "@/components/shared/PorcentajeEnteroMaskInput";
import {
  calcularValoresMargenContribucion,
  crearDescuentoPctPorFormaPagoVacios,
  cxFinancieroRatioMargenContribucion,
  esFilaDescuentoPorFormaPagoMargenContribucion,
  etiquetaFilaMargenContribucion,
  FIN_ANA_MC_DESCUENTO_MAX,
  FIN_ANA_MC_DESCUENTO_MIN,
  FIN_ANA_MC_SECCIONES,
  fmtCeldaMontoMargenContribucion,
  mcMargenContribucionPorFormaPago,
  mcPonderadoMargenContribucionPorFormaPago,
  type FilaMargenContribucionDatoId,
  type FormaPagoMargenContribucion,
  type TipoComprobanteVentaMargenContribucion,
  type ValoresCalculadosMargenContribucion,
  type ParametrosFormulaMargenContribucion,
  FIN_ANA_MC_FORMULA_PARAMS_DEFAULT,
} from "@/lib/finAnaMargenContribucion";
import type { ColumnaMargenContribucion } from "@/lib/finAnaMcColumnas";
import {
  parsePxListaEnteroNormalized,
  pxListaEnteroFromNumber,
} from "@/lib/pxListaEnteroMask";
import { cn } from "@/lib/utils";

const INPUT_FILA_CLASS =
  "h-full min-h-0 max-h-full min-w-0 w-full text-xs tabular-nums";

const INPUT_MARGEN_DESCUENTO_CLASS = cn(
  INPUT_FILA_CLASS,
  "border border-primary rounded-md"
);

/** Las columnas se reparten el ancho; mínimo `--tabla-mc-forma-width` en globals. */
const COL_FORMA = "tabla-mc-col-forma";
const COL_CONCEPTO = "w-[10.5rem]";
const COL_SECCION = "w-[1.75rem]";
/** Columna de sección (etiqueta vertical) + CONCEPTO fijos al scroll. */
const COL_SECCION_STICKY = "tabla-mc-col-seccion";
const COL_CONCEPTO_STICKY = "tabla-mc-col-concepto";
/** Separador vertical entre columnas (más marcado). */
const SEP_FORMA = "tabla-mc-sep-forma";

function CeldaConceptoMargenContribucion({
  filaId,
  esFilaMargen,
}: {
  filaId: FilaMargenContribucionDatoId;
  esFilaMargen: boolean;
}) {
  return (
    <TableCell
      className={cn(
        "celda-datos font-medium",
        COL_CONCEPTO_STICKY,
        esFilaMargen && "font-bold"
      )}
    >
      {etiquetaFilaMargenContribucion(filaId)}
    </TableCell>
  );
}

type InputsMargenContribucionState = {
  pxListaNorm: string;
  /** Entero −100…100 (%) por forma de pago. Negativo = descuento; positivo = recargo. */
  descuentoPctPorFormaPago: Record<FormaPagoMargenContribucion, number>;
};

interface Props {
  /** Combinaciones forma × entidad × cuota elegidas en los filtros. */
  columnas: ColumnaMargenContribucion[];
  inputs: InputsMargenContribucionState;
  onDescuentoPorFormaPagoChange: (
    formaPago: FormaPagoMargenContribucion,
    descuentoPct: number
  ) => void | Promise<void>;
  /** `null` = PORC. UTILIDAD vacío. */
  porcUtilidadPct: number | null;
  /** `null` = TIPO FACTURA sin elegir: todos los valores calculados quedan en "—". */
  tipoComprobante: TipoComprobanteVentaMargenContribucion | null;
  formulaParams?: ParametrosFormulaMargenContribucion;
  esEditor: boolean;
}

export default function TablaFinAnaMargenContribucion({
  columnas,
  inputs,
  onDescuentoPorFormaPagoChange,
  porcUtilidadPct,
  tipoComprobante,
  formulaParams = FIN_ANA_MC_FORMULA_PARAMS_DEFAULT,
  esEditor,
}: Props) {
  const totalCols = 2 + columnas.length;
  /** Ancho mínimo de la tabla según la cantidad de columnas (ver `.tabla-fin-ana-margen-contribucion`). */
  const estiloColumnas = {
    "--tabla-mc-formas": Math.max(columnas.length, 1),
  } as CSSProperties;

  const parsed = useMemo(() => {
    const pxLista = parsePxListaEnteroNormalized(inputs.pxListaNorm) ?? 0;
    const calculadosPorColumna = new Map<string, ValoresCalculadosMargenContribucion>();
    if (tipoComprobante != null) {
      for (const columna of columnas) {
        calculadosPorColumna.set(
          columna.id,
          calcularValoresMargenContribucion({
            pxLista,
            descuentoPct: inputs.descuentoPctPorFormaPago[columna.pagoId] ?? 0,
            porcUtilidadPct,
            tipoComprobante,
            formulas: formulaParams,
          })
        );
      }
    }
    return { pxLista, calculadosPorColumna };
  }, [inputs, columnas, porcUtilidadPct, tipoComprobante, formulaParams]);

  function valorFila(
    filaId: FilaMargenContribucionDatoId,
    columna: ColumnaMargenContribucion
  ): { valor: number | null; escala: "ratio" | "base100" } {
    const calculados = parsed.calculadosPorColumna.get(columna.id);
    const cxFinPct = columna.cxFinPct;
    if (!calculados || cxFinPct == null) return { valor: null, escala: "ratio" };

    switch (filaId) {
      case "PX_LISTA":
        return {
          valor: parsed.pxLista > 0 ? parsed.pxLista / 100 : null,
          escala: "ratio",
        };
      case "PX_VENTA":
        return {
          valor:
            calculados.precioVenta > 0 ? calculados.precioVenta / 100 : null,
          escala: "ratio",
        };
      case "IVA":
        return {
          valor: calculados.iva > 0 ? calculados.iva : null,
          escala: "ratio",
        };
      case "IIBB":
        return {
          valor: calculados.iibb > 0 ? calculados.iibb : null,
          escala: "ratio",
        };
      case "CX_MERCADERIA":
        return {
          valor:
            calculados.cxMercaderia != null && calculados.cxMercaderia > 0
              ? calculados.cxMercaderia
              : null,
          escala: "ratio",
        };
      case "CX_FINANCIERO": {
        const ratio = cxFinancieroRatioMargenContribucion(cxFinPct);
        return {
          valor: ratio > 0 ? ratio : null,
          escala: "ratio",
        };
      }
      case "MC":
        return {
          valor: mcMargenContribucionPorFormaPago(calculados, cxFinPct),
          escala: "ratio",
        };
      case "MC_PONDERADO":
        return {
          valor: mcPonderadoMargenContribucionPorFormaPago(calculados, cxFinPct),
          escala: "base100",
        };
      default:
        return { valor: null, escala: "ratio" };
    }
  }

  function renderCeldasDatos(filaId: FilaMargenContribucionDatoId) {
    if (esFilaDescuentoPorFormaPagoMargenContribucion(filaId)) {
      return columnas.map((columna) => (
        <TableCell
          key={`${filaId}-${columna.id}`}
          className={cn(
            "celda-datos celda-numero tabla-mc-celda-descuento",
            COL_FORMA,
            SEP_FORMA
          )}
        >
          <div className="flex h-full min-h-0 w-full items-center justify-center">
            <PorcentajeEnteroMaskInput
              value={inputs.descuentoPctPorFormaPago[columna.pagoId] ?? 0}
              signed
              defaultNegative
              min={FIN_ANA_MC_DESCUENTO_MIN}
              max={FIN_ANA_MC_DESCUENTO_MAX}
              onValueChange={(next) => {
                void onDescuentoPorFormaPagoChange(columna.pagoId, next);
              }}
              className={INPUT_MARGEN_DESCUENTO_CLASS}
              aria-label={`Descuento ${columna.etiqueta}`}
              disabled={!esEditor}
            />
          </div>
        </TableCell>
      ));
    }

    const esFilaMargen = filaId === "MC" || filaId === "MC_PONDERADO";
    return columnas.map((columna) => {
      const { valor, escala } = valorFila(filaId, columna);
      return (
        <TableCell
          key={`${filaId}-${columna.id}`}
          className={cn(
            "celda-datos celda-numero tabular-nums",
            COL_FORMA,
            SEP_FORMA,
            esFilaMargen && "font-bold"
          )}
        >
          {fmtCeldaMontoMargenContribucion(valor, escala)}
        </TableCell>
      );
    });
  }

  if (columnas.length === 0) {
    return (
      <div className="contenedor-tabla-gestion min-w-0 w-full items-center justify-center p-6 text-sm text-muted-foreground">
        Seleccioná al menos una forma de pago
      </div>
    );
  }

  return (
    <div className="contenedor-tabla-gestion min-w-0 w-full">
      <Table
        variant="compact"
        scrollX={false}
        className="tabla-fin-ana-margen-contribucion"
        style={estiloColumnas}
      >
        <colgroup>
          <col className={COL_SECCION} />
          <col className={COL_CONCEPTO} />
          {columnas.map((columna) => (
            <col key={columna.id} className={COL_FORMA} />
          ))}
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead
              className={cn("text-center p-0", COL_SECCION_STICKY)}
              aria-label="Sección"
            />
            <TableHead className={cn("text-center", COL_CONCEPTO_STICKY)}>
              CONCEPTO
            </TableHead>
            {columnas.map((columna) => (
              <TableHead
                key={columna.id}
                className={cn("text-center leading-tight", COL_FORMA, SEP_FORMA)}
                title={columna.etiqueta}
              >
                <span className="block truncate">{columna.formaNombre}</span>
                {columna.detalle ? (
                  <span className="block truncate text-[0.65rem] font-semibold opacity-80">
                    {columna.detalle}
                  </span>
                ) : null}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {FIN_ANA_MC_SECCIONES.map((seccion, seccionIndex) => {
            const filas = seccion.filas;
            const esUltimaSeccion =
              seccionIndex === FIN_ANA_MC_SECCIONES.length - 1;
            const filasJsx = filas.map((filaId, filaIndex) => (
              <TableRow key={`${seccion.id}-${filaId}`}>
                {filaIndex === 0 ? (
                  <TableCell
                    rowSpan={filas.length}
                    className={cn(
                      "celda-datos tabla-mc-col-seccion-cell",
                      COL_SECCION_STICKY
                    )}
                  >
                    <span className="tabla-mc-seccion-label">
                      {seccion.etiqueta}
                    </span>
                  </TableCell>
                ) : null}
                <CeldaConceptoMargenContribucion
                  filaId={filaId}
                  esFilaMargen={filaId === "MC" || filaId === "MC_PONDERADO"}
                />
                {renderCeldasDatos(filaId)}
              </TableRow>
            ));

            if (esUltimaSeccion) {
              return filasJsx;
            }

            return [
              ...filasJsx,
              <TableRow
                key={`sep-${seccion.id}`}
                className="tabla-fila-mc-sep-linea hover:bg-transparent"
                aria-hidden
              >
                <TableCell colSpan={totalCols} className="!p-0 !h-0 border-0" />
              </TableRow>,
            ];
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** Serializa inputs persistidos (opcional futuro). */
export function inputsMargenContribucionDesdeNumeros(params: {
  pxLista?: number | null;
  descuentoPctPorFormaPago?: InputsMargenContribucionState["descuentoPctPorFormaPago"];
  formasPago?: FormaPagoMargenContribucion[];
}): InputsMargenContribucionState {
  const formasPago = params.formasPago ?? [];
  return {
    pxListaNorm: pxListaEnteroFromNumber(params.pxLista ?? null),
    descuentoPctPorFormaPago: {
      ...crearDescuentoPctPorFormaPagoVacios(formasPago),
      ...params.descuentoPctPorFormaPago,
    },
  };
}
