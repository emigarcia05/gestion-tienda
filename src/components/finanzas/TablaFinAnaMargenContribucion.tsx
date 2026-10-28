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
  cxFinancieroRatioMargenContribucion,
  esFilaDescuentoPorFormaPagoMargenContribucion,
  etiquetaEscenarioIvaMargenContribucion,
  etiquetaFilaMargenContribucion,
  FIN_ANA_MC_DESCUENTO_MAX,
  FIN_ANA_MC_DESCUENTO_MIN,
  FIN_ANA_MC_SECCIONES,
  fmtCeldaMontoMargenContribucion,
  mcMargenContribucionPorFormaPago,
  mcPonderadoMargenContribucionPorFormaPago,
  type FilaMargenContribucionDatoId,
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
/** Cuota / entidad del cabezal (arriba y abajo de la forma); vacías quedan reservadas para alinear la forma. */
const LINEA_CABEZAL_SECUNDARIA =
  "block truncate text-[0.65rem] font-semibold opacity-80";

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
      <span className="block leading-tight">{etiquetaFilaMargenContribucion(filaId)}</span>
      {esFilaMargen ? (
        <span className="block text-[0.6rem] font-semibold leading-tight text-muted-foreground">
          {etiquetaEscenarioIvaMargenContribucion("FACTURA_A")} |{" "}
          {etiquetaEscenarioIvaMargenContribucion("FACTURA_C")}
        </span>
      ) : null}
    </TableCell>
  );
}

type InputsMargenContribucionState = {
  pxListaNorm: string;
  /**
   * Entero −100…100 (%) por columna (`ColumnaMargenContribucion.id` = `cobros_cx_fin.id`);
   * sin clave = 0. Negativo = descuento; positivo = recargo. Persistido en `margen_contribucion_desc`.
   */
  descuentoPctPorColumna: Record<string, number>;
};

interface Props {
  /** Combinaciones forma × entidad × cuota elegidas en los filtros. */
  columnas: ColumnaMargenContribucion[];
  inputs: InputsMargenContribucionState;
  onDescuentoColumnaChange: (columnaId: string, descuentoPct: number) => void;
  /** `null` = PORC. UTILIDAD vacío. */
  porcUtilidadPct: number | null;
  formulaParams?: ParametrosFormulaMargenContribucion;
}

export default function TablaFinAnaMargenContribucion({
  columnas,
  inputs,
  onDescuentoColumnaChange,
  porcUtilidadPct,
  formulaParams = FIN_ANA_MC_FORMULA_PARAMS_DEFAULT,
}: Props) {
  const totalCols = 2 + columnas.length;
  /** Ancho mínimo de la tabla según la cantidad de columnas (ver `.tabla-fin-ana-margen-contribucion`). */
  const estiloColumnas = {
    "--tabla-mc-formas": Math.max(columnas.length, 1),
  } as CSSProperties;

  const parsed = useMemo(() => {
    const pxLista = parsePxListaEnteroNormalized(inputs.pxListaNorm) ?? 0;
    const calculadosPorColumna = new Map<
      string,
      Record<TipoComprobanteVentaMargenContribucion, ValoresCalculadosMargenContribucion>
    >();
    for (const columna of columnas) {
      const base = {
        pxLista,
        descuentoPct: inputs.descuentoPctPorColumna[columna.id] ?? 0,
        porcUtilidadPct,
        formulas: formulaParams,
      };
      calculadosPorColumna.set(columna.id, {
        FACTURA_A: calcularValoresMargenContribucion({ ...base, tipoComprobante: "FACTURA_A" }),
        FACTURA_C: calcularValoresMargenContribucion({ ...base, tipoComprobante: "FACTURA_C" }),
      });
    }
    return { pxLista, calculadosPorColumna };
  }, [inputs, columnas, porcUtilidadPct, formulaParams]);

  function valorFila(
    filaId: FilaMargenContribucionDatoId,
    columna: ColumnaMargenContribucion,
    tipo: TipoComprobanteVentaMargenContribucion
  ): { valor: number | null; escala: "ratio" | "base100" } {
    const calculados = parsed.calculadosPorColumna.get(columna.id)?.[tipo];
    const cxFinPct = columna.cxFinPctPorTipo[tipo];
    if (!calculados) return { valor: null, escala: "ratio" };

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
              value={inputs.descuentoPctPorColumna[columna.id] ?? 0}
              signed
              defaultNegative
              min={FIN_ANA_MC_DESCUENTO_MIN}
              max={FIN_ANA_MC_DESCUENTO_MAX}
              onValueChange={(next) => onDescuentoColumnaChange(columna.id, next)}
              className={INPUT_MARGEN_DESCUENTO_CLASS}
              aria-label={`Descuento ${columna.etiqueta}`}
            />
          </div>
        </TableCell>
      ));
    }

    const esFilaMargen = filaId === "MC" || filaId === "MC_PONDERADO";
    return columnas.map((columna) => {
      if (!esFilaMargen) {
        const { valor, escala } = valorFila(filaId, columna, "FACTURA_A");
        return (
          <TableCell
            key={`${filaId}-${columna.id}`}
            className={cn("celda-datos celda-numero tabular-nums", COL_FORMA, SEP_FORMA)}
          >
            {fmtCeldaMontoMargenContribucion(valor, escala)}
          </TableCell>
        );
      }

      const conIva = valorFila(filaId, columna, "FACTURA_A");
      const sinIva = valorFila(filaId, columna, "FACTURA_C");
      const textoConIva = fmtCeldaMontoMargenContribucion(conIva.valor, conIva.escala);
      const textoSinIva = fmtCeldaMontoMargenContribucion(sinIva.valor, sinIva.escala);
      const sinValores = conIva.valor == null && sinIva.valor == null;
      return (
        <TableCell
          key={`${filaId}-${columna.id}`}
          className={cn(
            "celda-datos celda-numero tabular-nums font-bold",
            COL_FORMA,
            SEP_FORMA
          )}
          title={
            sinValores
              ? undefined
              : `${etiquetaEscenarioIvaMargenContribucion("FACTURA_A")}: ${textoConIva} | ${etiquetaEscenarioIvaMargenContribucion("FACTURA_C")}: ${textoSinIva}`
          }
        >
          {sinValores ? "—" : `${textoConIva} | ${textoSinIva}`}
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
                <span
                  className={cn(
                    LINEA_CABEZAL_SECUNDARIA,
                    !columna.cuotaEtiqueta && "invisible"
                  )}
                >
                  {columna.cuotaEtiqueta ?? "\u00a0"}
                </span>
                <span className="block truncate">{columna.formaNombre}</span>
                <span
                  className={cn(
                    LINEA_CABEZAL_SECUNDARIA,
                    !columna.entidadNombre && "invisible"
                  )}
                >
                  {columna.entidadNombre ?? "\u00a0"}
                </span>
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

/** Estado inicial: PX LISTA de referencia y todos los descuentos en 0. */
export function inputsMargenContribucionDesdeNumeros(params: {
  pxLista?: number | null;
}): InputsMargenContribucionState {
  return {
    pxListaNorm: pxListaEnteroFromNumber(params.pxLista ?? null),
    descuentoPctPorColumna: {},
  };
}
