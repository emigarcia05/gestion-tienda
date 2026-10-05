"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FilterBar, {
  FILTER_SELECT_WRAPPER_CLASS,
  FiltroIndividualContainer,
  FilaFiltrosDesplegables,
  FilterRowSearch,
  FilterRowSelection,
  LimpiarFiltrosButton,
  SELECT_TRIGGER_FILTER_CLASS,
} from "@/components/FilterBar";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import FiltroMultiSelect from "@/components/shared/FiltroMultiSelect";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import EstVtasGraficoBarrasMensual from "@/components/estadisticas-productos/EstVtasGraficoBarrasMensual";
import EstVtasGraficoTopProductos from "@/components/estadisticas-productos/EstVtasGraficoTopProductos";
import EstVtasGraficoVarianteBarras from "@/components/estadisticas-productos/EstVtasGraficoVarianteBarras";
import { matchByMultiTerm } from "@/lib/busqueda";
import {
  cumpleFiltroIn,
  cumpleFiltroListaOSentinel,
  pruneSelected,
} from "@/lib/estFiltrosMulti";
import { filterItemsBySelectSearch } from "@/lib/selectSearch";
import SelectSearchInput from "@/components/shared/SelectSearchInput";
import {
  agregarTopProductos,
  agregarUnidadesMensualesAnio,
  agregarUnidadesPorDobleDimension,
  agregarUnidadesPorEjeY,
  filtroProductoDesdeDimension,
} from "@/lib/estVtasAgregar";
import {
  esEstVtasEjeY,
  type EstVtasDesglose,
  type EstVtasDimensionGrafico,
  type EstVtasFiltroDimension,
  type EstVtasModoUnidad,
  type EstVtasProductoItem,
  type EstVtasSeleccionDesglose,
  type EstVtasVentaItem,
} from "@/lib/estVtasTypes";
import type { SucursalEstOption } from "@/lib/estPorProdTypes";
import {
  clavePeriodoEstPorProd,
  clavePeriodoMasRecienteConVentas,
  etiquetaMesCortoEstPorProd,
  etiquetaMesEstPorProd,
  listarPeriodosCargaEstPorProd,
  parseClavePeriodoEstPorProd,
} from "@/lib/estPorProdPeriodo";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

const FILTRO_TODOS = "none";
const FILTRO_SIN_COLOR = "__SIN_COLOR__";
const FILTRO_SIN_TERMINACION = "__SIN_TERMINACION__";
const FILTRO_SIN_PRESENTACION = "__SIN_PRESENTACION__";
const EXTRA_SIN_COLOR = [{ value: FILTRO_SIN_COLOR, label: "SIN COLOR" }] as const;
const EXTRA_SIN_TERMINACION = [
  { value: FILTRO_SIN_TERMINACION, label: "SIN TERMINACION" },
] as const;
const EXTRA_SIN_PRESENTACION = [
  { value: FILTRO_SIN_PRESENTACION, label: "SIN PRESENTACION" },
] as const;

const FOCUS_KEY = "filtros-est-vtas-focus";

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

interface Props {
  filas: EstVtasProductoItem[];
  ventas: EstVtasVentaItem[];
  sucursales: SucursalEstOption[];
  mesActual: number;
  anioActual: number;
}

function opcionesOrdenadas(valores: string[]): string[] {
  return [...new Set(valores.filter((v) => v.trim() !== ""))].sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" })
  );
}

