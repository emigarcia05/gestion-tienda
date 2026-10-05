"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FilterBar, {
  FiltroIndividualContainer,
  FilterRowSelection,
  FilterRowSearch,
  FilaFiltrosDesplegables,
  FILTER_SELECT_WRAPPER_CLASS,
  LimpiarFiltrosButton,
} from "@/components/FilterBar";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PaginacionClient from "@/components/shared/PaginacionClient";
import { fmtPrecio } from "@/lib/format";
import {
  tableEmptyStateContainerVariants,
  tableEmptyStateMessageVariants,
} from "@/components/shared/TableEmptyState";
import { cn } from "@/lib/utils";
import type { FilaListaPrecioParaCliente } from "@/services/listaPrecios.service";
import type { ListaPreciosConOpcionesResult, ListaPreciosFiltrosLecturaInput } from "@/actions/listaPrecios";

type FetchListaPreciosConOpcionesAction = (
  params: ListaPreciosFiltrosLecturaInput
) => Promise<ListaPreciosConOpcionesResult>;

interface ProveedorOption {
  id: string;
  nombre: string;
  prefijo: string;
}

interface MarcaOption {
  id: string;
  nombre: string;
}

interface SugeridosTablaConFiltrosProps {
  proveedores: ProveedorOption[];
  marcas: MarcaOption[];
  fetchListaPreciosConOpcionesAction: FetchListaPreciosConOpcionesAction;
}

const MIN_CARACTERES_BUSQUEDA = 3;
const MENSAJE_SIN_FILTRO =
  "Aplicá un filtro (Proveedor o Marca) o escribí al menos 3 caracteres en la búsqueda para ver productos.";

