"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Beaker, Paintbrush, Palette, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import FilterBar, {
  FILTER_SELECT_WRAPPER_CLASS,
  FiltroIndividualContainer,
  FilaFiltrosDesplegables,
  FilterRowSearch,
  FilterRowSelection,
  LimpiarFiltrosButton,
} from "@/components/FilterBar";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import FiltroMultiSelect from "@/components/shared/FiltroMultiSelect";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import PaginacionClient from "@/components/shared/PaginacionClient";
import GestionarEstPorProdColoresModal from "@/components/estadisticas-productos/GestionarEstPorProdColoresModal";
import GestionarEstPorProdPresentacionModal from "@/components/estadisticas-productos/GestionarEstPorProdPresentacionModal";
import GestionarEstPorProdTerminacionModal from "@/components/estadisticas-productos/GestionarEstPorProdTerminacionModal";
import GestionarEstPorProdUnPresentacionModal from "@/components/estadisticas-productos/GestionarEstPorProdUnPresentacionModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import { matchByMultiTerm } from "@/lib/busqueda";
import type { EstCategorizacionItem } from "@/lib/estCategorizacionTypes";
import {
  cumpleFiltroIn,
  cumpleFiltroListaOSentinel,
  pruneSelected,
} from "@/lib/estFiltrosMulti";
import type { EstPorProdColorItem } from "@/lib/estPorProdColores";
import type { EstPorProdPresentacionItem } from "@/lib/estPorProdPresentacion";
import type { EstPorProdTerminacionItem } from "@/lib/estPorProdTerminacion";
import type { EstPorProdUnPresentacionItem } from "@/lib/estPorProdUnPresentacion";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import { PAGE_SIZE } from "@/lib/pagination";
import { cn } from "@/lib/utils";

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
const FOCUS_KEY = "filtros-est-categorizacion-focus";

interface Props {
  filas: EstCategorizacionItem[];
  coloresCatalogo: EstPorProdColorItem[];
  presentacionesCatalogo: EstPorProdPresentacionItem[];
  unidadesCatalogo: EstPorProdUnPresentacionItem[];
  terminacionesCatalogo: EstPorProdTerminacionItem[];
  esEditor: boolean;
}

function opcionesOrdenadas(valores: string[]): string[] {
  return [...new Set(valores.filter((v) => v.trim() !== ""))].sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" })
  );
}

