"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, ChartLine, Table2, Tags } from "lucide-react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import FiltroMultiSelect, {
  type FiltroMultiSelectOpcion,
} from "@/components/shared/FiltroMultiSelect";
import TablaFinAnaMargenContribucion, {
  inputsMargenContribucionDesdeNumeros,
} from "@/components/finanzas/TablaFinAnaMargenContribucion";
import GraficoMcVsPorcUtilidad from "@/components/finanzas/GraficoMcVsPorcUtilidad";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import PorcentajeCentInput from "@/components/shared/PorcentajeCentInput";
import {
  COLORES_SERIE_GRAFICO_MC,
  FIN_ANA_MC_TIPOS_COMPROBANTE,
  crearDescuentoPctPorFormaPagoVacios,
  etiquetaFormaPagoMargenContribucion,
  etiquetaTipoComprobanteVentaMargenContribucion,
  idsFormasPagoMargenContribucion,
  mapCxFinancieroPorFormaPago,
  mcPctEnPorcUtilidadMargenContribucion,
  MC_GRAFICO_PORC_UTILIDAD_MAX,
  MC_GRAFICO_PORC_UTILIDAD_MIN,
  serieMcVsPorcUtilidadMargenContribucion,
  type MetricaGraficoMcMargenContribucion,
  type TipoComprobanteVentaMargenContribucion,
} from "@/lib/finAnaMargenContribucion";
import {
  resolverParametrosFormulaMargenContribucion,
  type FinAnaMcFormulaItem,
} from "@/lib/finAnaMcFormulas";
import type { FinAnaMcCategoriaItem } from "@/lib/finAnaMcCategorias";
import {
  metricaDesdeVariableObjetivo,
  type FinAnaMcConfigItem,
} from "@/lib/finAnaMcConfig";
import type { FinAnaCosFinaPagoItem } from "@/lib/finAnaCosFinaPagos";
import { actualizarDescuentoFpMargenContribucionAction } from "@/actions/finAnaMargenContribucion";
import { MARGEN_PX_LISTA_MAX_CENTS } from "@/lib/pxListasPreciosFormat";
import {
  parsePorcentajeCentNormalized,
  porcentajeCentNormalizedStringToCents,
} from "@/lib/porcentajeCentMask";
import type { FinAnaCosFinaItem } from "@/services/finAnaCosFina.service";
import type { FinAnaCosFinaTerminalMarcaItem } from "@/lib/finAnaCosFinaTerminalesMarcas";
import type { DescuentoFpMargenContribucionMap } from "@/services/finAnaMcDescuentoFp.service";
import type { FormaPagoMargenContribucion } from "@/lib/finAnaMargenContribucion";
import { toast } from "sonner";

interface Props {
  filasCostosFinancieros: FinAnaCosFinaItem[];
  terminales: FinAnaCosFinaTerminalMarcaItem[];
  pagos: FinAnaCosFinaPagoItem[];
  descuentosPorFormaPago: DescuentoFpMargenContribucionMap;
  formulas: FinAnaMcFormulaItem[];
  categoriasMc: FinAnaMcCategoriaItem[];
  configMc: FinAnaMcConfigItem;
  esEditor: boolean;
}

type VistaMargenContribucion = "detalle" | "grafico";

function configUiDesdeMcConfig(configMc: FinAnaMcConfigItem) {
  return {
    terminalId: configMc.terminalId ?? "",
    tipoComprobante: configMc.tipoComprobante,
    porcUtilidadNorm: "",
  };
}

function etiquetaFiltroMayusculas(texto: string): string {
  return texto.toLocaleUpperCase("es");
}

function inputsMargenContribucionIniciales(
  formasPago: FormaPagoMargenContribucion[],
  descuentosPorFormaPago: DescuentoFpMargenContribucionMap,
  pxLista: number
) {
  const descuentos = {
    ...crearDescuentoPctPorFormaPagoVacios(formasPago),
    ...descuentosPorFormaPago,
  };
  return inputsMargenContribucionDesdeNumeros({
    pxLista,
    descuentoPctPorFormaPago: descuentos,
    formasPago,
  });
}