export default function SugeridosTablaConFiltros({
  proveedores,
  marcas,
  fetchListaPreciosConOpcionesAction,
}: SugeridosTablaConFiltrosProps) {
  const [proveedorId, setProveedorId] = useState<string>("");
  const [marcaNombre, setMarcaNombre] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");
  const {
    q,
    setQ,
    ref: inputRef,
    handleQChange,
    isDebouncing,
  } = useFiltrosConBusqueda({
    qActual: busqueda,
    debounceMs: 700,
    onDebouncedSearch: (value) => {
      setBusqueda(value);
    },
  });
  const [filasData, setFilasData] = useState<FilaListaPrecioParaCliente[]>([]);
  const [proveedoresOptions, setProveedoresOptions] = useState<ProveedorOption[]>(proveedores);
  const [marcasOptions, setMarcasOptions] = useState<MarcaOption[]>(marcas);
  const [loading, setLoading] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);

  const hasFilterActive =
    !!proveedorId || !!marcaNombre || busqueda.trim().length >= MIN_CARACTERES_BUSQUEDA;

  useEffect(() => {
    if (!hasFilterActive) {
      queueMicrotask(() => {
        setProveedoresOptions(proveedores);
        setMarcasOptions(marcas);
      });
    }
  }, [hasFilterActive, proveedores, marcas]);

  useEffect(() => {
    if (!hasFilterActive) {
      queueMicrotask(() => {
        setFilasData([]);
        setTotal(0);
        setTotalPaginas(1);
      });
      return;
    }
    let cancelled = false;
    queueMicrotask(() => setLoading(true));
    fetchListaPreciosConOpcionesAction({
      proveedorId: proveedorId || undefined,
      marcaNombre: marcaNombre || undefined,
      busqueda: busqueda.trim() || undefined,
      habilitado: true,
      opciones: { soloPxSugerido: true },
      pagina,
    })
      .then((res) => {
        if (cancelled) return;
        setFilasData(res.filas);
        setTotal(res.total);
        setTotalPaginas(res.totalPaginas);
        setProveedoresOptions((prev) => {
          const next = res.proveedoresDisponibles;
          const selected = prev.find((p) => p.id === proveedorId);
          if (proveedorId && selected && !next.some((p) => p.id === proveedorId)) {
            return [selected, ...next];
          }
          return next;
        });
        setMarcasOptions((prev) => {
          const next = res.marcasDisponibles;
          const selected = prev.find((m) => m.nombre === marcaNombre);
          if (marcaNombre && selected && !next.some((m) => m.nombre === marcaNombre)) {
            return [selected, ...next];
          }
          return next;
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasFilterActive, proveedorId, marcaNombre, busqueda, pagina, fetchListaPreciosConOpcionesAction]);

  useEffect(() => {
    queueMicrotask(() => setPagina(1));
  }, [proveedorId, marcaNombre, busqueda]);

  const filteredFilas = filasData;


  function limpiarFiltros() {
    setProveedorId("");
    setMarcaNombre("");
    setQ("");
    setBusqueda("");
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-0.5">
      <FilterBar className="filtros-contenedor-tienda bg-card">
        <FilterRowSelection>
          <FilaFiltrosDesplegables>
            <FiltroIndividualContainer
              className={FILTER_SELECT_WRAPPER_CLASS}
              activo={Boolean(proveedorId)}
              onLimpiar={() => setProveedorId("")}
            >
              <Select
                value={proveedorId ?? ""}
                onValueChange={(v) => setProveedorId(v)}
              >
                <SelectTrigger id="filtro-sugeridos-proveedor" className="input-filtro-unificado">
                  <SelectValue placeholder="PROVEEDOR" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  {proveedoresOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      [{p.prefijo}] {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FiltroIndividualContainer>
            <FiltroIndividualContainer
              className={FILTER_SELECT_WRAPPER_CLASS}
              activo={Boolean(marcaNombre)}
              onLimpiar={() => setMarcaNombre("")}
            >
              <Select
                value={marcaNombre ?? ""}
                onValueChange={(v) => setMarcaNombre(v)}
              >
                <SelectTrigger id="filtro-sugeridos-marca" className="input-filtro-unificado">
                  <SelectValue placeholder="MARCA" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  {marcasOptions.map((m) => (
                    <SelectItem key={m.id} value={m.nombre}>
                      {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FiltroIndividualContainer>
          </FilaFiltrosDesplegables>
        </FilterRowSelection>
        <div className="flex items-center gap-3">
          <FilterRowSearch className="flex-1">
            <FiltroBusquedaInput
              id="filtro-sugeridos-busqueda"
              value={q}
              onChange={handleQChange}
              isDebouncing={isDebouncing}
              inputRef={inputRef}
              placeholder="BUSCAR POR DESCRIPCIÓN (MÍN. 3 CARACTERES)"
            />
          </FilterRowSearch>
          <LimpiarFiltrosButton onClick={limpiarFiltros} />
        </div>
      </FilterBar>

      <div className="contenedor-tabla-gestion no-scroll-x">
        <Table variant="compact" scrollX={false}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-28">COD. EXT.</TableHead>
              <TableHead className="min-w-0">DESCRIPCIÓN</TableHead>
              <TableHead className="w-28">PX. LISTA GENERAL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hasFilterActive && !loading && filteredFilas.map((fila) => (
              <TableRow key={fila.id}>
                <TableCell className="celda-datos celda-mono whitespace-nowrap">
                  {fila.codExt}
                </TableCell>
                <TableCell className="celda-datos min-w-0 overflow-hidden">
                  <div className="celda-destacado truncate text-xs font-bold" title={fila.descripcion}>
                    {fila.descripcion}
                  </div>
                </TableCell>
                <TableCell className="celda-datos celda-numero celda-destacado">
                  {fila.pxVtaSugerido != null ? `$${fmtPrecio(Number(fila.pxVtaSugerido))}` : ""}
                </TableCell>
              </TableRow>
            ))}
            {(!hasFilterActive || loading || filteredFilas.length === 0) && (
              <TableRow>
                <TableCell
                  className={cn(
                    "celda-datos",
                    tableEmptyStateContainerVariants({
                      placement: "tableCell",
                      textSize: "sm",
                    })
                  )}
                  colSpan={3}
                >
                  <span
                    className={tableEmptyStateMessageVariants({
                      maxWidth: "full",
                    })}
                  >
                    {!hasFilterActive
                      ? MENSAJE_SIN_FILTRO
                      : loading
                        ? "Cargando…"
                        : "Ningún producto coincide con los filtros."}
                  </span>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between gap-2 py-1.5 px-1 border-t bg-gris rounded-b-lg shrink-0">
        <span className="text-sm text-muted-foreground tabular-nums">
          {!hasFilterActive || total === 0
            ? "Mostrando 0 de 0"
            : `Mostrando ${filteredFilas.length.toLocaleString()} de ${total.toLocaleString()}`}
        </span>
        {hasFilterActive && totalPaginas > 1 && (
          <PaginacionClient
            paginaActual={pagina}
            totalPaginas={totalPaginas}
            onPaginaChange={setPagina}
          />
        )}
      </div>
    </div>
  );
}
