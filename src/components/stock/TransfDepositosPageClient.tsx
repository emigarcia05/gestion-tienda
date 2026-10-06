"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ArrowRightLeft, Eye, PackageCheck, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import FilterBar, {
  FILTER_SELECT_WRAPPER_CLASS,
  FiltroIndividualContainer,
  FilaFiltrosDesplegables,
  FilterRowSearch,
  FilterRowSelection,
  LimpiarFiltrosButton,
} from "@/components/FilterBar";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import PaginacionClient from "@/components/shared/PaginacionClient";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import CrearTransferenciaModal from "@/components/stock/CrearTransferenciaModal";
import StockTransferenciaModal from "@/components/stock/StockTransferenciaModal";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EmptyTableRow,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { matchByMultiTerm } from "@/lib/busqueda";
import { formatCantidadInputValor } from "@/lib/cantidadUnDecimal";
import { formatInstanteDdMmYyyyHhMmArgentina } from "@/lib/fechaArgentina";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import { PAGE_SIZE } from "@/lib/pagination";
import { estaAbiertaTransferencia } from "@/lib/stockTransferenciaNumero";
import {
  eliminarTransferenciaApi,
  EVENTO_NOTIFICACIONES_REFRESCAR,
  listarTransferenciasApi,
  obtenerTransferenciaApi,
  pedirRefrescoNotificaciones,
} from "@/lib/stockTransferenciasClient";
import type { BorradorTransfDepositos } from "@/lib/transfDepositosControl";
import type { SucursalTransf } from "@/lib/transfDepositosTypes";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import {
  EVENTO_USUARIO_SESION,
  leerUsuarioSesion,
  type UsuarioSesion,
} from "@/lib/usuarioSesion";
import { cn } from "@/lib/utils";
import type { StockTransferenciaHistorialFila } from "@/services/stockTransferencias.service";

const ESTADOS_FILTRO = [
  { value: "todos", label: "TODOS" },
  { value: "EMITIDO_PENDIENTE", label: "EMITIDO, PENDIENTE DE ACEPTACIÓN" },
  { value: "RECTIFICADO_PENDIENTE", label: "RECTIFICACION PENDIENTE DE ACEPTACION" },
  { value: "ACEPTADA", label: "ACEPTADO" },
  { value: "CANCELADA", label: "ELIMINADA" },
] as const;

type EstadoFiltro = (typeof ESTADOS_FILTRO)[number]["value"];

type ModalDetalle = {
  id: string;
  soloLectura: boolean;
};

type ModalEditar = {
  id: string;
  origen: SucursalTransf;
  destino: SucursalTransf;
  cantidades: BorradorTransfDepositos;
};

function esSucursalTransf(value: string): value is SucursalTransf {
  return value === "guaymallen" || value === "maipu";
}

function coincideEstado(
  fila: StockTransferenciaHistorialFila,
  filtro: EstadoFiltro
): boolean {
  if (filtro === "todos") return true;
  if (filtro === "CANCELADA") {
    return fila.estado === "CANCELADA" || fila.estado === "RECHAZADA";
  }
  return fila.estado === filtro;
}

/**
 * Historial de transferencias internas. El catálogo vive en **Crear Transferencia**.
 */