export default function FinAnaMargenContribucionPageClient({
  filasCostosFinancieros,
  terminales,
  pagos,
  descuentosPorFormaPago,
  formulas,
  categoriasMc,
  configMc,
  esEditor,
}: Props) {
  const router = useRouter();
  const formasPago = useMemo(() => idsFormasPagoMargenContribucion(pagos), [pagos]);
  const [defaultsMc, setDefaultsMc] = useState(configMc);
  const [config, setConfig] = useState(() => configUiDesdeMcConfig(configMc));
  const [descuentosBase, setDescuentosBase] = useState(descuentosPorFormaPago);
  const formulaParams = useMemo(
    () => resolverParametrosFormulaMargenContribucion(formulas),
    [formulas]
  );
  const [inputs, setInputs] = useState(() =>
    inputsMargenContribucionIniciales(
      formasPago,
      descuentosPorFormaPago,
      formulaParams.pxListaCIva
    )
  );
  const [vista, setVista] = useState<VistaMargenContribucion>("detalle");
  const esVistaGrafico = vista === "grafico";
  /** Vacío = todas las formas de pago como columnas. */
  const [formasTablaIds, setFormasTablaIds] = useState<string[]>([]);
  const opcionesFormasPago = useMemo<FiltroMultiSelectOpcion[]>(
    () =>
      formasPago.map((id) => ({
        value: id,
        label: etiquetaFiltroMayusculas(
          etiquetaFormaPagoMargenContribucion(id, pagos)
        ),
      })),
    [formasPago, pagos]
  );
  const formasVisibles = useMemo(
    () =>
      formasTablaIds.length === 0
        ? formasPago
        : formasPago.filter((id) => formasTablaIds.includes(id)),
    [formasPago, formasTablaIds]
  );
  const [modalCxFormulasAbierto, setModalCxFormulasAbierto] = useState(false);
  const [modalCategoriasAbierto, setModalCategoriasAbierto] = useState(false);

  const cxFinancieroPorFormaPago = useMemo(
    () =>
      mapCxFinancieroPorFormaPago(
        filasCostosFinancieros,
        pagos,
        config.terminalId || undefined,
        config.tipoComprobante
      ),
    [
      filasCostosFinancieros,
      pagos,
      config.terminalId,
      config.tipoComprobante,
    ]
  );

  const porcUtilidadPct =
    parsePorcentajeCentNormalized(
      config.porcUtilidadNorm,
      MARGEN_PX_LISTA_MAX_CENTS
    ) ?? 0;

  const tienePorcUtilidad =
    config.porcUtilidadNorm.trim() !== "" && porcUtilidadPct > 0;

  const [metricaGrafico, setMetricaGrafico] =
    useState<MetricaGraficoMcMargenContribucion>(() =>
      metricaDesdeVariableObjetivo(configMc.variableObjetivo)
    );

  const graficoMc = useMemo(() => {
    const marcaEnRango =
      tienePorcUtilidad &&
      porcUtilidadPct >= MC_GRAFICO_PORC_UTILIDAD_MIN &&
      porcUtilidadPct <= MC_GRAFICO_PORC_UTILIDAD_MAX;

    const filasTodasLasFormas = formasPago.map((formaId, index) => {
      const descuentoPct = inputs.descuentoPctPorFormaPago[formaId] ?? 0;
      const cxFinPct = cxFinancieroPorFormaPago[formaId] ?? 0;
      const base = {
        pxLista: formulaParams.pxListaCIva,
        descuentoPct,
        cxFinPct,
        tipoComprobante: config.tipoComprobante,
        formulas: formulaParams,
        metrica: metricaGrafico,
      };
      const puedeMostrarValor =
        metricaGrafico === "CX_FINANCIERO" || tienePorcUtilidad;
      return {
        id: formaId,
        nombre: etiquetaFormaPagoMargenContribucion(formaId, pagos),
        color:
          COLORES_SERIE_GRAFICO_MC[index % COLORES_SERIE_GRAFICO_MC.length]!,
        descuentoPct,
        valorPct: puedeMostrarValor
          ? mcPctEnPorcUtilidadMargenContribucion({
              ...base,
              porcUtilidadPct: tienePorcUtilidad
                ? porcUtilidadPct
                : MC_GRAFICO_PORC_UTILIDAD_MIN,
            })
          : null,
      };
    });

    const colorPorId = new Map(
      filasTodasLasFormas.map((fila) => [fila.id, fila.color] as const)
    );
    const filasFormaPago = filasTodasLasFormas.filter((fila) =>
      formasVisibles.includes(fila.id)
    );

    const series = formasVisibles.map((formaId) => {
      const descuentoPct = inputs.descuentoPctPorFormaPago[formaId] ?? 0;
      const cxFinPct = cxFinancieroPorFormaPago[formaId] ?? 0;
      const base = {
        pxLista: formulaParams.pxListaCIva,
        descuentoPct,
        cxFinPct,
        tipoComprobante: config.tipoComprobante,
        formulas: formulaParams,
        metrica: metricaGrafico,
      };
      return {
        id: formaId,
        etiqueta: etiquetaFormaPagoMargenContribucion(formaId, pagos),
        color: colorPorId.get(formaId) ?? COLORES_SERIE_GRAFICO_MC[0]!,
        puntos: serieMcVsPorcUtilidadMargenContribucion(base),
        valorMarca: marcaEnRango
          ? mcPctEnPorcUtilidadMargenContribucion({
              ...base,
              porcUtilidadPct,
            })
          : null,
      };
    });

    /** Serie en escala M.C. (ratio×100) para umbrales cuando VARIABLE OBJETIVO = M.C. */
    const seriesMc = formasVisibles.map((formaId) => {
      const descuentoPct = inputs.descuentoPctPorFormaPago[formaId] ?? 0;
      const cxFinPct = cxFinancieroPorFormaPago[formaId] ?? 0;
      const base = {
        pxLista: formulaParams.pxListaCIva,
        descuentoPct,
        cxFinPct,
        tipoComprobante: config.tipoComprobante,
        formulas: formulaParams,
        metrica: "MC" as const,
      };
      return {
        id: formaId,
        etiqueta: etiquetaFormaPagoMargenContribucion(formaId, pagos),
        color: colorPorId.get(formaId) ?? COLORES_SERIE_GRAFICO_MC[0]!,
        puntos: serieMcVsPorcUtilidadMargenContribucion(base),
        valorMarca: null,
      };
    });

    /** Serie en escala M.C. PONDERADO para umbrales de Cat. M.C. */
    const seriesMcPonderado = formasVisibles.map((formaId) => {
      const descuentoPct = inputs.descuentoPctPorFormaPago[formaId] ?? 0;
      const cxFinPct = cxFinancieroPorFormaPago[formaId] ?? 0;
      const base = {
        pxLista: formulaParams.pxListaCIva,
        descuentoPct,
        cxFinPct,
        tipoComprobante: config.tipoComprobante,
        formulas: formulaParams,
        metrica: "MC_PONDERADO" as const,
      };
      return {
        id: formaId,
        etiqueta: etiquetaFormaPagoMargenContribucion(formaId, pagos),
        color: colorPorId.get(formaId) ?? COLORES_SERIE_GRAFICO_MC[0]!,
        puntos: serieMcVsPorcUtilidadMargenContribucion(base),
        valorMarca: null,
      };
    });

    return {
      series,
      seriesMc,
      seriesMcPonderado,
      filasFormaPago,
      porcUtilidadMarca: marcaEnRango ? porcUtilidadPct : null,
      revisionFiltros: [
        config.terminalId || "ALL",
        config.tipoComprobante,
        tienePorcUtilidad ? String(porcUtilidadPct) : "SIN_PORC",
        formasVisibles.join(","),
        Object.entries(cxFinancieroPorFormaPago)
          .map(([id, v]) => `${id}:${v}`)
          .sort()
          .join("|"),
        Object.entries(inputs.descuentoPctPorFormaPago)
          .map(([id, v]) => `${id}:${v}`)
          .sort()
          .join("|"),
      ].join("::"),
    };
  }, [
    formasPago,
    formasVisibles,
    inputs.descuentoPctPorFormaPago,
    cxFinancieroPorFormaPago,
    formulaParams,
    config.terminalId,
    config.tipoComprobante,
    metricaGrafico,
    tienePorcUtilidad,
    porcUtilidadPct,
    pagos,
  ]);

  function limpiarFiltros() {
    setConfig(configUiDesdeMcConfig(defaultsMc));
    setFormasTablaIds([]);
    setMetricaGrafico(metricaDesdeVariableObjetivo(defaultsMc.variableObjetivo));
    setInputs(
      inputsMargenContribucionIniciales(
        formasPago,
        descuentosBase,
        formulaParams.pxListaCIva
      )
    );
  }

  async function cambiarDescuentoPorFormaPago(
    formaPago: FormaPagoMargenContribucion,
    descuentoPct: number
  ) {
    setInputs((prev) => ({
      ...prev,
      descuentoPctPorFormaPago: {
        ...prev.descuentoPctPorFormaPago,
        [formaPago]: descuentoPct,
      },
    }));

    if (!esEditor) return;

    const res = await actualizarDescuentoFpMargenContribucionAction({
      pagoId: formaPago,
      descuentoPct,
    });
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar el descuento.");
      return;
    }
    setDescuentosBase(res.data);
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
            <FilterRowSelection className="w-full min-w-0">
              <FilaFiltrosDesplegables columnas={5}>
                <FiltroIndividualContainer
                  className={cn(FILTER_SELECT_WRAPPER_CLASS, "relative")}
                  activo={formasTablaIds.length > 0}
                  onLimpiar={() => setFormasTablaIds([])}
                >
                  <FiltroMultiSelect
                    opciones={opcionesFormasPago}
                    selected={formasTablaIds}
                    onChange={setFormasTablaIds}
                    placeholder="FORMAS DE PAGO"
                    ariaLabel="Formas de pago (columnas)"
                  />
                </FiltroIndividualContainer>

                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={
                    (config.terminalId || "") !== (defaultsMc.terminalId ?? "")
                  }
                  onLimpiar={() =>
                    setConfig((prev) => ({
                      ...prev,
                      terminalId: defaultsMc.terminalId ?? "",
                    }))
                  }
                >
                  <Select
                    value={config.terminalId ?? ""}
                    onValueChange={(value) =>
                      setConfig((prev) => ({ ...prev, terminalId: value }))
                    }
                  >
                    <SelectTrigger className="input-filtro-unificado w-full">
                      <SelectValue placeholder="TERMINAL" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {terminales.map((terminal) => (
                        <SelectItem key={terminal.id} value={terminal.id}>
                          {etiquetaFiltroMayusculas(terminal.nombre)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>

                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={
                    config.tipoComprobante !== defaultsMc.tipoComprobante
                  }
                  onLimpiar={() =>
                    setConfig((prev) => ({
                      ...prev,
                      tipoComprobante: defaultsMc.tipoComprobante,
                    }))
                  }
                >
                  <Select
                    value={config.tipoComprobante}
                    onValueChange={(value) =>
                      setConfig((prev) => ({
                        ...prev,
                        tipoComprobante:
                          value as TipoComprobanteVentaMargenContribucion,
                      }))
                    }
                  >
                    <SelectTrigger className="input-filtro-unificado w-full">
                      <SelectValue placeholder="TIPO DE COMPROBANTE" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {FIN_ANA_MC_TIPOS_COMPROBANTE.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {etiquetaTipoComprobanteVentaMargenContribucion(tipo)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>

                <div className={cn(FILTER_SELECT_WRAPPER_CLASS, "col-span-1")}>
                  <PorcentajeCentInput
                    valueNormalized={config.porcUtilidadNorm}
                    maxCents={MARGEN_PX_LISTA_MAX_CENTS}
                    emptyWhenZero
                    placeholder="PORC. UTILIDAD"
                    onValueNormalizedChange={(next) => {
                      const cents = porcentajeCentNormalizedStringToCents(
                        next,
                        MARGEN_PX_LISTA_MAX_CENTS
                      );
                      setConfig((prev) => ({
                        ...prev,
                        porcUtilidadNorm: cents === 0 ? "" : next,
                      }));
                    }}
                    onClear={() =>
                      setConfig((prev) => ({ ...prev, porcUtilidadNorm: "" }))
                    }
                    className="input-filtro-unificado w-1/2 border-primary text-xs"
                    aria-label="Porc. utilidad"
                    title="Porc. utilidad (CX MERCADERÍA)"
                    disabled={!esEditor}
                  />
                </div>

                <div
                  className={cn(
                    FILTER_INLINE_ACTION_SLOT_CLASS,
                    "justify-end"
                  )}
                >
                  <LimpiarFiltrosButton onClick={limpiarFiltros} />
                </div>
              </FilaFiltrosDesplegables>
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
            categoriasMc={categoriasMc}
            variableObjetivo={defaultsMc.variableObjetivo}
            className="min-h-0 flex-1"
          />
        ) : (
          <TablaFinAnaMargenContribucion
            formasPago={formasVisibles}
            pagosCatalogo={pagos}
            cxFinancieroPorFormaPago={cxFinancieroPorFormaPago}
            inputs={inputs}
            onDescuentoPorFormaPagoChange={cambiarDescuentoPorFormaPago}
            porcUtilidadPct={porcUtilidadPct}
            tipoComprobante={config.tipoComprobante}
            formulaParams={formulaParams}
            esEditor={esEditor}
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
          setConfig((prev) => ({
            ...configUiDesdeMcConfig(cfg),
            porcUtilidadNorm: prev.porcUtilidadNorm,
          }));
          setMetricaGrafico(metricaDesdeVariableObjetivo(cfg.variableObjetivo));
          router.refresh();
        }}
      />
    </>
  );
}
