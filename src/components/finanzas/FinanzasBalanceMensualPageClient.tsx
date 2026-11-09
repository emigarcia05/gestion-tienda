"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BarChart2 } from "lucide-react";
import FilterBar, {
  FILTER_INLINE_ACTION_SLOT_CLASS,
  FILTER_SELECT_WRAPPER_CLASS,
  FiltroIndividualContainer,
  FilaFiltrosDesplegables,
  FilterRowSelection,
  LimpiarFiltrosButton,
} from "@/components/FilterBar";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtPrecio } from "@/lib/format";
import {
  ETIQUETA_FILA_BALANCE_HISTORIAL,
  esFilaBalanceConHistorialAgregado,
  type BalanceMensualFilaHistorialId,
} from "@/lib/balanceMensualHistorialFila";
import {
  type BalanceMensualBloque,
  type BalanceMensualResumen,
  fmtMargenContribucionPct,
  puntoEquilibrioVentasPesos,
  resumenBalanceMensualDesdeFilas,
} from "@/lib/balanceMensual";
import { cn } from "@/lib/utils";
import {
  CALLOUT_WARNING_CLASS,
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { Button } from "@/components/ui/button";
import BalanceMensualDetallePorRubroModal from "@/components/finanzas/BalanceMensualDetallePorRubroModal";
import BalanceMensualDetalleGastosPorRubroModal from "@/components/finanzas/BalanceMensualDetalleGastosPorRubroModal";
import BalanceMensualDetalleGastosRubroModal from "@/components/finanzas/BalanceMensualDetalleGastosRubroModal";
import BalanceMensualGastoHistoricoModal from "@/components/finanzas/BalanceMensualGastoHistoricoModal";
import type { BalanceGastoMensualFila } from "@/services/finBalGastoMensualBalance.service";
import {
  agruparTiposYRubrosCostoMensual,
  BALANCE_MENSUAL_RUBRO_REPARTO_CC,
  listarGastosAgregadosPorRubroTipo,
  listarGastosDetalleRubro,
  resolverGastoFinalIdHistorialRubro,
  totalMontoTipoEnCelda,
  type BalanceMensualColumnaDetalle,
  type BalanceMensualGastoAgregado,
  type ElegirRubroBalancePayload,
} from "@/lib/balanceMensualDetalle";
import { dateToIsoYmdArgentina } from "@/lib/fechaArgentina";
import { cargarFilasBalanceMensualPeriodoAction } from "@/actions/finBalGastoMensualBalance";
import { toast } from "sonner";

const ANIO_FILTRO_MIN = 2026;
const ANIO_FILTRO_MAX = 2046;
const ANIOS_FILTRO = Array.from(
  { length: ANIO_FILTRO_MAX - ANIO_FILTRO_MIN + 1 },
  (_, i) => ANIO_FILTRO_MIN + i
);

const MESES_CALENDARIO: { valor: number; etiqueta: string }[] = [
  { valor: 1, etiqueta: "ENERO" },
  { valor: 2, etiqueta: "FEBRERO" },
  { valor: 3, etiqueta: "MARZO" },
  { valor: 4, etiqueta: "ABRIL" },
  { valor: 5, etiqueta: "MAYO" },
  { valor: 6, etiqueta: "JUNIO" },
  { valor: 7, etiqueta: "JULIO" },
  { valor: 8, etiqueta: "AGOSTO" },
  { valor: 9, etiqueta: "SEPTIEMBRE" },
  { valor: 10, etiqueta: "OCTUBRE" },
  { valor: 11, etiqueta: "NOVIEMBRE" },
  { valor: 12, etiqueta: "DICIEMBRE" },
];

function fmtMonto(n: number) {
  if (n === 0) return "—";
  return `$${fmtPrecio(n)}`;
}

function fmtMontoPe(b: BalanceMensualBloque) {
  const pe = puntoEquilibrioVentasPesos(b);
  if (pe === null) return "—";
  return `$${fmtPrecio(pe)}`;
}

/** Línea de contexto en modales de drill-down: `SUCURSAL - AÑO - MES` (mes como en catálogo, mayúsculas). */
function fmtLineaContextoModalBalance(etiquetaColumna: string, mes: number, anio: number): string {
  const mesNom = MESES_CALENDARIO.find((x) => x.valor === mes)?.etiqueta ?? String(mes);
  return `${etiquetaColumna.toUpperCase()} - ${anio} - ${mesNom}`;
}

type ColumnaBalance = {
  key: string;
  titulo: string;
  bloque: BalanceMensualBloque;
  sucursalId: string | null;
};

/** Contexto de columna/tipo de costo al abrir historial desde la grilla (clic en barra → desglose). */
type HistoricoDetalleCostosOrigen = {
  tipoCosto: "variables" | "fijos";
  columna: BalanceMensualColumnaDetalle;
  etiquetaColumna: string;
};

/** Fondo más claro que el encabezado #0072BB, para filas de resultado. */
const BG_FILA_RESULTADO = "#a9d6f1";
const FG_FILA_RESULTADO = "#063652";

/**
 * Altura fija de cada fila del grid de balance mensual (referencia: «Resultado operativo», una línea).
 * Los botones de icono se escalan a este alto (`h-7 w-7`) para no estirar la fila.
 */
const CLASE_FILA_BALANCE_MENSUAL_GRID = "h-10 min-h-10 max-h-10";
const CLASE_CELDA_BALANCE_MENSUAL = "flex min-h-0 items-center px-3 py-0";
/** Botón ícono compacto en celdas de balance (misma familia visual que tablas de gestión). */
const CLASE_BOTON_ACCION_BALANCE_MENSUAL = cn(
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  "!h-7 !w-7 min-h-0 !p-1"
);

type FilaBalance =
  | {
      id: string;
      tipo: "monto";
      etiquetaConcepto: ReactNode;
      get: (b: BalanceMensualBloque) => number;
      /** Negrita en celdas de importe (p. ej. ventas). */
      valorNegrita: boolean;
      /** Fila de subtotal resultado: fondo azul claro, concepto indentado, todo en negrita. */
      filaResultado?: boolean;
    }
  | {
      id: string;
      tipo: "texto";
      etiquetaConcepto: ReactNode;
      valor: (b: BalanceMensualBloque) => string;
      valorNegrita: boolean;
    };

const FILAS_BALANCE: FilaBalance[] = [
  {
    id: "ventas",
    tipo: "monto",
    etiquetaConcepto: "Ventas",
    get: (b) => b.ventas,
    valorNegrita: true,
  },
  {
    id: "cv",
    tipo: "monto",
    etiquetaConcepto: "Costos Variables",
    get: (b) => b.costosVariables,
    valorNegrita: false,
  },
  {
    id: "ro",
    tipo: "monto",
    etiquetaConcepto: "RESULTADO OPERATIVO",
    get: (b) => b.resultadoOperativo,
    valorNegrita: false,
    filaResultado: true,
  },
  {
    id: "cf",
    tipo: "monto",
    etiquetaConcepto: "Costos Fijos",
    get: (b) => b.costosFijos,
    valorNegrita: false,
  },
  {
    id: "re",
    tipo: "monto",
    etiquetaConcepto: "RESULTADO DEL EJERCICIO",
    get: (b) => b.resultadoEjercicio,
    valorNegrita: false,
    filaResultado: true,
  },
  {
    id: "mc",
    tipo: "texto",
    etiquetaConcepto: "Margen Contribución",
    valor: (b) => fmtMargenContribucionPct(b.margenContribucionPct),
    valorNegrita: false,
  },
  {
    id: "pe",
    tipo: "texto",
    etiquetaConcepto: "Punto de Equilibrio",
    valor: (b) => fmtMontoPe(b),
    valorNegrita: false,
  },
  {
    id: "mc_hist",
    tipo: "texto",
    etiquetaConcepto: "Margen Contribución Histórico",
    valor: () => "—",
    valorNegrita: false,
  },
  {
    id: "pe_hist",
    tipo: "texto",
    etiquetaConcepto: "Punto de Equilibrio Histórico",
    valor: () => "—",
    valorNegrita: false,
  },
];

function TablaBalanceMensualAlineada({
  columnas,
  onAbrirHistoricoFila,
}: {
  columnas: ColumnaBalance[];
  onAbrirHistoricoFila?: (payload: {
    filaId: BalanceMensualFilaHistorialId;
    columna: BalanceMensualColumnaDetalle;
    etiquetaColumna: string;
  }) => void;
}) {
  const nDatos = columnas.length;
  const gridTemplateColumns = `minmax(10.5rem, 1.05fr) repeat(${nDatos}, minmax(6.75rem, 1fr))`;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <div className="min-w-[44rem]">
          <div
            className={cn(
              "grid border-b border-white/20 bg-[#0072BB] text-white",
              CLASE_FILA_BALANCE_MENSUAL_GRID
            )}
            style={{ gridTemplateColumns }}
          >
            <div
              className={cn(
                CLASE_CELDA_BALANCE_MENSUAL,
                "justify-center border-r border-white/20"
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                Concepto
              </span>
            </div>
            {columnas.map((c) => (
              <div
                key={c.key}
                className={cn(
                  CLASE_CELDA_BALANCE_MENSUAL,
                  "justify-center border-r border-white/20 text-center last:border-r-0"
                )}
              >
                <span className="text-xs font-bold uppercase tracking-[0.06em] text-white">
                  {c.titulo}
                </span>
              </div>
            ))}
          </div>
          {FILAS_BALANCE.map((fila) => {
            const esFilaResultado = fila.tipo === "monto" && Boolean(fila.filaResultado);
            const negritaValor =
              fila.tipo === "monto"
                ? fila.valorNegrita || esFilaResultado
                : fila.tipo === "texto" && fila.valorNegrita;

            return (
              <div
                key={fila.id}
                className={cn(
                  "grid border-b border-border/60 last:border-b-0",
                  CLASE_FILA_BALANCE_MENSUAL_GRID,
                  esFilaResultado && "border-[#0072BB]/25"
                )}
                style={{
                  gridTemplateColumns,
                  ...(esFilaResultado ? { backgroundColor: BG_FILA_RESULTADO } : {}),
                }}
              >
                <div
                  className={cn(
                    CLASE_CELDA_BALANCE_MENSUAL,
                    "border-r border-border/80 text-sm leading-none whitespace-nowrap",
                    esFilaResultado
                      ? "border-[#0072BB]/20 pl-10 font-bold"
                      : "font-normal text-foreground"
                  )}
                  style={esFilaResultado ? { color: FG_FILA_RESULTADO } : undefined}
                >
                  {fila.etiquetaConcepto}
                </div>
                {columnas.map((c) => {
                  const txt =
                    fila.tipo === "monto" ? fmtMonto(fila.get(c.bloque)) : fila.valor(c.bloque);
                  const mostrarColumnaConHistorico = Boolean(c.sucursalId) || c.key === "global";
                  const filaConHistorialAgregado =
                    onAbrirHistoricoFila && esFilaBalanceConHistorialAgregado(fila.id);
                  const etiquetaFilaHistorial = esFilaBalanceConHistorialAgregado(fila.id)
                    ? ETIQUETA_FILA_BALANCE_HISTORIAL[fila.id]
                    : fila.id.toUpperCase();

                  return (
                    <div
                      key={`${fila.id}-${c.key}`}
                      className={cn(
                        CLASE_CELDA_BALANCE_MENSUAL,
                        "justify-end border-r border-border/80 text-sm tabular-nums tracking-tight last:border-r-0",
                        esFilaResultado ? "border-[#0072BB]/20 font-bold" : "text-foreground"
                      )}
                      style={esFilaResultado ? { color: FG_FILA_RESULTADO } : undefined}
                    >
                      {mostrarColumnaConHistorico ? (
                        <div className="grid w-full min-w-0 grid-cols-[25%_75%] items-center gap-0">
                          <div className="flex min-w-0 items-center justify-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={CLASE_BOTON_ACCION_BALANCE_MENSUAL}
                                aria-label={`Ver histórico — ${etiquetaFilaHistorial} — ${c.titulo}`}
                                title={
                                  filaConHistorialAgregado
                                    ? "Ver Evolución Mensual De La Fila"
                                    : "Sin historial para esta fila"
                                }
                                onClick={() => {
                                  if (!filaConHistorialAgregado || !esFilaBalanceConHistorialAgregado(fila.id)) {
                                    return;
                                  }
                                  onAbrirHistoricoFila?.({
                                    filaId: fila.id,
                                    columna:
                                      c.key === "global"
                                        ? { ambito: "global" }
                                        : { ambito: "sucursal", nombre: c.titulo },
                                    etiquetaColumna: c.titulo,
                                  });
                                }}
                                disabled={!filaConHistorialAgregado}
                              >
                                <BarChart2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                              </Button>
                          </div>
                          <div className="flex h-full min-w-0 items-center justify-end">
                            <span className={cn(negritaValor ? "font-bold" : "font-normal")}>{txt}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full w-full min-w-0 items-center justify-end">
                          <span className={cn(negritaValor ? "font-bold" : "font-normal")}>
                            {txt}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface Props {
  mes: number;
  anio: number;
  resumen: BalanceMensualResumen;
  filas: BalanceGastoMensualFila[];
  sucursalesGeneranBalance: { id: string; nombre: string }[];
}

type DetalleRubrosModalCtx = {
  columna: BalanceMensualColumnaDetalle;
  tipo: "variables" | "fijos";
  etiquetaColumna: string;
  totalCvCelda: number;
  totalCfCelda: number;
};

type DetalleGastosPorRubroModalCtx = DetalleRubrosModalCtx & {
  tipoGastoNombre: string | null;
  etiquetaTipo: string;
  rubroClave: string;
  tituloRubro: string;
  totalRubroSeccion: number;
};

type DetalleLineasGastoModalCtx = DetalleGastosPorRubroModalCtx & {
  gastoNombre: string;
  totalGastoAgregado: number;
};

export default function FinanzasBalanceMensualPageClient({
  mes,
  anio,
  resumen,
  filas,
  sucursalesGeneranBalance,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [detalleRubrosOpen, setDetalleRubrosOpen] = useState(false);
  const [detalleRubrosCtx, setDetalleRubrosCtx] = useState<DetalleRubrosModalCtx | null>(null);
  const [detalleGastosPorRubroOpen, setDetalleGastosPorRubroOpen] = useState(false);
  const [detalleGastosPorRubroCtx, setDetalleGastosPorRubroCtx] =
    useState<DetalleGastosPorRubroModalCtx | null>(null);
  const [detalleLineasGastoOpen, setDetalleLineasGastoOpen] = useState(false);
  const [detalleLineasGastoCtx, setDetalleLineasGastoCtx] =
    useState<DetalleLineasGastoModalCtx | null>(null);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoGastoFinalId, setHistoricoGastoFinalId] = useState<string | null>(null);
  const [historicoFilaGrilla, setHistoricoFilaGrilla] = useState<{
    filaId: BalanceMensualFilaHistorialId;
    columna: BalanceMensualColumnaDetalle;
    etiquetaColumna: string;
  } | null>(null);
  /** Origen del historial para ofrecer «Volver» al modal de líneas cuando aplica. */
  const [historicoAbiertoDesde, setHistoricoAbiertoDesde] = useState<
    "grilla" | "lineas" | "rubros" | "gastos_por_rubro" | null
  >(null);
  const [historicoDetalleCostosOrigen, setHistoricoDetalleCostosOrigen] =
    useState<HistoricoDetalleCostosOrigen | null>(null);
  const [filasParaModalesDetalle, setFilasParaModalesDetalle] =
    useState<BalanceGastoMensualFila[] | null>(null);
  const [detalleModalesMesAnio, setDetalleModalesMesAnio] = useState<{
    mes: number;
    anio: number;
  } | null>(null);
  /** Detalle por rubro abierto desde barra del historial CV/CF en grilla (volver reabre historial). */
  const [detalleRubrosDesdeHistoricoGrilla, setDetalleRubrosDesdeHistoricoGrilla] =
    useState(false);

  const filasEfectivasDetalle = filasParaModalesDetalle ?? filas;

  const seccionesTiposRubros = useMemo(() => {
    if (!detalleRubrosCtx) return [];
    return agruparTiposYRubrosCostoMensual(
      filasEfectivasDetalle,
      sucursalesGeneranBalance,
      detalleRubrosCtx.columna,
      detalleRubrosCtx.tipo,
    );
  }, [detalleRubrosCtx, filasEfectivasDetalle, sucursalesGeneranBalance]);

  const gastosAgregadosPorRubro = useMemo(() => {
    if (!detalleGastosPorRubroCtx) return [];
    return listarGastosAgregadosPorRubroTipo(
      filasEfectivasDetalle,
      detalleGastosPorRubroCtx.columna,
      detalleGastosPorRubroCtx.tipo,
      detalleGastosPorRubroCtx.rubroClave,
      detalleGastosPorRubroCtx.tipoGastoNombre,
    );
  }, [detalleGastosPorRubroCtx, filasEfectivasDetalle]);

  const filasLineasGastoDetalle = useMemo(() => {
    if (!detalleLineasGastoCtx) return [];
    return listarGastosDetalleRubro(
      filasEfectivasDetalle,
      detalleLineasGastoCtx.columna,
      detalleLineasGastoCtx.tipo,
      detalleLineasGastoCtx.rubroClave,
      {
        tipoGastoNombre: detalleLineasGastoCtx.tipoGastoNombre,
        gastoNombre: detalleLineasGastoCtx.gastoNombre,
      },
    );
  }, [detalleLineasGastoCtx, filasEfectivasDetalle]);

  function navegarPeriodo(nuevoMes: number, nuevoAnio: number) {
    const q = new URLSearchParams();
    q.set("mes", String(nuevoMes));
    q.set("anio", String(nuevoAnio));
    router.replace(`${pathname}?${q.toString()}`);
    router.refresh();
  }

  const { mesHoy, anioHoy } = useMemo(() => {
    const iso = dateToIsoYmdArgentina(new Date());
    const [yStr, mStr] = iso.split("-");
    const anioN = Number.parseInt(yStr ?? "", 10);
    const mesN = Number.parseInt(mStr ?? "", 10);
    return {
      mesHoy: Number.isFinite(mesN) ? mesN : 1,
      anioHoy: Number.isFinite(anioN) ? anioN : ANIO_FILTRO_MIN,
    };
  }, []);

  function limpiarFiltrosPeriodo() {
    navegarPeriodo(mesHoy, anioHoy);
  }

  const mesAnioEtiquetaModalesDetalle = detalleModalesMesAnio ?? { mes, anio };

  const cerrarDetalleRubrosModal = useCallback(() => {
    setDetalleRubrosOpen(false);
    setDetalleRubrosCtx(null);
    setFilasParaModalesDetalle(null);
    setDetalleModalesMesAnio(null);
  }, []);

  const volverDesdeDetalleRubros = useCallback(() => {
    const reabrirHistorico = detalleRubrosDesdeHistoricoGrilla;
    cerrarDetalleRubrosModal();
    setDetalleRubrosDesdeHistoricoGrilla(false);
    if (reabrirHistorico) {
      setHistoricoOpen(true);
    }
  }, [cerrarDetalleRubrosModal, detalleRubrosDesdeHistoricoGrilla]);

  const historialRubroDisponible = useCallback(
    (rubroClave: string) => {
      if (!detalleRubrosCtx) return false;
      return (
        resolverGastoFinalIdHistorialRubro(
          filasEfectivasDetalle,
          detalleRubrosCtx.columna,
          detalleRubrosCtx.tipo,
          rubroClave,
        ) != null
      );
    },
    [detalleRubrosCtx, filasEfectivasDetalle],
  );

  const handleHistoricoOpenChange = useCallback(
    (nextOpen: boolean) => {
      setHistoricoOpen(nextOpen);
      if (!nextOpen) {
        setHistoricoGastoFinalId(null);
        setHistoricoFilaGrilla(null);
        setHistoricoDetalleCostosOrigen(null);
        setHistoricoAbiertoDesde(null);
        if (detalleRubrosDesdeHistoricoGrilla) {
          cerrarDetalleRubrosModal();
          setDetalleRubrosDesdeHistoricoGrilla(false);
        }
      }
    },
    [cerrarDetalleRubrosModal, detalleRubrosDesdeHistoricoGrilla],
  );

  async function handleSeleccionarMesEnGraficoHistorico(mesBar: number, anioBar: number) {
    if (!historicoDetalleCostosOrigen) return;
    const res = await cargarFilasBalanceMensualPeriodoAction({ mes: mesBar, anio: anioBar });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const { filas: filasB, ventasPorSucursalNombre } = res.data;
    const resumenB = resumenBalanceMensualDesdeFilas(
      filasB,
      ventasPorSucursalNombre,
      sucursalesGeneranBalance,
    );
    const { tipoCosto, columna, etiquetaColumna } = historicoDetalleCostosOrigen;
    const bloque =
      columna.ambito === "global"
        ? resumenB.global
        : resumenB.sucursales.find((s) => s.nombre === columna.nombre)?.bloque;
    if (!bloque) {
      toast.error("No se encontró la columna en el resumen de ese periodo.");
      return;
    }
    setFilasParaModalesDetalle(filasB);
    setDetalleModalesMesAnio({ mes: mesBar, anio: anioBar });
    setDetalleRubrosCtx({
      tipo: tipoCosto,
      columna,
      etiquetaColumna,
      totalCvCelda: bloque.costosVariables,
      totalCfCelda: bloque.costosFijos,
    });
    setDetalleRubrosDesdeHistoricoGrilla(true);
    setHistoricoOpen(false);
    setDetalleRubrosOpen(true);
  }

  return (
    <div className="area-page-shell">
      <ClassicFilteredTableLayout
        title="Balance"
        subtitle="Balance mensual"
        contentWidth="full"
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilterRowSelection className="w-full min-w-0">
              <FilaFiltrosDesplegables>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={anio !== anioHoy}
                  onLimpiar={() => navegarPeriodo(mes, anioHoy)}
                >
                  <Select value={String(anio)} onValueChange={(v) => navegarPeriodo(mes, parseInt(v, 10))}>
                    <SelectTrigger className="input-filtro-unificado" aria-label="Año del periodo">
                      <SelectValue placeholder="AÑO" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {ANIOS_FILTRO.map((a) => (
                        <SelectItem key={a} value={String(a)}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={mes !== mesHoy}
                  onLimpiar={() => navegarPeriodo(mesHoy, anio)}
                >
                  <Select
                    value={String(mes)}
                    onValueChange={(v) => navegarPeriodo(parseInt(v, 10), anio)}
                  >
                    <SelectTrigger className="input-filtro-unificado" aria-label="Mes del periodo">
                      <SelectValue placeholder="MES" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {MESES_CALENDARIO.map((m) => (
                        <SelectItem key={m.valor} value={String(m.valor)}>
                          {m.etiqueta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                <div className={cn(FILTER_INLINE_ACTION_SLOT_CLASS, "col-span-3")}>
                  <LimpiarFiltrosButton onClick={limpiarFiltrosPeriodo} />
                </div>
              </FilaFiltrosDesplegables>
            </FilterRowSelection>
          </FilterBar>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
          {resumen.sucursales.length === 0 ? (
            <p className={CALLOUT_WARNING_CLASS}>
              No hay sucursales: solo se muestra el bloque global.
            </p>
          ) : null}
          <TablaBalanceMensualAlineada
            columnas={[
              { key: "global", titulo: "Global", bloque: resumen.global, sucursalId: null },
              ...resumen.sucursales.map((s) => ({
                key: s.nombre,
                titulo: s.nombre,
                bloque: s.bloque,
                sucursalId: s.sucursalId || null,
              })),
            ]}
            onAbrirHistoricoFila={(payload) => {
              setHistoricoFilaGrilla({
                filaId: payload.filaId,
                columna: payload.columna,
                etiquetaColumna: payload.etiquetaColumna,
              });
              setHistoricoGastoFinalId(null);
              setHistoricoAbiertoDesde("grilla");
              setHistoricoDetalleCostosOrigen(
                payload.filaId === "cv" || payload.filaId === "cf"
                  ? {
                      tipoCosto: payload.filaId === "cv" ? "variables" : "fijos",
                      columna: payload.columna,
                      etiquetaColumna: payload.etiquetaColumna,
                    }
                  : null,
              );
              setHistoricoOpen(true);
            }}
          />
        </div>
      </ClassicFilteredTableLayout>
      <BalanceMensualDetallePorRubroModal
        open={detalleRubrosOpen}
        onOpenChange={(open) => {
          if (!open) {
            volverDesdeDetalleRubros();
            return;
          }
          setDetalleRubrosOpen(true);
        }}
        titulo={
          detalleRubrosCtx
            ? detalleRubrosCtx.tipo === "variables"
              ? "Detalle costos variables por rubro"
              : "Detalle costos fijos por rubro"
            : "Detalle por rubro"
        }
        subtitulo={
          detalleRubrosCtx
            ? fmtLineaContextoModalBalance(
                detalleRubrosCtx.etiquetaColumna,
                mesAnioEtiquetaModalesDetalle.mes,
                mesAnioEtiquetaModalesDetalle.anio,
              )
            : ""
        }
        tipo={detalleRubrosCtx?.tipo ?? "variables"}
        totalCvCelda={detalleRubrosCtx?.totalCvCelda ?? 0}
        totalCfCelda={detalleRubrosCtx?.totalCfCelda ?? 0}
        secciones={seccionesTiposRubros}
        onElegirRubro={(payload: ElegirRubroBalancePayload) => {
          if (!detalleRubrosCtx) return;
          setDetalleGastosPorRubroCtx({
            ...detalleRubrosCtx,
            tipoGastoNombre: payload.tipoGastoNombre,
            etiquetaTipo: payload.etiquetaTipo,
            rubroClave: payload.rubro.clave,
            tituloRubro: payload.rubro.etiqueta,
            totalRubroSeccion: payload.rubro.monto,
          });
          setDetalleGastosPorRubroOpen(true);
        }}
        onVolver={volverDesdeDetalleRubros}
        historialRubroDisponible={historialRubroDisponible}
        onAbrirHistoricoRubro={(rubroClave) => {
          if (!detalleRubrosCtx) return;
          const id = resolverGastoFinalIdHistorialRubro(
            filasEfectivasDetalle,
            detalleRubrosCtx.columna,
            detalleRubrosCtx.tipo,
            rubroClave,
          );
          if (!id) return;
          setHistoricoDetalleCostosOrigen(null);
          setHistoricoFilaGrilla(null);
          setHistoricoGastoFinalId(id);
          setHistoricoAbiertoDesde("rubros");
          setHistoricoOpen(true);
        }}
      />
      <BalanceMensualDetalleGastosPorRubroModal
        open={detalleGastosPorRubroOpen}
        onOpenChange={(open) => {
          setDetalleGastosPorRubroOpen(open);
          if (!open) setDetalleGastosPorRubroCtx(null);
        }}
        titulo={
          detalleGastosPorRubroCtx
            ? `Detalle de gasto en ${detalleGastosPorRubroCtx.tituloRubro.toLowerCase()}`
            : "Gastos por rubro"
        }
        subtitulo={
          detalleGastosPorRubroCtx
            ? fmtLineaContextoModalBalance(
                detalleGastosPorRubroCtx.etiquetaColumna,
                mesAnioEtiquetaModalesDetalle.mes,
                mesAnioEtiquetaModalesDetalle.anio,
              )
            : ""
        }
        tipo={detalleGastosPorRubroCtx?.tipo ?? "variables"}
        totalCvCelda={detalleGastosPorRubroCtx?.totalCvCelda ?? 0}
        totalCfCelda={detalleGastosPorRubroCtx?.totalCfCelda ?? 0}
        totalRubroSeccion={detalleGastosPorRubroCtx?.totalRubroSeccion ?? 0}
        gastos={gastosAgregadosPorRubro}
        onElegirGasto={(g: BalanceMensualGastoAgregado) => {
          if (!detalleGastosPorRubroCtx) return;
          setDetalleLineasGastoCtx({
            ...detalleGastosPorRubroCtx,
            gastoNombre: g.gastoNombre,
            totalGastoAgregado: g.monto,
          });
          setDetalleLineasGastoOpen(true);
        }}
        onVolver={() => {
          setDetalleGastosPorRubroOpen(false);
          setDetalleGastosPorRubroCtx(null);
        }}
        onAbrirHistorico={({ gastoFinalId }) => {
          setHistoricoDetalleCostosOrigen(null);
          setHistoricoFilaGrilla(null);
          setHistoricoGastoFinalId(gastoFinalId);
          setHistoricoAbiertoDesde("gastos_por_rubro");
          setHistoricoOpen(true);
        }}
      />
      <BalanceMensualDetalleGastosRubroModal
        open={detalleLineasGastoOpen}
        onOpenChange={(open) => {
          setDetalleLineasGastoOpen(open);
          if (!open) setDetalleLineasGastoCtx(null);
        }}
        titulo={
          detalleLineasGastoCtx
            ? `Detalle de ${detalleLineasGastoCtx.gastoNombre.toLowerCase()}`
            : "Líneas de gasto"
        }
        subtitulo={
          detalleLineasGastoCtx
            ? fmtLineaContextoModalBalance(
                detalleLineasGastoCtx.etiquetaColumna,
                mesAnioEtiquetaModalesDetalle.mes,
                mesAnioEtiquetaModalesDetalle.anio,
              )
            : ""
        }
        tipo={detalleLineasGastoCtx?.tipo ?? "variables"}
        totalGastoAgregado={detalleLineasGastoCtx?.totalGastoAgregado ?? 0}
        totalRubroSeccion={detalleLineasGastoCtx?.totalRubroSeccion ?? 0}
        totalPorTipo={(tipoNombre: string) =>
          detalleLineasGastoCtx
            ? totalMontoTipoEnCelda(
                filasEfectivasDetalle,
                sucursalesGeneranBalance,
                detalleLineasGastoCtx.columna,
                detalleLineasGastoCtx.tipo,
                tipoNombre,
              )
            : 0
        }
        filas={filasLineasGastoDetalle}
        notaInformativa={
          detalleLineasGastoCtx?.rubroClave === BALANCE_MENSUAL_RUBRO_REPARTO_CC
            ? "Los importes son el total del mes sin sucursal. En la tabla del balance, ese total se reparte en partes iguales entre todas las sucursales."
            : null
        }
        onAbrirHistorico={({ gastoFinalId }) => {
          setHistoricoDetalleCostosOrigen(null);
          setHistoricoFilaGrilla(null);
          setHistoricoGastoFinalId(gastoFinalId);
          setHistoricoAbiertoDesde("lineas");
          setHistoricoOpen(true);
        }}
        onVolver={() => {
          setDetalleLineasGastoOpen(false);
          setDetalleLineasGastoCtx(null);
        }}
      />
      <BalanceMensualGastoHistoricoModal
        key={`${historicoGastoFinalId ?? ""}-${historicoFilaGrilla?.filaId ?? ""}-${historicoFilaGrilla?.etiquetaColumna ?? ""}`}
        open={historicoOpen}
        onOpenChange={handleHistoricoOpenChange}
        gastoFinalId={historicoFilaGrilla ? null : historicoGastoFinalId}
        historialFila={
          historicoFilaGrilla
            ? {
                filaConceptoId: historicoFilaGrilla.filaId,
                columna: historicoFilaGrilla.columna,
                mesFin: mes,
                anioFin: anio,
              }
            : null
        }
        costoClase={
          historicoDetalleCostosOrigen?.tipoCosto ??
          (historicoAbiertoDesde === "lineas" ? detalleLineasGastoCtx?.tipo : undefined) ??
          (historicoAbiertoDesde === "gastos_por_rubro" ? detalleGastosPorRubroCtx?.tipo : undefined) ??
          (historicoAbiertoDesde === "rubros" ? detalleRubrosCtx?.tipo : undefined) ??
          undefined
        }
        onSeleccionarMesEnGrafico={
          historicoDetalleCostosOrigen ? handleSeleccionarMesEnGraficoHistorico : undefined
        }
        onVolver={
          historicoAbiertoDesde === "lineas" ||
          historicoAbiertoDesde === "rubros" ||
          historicoAbiertoDesde === "gastos_por_rubro"
            ? () => handleHistoricoOpenChange(false)
            : undefined
        }
      />
    </div>
  );
}
