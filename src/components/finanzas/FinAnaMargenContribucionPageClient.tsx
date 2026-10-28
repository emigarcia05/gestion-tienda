"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, ChartLine, Table2, Tags } from "lucide-react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import FiltroMultiSelect from "@/components/shared/FiltroMultiSelect";
import PorcentajeEnteroMaskInput from "@/components/shared/PorcentajeEnteroMaskInput";
import TablaFinAnaMargenContribucion, {
  inputsMargenContribucionDesdeNumeros,
} from "@/components/finanzas/TablaFinAnaMargenContribucion";
import GraficoMcVsPorcUtilidad, {
  type SerieGraficoMcVsPorcUtilidad,
} from "@/components/finanzas/GraficoMcVsPorcUtilidad";
import GestionCxYFormulasMargenContribucionModal from "@/components/finanzas/GestionCxYFormulasMargenContribucionModal";
import GestionarCategoriasMargenContribucionModal from "@/components/finanzas/GestionarCategoriasMargenContribucionModal";
import FilterBar, {
  FILTER_INLINE_ACTION_SLOT_CLASS,
  FILTER_SELECT_WRAPPER_CLASS,
  FiltroIndividualContainer,
  FilaFiltrosDesplegables,
  FilterRowSelection,
  LimpiarFiltrosButton,
} from "@/components/FilterBar";
import { cn } from "@/lib/utils";
import {
  mcPctEnPorcUtilidadMargenContribucion,
  MC_GRAFICO_PORC_UTILIDAD_MAX,
  MC_GRAFICO_PORC_UTILIDAD_MIN,
  serieMcVsPorcUtilidadMargenContribucion,
  type MetricaGraficoMcMargenContribucion,
  type TipoComprobanteVentaMargenContribucion,
} from "@/lib/finAnaMargenContribucion";
import {
  columnasMargenContribucion,
  filasHabilitadasColumnasMargenContribucion,
  opcionesCuotaColumnasMargenContribucion,
  opcionesEntidadColumnasMargenContribucion,
  opcionesFormaPagoColumnasMargenContribucion,
  type ColumnaMargenContribucion,
} from "@/lib/finAnaMcColumnas";
import {
  resolverParametrosFormulaMargenContribucion,
  type FinAnaMcFormulaItem,
} from "@/lib/finAnaMcFormulas";
import type { FinAnaMcCategoriaItem } from "@/lib/finAnaMcCategorias";
import {
  metricaDesdeVariableObjetivo,
  type FinAnaMcConfigItem,
} from "@/lib/finAnaMcConfig";
import type { FinAnaCosFinaItem } from "@/services/finAnaCosFina.service";
import type { FinAnaCosFinaTerminalMarcaItem } from "@/lib/finAnaCosFinaTerminalesMarcas";
import type { DescuentosMargenContribucionMap } from "@/services/margenContribucionDesc.service";
import { guardarDescuentoMargenContribucionAction } from "@/actions/finAnaMargenContribucion";
import { toast } from "sonner";

/** Espera tras el último dígito antes de guardar el DESC. (evita guardar cada tecla). */
const DESCUENTO_GUARDADO_DEBOUNCE_MS = 500;

interface Props {
  filasCostosFinancieros: FinAnaCosFinaItem[];
  terminales: FinAnaCosFinaTerminalMarcaItem[];
  descuentosPorColumna: DescuentosMargenContribucionMap;
  formulas: FinAnaMcFormulaItem[];
  categoriasMc: FinAnaMcCategoriaItem[];
  configMc: FinAnaMcConfigItem;
  esEditor: boolean;
}

type VistaMargenContribucion = "detalle" | "grafico";

function soloDisponibles(
  seleccion: string[],
  opciones: readonly { value: string }[]
): string[] {
  const disponibles = new Set(opciones.map((opcion) => opcion.value));
  return seleccion.filter((valor) => disponibles.has(valor));
}