export default function EstCategorizacionPageClient({
  filas,
  coloresCatalogo,
  presentacionesCatalogo,
  unidadesCatalogo,
  terminacionesCatalogo,
  esEditor,
}: Props) {
  const router = useRouter();
  const [filtMarca, setFiltMarca] = useState<string[]>([]);
  const [filtRubro, setFiltRubro] = useState<string[]>([]);
  const [filtSubRubro, setFiltSubRubro] = useState<string[]>([]);
  const [filtColor, setFiltColor] = useState<string[]>([]);
  const [filtTerminacion, setFiltTerminacion] = useState<string[]>([]);
  const [filtPresentacion, setFiltPresentacion] = useState<string[]>([]);
  const [modalColoresOpen, setModalColoresOpen] = useState(false);
  const [modalUnidadesOpen, setModalUnidadesOpen] = useState(false);
  const [modalPresentacionOpen, setModalPresentacionOpen] = useState(false);
  const [modalTerminacionOpen, setModalTerminacionOpen] = useState(false);
  const [paginaActual, setPaginaActual] = useState(1);
  const [qDebounced, setQDebounced] = useState("");

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
      setPaginaActual(1);
    },
  });

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
    setPaginaActual(1);
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
    setPaginaActual(1);
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

  const totalPaginas = Math.max(1, Math.ceil(filasFiltradas.length / PAGE_SIZE));
  const paginaSafe = Math.min(paginaActual, totalPaginas);
  const filasPagina = filasFiltradas.slice(
    (paginaSafe - 1) * PAGE_SIZE,
    paginaSafe * PAGE_SIZE
  );

  function limpiarFiltros() {
    setFiltMarca([]);
    setFiltRubro([]);
    setFiltSubRubro([]);
    setFiltColor([]);
    setFiltTerminacion([]);
    setFiltPresentacion([]);
    setQ("");
    setQDebounced("");
    setPaginaActual(1);
  }

  const emptyMessage =
    filas.length > 0 && filasFiltradas.length === 0
      ? "Ningún producto coincide con los filtros seleccionados."
      : undefined;

  return (
    <>
      <ClassicFilteredTableLayout
        title="ESTADÍSTICAS PRODUCTOS"
        subtitle="Configuracion"
        contentWidth="full"
      actions={
        esEditor ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="h-10 px-4 gap-2"
              onClick={() => setModalColoresOpen(true)}
            >
              <Palette className="h-4 w-4 shrink-0" aria-hidden />
              Gestion Colores
            </Button>
            <Button
              type="button"
              className="h-10 px-4 gap-2"
              onClick={() => setModalUnidadesOpen(true)}
            >
              <Ruler className="h-4 w-4 shrink-0" aria-hidden />
              Gestion Unidades
            </Button>
            <Button
              type="button"
              className="h-10 px-4 gap-2"
              onClick={() => setModalPresentacionOpen(true)}
            >
              <Beaker className="h-4 w-4 shrink-0" aria-hidden />
              Gestion Presentacion
            </Button>
            <Button
              type="button"
              className="h-10 px-4 gap-2"
              onClick={() => setModalTerminacionOpen(true)}
            >
              <Paintbrush className="h-4 w-4 shrink-0" aria-hidden />
              Gestion Terminacion
            </Button>
          </div>
        ) : undefined
      }
        filters={
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
                  setPaginaActual(1);
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
                  setPaginaActual(1);
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
                onLimpiar={() => {
                  setFiltSubRubro([]);
                  setPaginaActual(1);
                }}
              >
                <FiltroMultiSelect
                  opciones={subRubros}
                  selected={filtSubRubro}
                  onChange={(v) => {
                    setFiltSubRubro(v);
                    setPaginaActual(1);
                  }}
                  placeholder="SUB RUBRO"
                  ariaLabel="Sub Rubro"
                />
              </FiltroIndividualContainer>

              <FiltroIndividualContainer
                className={cn(FILTER_SELECT_WRAPPER_CLASS, "relative")}
                activo={filtColor.length > 0}
                onLimpiar={() => {
                  setFiltColor([]);
                  setPaginaActual(1);
                }}
              >
                <FiltroMultiSelect
                  opciones={colores}
                  extras={EXTRA_SIN_COLOR}
                  selected={filtColor}
                  onChange={(v) => {
                    setFiltColor(v);
                    setPaginaActual(1);
                  }}
                  placeholder="COLOR"
                  ariaLabel="Color"
                />
              </FiltroIndividualContainer>

              <FiltroIndividualContainer
                className={cn(FILTER_SELECT_WRAPPER_CLASS, "relative")}
                activo={filtTerminacion.length > 0}
                onLimpiar={() => {
                  setFiltTerminacion([]);
                  setPaginaActual(1);
                }}
              >
                <FiltroMultiSelect
                  opciones={terminacionesOpciones}
                  extras={EXTRA_SIN_TERMINACION}
                  selected={filtTerminacion}
                  onChange={(v) => {
                    setFiltTerminacion(v);
                    setPaginaActual(1);
                  }}
                  placeholder="TERMINACION"
                  ariaLabel="Terminacion"
                />
              </FiltroIndividualContainer>

              <FiltroIndividualContainer
                className={cn(FILTER_SELECT_WRAPPER_CLASS, "relative")}
                activo={filtPresentacion.length > 0}
                onLimpiar={() => {
                  setFiltPresentacion([]);
                  setPaginaActual(1);
                }}
              >
                <FiltroMultiSelect
                  opciones={presentacionOpciones}
                  extras={EXTRA_SIN_PRESENTACION}
                  selected={filtPresentacion}
                  onChange={(v) => {
                    setFiltPresentacion(v);
                    setPaginaActual(1);
                  }}
                  placeholder="PRESENTACION"
                  ariaLabel="Presentacion"
                />
              </FiltroIndividualContainer>
            </FilaFiltrosDesplegables>
          </FilterRowSelection>

          <div className="flex items-center gap-3">
            <FilterRowSearch className="flex-1">
              <FiltroBusquedaInput
                id="filtro-est-categorizacion-descripcion"
                placeholder="BUSCAR POR DESCRIPCIÓN..."
                value={q}
                onChange={(value) => {
                  handleQChange(value);
                  setPaginaActual(1);
                }}
                isDebouncing={isDebouncing}
                inputRef={inputRef}
              />
            </FilterRowSearch>
            <LimpiarFiltrosButton onClick={limpiarFiltros} />
          </div>
        </FilterBar>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <section className="contenedor-tabla-gestion flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-card">
          <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[32%]">DESCRIPCIÓN</TableHead>
                  <TableHead className="w-[12%]">MARCA</TableHead>
                  <TableHead className="w-[12%]">RUBRO</TableHead>
                  <TableHead className="w-[12%]">SUB RUBRO</TableHead>
                  <TableHead className="w-[12%]">COLOR</TableHead>
                  <TableHead className="w-[12%]">TERMINACION</TableHead>
                  <TableHead className="w-[8%]">PRESENTACION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filasPagina.length === 0 ? (
                  <EmptyTableRow
                    colSpan={7}
                    message={
                      emptyMessage ??
                      (filas.length === 0
                        ? "No hay productos en el catálogo tienda."
                        : "Sin resultados.")
                    }
                  />
                ) : (
                  filasPagina.map((f) => (
                    <TableRow key={f.codTienda}>
                      <TableCell className="celda-datos">
                        {f.descripcionTienda || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="celda-datos">
                        {f.marca || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="celda-datos">
                        {f.rubro || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="celda-datos">
                        {f.subRubro || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="celda-datos">
                        {f.colorEtiqueta || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="celda-datos">
                        {f.terminacionEtiqueta || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="celda-datos">
                        {f.presentacionEtiqueta || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {filasFiltradas.length > PAGE_SIZE ? (
            <div className="border-t border-border px-4 py-3">
              <PaginacionClient
                paginaActual={paginaSafe}
                totalPaginas={totalPaginas}
                onPaginaChange={setPaginaActual}
              />
            </div>
          ) : null}
        </section>
      </div>
    </ClassicFilteredTableLayout>

      <GestionarEstPorProdColoresModal
        open={modalColoresOpen}
        onOpenChange={setModalColoresOpen}
        itemsIniciales={coloresCatalogo}
        esEditor={esEditor}
        onCatalogoChanged={() => router.refresh()}
      />

      <GestionarEstPorProdUnPresentacionModal
        open={modalUnidadesOpen}
        onOpenChange={setModalUnidadesOpen}
        itemsIniciales={unidadesCatalogo}
        esEditor={esEditor}
        onCatalogoChanged={() => router.refresh()}
      />

      <GestionarEstPorProdPresentacionModal
        open={modalPresentacionOpen}
        onOpenChange={setModalPresentacionOpen}
        itemsIniciales={presentacionesCatalogo}
        unidades={unidadesCatalogo}
        esEditor={esEditor}
        onCatalogoChanged={() => router.refresh()}
      />

      <GestionarEstPorProdTerminacionModal
        open={modalTerminacionOpen}
        onOpenChange={setModalTerminacionOpen}
        itemsIniciales={terminacionesCatalogo}
        esEditor={esEditor}
        onCatalogoChanged={() => router.refresh()}
      />
    </>
  );
}