export default function TransfDepositosPageClient() {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [filas, setFilas] = useState<StockTransferenciaHistorialFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<EstadoFiltro>("todos");
  const [pagina, setPagina] = useState(1);
  const [crearOpen, setCrearOpen] = useState(false);
  const [detalle, setDetalle] = useState<ModalDetalle | null>(null);
  const [editar, setEditar] = useState<ModalEditar | null>(null);
  const [eliminarId, setEliminarId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [isPending, startTransition] = useTransition();

  const { q, setQ, ref, handleQChange, isDebouncing } = useFiltrosConBusqueda({
    qActual: "",
    debounceMs: 200,
    onDebouncedSearch: () => undefined,
  });

  const syncUsuario = useCallback(() => {
    setUsuario(leerUsuarioSesion());
  }, []);

  const cargar = useCallback(async () => {
    const sesion = leerUsuarioSesion();
    if (!sesion) {
      setFilas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const res = await listarTransferenciasApi(sesion.sucursalPorDefecto);
    if (!res.ok) {
      toast.error(res.error);
      setFilas([]);
      setCargando(false);
      return;
    }
    setFilas(res.data);
    setCargando(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      syncUsuario();
    });
    window.addEventListener(EVENTO_USUARIO_SESION, syncUsuario);
    return () => window.removeEventListener(EVENTO_USUARIO_SESION, syncUsuario);
  }, [syncUsuario]);

  useEffect(() => {
    queueMicrotask(() => {
      void cargar();
    });
  }, [cargar, usuario?.idPersonal, usuario?.sucursalPorDefecto]);

  useEffect(() => {
    function onRefresco() {
      void cargar();
    }
    window.addEventListener(EVENTO_NOTIFICACIONES_REFRESCAR, onRefresco);
    return () => window.removeEventListener(EVENTO_NOTIFICACIONES_REFRESCAR, onRefresco);
  }, [cargar]);

  const filtradas = useMemo(() => {
    return filas.filter((fila) => {
      if (!coincideEstado(fila, filtroEstado)) return false;
      return matchByMultiTerm(
        [
          fila.numeroEtiqueta,
          fila.origenNombre,
          fila.destinoNombre,
          fila.estadoEtiqueta,
        ],
        q
      );
    });
  }, [filas, filtroEstado, q]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const paginaSafe = Math.min(pagina, totalPaginas);
  const paginaFilas = filtradas.slice(
    (paginaSafe - 1) * PAGE_SIZE,
    paginaSafe * PAGE_SIZE
  );

  function limpiarFiltros() {
    setQ("");
    setFiltroEstado("todos");
    setPagina(1);
  }

  function abrirVer(id: string) {
    setDetalle({ id, soloLectura: true });
  }

  function abrirRecepcion(id: string) {
    setDetalle({ id, soloLectura: false });
  }

  function abrirEditar(fila: StockTransferenciaHistorialFila) {
    if (!esSucursalTransf(fila.origenCodigo) || !esSucursalTransf(fila.destinoCodigo)) {
      toast.error("Sucursal de la transferencia no reconocida.");
      return;
    }
    startTransition(async () => {
      const res = await obtenerTransferenciaApi(fila.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const cantidades: BorradorTransfDepositos = {};
      for (const item of res.data.items) {
        if (item.cantidad <= 0) continue;
        cantidades[item.codItem] = {
          cantidad: formatCantidadInputValor(item.cantidad),
          descripcion: item.descripcion,
        };
      }
      setEditar({
        id: fila.id,
        origen: fila.origenCodigo,
        destino: fila.destinoCodigo,
        cantidades,
      });
    });
  }

  function confirmarEliminar() {
    if (!eliminarId || !usuario) return;
    startTransition(async () => {
      const res = await eliminarTransferenciaApi(eliminarId, {
        personalId: usuario.idPersonal,
        motivo: motivo.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Transferencia eliminada.");
      setEliminarId(null);
      setMotivo("");
      pedirRefrescoNotificaciones();
      void cargar();
    });
  }

  const filters = (
    <FilterBar className="filtros-contenedor-tienda bg-card">
      <FilterRowSelection>
        <FilaFiltrosDesplegables columnas={4}>
          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={filtroEstado !== "todos"}
            onLimpiar={() => {
              setFiltroEstado("todos");
              setPagina(1);
            }}
          >
            <Select
              value={filtroEstado}
              onValueChange={(v) => {
                setFiltroEstado(v as EstadoFiltro);
                setPagina(1);
              }}
            >
              <SelectTrigger id="filtro-transf-historial-estado" className="input-filtro-unificado">
                <SelectValue placeholder="ESTADO" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
                {ESTADOS_FILTRO.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
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
            id="filtro-transf-historial-busqueda"
            placeholder="BUSCAR POR N°, SUCURSAL O ESTADO..."
            value={q}
            onChange={(value) => {
              handleQChange(value);
              setPagina(1);
            }}
            isDebouncing={isDebouncing}
            inputRef={ref}
          />
        </FilterRowSearch>
        <LimpiarFiltrosButton onClick={limpiarFiltros} />
      </div>
    </FilterBar>
  );

  return (
    <>
      <ClassicFilteredTableLayout
        title="Stock"
        subtitle="Trans. Depósitos"
        filters={filters}
        actions={
          <Button
            type="button"
            className="h-10 px-4"
            onClick={() => setCrearOpen(true)}
          >
            <ArrowRightLeft className="h-4 w-4 shrink-0" aria-hidden />
            Crear Transferencia
          </Button>
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-0.5">
          <div className="contenedor-tabla-gestion no-scroll-x min-h-0 flex-1">
            <Table variant="compact">
              <colgroup>
                <col style={{ width: "18%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "27%" }} />
                <col style={{ width: "15%" }} />
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>FECHA</TableHead>
                  <TableHead>SUC. ORIGEN</TableHead>
                  <TableHead>SUC. DESTINO</TableHead>
                  <TableHead>ESTADO</TableHead>
                  <TableHead className="text-center">ACCIONES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!usuario ? (
                  <EmptyTableRow colSpan={5} message="Elegí un usuario para ver el historial." />
                ) : cargando ? (
                  <EmptyTableRow colSpan={5} message="Cargando…" />
                ) : paginaFilas.length === 0 ? (
                  <EmptyTableRow colSpan={5} message="Sin transferencias." />
                ) : (
                  paginaFilas.map((fila) => {
                    const abierta = estaAbiertaTransferencia(fila.estado);
                    const sucursal = usuario.sucursalPorDefecto;
                    const puedeRecepcionar = abierta && sucursal === fila.confirmaCodigo;
                    const esCreadora = abierta && sucursal === fila.creadoraCodigo;
                    return (
                      <TableRow key={fila.id}>
                        <TableCell className="celda-datos">
                          <div className="flex flex-col gap-0.5">
                            <span className="tabular-nums">
                              {formatInstanteDdMmYyyyHhMmArgentina(new Date(fila.createdAtIso))}
                            </span>
                            <span className="text-muted-foreground">N° {fila.numeroEtiqueta}</span>
                          </div>
                        </TableCell>
                        <TableCell className="celda-datos min-w-0 truncate" title={fila.origenNombre}>
                          {fila.origenNombre}
                        </TableCell>
                        <TableCell className="celda-datos min-w-0 truncate" title={fila.destinoNombre}>
                          {fila.destinoNombre}
                        </TableCell>
                        <TableCell className="celda-datos min-w-0" title={fila.estadoEtiqueta}>
                          {fila.estadoEtiqueta}
                        </TableCell>
                        <TableCell className="celda-datos celda-datos--accion-relleno-fila">
                          <div className={cn(TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS, "gap-2")}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => abrirVer(fila.id)}
                                  aria-label="Ver"
                                  className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                >
                                  <Eye className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Ver</TooltipContent>
                            </Tooltip>
                            {puedeRecepcionar ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => abrirRecepcion(fila.id)}
                                    aria-label="Recepcionar"
                                    className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                  >
                                    <PackageCheck className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Recepcionar</TooltipContent>
                              </Tooltip>
                            ) : null}
                            {esCreadora ? (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => abrirEditar(fila)}
                                      aria-label="Editar"
                                      disabled={isPending}
                                      className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                    >
                                      <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">Editar</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setEliminarId(fila.id);
                                        setMotivo("");
                                      }}
                                      aria-label="Eliminar"
                                      className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                    >
                                      <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">Eliminar</TooltipContent>
                                </Tooltip>
                              </>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {usuario && !cargando && filtradas.length > PAGE_SIZE ? (
            <div className="flex shrink-0 justify-end pt-2">
              <PaginacionClient
                paginaActual={paginaSafe}
                totalPaginas={totalPaginas}
                onPaginaChange={setPagina}
              />
            </div>
          ) : null}
        </div>
      </ClassicFilteredTableLayout>

      <CrearTransferenciaModal
        open={crearOpen}
        onOpenChange={setCrearOpen}
        modo="crear"
        onGuardada={() => {
          void cargar();
        }}
      />

      {editar ? (
        <CrearTransferenciaModal
          open
          onOpenChange={(next) => {
            if (!next) setEditar(null);
          }}
          modo="editar"
          transferenciaId={editar.id}
          origenInicial={editar.origen}
          destinoInicial={editar.destino}
          cantidadesIniciales={editar.cantidades}
          onGuardada={() => {
            setEditar(null);
            void cargar();
          }}
        />
      ) : null}

      {detalle && usuario ? (
        <StockTransferenciaModal
          open
          onOpenChange={(next) => {
            if (!next) setDetalle(null);
          }}
          transferenciaId={detalle.id}
          usuario={usuario}
          soloLectura={detalle.soloLectura}
          onResuelta={() => {
            setDetalle(null);
            void cargar();
          }}
        />
      ) : null}

      <Dialog
        open={eliminarId != null}
        onOpenChange={(next) => {
          if (!next) {
            setEliminarId(null);
            setMotivo("");
          }
        }}
      >
        <AppModal
          title="ELIMINAR TRANSFERENCIA"
          size="sm"
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEliminarId(null);
                  setMotivo("");
                }}
                disabled={isPending}
              >
                Cerrar
              </Button>
              <Button type="button" onClick={confirmarEliminar} disabled={isPending}>
                Confirmar Eliminación
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-2">
            <ModalMicroLabel>MOTIVO DE LA ELIMINACIÓN (OPCIONAL)</ModalMicroLabel>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={500}
            />
          </div>
        </AppModal>
      </Dialog>
    </>
  );
}