function mismosNumeros(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

function etiquetaAniosSeleccionados(aniosSel: number[]): string {
  if (aniosSel.length === 0) return "AÑO";
  const sorted = [...aniosSel].sort((a, b) => a - b);
  if (sorted.length === 1) return String(sorted[0]);
  return sorted.join(" · ");
}

function etiquetaMesesSeleccionados(mesesSel: number[]): string {
  if (mesesSel.length === 0) return "MES";
  const sorted = [...mesesSel].sort((a, b) => a - b);
  if (sorted.length === 1) {
    return (
      MESES_CALENDARIO.find((m) => m.valor === sorted[0])?.etiqueta ??
      etiquetaMesEstPorProd(sorted[0]!).toLocaleUpperCase("es-AR")
    );
  }
  return sorted.map((n) => etiquetaMesCortoEstPorProd(n)).join(" · ");
}

export default function EstVtasPageClient({
  filas,
  ventas,
  sucursales,
  mesActual,
  anioActual,
}: Props) {
  const periodoDefault = useMemo(() => {
    const clave = clavePeriodoMasRecienteConVentas(ventas, {
      mes: mesActual,
      anio: anioActual,
    });
    return (
      parseClavePeriodoEstPorProd(clave) ?? {
        mes: mesActual,
        anio: anioActual,
      }
    );
  }, [ventas, mesActual, anioActual]);

  const [filtMarca, setFiltMarca] = useState<string[]>([]);
  const [filtRubro, setFiltRubro] = useState<string[]>([]);
  const [filtSubRubro, setFiltSubRubro] = useState<string[]>([]);
  const [filtColor, setFiltColor] = useState<string[]>([]);
  const [filtTerminacion, setFiltTerminacion] = useState<string[]>([]);
  const [filtPresentacion, setFiltPresentacion] = useState<string[]>([]);
  const [filtSucursalId, setFiltSucursalId] = useState(FILTRO_TODOS);
  const [filtAnios, setFiltAnios] = useState<number[]>([periodoDefault.anio]);
  const [filtMeses, setFiltMeses] = useState<number[]>([periodoDefault.mes]);
  const [filtUnidad, setFiltUnidad] = useState<EstVtasModoUnidad>("unidad");
  const [aniosOpen, setAniosOpen] = useState(false);
  const [mesesOpen, setMesesOpen] = useState(false);
  const [aniosQuery, setAniosQuery] = useState("");
  const [mesesQuery, setMesesQuery] = useState("");
  const aniosMultiRef = useRef<HTMLDivElement>(null);
  const mesesMultiRef = useRef<HTMLDivElement>(null);
  const [dimension1, setDimension1] =
    useState<EstVtasDimensionGrafico>("marca");
  const [desglose1, setDesglose1] = useState<EstVtasDesglose>("ninguno");
  const [seleccionGrafico1, setSeleccionGrafico1] = useState<string | null>(null);
  const [seleccionDesglose1, setSeleccionDesglose1] =
    useState<EstVtasSeleccionDesglose | null>(null);
  /** `codTienda` del producto elegido en el Top 10. */
  const [seleccionProductoTop, setSeleccionProductoTop] = useState<string | null>(
    null
  );
  const [qDebounced, setQDebounced] = useState("");

  const periodosConVentas = useMemo(() => {
    const keys = new Set(
      ventas.map((v) => clavePeriodoEstPorProd(v.mes, v.anio))
    );
    return keys;
  }, [ventas]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (aniosMultiRef.current && !aniosMultiRef.current.contains(t)) {
        setAniosOpen(false);
        setAniosQuery("");
      }
      if (mesesMultiRef.current && !mesesMultiRef.current.contains(t)) {
        setMesesOpen(false);
        setMesesQuery("");
      }
    }
    if (aniosOpen || mesesOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [aniosOpen, mesesOpen]);

  const {
    q,
    setQ,
    ref: inputRef,
    handleQChange,
    isDebouncing,
  } = useFiltrosConBusqueda({
    qActual: qDebounced,
    debounceMs: 300,
    focusStorageKey: FOCUS_KEY,
    onDebouncedSearch: (value) => {
      setQDebounced(value);
    },
  });

  const periodos = useMemo(
    () => listarPeriodosCargaEstPorProd({ mes: mesActual, anio: anioActual }),
    [mesActual, anioActual]
  );

  const aniosOpciones = useMemo(() => {
    const set = new Set(periodos.map((p) => p.anio));
    return [...set].sort((a, b) => b - a);
  }, [periodos]);

  const aniosFiltrados = useMemo(
    () =>
      filterItemsBySelectSearch(aniosOpciones, aniosQuery, (a) => {
        const conDatos = [...periodosConVentas].some((k) => k.startsWith(`${a}-`));
        return conDatos ? String(a) : `${a} (SIN DATOS)`;
      }),
    [aniosOpciones, aniosQuery, periodosConVentas]
  );

  const mesesFiltrados = useMemo(
    () => filterItemsBySelectSearch(MESES_CALENDARIO, mesesQuery, (m) => m.etiqueta),
    [mesesQuery]
  );

  const labelAnios = etiquetaAniosSeleccionados(filtAnios);
  const labelMeses = etiquetaMesesSeleccionados(filtMeses);
  const aniosFiltroActivo = !mismosNumeros(filtAnios, [periodoDefault.anio]);
  const mesesFiltroActivo = !mismosNumeros(filtMeses, [periodoDefault.mes]);

  function toggleAnio(anioValor: number) {
    const tiene = filtAnios.includes(anioValor);
    if (tiene && filtAnios.length === 1) {
      toast.info("Dejá al menos un año seleccionado.");
      return;
    }
    setFiltAnios(
      tiene
        ? filtAnios.filter((a) => a !== anioValor)
        : [...filtAnios, anioValor]
    );
  }

  function toggleMes(mesValor: number) {
    const tiene = filtMeses.includes(mesValor);
    if (tiene && filtMeses.length === 1) {
      toast.info("Dejá al menos un mes seleccionado.");
      return;
    }
    setFiltMeses(
      tiene
        ? filtMeses.filter((m) => m !== mesValor)
        : [...filtMeses, mesValor]
    );
  }

  const marcas = useMemo(
    () => opcionesOrdenadas(filas.map((f) => f.marca)),
    [filas]
  );

  const rubros = useMemo(() => {
    const base =
      filtMarca.length === 0
        ? filas
        : filas.filter((f) => filtMarca.includes(f.marca));
    return opcionesOrdenadas(base.map((f) => f.rubro));
  }, [filas, filtMarca]);

  const subRubros = useMemo(() => {
    let base = filas;
    if (filtMarca.length > 0) {
      base = base.filter((f) => filtMarca.includes(f.marca));
    }
    if (filtRubro.length > 0) {
      base = base.filter((f) => filtRubro.includes(f.rubro));
    }
    return opcionesOrdenadas(base.map((f) => f.subRubro));
  }, [filas, filtMarca, filtRubro]);

  const colores = useMemo(() => {
    const names = filas.flatMap((f) => f.colores);
    return opcionesOrdenadas(names);
  }, [filas]);

  const terminacionesOpciones = useMemo(() => {
    const names = filas.flatMap((f) => f.terminaciones);
    return opcionesOrdenadas(names);
  }, [filas]);

  const presentacionOpciones = useMemo(() => {
    return opcionesOrdenadas(
      filas.map((f) => f.presentacionEtiqueta).filter((v) => v.trim() !== "")
    );
  }, [filas]);

  function handleMarcaChange(nextMarcas: string[]) {
    setFiltMarca(nextMarcas);
    let base =
      nextMarcas.length === 0
        ? filas
        : filas.filter((f) => nextMarcas.includes(f.marca));
    const nextRubros = opcionesOrdenadas(base.map((f) => f.rubro));
    const keptRubro = pruneSelected(filtRubro, nextRubros);
    setFiltRubro(keptRubro);
    if (keptRubro.length > 0) {
      base = base.filter((f) => keptRubro.includes(f.rubro));
    }
    setFiltSubRubro(
      pruneSelected(filtSubRubro, opcionesOrdenadas(base.map((f) => f.subRubro)))
    );
  }

  function handleRubroChange(nextRubros: string[]) {
    setFiltRubro(nextRubros);
    let base = filas;
    if (filtMarca.length > 0) {
      base = base.filter((f) => filtMarca.includes(f.marca));
    }
    if (nextRubros.length > 0) {
      base = base.filter((f) => nextRubros.includes(f.rubro));
    }
    setFiltSubRubro(
      pruneSelected(filtSubRubro, opcionesOrdenadas(base.map((f) => f.subRubro)))
    );
  }

  const filasFiltradas = useMemo(() => {
    let out = filas;
    if (filtMarca.length > 0) {
      out = out.filter((f) => cumpleFiltroIn(filtMarca, f.marca));
    }
    if (filtRubro.length > 0) {
      out = out.filter((f) => cumpleFiltroIn(filtRubro, f.rubro));
    }
    if (filtSubRubro.length > 0) {
      out = out.filter((f) => cumpleFiltroIn(filtSubRubro, f.subRubro));
    }
    out = out.filter((f) =>
      cumpleFiltroListaOSentinel(filtColor, f.colores, FILTRO_SIN_COLOR)
    );
    out = out.filter((f) =>
      cumpleFiltroListaOSentinel(
        filtTerminacion,
        f.terminaciones,
        FILTRO_SIN_TERMINACION
      )
    );
    out = out.filter((f) => {
      const etiqueta = f.presentacionEtiqueta.trim();
      return cumpleFiltroListaOSentinel(
        filtPresentacion,
        etiqueta === "" ? [] : [f.presentacionEtiqueta],
        FILTRO_SIN_PRESENTACION
      );
    });
    const qTrim = qDebounced.trim();
    if (qTrim) {
      out = out.filter((f) => matchByMultiTerm([f.descripcionTienda], qTrim));
    }
    return out;
  }, [
    filas,
    filtMarca,
    filtRubro,
    filtSubRubro,
    filtColor,
    filtTerminacion,
    filtPresentacion,
    qDebounced,
  ]);

  const desgloseActivo = desglose1 !== "ninguno";

  const barrasCategoria1 = useMemo(
    () =>
      agregarUnidadesPorEjeY({
        productosFiltrados: filasFiltradas,
        ventas,
        sucursalId: filtSucursalId,
        anios: filtAnios,
        meses: filtMeses,
        modoUnidad: filtUnidad,
        ejeY: dimension1,
        sucursales,
      }),
    [
      filasFiltradas,
      ventas,
      filtSucursalId,
      filtAnios,
      filtMeses,
      filtUnidad,
      dimension1,
      sucursales,
    ]
  );

  const gruposGrafico1 = useMemo(() => {
    if (desglose1 === "ninguno") return null;
    return agregarUnidadesPorDobleDimension({
      productosFiltrados: filasFiltradas,
      ventas,
      anios: filtAnios,
      meses: filtMeses,
      modoUnidad: filtUnidad,
      dimension: dimension1,
      desglose: desglose1,
      sucursales,
    });
  }, [
    desglose1,
    filasFiltradas,
    ventas,
    filtAnios,
    filtMeses,
    filtUnidad,
    dimension1,
    sucursales,
  ]);

  const seleccionDesgloseValida = useMemo(() => {
    if (!desgloseActivo || !seleccionDesglose1 || !gruposGrafico1) return null;
    const ok = gruposGrafico1.some(
      (g) =>
        g.id === seleccionDesglose1.categoriaId &&
        g.hijos.some((h) => h.id === seleccionDesglose1.hijoId)
    );
    return ok ? seleccionDesglose1 : null;
  }, [desgloseActivo, seleccionDesglose1, gruposGrafico1]);

  const seleccionCategoria1Valida = useMemo(() => {
    if (desgloseActivo) {
      return seleccionDesgloseValida?.categoria ?? null;
    }
    if (
      seleccionGrafico1 &&
      barrasCategoria1.some((b) => b.etiqueta === seleccionGrafico1)
    ) {
      return seleccionGrafico1;
    }
    return null;
  }, [
    desgloseActivo,
    seleccionDesgloseValida,
    seleccionGrafico1,
    barrasCategoria1,
  ]);

  /** Sucursal efectiva: selección G1 (plano o desglose) o filtro global. */
  const sucursalIdEfectiva = useMemo(() => {
    if (desgloseActivo && seleccionDesgloseValida) {
      if (dimension1 === "sucursal") return seleccionDesgloseValida.categoriaId;
      if (desglose1 === "sucursal") return seleccionDesgloseValida.hijoId;
    } else if (!desgloseActivo && seleccionCategoria1Valida && dimension1 === "sucursal") {
      const barra = barrasCategoria1.find(
        (b) => b.etiqueta === seleccionCategoria1Valida
      );
      if (barra?.id) return barra.id;
    }
    return filtSucursalId;
  }, [
    desgloseActivo,
    seleccionDesgloseValida,
    dimension1,
    desglose1,
    seleccionCategoria1Valida,
    barrasCategoria1,
    filtSucursalId,
  ]);

  /** Filtros de producto derivados de la selección del gráfico 1. */
  const filtrosDimensionG1 = useMemo((): EstVtasFiltroDimension[] | null => {
    if (!seleccionCategoria1Valida) return null;

    if (seleccionDesgloseValida && desglose1 !== "ninguno") {
      const out: EstVtasFiltroDimension[] = [];
      const fCat = filtroProductoDesdeDimension(
        dimension1,
        seleccionDesgloseValida.categoria
      );
      if (fCat) out.push(fCat);
      const fHijo = filtroProductoDesdeDimension(
        desglose1,
        seleccionDesgloseValida.hijoEtiqueta
      );
      if (fHijo) out.push(fHijo);
      return out.length > 0 ? out : null;
    }

    if (esEstVtasEjeY(dimension1)) {
      return [{ ejeY: dimension1, etiqueta: seleccionCategoria1Valida }];
    }
    return null;
  }, [
    seleccionCategoria1Valida,
    seleccionDesgloseValida,
    desglose1,
    dimension1,
  ]);

  const topProductos = useMemo(() => {
    return agregarTopProductos({
      productosFiltrados: filasFiltradas,
      ventas,
      sucursalId: sucursalIdEfectiva,
      anios: filtAnios,
      meses: filtMeses,
      modoUnidad: filtUnidad,
      filtros: filtrosDimensionG1,
      topN: 10,
    });
  }, [
    filasFiltradas,
    ventas,
    sucursalIdEfectiva,
    filtAnios,
    filtMeses,
    filtUnidad,
    filtrosDimensionG1,
  ]);

  const seleccionProductoTopValida =
    seleccionProductoTop &&
    topProductos.filas.some((b) => b.codTienda === seleccionProductoTop)
      ? seleccionProductoTop
      : null;

  const puntosMensuales = useMemo(() => {
    // G3: ENE…DIC; respeta años seleccionados; ignora filtro Mes de página.
    return agregarUnidadesMensualesAnio({
      productosFiltrados: filasFiltradas,
      ventas,
      sucursalId: sucursalIdEfectiva,
      modoUnidad: filtUnidad,
      anios: filtAnios,
      filtros: filtrosDimensionG1,
      codTienda: seleccionProductoTopValida,
    });
  }, [
    filasFiltradas,
    ventas,
    sucursalIdEfectiva,
    filtUnidad,
    filtAnios,
    filtrosDimensionG1,
    seleccionProductoTopValida,
  ]);

  function handleDimension1Change(dim: EstVtasDimensionGrafico) {
    setDimension1(dim);
    if (desglose1 === dim) {
      setDesglose1("ninguno");
    }
    setSeleccionGrafico1(null);
    setSeleccionDesglose1(null);
    setSeleccionProductoTop(null);
  }

  function handleDesglose1Change(desglose: EstVtasDesglose) {
    // Opciones de UI ya excluyen la dimensión activa; defensivo si coinciden.
    setDesglose1(
      desglose !== "ninguno" && desglose === dimension1 ? "ninguno" : desglose
    );
    setSeleccionGrafico1(null);
    setSeleccionDesglose1(null);
    setSeleccionProductoTop(null);
  }

  function handleSeleccionarGrafico1(etiqueta: string | null) {
    setSeleccionGrafico1(etiqueta);
    setSeleccionDesglose1(null);
    setSeleccionProductoTop(null);
  }

  function handleSeleccionarDesglose1(sel: EstVtasSeleccionDesglose | null) {
    setSeleccionDesglose1(sel);
    setSeleccionGrafico1(sel?.categoria ?? null);
    setSeleccionProductoTop(null);
  }

  function limpiarFiltros() {
    setFiltMarca([]);
    setFiltRubro([]);
    setFiltSubRubro([]);
    setFiltColor([]);
    setFiltTerminacion([]);
    setFiltPresentacion([]);
    setFiltSucursalId(FILTRO_TODOS);
    setFiltAnios([periodoDefault.anio]);
    setFiltMeses([periodoDefault.mes]);
    setFiltUnidad("unidad");
    setQ("");
    setQDebounced("");
  }

  return (
    <ClassicFilteredTableLayout
      title="ESTADÍSTICAS PRODUCTOS"
      subtitle="Ventas"
      contentWidth="full"
      filters={
        <div className="filtros-doble-bloque-compacto">
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilterRowSelection className="w-full min-w-0">
              <FilaFiltrosDesplegables>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={filtUnidad !== "unidad"}
                  onLimpiar={() => setFiltUnidad("unidad")}
                >
                  <Select
                    value={filtUnidad}
                    onValueChange={(v) => setFiltUnidad(v as EstVtasModoUnidad)}
                  >
                    <SelectTrigger
                      className="input-filtro-unificado"
                      aria-label="Unidades"
                    >
                      <SelectValue placeholder="UNIDADES" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      <SelectItem value="unidad">UNIDAD</SelectItem>
                      <SelectItem value="suma">SUMA DE UNIDADES</SelectItem>
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>

                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={filtSucursalId !== FILTRO_TODOS}
                  onLimpiar={() => setFiltSucursalId(FILTRO_TODOS)}
                >
                  <Select value={filtSucursalId} onValueChange={setFiltSucursalId}>
                    <SelectTrigger
                      className="input-filtro-unificado"
                      aria-label="Sucursal"
                    >
                      <SelectValue placeholder="SUCURSAL" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro max-h-60"
                    >
                      <SelectItem value={FILTRO_TODOS}>SUCURSAL</SelectItem>
                      {sucursales.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>

                <FiltroIndividualContainer
                  className={cn(FILTER_SELECT_WRAPPER_CLASS, "relative")}
                  activo={aniosFiltroActivo}
                  onLimpiar={() => setFiltAnios([periodoDefault.anio])}
                >
                  <div className="relative" ref={aniosMultiRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setMesesOpen(false);
                        setMesesQuery("");
                        setAniosOpen((o) => {
                          const next = !o;
                          if (!next) setAniosQuery("");
                          return next;
                        });
                      }}
                      className={cn(
                        SELECT_TRIGGER_FILTER_CLASS,
                        "flex w-full items-center justify-between gap-2 text-left font-semibold"
                      )}
                      aria-expanded={aniosOpen}
                      aria-haspopup="listbox"
                      aria-label="Año (selección múltiple)"
                    >
                      <span className="truncate">{labelAnios}</span>
                      <ChevronDown
                        className="h-4 w-4 shrink-0 opacity-50"
                        aria-hidden
                      />
                    </button>
                    {aniosOpen ? (
                      <div
                        className="absolute top-full left-0 z-50 mt-1 flex max-h-72 min-w-full flex-col overflow-hidden rounded-md border border-border bg-popover shadow-md"
                        role="listbox"
                        aria-multiselectable="true"
                      >
                        <div className="shrink-0 border-b border-border p-1">
                          <SelectSearchInput
                            value={aniosQuery}
                            onValueChange={setAniosQuery}
                            autoFocus
                          />
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto p-1">
                          {aniosFiltrados.length === 0 ? (
                            <p className="px-2 py-1.5 text-sm text-muted-foreground" role="status">
                              SIN RESULTADOS
                            </p>
                          ) : (
                            aniosFiltrados.map((a) => {
                              const selected = filtAnios.includes(a);
                              const conDatos = [...periodosConVentas].some((k) =>
                                k.startsWith(`${a}-`)
                              );
                              return (
                                <label
                                  key={a}
                                  role="option"
                                  aria-selected={selected}
                                  className={cn(
                                    "flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm font-medium hover:bg-muted",
                                    selected && "bg-muted"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() => toggleAnio(a)}
                                    className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
                                    aria-label={String(a)}
                                  />
                                  <span>
                                    {conDatos ? a : `${a} (SIN DATOS)`}
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </FiltroIndividualContainer>

                <FiltroIndividualContainer
                  className={cn(FILTER_SELECT_WRAPPER_CLASS, "relative")}
                  activo={mesesFiltroActivo}
                  onLimpiar={() => setFiltMeses([periodoDefault.mes])}
                >
                  <div className="relative" ref={mesesMultiRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setAniosOpen(false);
                        setAniosQuery("");
                        setMesesOpen((o) => {
                          const next = !o;
                          if (!next) setMesesQuery("");
                          return next;
                        });
                      }}
                      className={cn(
                        SELECT_TRIGGER_FILTER_CLASS,
                        "flex w-full items-center justify-between gap-2 text-left font-semibold"
                      )}
                      aria-expanded={mesesOpen}
                      aria-haspopup="listbox"
                      aria-label="Mes (selección múltiple)"
                    >
                      <span className="truncate">{labelMeses}</span>
                      <ChevronDown
                        className="h-4 w-4 shrink-0 opacity-50"
                        aria-hidden
                      />
                    </button>
                    {mesesOpen ? (
                      <div
                        className="absolute top-full left-0 z-50 mt-1 flex max-h-72 min-w-full flex-col overflow-hidden rounded-md border border-border bg-popover shadow-md"
                        role="listbox"
                        aria-multiselectable="true"
                      >
                        <div className="shrink-0 border-b border-border p-1">
                          <SelectSearchInput
                            value={mesesQuery}
                            onValueChange={setMesesQuery}
                            autoFocus
                          />
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto p-1">
                          {mesesFiltrados.length === 0 ? (
                            <p className="px-2 py-1.5 text-sm text-muted-foreground" role="status">
                              SIN RESULTADOS
                            </p>
                          ) : (
                            mesesFiltrados.map((m) => {
                              const selected = filtMeses.includes(m.valor);
                              return (
                                <label
                                  key={m.valor}
                                  role="option"
                                  aria-selected={selected}
                                  className={cn(
                                    "flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm font-medium hover:bg-muted",
                                    selected && "bg-muted"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() => toggleMes(m.valor)}
                                    className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
                                    aria-label={m.etiqueta}
                                  />
                                  <span>{m.etiqueta}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </FiltroIndividualContainer>

              </FilaFiltrosDesplegables>
            </FilterRowSelection>
          </FilterBar>

          <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilterRowSelection className="w-full min-w-0">
              <FilaFiltrosDesplegables columnas={6}>
                <FiltroIndividualContainer
                  className={cn(FILTER_SELECT_WRAPPER_CLASS, "relative")}
                  activo={filtMarca.length > 0}
                  onLimpiar={() => {
                    setFiltMarca([]);
                    setFiltRubro([]);
                    setFiltSubRubro([]);
                  }}
                >
                  <FiltroMultiSelect
                    opciones={marcas}
                    selected={filtMarca}
                    onChange={handleMarcaChange}
                    placeholder="MARCA"
                    ariaLabel="Marca"
                  />
                </FiltroIndividualContainer>

                <FiltroIndividualContainer
                  className={cn(FILTER_SELECT_WRAPPER_CLASS, "relative")}
                  activo={filtRubro.length > 0}
                  onLimpiar={() => {
                    setFiltRubro([]);
                    setFiltSubRubro([]);
                  }}
                >
                  <FiltroMultiSelect
                    opciones={rubros}
                    selected={filtRubro}
                    onChange={handleRubroChange}
                    placeholder="RUBRO"
                    ariaLabel="Rubro"
                  />
                </FiltroIndividualContainer>

                <FiltroIndividualContainer
                  className={cn(FILTER_SELECT_WRAPPER_CLASS, "relative")}
                  activo={filtSubRubro.length > 0}
                  onLimpiar={() => setFiltSubRubro([])}
                >
                  <FiltroMultiSelect
                    opciones={subRubros}
                    selected={filtSubRubro}
                    onChange={setFiltSubRubro}
                    placeholder="SUB RUBRO"
                    ariaLabel="Sub Rubro"
                  />
                </FiltroIndividualContainer>

                <FiltroIndividualContainer
                  className={cn(FILTER_SELECT_WRAPPER_CLASS, "relative")}
                  activo={filtColor.length > 0}
                  onLimpiar={() => setFiltColor([])}
                >
                  <FiltroMultiSelect
                    opciones={colores}
                    extras={EXTRA_SIN_COLOR}
                    selected={filtColor}
                    onChange={setFiltColor}
                    placeholder="COLOR"
                    ariaLabel="Color"
                  />
                </FiltroIndividualContainer>

                <FiltroIndividualContainer
                  className={cn(FILTER_SELECT_WRAPPER_CLASS, "relative")}
                  activo={filtTerminacion.length > 0}
                  onLimpiar={() => setFiltTerminacion([])}
                >
                  <FiltroMultiSelect
                    opciones={terminacionesOpciones}
                    extras={EXTRA_SIN_TERMINACION}
                    selected={filtTerminacion}
                    onChange={setFiltTerminacion}
                    placeholder="TERMINACION"
                    ariaLabel="Terminacion"
                  />
                </FiltroIndividualContainer>

                <FiltroIndividualContainer
                  className={cn(FILTER_SELECT_WRAPPER_CLASS, "relative")}
                  activo={filtPresentacion.length > 0}
                  onLimpiar={() => setFiltPresentacion([])}
                >
                  <FiltroMultiSelect
                    opciones={presentacionOpciones}
                    extras={EXTRA_SIN_PRESENTACION}
                    selected={filtPresentacion}
                    onChange={setFiltPresentacion}
                    placeholder="PRESENTACION"
                    ariaLabel="Presentacion"
                  />
                </FiltroIndividualContainer>
              </FilaFiltrosDesplegables>
            </FilterRowSelection>

            <div className="flex items-center gap-3">
              <FilterRowSearch className="flex-1">
                <FiltroBusquedaInput
                  id="filtro-est-vtas-descripcion"
                  placeholder="BUSCAR POR DESCRIPCIÓN..."
                  value={q}
                  onChange={(value) => {
                    handleQChange(value);
                  }}
                  isDebouncing={isDebouncing}
                  inputRef={inputRef}
                />
              </FilterRowSearch>
              <LimpiarFiltrosButton onClick={limpiarFiltros} />
            </div>
          </FilterBar>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        <EstVtasGraficoVarianteBarras
          barras={barrasCategoria1}
          grupos={gruposGrafico1}
          dimension={dimension1}
          onDimensionChange={handleDimension1Change}
          desglose={desglose1}
          onDesgloseChange={handleDesglose1Change}
          seleccionada={desgloseActivo ? null : seleccionCategoria1Valida}
          onSeleccionar={
            desgloseActivo ? undefined : handleSeleccionarGrafico1
          }
          seleccionDesglose={seleccionDesgloseValida}
          onSeleccionarDesglose={
            desgloseActivo ? handleSeleccionarDesglose1 : undefined
          }
          sinVentasCargadas={ventas.length === 0}
          ariaLabelDimension="Dimensión del eje Y — gráfico 1"
          className="h-full max-h-full w-[35%] min-w-0 shrink-0 self-start"
        />
        <EstVtasGraficoTopProductos
          filas={topProductos.filas}
          totalFiltrado={topProductos.totalUnidades}
          seleccionadoCod={seleccionProductoTopValida}
          onSeleccionar={setSeleccionProductoTop}
          sinVentasCargadas={ventas.length === 0}
          className="h-full max-h-full w-[30%] min-w-0 shrink-0 self-start"
        />
        <EstVtasGraficoBarrasMensual
          puntos={puntosMensuales}
          anio={filtAnios.length === 1 ? filtAnios[0]! : null}
          mesMarca={filtMeses.length === 1 ? filtMeses[0]! : null}
          sinVentasCargadas={ventas.length === 0}
          className="h-full max-h-full w-[35%] min-w-0 shrink-0 self-start"
        />
      </div>
    </ClassicFilteredTableLayout>
  );
}
