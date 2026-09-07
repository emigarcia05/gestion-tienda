"use client";

import { useState, useEffect } from "react";
import { Link2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  FILTER_COUNT_CLASS,
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
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import EdicionMasivaListaPreciosModal from "@/components/proveedores/EdicionMasivaListaPreciosModal";
import VincularPrecioRexModal from "@/components/proveedores/VincularPrecioRexModal";
import EliminarListaPrecioModal from "@/components/proveedores/EliminarListaPrecioModal";
import DescuentosListaPreciosCelda from "@/components/proveedores/DescuentosListaPreciosCelda";
import DescuentosAplicadosListaPreciosModal from "@/components/proveedores/DescuentosAplicadosListaPreciosModal";
import ReglaDescuentoItemListaPreciosModal from "@/components/proveedores/ReglaDescuentoItemListaPreciosModal";
import type { ListaPreciosFiltrosExportSnapshot } from "@/components/proveedores/ExportarListaPreciosButton";
import type {
  DescuentoActivoListaPrecio,
  FilaListaPrecioParaCliente,
} from "@/services/listaPrecios.service";
import {
  getListaPreciosConOpcionesAction,
  type ListaPreciosFiltrosLecturaInput,
} from "@/actions/listaPrecios";
import { toast } from "sonner";
import {
  LISTA_PRECIOS_FILTRO_SIN_VALOR,
  LISTA_PRECIOS_FILTRO_SIN_VALOR_LABEL,
} from "@/lib/listaPreciosFiltros";

interface ProveedorOption {
  id: string;
  nombre: string;
  prefijo: string;
}

interface MarcaOption {
  id: string;
  nombre: string;
}

interface RubroOption {
  id: string;
  nombre: string;
}

interface ListaPreciosTablaConFiltrosProps {
  proveedores: ProveedorOption[];
  marcas: MarcaOption[];
  rubros: RubroOption[];
  puedeEdicionMasiva?: boolean;
  reloadNonce?: number;
  onEdicionSuccess?: () => void;
  onFiltrosExportSnapshotChange?: (snapshot: ListaPreciosFiltrosExportSnapshot) => void;
}

/** Anchos de columna en % (COD / DESCR / MARCA / RUBRO / PX FINAL / ACC). */
const COL_WIDTHS_PCT = [8, 53, 8, 8, 8, 15] as const;

const MIN_CARACTERES_BUSQUEDA = 3;
const COL_COUNT = COL_WIDTHS_PCT.length;
const MENSAJE_SIN_FILTRO =
  "Aplicá un filtro (Proveedor, Marca, Rubro, Habilitado o Vinculado) o escribí al menos 3 caracteres en la búsqueda para ver productos.";

function fmtPrecioTabla(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `$${fmtPrecio(n)}`;
}

function DescripcionCelda({ fila }: { fila: FilaListaPrecioParaCliente }) {
  const tienda = fila.descripcionTienda?.trim() || "";
  const proveedor = fila.descripcionProveedor?.trim() || "";
  const principal = tienda || proveedor || "—";

  return (
    <div
      className="flex min-w-0 max-h-full flex-col justify-center gap-0"
      title={[principal, fila.codExt].filter(Boolean).join(" · ")}
    >
      <div className="celda-destacado truncate text-xs font-bold leading-none">{principal}</div>
    </div>
  );
}

function CeldaTextoTabla({ valor }: { valor: string | null | undefined }) {
  const texto = valor?.trim() || "—";
  return (
    <span className="block truncate" title={texto !== "—" ? texto : undefined}>
      {texto}
    </span>
  );
}

export default function ListaPreciosTablaConFiltros({
  proveedores,
  marcas,
  rubros,
  puedeEdicionMasiva = false,
  reloadNonce = 0,
  onEdicionSuccess,
  onFiltrosExportSnapshotChange,
}: ListaPreciosTablaConFiltrosProps) {
  const [filaEdit, setFilaEdit] = useState<FilaListaPrecioParaCliente | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [filaVincular, setFilaVincular] = useState<FilaListaPrecioParaCliente | null>(null);
  const [vincularOpen, setVincularOpen] = useState(false);
  const [filaEliminar, setFilaEliminar] = useState<FilaListaPrecioParaCliente | null>(null);
  const [eliminarOpen, setEliminarOpen] = useState(false);
  const [descuentosModalOpen, setDescuentosModalOpen] = useState(false);
  const [filaDescuentos, setFilaDescuentos] = useState<FilaListaPrecioParaCliente | null>(null);
  const [reglaModalOpen, setReglaModalOpen] = useState(false);
  const [reglaModalDescuento, setReglaModalDescuento] =
    useState<DescuentoActivoListaPrecio | null>(null);
  const [proveedorId, setProveedorId] = useState<string>("");
  const [marcaNombre, setMarcaNombre] = useState<string>("");
  const [rubroNombre, setRubroNombre] = useState<string>("");
  const [habilitadoFilter, setHabilitadoFilter] = useState<string>("");
  const [vinculadoFilter, setVinculadoFilter] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");
  const {
    q,
    setQ,
    ref: busquedaInputRef,
    handleQChange,
    isDebouncing,
  } = useFiltrosConBusqueda({
    qActual: busqueda,
    debounceMs: 700,
    onDebouncedSearch: (value) => {
      setBusqueda(value);
      setPagina(1);
    },
  });
  const [filasData, setFilasData] = useState<FilaListaPrecioParaCliente[]>([]);
  const [proveedoresOptions, setProveedoresOptions] = useState<ProveedorOption[]>(proveedores);
  const [marcasOptions, setMarcasOptions] = useState<MarcaOption[]>(marcas);
  const [rubrosOptions, setRubrosOptions] = useState<RubroOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);

  const hasFilterActive =
    !!proveedorId ||
    !!marcaNombre ||
    !!rubroNombre ||
    habilitadoFilter === "si" ||
    habilitadoFilter === "no" ||
    vinculadoFilter === "si" ||
    vinculadoFilter === "no" ||
    busqueda.trim().length >= MIN_CARACTERES_BUSQUEDA;

  function abrirDescuentos(fila: FilaListaPrecioParaCliente) {
    setFilaDescuentos(fila);
    setDescuentosModalOpen(true);
  }

  function abrirReglaDescuento(descuento: DescuentoActivoListaPrecio) {
    setReglaModalDescuento(descuento);
    setReglaModalOpen(true);
  }

  useEffect(() => {
    if (!hasFilterActive) {
      queueMicrotask(() => {
        setProveedoresOptions(proveedores);
        setMarcasOptions(marcas);
        setRubrosOptions([]);
      });
    }
  }, [hasFilterActive, proveedores, marcas]);

  function reiniciarPagina() {
    setPagina(1);
  }

  function cambiarProveedor(value: string) {
    setProveedorId(value);
    reiniciarPagina();
  }

  function cambiarMarca(value: string) {
    setMarcaNombre(value);
    reiniciarPagina();
  }

  function cambiarRubro(value: string) {
    setRubroNombre(value);
    reiniciarPagina();
  }

  function cambiarHabilitado(value: string) {
    setHabilitadoFilter(value);
    reiniciarPagina();
  }

  function cambiarVinculado(value: string) {
    setVinculadoFilter(value);
    reiniciarPagina();
  }

  useEffect(() => {
    if (!hasFilterActive) {
      queueMicrotask(() => {
        setLoading(false);
        setFilasData([]);
        setTotal(0);
        setTotalPaginas(1);
      });
      return;
    }
    let cancelled = false;
    queueMicrotask(() => setLoading(true));
    const params: ListaPreciosFiltrosLecturaInput = {
      proveedorId: proveedorId || undefined,
      marcaNombre: marcaNombre || undefined,
      rubroNombre: rubroNombre || undefined,
      busqueda: busqueda.trim() || undefined,
      habilitado: habilitadoFilter === "si" ? true : habilitadoFilter === "no" ? false : undefined,
      vinculado: vinculadoFilter === "si" ? true : vinculadoFilter === "no" ? false : undefined,
      pagina,
    };
    getListaPreciosConOpcionesAction(params)
      .then((res) => {
        if (cancelled || !res) return;
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
          if (marcaNombre === LISTA_PRECIOS_FILTRO_SIN_VALOR) return next;
          const selected = prev.find((m) => m.nombre === marcaNombre);
          if (marcaNombre && selected && !next.some((m) => m.nombre === marcaNombre)) {
            return [selected, ...next];
          }
          return next;
        });
        setRubrosOptions((prev) => {
          const next = res.rubrosDisponibles;
          if (rubroNombre === LISTA_PRECIOS_FILTRO_SIN_VALOR) return next;
          const selected = prev.find((r) => r.nombre === rubroNombre);
          if (rubroNombre && selected && !next.some((r) => r.nombre === rubroNombre)) {
            return [selected, ...next];
          }
          return next;
        });
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Error al cargar la lista de precios.");
        setFilasData([]);
        setTotal(0);
        setTotalPaginas(1);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    hasFilterActive,
    proveedorId,
    marcaNombre,
    rubroNombre,
    habilitadoFilter,
    vinculadoFilter,
    busqueda,
    pagina,
    reloadNonce,
  ]);

  useEffect(() => {
    onFiltrosExportSnapshotChange?.({
      hasFilterActive,
      total: hasFilterActive ? total : 0,
      filtros: hasFilterActive
        ? {
            proveedorId: proveedorId || undefined,
            marcaNombre: marcaNombre || undefined,
            rubroNombre: rubroNombre || undefined,
            busqueda: busqueda.trim() || undefined,
            habilitado:
              habilitadoFilter === "si" ? true : habilitadoFilter === "no" ? false : undefined,
            vinculado:
              vinculadoFilter === "si" ? true : vinculadoFilter === "no" ? false : undefined,
          }
        : null,
    });
  }, [
    hasFilterActive,
    proveedorId,
    marcaNombre,
    rubroNombre,
    habilitadoFilter,
    vinculadoFilter,
    busqueda,
    total,
    onFiltrosExportSnapshotChange,
  ]);

  const filteredFilas = filasData;

  function limpiarFiltros() {
    setProveedorId("");
    setMarcaNombre("");
    setRubroNombre("");
    setHabilitadoFilter("");
    setVinculadoFilter("");
    setQ("");
    setBusqueda("");
    setPagina(1);
    setLoading(false);
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-0.5">
      <FilterBar className="filtros-contenedor-tienda bg-card">
        <FilterRowSelection>
          <FilaFiltrosDesplegables>
            <FiltroIndividualContainer
              className={FILTER_SELECT_WRAPPER_CLASS}
              activo={Boolean(proveedorId)}
              onLimpiar={() => cambiarProveedor("")}
            >
              <Select value={proveedorId ?? ""} onValueChange={cambiarProveedor}>
                <SelectTrigger id="filtro-proveedor" className="input-filtro-unificado">
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
              onLimpiar={() => cambiarMarca("")}
            >
              <Select value={marcaNombre ?? ""} onValueChange={cambiarMarca}>
                <SelectTrigger id="filtro-marca" className="input-filtro-unificado">
                  <SelectValue placeholder="MARCA" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  <SelectItem value={LISTA_PRECIOS_FILTRO_SIN_VALOR}>
                    {LISTA_PRECIOS_FILTRO_SIN_VALOR_LABEL}
                  </SelectItem>
                  {marcasOptions.map((m) => (
                    <SelectItem key={m.id} value={m.nombre}>
                      {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FiltroIndividualContainer>
            <FiltroIndividualContainer
              className={FILTER_SELECT_WRAPPER_CLASS}
              activo={Boolean(rubroNombre)}
              onLimpiar={() => cambiarRubro("")}
            >
              <Select value={rubroNombre ?? ""} onValueChange={cambiarRubro}>
                <SelectTrigger id="filtro-rubro" className="input-filtro-unificado">
                  <SelectValue placeholder="RUBRO" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  <SelectItem value={LISTA_PRECIOS_FILTRO_SIN_VALOR}>
                    {LISTA_PRECIOS_FILTRO_SIN_VALOR_LABEL}
                  </SelectItem>
                  {rubrosOptions.map((r) => (
                    <SelectItem key={r.id} value={r.nombre}>
                      {r.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FiltroIndividualContainer>
            <FiltroIndividualContainer
              className={FILTER_SELECT_WRAPPER_CLASS}
              activo={habilitadoFilter === "si" || habilitadoFilter === "no"}
              onLimpiar={() => cambiarHabilitado("")}
            >
              <Select value={habilitadoFilter ?? ""} onValueChange={cambiarHabilitado}>
                <SelectTrigger id="filtro-habilitado" className="input-filtro-unificado">
                  <SelectValue placeholder="HABILITADO" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  <SelectItem value="si">HABILITADO</SelectItem>
                  <SelectItem value="no">NO HABILITADO</SelectItem>
                </SelectContent>
              </Select>
            </FiltroIndividualContainer>
            <FiltroIndividualContainer
              className={FILTER_SELECT_WRAPPER_CLASS}
              activo={vinculadoFilter === "si" || vinculadoFilter === "no"}
              onLimpiar={() => cambiarVinculado("")}
            >
              <Select value={vinculadoFilter ?? ""} onValueChange={cambiarVinculado}>
                <SelectTrigger id="filtro-vinculado" className="input-filtro-unificado">
                  <SelectValue placeholder="VINCULADO" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  <SelectItem value="si">SI</SelectItem>
                  <SelectItem value="no">NO</SelectItem>
                </SelectContent>
              </Select>
            </FiltroIndividualContainer>
          </FilaFiltrosDesplegables>
        </FilterRowSelection>
        <div className="flex items-center gap-3">
          <FilterRowSearch className="flex-1">
            <FiltroBusquedaInput
              id="filtro-lista-precios-busqueda"
              value={q}
              onChange={handleQChange}
              isDebouncing={isDebouncing}
              inputRef={busquedaInputRef}
              placeholder="BUSCAR POR DESCRIPCIÓN (MÍN. 3 CARACTERES)"
            />
          </FilterRowSearch>
          <LimpiarFiltrosButton onClick={limpiarFiltros} />
          <span className={cn(FILTER_COUNT_CLASS, "ml-auto")}>
            {total.toLocaleString()} PRODUCTO
            {total !== 1 ? "S" : ""}
          </span>
        </div>
      </FilterBar>

      <div className="contenedor-tabla-gestion no-scroll-x">
        <Table variant="compact" scrollX={false} className="tabla-lista-precios-proveedor">
          <colgroup>
            {COL_WIDTHS_PCT.map((pct, i) => (
              <col key={i} style={{ width: `${pct}%` }} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>COD. EXT.</TableHead>
              <TableHead>DESCRIPCION</TableHead>
              <TableHead>MARCA</TableHead>
              <TableHead>RUBRO</TableHead>
              <TableHead className="text-right">PX. FINAL</TableHead>
              <TableHead className="text-center">ACCIONES</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hasFilterActive &&
              !loading &&
              filteredFilas.map((fila) => (
                <TableRow key={fila.id}>
                  <TableCell className="celda-datos celda-mono whitespace-nowrap">
                    {fila.codExt}
                  </TableCell>
                  <TableCell className="celda-datos min-w-0 overflow-hidden text-left">
                    <DescripcionCelda fila={fila} />
                  </TableCell>
                  <TableCell className="celda-datos min-w-0 overflow-hidden">
                    <CeldaTextoTabla valor={fila.marca} />
                  </TableCell>
                  <TableCell className="celda-datos min-w-0 overflow-hidden">
                    <CeldaTextoTabla valor={fila.rubro} />
                  </TableCell>
                  <TableCell
                    className="celda-datos celda-numero celda-destacado text-right whitespace-nowrap"
                    title="Precio compra final sin IVA"
                  >
                    {fmtPrecioTabla(fila.pxCompraFinalSinIva)}
                  </TableCell>
                  <TableCell className="celda-datos celda-datos--accion-relleno-fila p-0">
                    <div
                      className={cn(
                        TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
                        "justify-center gap-0.5"
                      )}
                    >
                      <DescuentosListaPreciosCelda
                        fila={fila}
                        puedeEditar={puedeEdicionMasiva}
                        onAbrir={() => abrirDescuentos(fila)}
                      />
                      {puedeEdicionMasiva ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                            aria-label={`Editar ${fila.codExt}`}
                            onClick={() => {
                              setFilaEdit(fila);
                              setEditOpen(true);
                            }}
                          >
                            <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                            aria-label={
                              fila.precioRex
                                ? `Cambiar vínculo REX de ${fila.codExt}`
                                : `Vincular REX a ${fila.codExt}`
                            }
                            onClick={() => {
                              setFilaVincular(fila);
                              setVincularOpen(true);
                            }}
                          >
                            <Link2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                            aria-label={`Eliminar ${fila.codExt}`}
                            onClick={() => {
                              setFilaEliminar(fila);
                              setEliminarOpen(true);
                            }}
                          >
                            <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                          </Button>
                        </>
                      ) : null}
                    </div>
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
                  colSpan={COL_COUNT}
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

      {puedeEdicionMasiva && (
        <>
          <EdicionMasivaListaPreciosModal
            mode="fila"
            fila={filaEdit}
            open={editOpen}
            onOpenChange={(next) => {
              setEditOpen(next);
              if (!next) setFilaEdit(null);
            }}
            marcas={marcas}
            rubros={rubros}
            onSuccess={onEdicionSuccess}
          />
          <VincularPrecioRexModal
            open={vincularOpen}
            onClose={() => {
              setVincularOpen(false);
              setFilaVincular(null);
            }}
            fila={filaVincular}
            onVinculado={onEdicionSuccess}
          />
          <EliminarListaPrecioModal
            open={eliminarOpen}
            onOpenChange={(next) => {
              setEliminarOpen(next);
              if (!next) setFilaEliminar(null);
            }}
            fila={filaEliminar}
            onSuccess={onEdicionSuccess}
          />
        </>
      )}

      <DescuentosAplicadosListaPreciosModal
        open={descuentosModalOpen}
        onOpenChange={(next) => {
          setDescuentosModalOpen(next);
          if (!next) setFilaDescuentos(null);
        }}
        fila={filaDescuentos}
        puedeEditar={puedeEdicionMasiva}
        onSuccess={onEdicionSuccess}
        onVerRegla={(descuento) => {
          if (filaDescuentos) {
            abrirReglaDescuento(descuento);
          }
        }}
      />

      <ReglaDescuentoItemListaPreciosModal
        open={reglaModalOpen}
        onOpenChange={(next) => {
          setReglaModalOpen(next);
          if (!next) {
            setReglaModalDescuento(null);
          }
        }}
        descuento={reglaModalDescuento}
      />

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
