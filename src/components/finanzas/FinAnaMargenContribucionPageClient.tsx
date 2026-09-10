"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings2, Calculator, Tags } from "lucide-react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import TablaFinAnaMargenContribucion, {
  inputsMargenContribucionDesdeNumeros,
} from "@/components/finanzas/TablaFinAnaMargenContribucion";
import GraficoMcVsPorcUtilidad from "@/components/finanzas/GraficoMcVsPorcUtilidad";
import GestionarPagosFinAnaCosFinaModal from "@/components/finanzas/GestionarPagosFinAnaCosFinaModal";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import PorcentajeCentInput from "@/components/shared/PorcentajeCentInput";
import {
  COLORES_SERIE_GRAFICO_MC,
  FIN_ANA_MC_TIPOS_COMPROBANTE,
  crearDescuentoPctPorFormaPagoVacios,
  etiquetaFormaPagoMargenContribucion,
  etiquetaTipoComprobanteVentaMargenContribucion,
  idFormaPagoTresCuotasMargenContribucion,
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
  const [modalGestionarPagosAbierto, setModalGestionarPagosAbierto] = useState(false);
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

  const formaPagoTresCuotasId = useMemo(
    () => idFormaPagoTresCuotasMargenContribucion(pagos),
    [pagos]
  );

  /** `undefined` = aún no tocó el control → default 3 CUOTAS. */
  const [formasGraficoIds, setFormasGraficoIds] = useState<string[] | undefined>(
    undefined
  );
  const [metricaGrafico, setMetricaGrafico] =
    useState<MetricaGraficoMcMargenContribucion>(() =>
      metricaDesdeVariableObjetivo(configMc.variableObjetivo)
    );

  const formasGraficoSeleccionadas = useMemo(() => {
    if (formasGraficoIds !== undefined) return formasGraficoIds;
    return formaPagoTresCuotasId ? [formaPagoTresCuotasId] : [];
  }, [formasGraficoIds, formaPagoTresCuotasId]);

  const graficoMc = useMemo(() => {
    const marcaEnRango =
      tienePorcUtilidad &&
      porcUtilidadPct >= MC_GRAFICO_PORC_UTILIDAD_MIN &&
      porcUtilidadPct <= MC_GRAFICO_PORC_UTILIDAD_MAX;

    const filasFormaPago = formasPago.map((formaId, index) => {
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
      filasFormaPago.map((fila) => [fila.id, fila.color] as const)
    );

    const series = formasGraficoSeleccionadas.map((formaId) => {
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
    const seriesMc = formasGraficoSeleccionadas.map((formaId) => {
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
    const seriesMcPonderado = formasGraficoSeleccionadas.map((formaId) => {
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
    formasGraficoSeleccionadas,
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
    setFormasGraficoIds(undefined);
    setMetricaGrafico(metricaDesdeVariableObjetivo(defaultsMc.variableObjetivo));
    setInputs(
      inputsMargenContribucionIniciales(
        formasPago,
        descuentosBase,
        formulaParams.pxListaCIva
      )
    );
  }

  function handleCatalogoPagosChanged() {
    router.refresh();
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
        title="Finanzas"
        subtitle="Margen Contribución"
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => setModalCategoriasAbierto(true)}
              className="h-10 gap-2 px-4"
            >
              <Tags className="size-4 shrink-0" aria-hidden />
              Gestionar Cat. M.C.
            </Button>
            <Button
              type="button"
              onClick={() => setModalCxFormulasAbierto(true)}
              className="h-10 gap-2 px-4"
            >
              <Calculator className="size-4 shrink-0" aria-hidden />
              Gestion Cx. Y Formulas
            </Button>
            <Button
              type="button"
              onClick={() => setModalGestionarPagosAbierto(true)}
              className="h-10 gap-2 px-4"
            >
              <Settings2 className="size-4 shrink-0" aria-hidden />
              Gestionar Pagos
            </Button>
          </div>
        }
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilterRowSelection className="w-full min-w-0">
              <FilaFiltrosDesplegables columnas={4}>
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
        <div className="relative flex h-full min-h-0 flex-col gap-3">
          <TablaFinAnaMargenContribucion
            formasPago={formasPago}
            pagosCatalogo={pagos}
            cxFinancieroPorFormaPago={cxFinancieroPorFormaPago}
            inputs={inputs}
            onDescuentoPorFormaPagoChange={cambiarDescuentoPorFormaPago}
            porcUtilidadPct={porcUtilidadPct}
            tipoComprobante={config.tipoComprobante}
            formulaParams={formulaParams}
            esEditor={esEditor}
          />
          <GraficoMcVsPorcUtilidad
            series={graficoMc.series}
            seriesMc={graficoMc.seriesMc}
            seriesMcPonderado={graficoMc.seriesMcPonderado}
            porcUtilidadMarca={graficoMc.porcUtilidadMarca}
            revisionFiltros={graficoMc.revisionFiltros}
            metrica={metricaGrafico}
            onMetricaChange={setMetricaGrafico}
            filasFormaPago={graficoMc.filasFormaPago}
            formasSeleccionadas={formasGraficoSeleccionadas}
            onFormasSeleccionadasChange={setFormasGraficoIds}
            categoriasMc={categoriasMc}
            variableObjetivo={defaultsMc.variableObjetivo}
            className="relative z-0 shrink-0"
          />
        </div>
      </ClassicFilteredTableLayout>

      <GestionCxYFormulasMargenContribucionModal
        open={modalCxFormulasAbierto}
        onOpenChange={setModalCxFormulasAbierto}
        formulaParams={formulaParams}
      />

      <GestionarPagosFinAnaCosFinaModal
        open={modalGestionarPagosAbierto}
        onOpenChange={setModalGestionarPagosAbierto}
        pagosIniciales={pagos}
        esEditor={esEditor}
        onCatalogoChanged={handleCatalogoPagosChanged}
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