export default function FinAnaMargenContribucionPageClient({
  filasCostosFinancieros,
  terminales,
  descuentosPorColumna,
  formulas,
  categoriasMc,
  configMc,
  esEditor,
}: Props) {
  const router = useRouter();
  const [defaultsMc, setDefaultsMc] = useState(configMc);
  const formulaParams = useMemo(
    () => resolverParametrosFormulaMargenContribucion(formulas),
    [formulas]
  );
  const [inputs, setInputs] = useState(() => ({
    ...inputsMargenContribucionDesdeNumeros({ pxLista: formulaParams.pxListaCIva }),
    descuentoPctPorColumna: descuentosPorColumna,
  }));
  const guardadosPendientesRef = useRef(
    new Map<string, { timer: ReturnType<typeof setTimeout>; descuentoPct: number }>()
  );

  useEffect(() => {
    const pendientes = guardadosPendientesRef.current;
    return () => {
      for (const [cxFinId, { timer, descuentoPct }] of pendientes) {
        clearTimeout(timer);
        void guardarDescuentoMargenContribucionAction({ cxFinId, descuentoPct });
      }
      pendientes.clear();
    };
  }, []);
  const [vista, setVista] = useState<VistaMargenContribucion>("detalle");
  const esVistaGrafico = vista === "grafico";
  const [modalCxFormulasAbierto, setModalCxFormulasAbierto] = useState(false);
  const [modalCategoriasAbierto, setModalCategoriasAbierto] = useState(false);

  /** Filtros sin valor por defecto. */
  const [porcUtilidadPct, setPorcUtilidadPct] = useState<number | null>(null);
  const [escenarioGrafico, setEscenarioGrafico] =
    useState<TipoComprobanteVentaMargenContribucion>("FACTURA_A");
  const [pagoIds, setPagoIds] = useState<string[]>([]);
  const [entidadIds, setEntidadIds] = useState<string[]>([]);
  const [cuotasSel, setCuotasSel] = useState<string[]>([]);
  const [metricaGrafico, setMetricaGrafico] =
    useState<MetricaGraficoMcMargenContribucion>(() =>
      metricaDesdeVariableObjetivo(configMc.variableObjetivo)
    );

  const filasHabilitadas = useMemo(
    () => filasHabilitadasColumnasMargenContribucion(filasCostosFinancieros),
    [filasCostosFinancieros]
  );
  const opcionesFormaPago = useMemo(
    () => opcionesFormaPagoColumnasMargenContribucion(filasHabilitadas),
    [filasHabilitadas]
  );
  const opcionesEntidad = useMemo(
    () => opcionesEntidadColumnasMargenContribucion(filasHabilitadas, pagoIds),
    [filasHabilitadas, pagoIds]
  );
  const opcionesCuota = useMemo(
    () =>
      opcionesCuotaColumnasMargenContribucion(
        filasHabilitadas,
        pagoIds,
        entidadIds
      ),
    [filasHabilitadas, pagoIds, entidadIds]
  );

  const columnas = useMemo(
    () =>
      columnasMargenContribucion(filasHabilitadas, {
        pagoIds,
        entidadIds,
        cuotas: cuotasSel,
      }),
    [filasHabilitadas, pagoIds, entidadIds, cuotasSel]
  );

  function cambiarFormasPago(next: string[]) {
    const entidades = soloDisponibles(
      entidadIds,
      opcionesEntidadColumnasMargenContribucion(filasHabilitadas, next)
    );
    setPagoIds(next);
    setEntidadIds(entidades);
    setCuotasSel(
      soloDisponibles(
        cuotasSel,
        opcionesCuotaColumnasMargenContribucion(filasHabilitadas, next, entidades)
      )
    );
  }

  function cambiarEntidades(next: string[]) {
    setEntidadIds(next);
    setCuotasSel(
      soloDisponibles(
        cuotasSel,
        opcionesCuotaColumnasMargenContribucion(filasHabilitadas, pagoIds, next)
      )
    );
  }

  const graficoMc = useMemo(() => {
    const marcaEnRango =
      porcUtilidadPct != null &&
      porcUtilidadPct >= MC_GRAFICO_PORC_UTILIDAD_MIN &&
      porcUtilidadPct <= MC_GRAFICO_PORC_UTILIDAD_MAX;

    function baseColumna(
      columna: ColumnaMargenContribucion,
      metrica: MetricaGraficoMcMargenContribucion
    ) {
      return {
        pxLista: formulaParams.pxListaCIva,
        descuentoPct: inputs.descuentoPctPorColumna[columna.id] ?? 0,
        cxFinPct: columna.cxFinPctPorTipo[escenarioGrafico],
        tipoComprobante: escenarioGrafico,
        formulas: formulaParams,
        metrica,
      };
    }

    function seriesDe(
      metrica: MetricaGraficoMcMargenContribucion,
      conMarca: boolean
    ): SerieGraficoMcVsPorcUtilidad[] {
      return columnas.map((columna) => {
        const base = baseColumna(columna, metrica);
        return {
          id: columna.id,
          etiqueta: columna.etiqueta,
          color: columna.color,
          puntos: serieMcVsPorcUtilidadMargenContribucion(base),
          valorMarca:
            conMarca && marcaEnRango
              ? mcPctEnPorcUtilidadMargenContribucion({ ...base, porcUtilidadPct })
              : null,
        };
      });
    }

    const puedeMostrarValor =
      metricaGrafico === "CX_FINANCIERO" || porcUtilidadPct != null;

    const filasFormaPago = columnas.map((columna) => ({
      id: columna.id,
      nombre: columna.etiqueta,
      color: columna.color,
      descuentoPct: inputs.descuentoPctPorColumna[columna.id] ?? 0,
      valorPct: puedeMostrarValor
        ? mcPctEnPorcUtilidadMargenContribucion({
            ...baseColumna(columna, metricaGrafico),
            porcUtilidadPct: porcUtilidadPct ?? MC_GRAFICO_PORC_UTILIDAD_MIN,
          })
        : null,
    }));

    return {
      series: seriesDe(metricaGrafico, true),
      /** Escala M.C. (ratio×100) para umbrales cuando VARIABLE OBJETIVO = M.C. */
      seriesMc: seriesDe("MC", false),
      /** Escala M.C. PONDERADO para umbrales de Cat. M.C. */
      seriesMcPonderado: seriesDe("MC_PONDERADO", false),
      filasFormaPago,
      porcUtilidadMarca: marcaEnRango ? porcUtilidadPct : null,
      revisionFiltros: [
        escenarioGrafico,
        porcUtilidadPct == null ? "SIN_PORC" : String(porcUtilidadPct),
        columnas
          .map(
            (columna) =>
              `${columna.id}:${columna.cxFinPctPorTipo[escenarioGrafico]}:${inputs.descuentoPctPorColumna[columna.id] ?? 0}`
          )
          .join("|"),
      ].join("::"),
    };
  }, [
    columnas,
    inputs.descuentoPctPorColumna,
    formulaParams,
    escenarioGrafico,
    metricaGrafico,
    porcUtilidadPct,
  ]);

  function limpiarFiltros() {
    setPorcUtilidadPct(null);
    setPagoIds([]);
    setEntidadIds([]);
    setCuotasSel([]);
    setMetricaGrafico(metricaDesdeVariableObjetivo(defaultsMc.variableObjetivo));
  }

  function cambiarDescuentoColumna(columnaId: string, descuentoPct: number) {
    setInputs((prev) => ({
      ...prev,
      descuentoPctPorColumna: {
        ...prev.descuentoPctPorColumna,
        [columnaId]: descuentoPct,
      },
    }));

    const pendientes = guardadosPendientesRef.current;
    const anterior = pendientes.get(columnaId);
    if (anterior) clearTimeout(anterior.timer);
    const timer = setTimeout(async () => {
      pendientes.delete(columnaId);
      const res = await guardarDescuentoMargenContribucionAction({
        cxFinId: columnaId,
        descuentoPct,
      });
      if (!res.ok) toast.error(res.error ?? "No se pudo guardar el descuento.");
    }, DESCUENTO_GUARDADO_DEBOUNCE_MS);
    pendientes.set(columnaId, { timer, descuentoPct });
  }

  return (
    <>
      <ClassicFilteredTableLayout
        title="Administrador"
        subtitle="Margen Contribución"
        contentWidth="full"
        actions={
          <>
            <ToolbarActionButton
              label={esVistaGrafico ? "Ver Detalle" : "Ver Gráfico"}
              icon={esVistaGrafico ? <Table2 /> : <ChartLine />}
              className="w-full justify-start"
              onClick={() => setVista(esVistaGrafico ? "detalle" : "grafico")}
            />
            <ToolbarActionButton
              label="Gestionar Cat. M.C."
              icon={<Tags />}
              className="w-full justify-start"
              onClick={() => setModalCategoriasAbierto(true)}
            />
            <ToolbarActionButton
              label="Info Cx. & Formulas"
              icon={<Calculator />}
              className="w-full justify-start"
              onClick={() => setModalCxFormulasAbierto(true)}
            />
          </>
        }
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilterRowSelection className="flex-nowrap">
              <div className="min-w-0 flex-1">
                <FilaFiltrosDesplegables>
                  <FiltroIndividualContainer
                    className={FILTER_SELECT_WRAPPER_CLASS}
                    activo={porcUtilidadPct != null}
                    onLimpiar={() => setPorcUtilidadPct(null)}
                  >
                    <PorcentajeEnteroMaskInput
                      value={porcUtilidadPct}
                      emptyWhenNull
                      min={MC_GRAFICO_PORC_UTILIDAD_MIN}
                      max={MC_GRAFICO_PORC_UTILIDAD_MAX}
                      onValueChange={setPorcUtilidadPct}
                      onEmpty={() => setPorcUtilidadPct(null)}
                      sufijoEnTexto
                      placeholder="PORC. UT. (S/ IVA)"
                      className="input-filtro-unificado flex items-center rounded-md border border-primary bg-transparent text-xs"
                      inputClassName="text-xs placeholder:font-bold placeholder:text-muted-foreground"
                      aria-label="Porc. utilidad"
                      title={`Porc. utilidad (CX MERCADERÍA), entero de ${MC_GRAFICO_PORC_UTILIDAD_MIN} a ${MC_GRAFICO_PORC_UTILIDAD_MAX} %`}
                      disabled={!esEditor}
                    />
                  </FiltroIndividualContainer>

                  <FiltroIndividualContainer
                    className={cn(FILTER_SELECT_WRAPPER_CLASS, "relative")}
                    activo={pagoIds.length > 0}
                    onLimpiar={() => cambiarFormasPago([])}
                  >
                    <FiltroMultiSelect
                      opciones={opcionesFormaPago}
                      selected={pagoIds}
                      onChange={cambiarFormasPago}
                      placeholder="FORMA PAGO"
                      ariaLabel="Forma de pago"
                    />
                  </FiltroIndividualContainer>

                  <FiltroIndividualContainer
                    className={cn(FILTER_SELECT_WRAPPER_CLASS, "relative")}
                    activo={entidadIds.length > 0}
                    onLimpiar={() => cambiarEntidades([])}
                  >
                    <FiltroMultiSelect
                      opciones={opcionesEntidad}
                      selected={entidadIds}
                      onChange={cambiarEntidades}
                      placeholder="ENTIDAD"
                      ariaLabel="Entidad"
                    />
                  </FiltroIndividualContainer>

                  <FiltroIndividualContainer
                    className={cn(FILTER_SELECT_WRAPPER_CLASS, "relative")}
                    activo={cuotasSel.length > 0}
                    onLimpiar={() => setCuotasSel([])}
                  >
                    <FiltroMultiSelect
                      opciones={opcionesCuota}
                      selected={cuotasSel}
                      onChange={setCuotasSel}
                      placeholder="CUOTAS"
                      ariaLabel="Cuotas"
                    />
                  </FiltroIndividualContainer>
                </FilaFiltrosDesplegables>
              </div>
              <div className={cn(FILTER_INLINE_ACTION_SLOT_CLASS, "shrink-0 gap-2")}>
                <LimpiarFiltrosButton onClick={limpiarFiltros} />
              </div>
            </FilterRowSelection>
          </FilterBar>
        }
        filtersAriaLabel="Configuración de margen contribución"
      >
        {esVistaGrafico ? (
          <GraficoMcVsPorcUtilidad
            series={graficoMc.series}
            seriesMc={graficoMc.seriesMc}
            seriesMcPonderado={graficoMc.seriesMcPonderado}
            porcUtilidadMarca={graficoMc.porcUtilidadMarca}
            revisionFiltros={graficoMc.revisionFiltros}
            metrica={metricaGrafico}
            onMetricaChange={setMetricaGrafico}
            filasFormaPago={graficoMc.filasFormaPago}
            escenario={escenarioGrafico}
            onEscenarioChange={setEscenarioGrafico}
            categoriasMc={categoriasMc}
            variableObjetivo={defaultsMc.variableObjetivo}
            className="min-h-0 flex-1"
          />
        ) : (
          <TablaFinAnaMargenContribucion
            columnas={columnas}
            inputs={inputs}
            onDescuentoColumnaChange={cambiarDescuentoColumna}
            porcUtilidadPct={porcUtilidadPct}
            formulaParams={formulaParams}
          />
        )}
      </ClassicFilteredTableLayout>

      <GestionCxYFormulasMargenContribucionModal
        open={modalCxFormulasAbierto}
        onOpenChange={setModalCxFormulasAbierto}
        formulaParams={formulaParams}
      />

      <GestionarCategoriasMargenContribucionModal
        open={modalCategoriasAbierto}
        onOpenChange={setModalCategoriasAbierto}
        esEditor={esEditor}
        terminales={terminales}
        configInicial={defaultsMc}
        onGuardado={({ config: cfg }) => {
          setDefaultsMc(cfg);
          setMetricaGrafico(metricaDesdeVariableObjetivo(cfg.variableObjetivo));
          router.refresh();
        }}
      />
    </>
  );
}
