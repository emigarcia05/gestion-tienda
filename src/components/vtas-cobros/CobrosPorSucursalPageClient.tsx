"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import FilterBar, {
  FILTER_COUNT_CLASS,
  FILTER_INLINE_ACTION_SLOT_CLASS,
  FILTER_SELECT_WRAPPER_CLASS,
  FiltroIndividualContainer,
  FilaFiltrosDesplegables,
  FilterRowSelection,
  LimpiarFiltrosButton,
  SELECT_TRIGGER_FILTER_CLASS,
} from "@/components/FilterBar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import CrearEditarCobroModal from "@/components/vtas-cobros/CrearEditarCobroModal";
import { eliminarCobroPorSucursalAction } from "@/actions/cobrosPorSucursal";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type {
  CobrosPorSucursalCajaOption,
  CobrosPorSucursalCatalogoItem,
  CobrosPorSucursalFila,
  CobrosPorSucursalSucursalCol,
  CobrosPorSucursalVinculoPagoEntidad,
} from "@/services/cobrosPorSucursal.service";

const TH_CLASS = "text-center text-xs font-bold uppercase tracking-wide";

interface Props {
  filas: CobrosPorSucursalFila[];
  sucursales: CobrosPorSucursalSucursalCol[];
  cajas: CobrosPorSucursalCajaOption[];
  pagos: CobrosPorSucursalCatalogoItem[];
  entidades: CobrosPorSucursalCatalogoItem[];
  vinculosPagoEntidad: CobrosPorSucursalVinculoPagoEntidad[];
  esEditor: boolean;
}

type ModalState =
  | { open: false }
  | { open: true; mode: "crear" }
  | { open: true; mode: "editar"; fila: CobrosPorSucursalFila };

export default function CobrosPorSucursalPageClient({
  filas: filasIniciales,
  sucursales,
  cajas,
  pagos,
  entidades,
  vinculosPagoEntidad,
  esEditor,
}: Props) {
  const [filas, setFilas] = useState(filasIniciales);
  const [filtroPagoId, setFiltroPagoId] = useState("");
  const [filtroEntidadId, setFiltroEntidadId] = useState("");
  const [filtroSucursalId, setFiltroSucursalId] = useState("");
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [filaBorrar, setFilaBorrar] = useState<CobrosPorSucursalFila | null>(null);
  const [isPending, startTransition] = useTransition();

  const opcionesPago = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of filas) {
      if (!map.has(f.pagoId)) map.set(f.pagoId, f.pagoNombre);
    }
    return [...map.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
  }, [filas]);

  const opcionesEntidad = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of filas) {
      if (!map.has(f.entidadId)) map.set(f.entidadId, f.entidadNombre);
    }
    return [...map.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
  }, [filas]);

  const filasFiltradas = useMemo(
    () =>
      filas.filter((f) => {
        if (filtroPagoId && f.pagoId !== filtroPagoId) return false;
        if (filtroEntidadId && f.entidadId !== filtroEntidadId) return false;
        if (filtroSucursalId && f.sucursalId !== filtroSucursalId) return false;
        return true;
      }),
    [filas, filtroPagoId, filtroEntidadId, filtroSucursalId]
  );

  function limpiarFiltros() {
    setFiltroPagoId("");
    setFiltroEntidadId("");
    setFiltroSucursalId("");
  }

  function handleSaved(fila: CobrosPorSucursalFila) {
    setFilas((prev) => {
      const idx = prev.findIndex((f) => f.id === fila.id);
      if (idx === -1) {
        return [...prev, fila].sort((a, b) => {
          const byPago = a.pagoNombre.localeCompare(b.pagoNombre, "es", {
            sensitivity: "base",
          });
          if (byPago !== 0) return byPago;
          const byEntidad = a.entidadNombre.localeCompare(b.entidadNombre, "es", {
            sensitivity: "base",
          });
          if (byEntidad !== 0) return byEntidad;
          return a.sucursalNombre.localeCompare(b.sucursalNombre, "es", {
            sensitivity: "base",
          });
        });
      }
      const next = [...prev];
      next[idx] = fila;
      return next;
    });
  }

  function confirmarBorrar() {
    if (!filaBorrar || isPending) return;
    const { id } = filaBorrar;
    startTransition(async () => {
      const res = await eliminarCobroPorSucursalAction({ id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar.");
        return;
      }
      setFilas((prev) => prev.filter((f) => f.id !== id));
      setFilaBorrar(null);
      toast.success("Cobro eliminado.");
    });
  }

  return (
    <>
      <ClassicFilteredTableLayout
        title="VTAS. & COBROS"
        subtitle="Cobros & Cajas"
        contentWidth="full"
        actions={
          esEditor ? (
            <ToolbarActionButton
              type="button"
              icon={<Plus aria-hidden />}
              label="Crear Cobro"
              onClick={() => setModal({ open: true, mode: "crear" })}
            />
          ) : undefined
        }
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilterRowSelection>
              <FilaFiltrosDesplegables columnas={5}>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtroPagoId)}
                  onLimpiar={() => setFiltroPagoId("")}
                >
                  <Select
                    value={filtroPagoId ?? ""}
                    onValueChange={setFiltroPagoId}
                  >
                    <SelectTrigger
                      className={SELECT_TRIGGER_FILTER_CLASS}
                      aria-label="Forma de pago"
                    >
                      <SelectValue placeholder="FORMA PAGO" />
                    </SelectTrigger>
                    <SelectContent
                      className="select-content-filtro"
                      position="popper"
                      side="bottom"
                      align="start"
                    >
                      {opcionesPago.map((pago) => (
                        <SelectItem key={pago.id} value={pago.id}>
                          {pago.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtroEntidadId)}
                  onLimpiar={() => setFiltroEntidadId("")}
                >
                  <Select
                    value={filtroEntidadId ?? ""}
                    onValueChange={setFiltroEntidadId}
                  >
                    <SelectTrigger
                      className={SELECT_TRIGGER_FILTER_CLASS}
                      aria-label="Entidad"
                    >
                      <SelectValue placeholder="ENTIDAD" />
                    </SelectTrigger>
                    <SelectContent
                      className="select-content-filtro"
                      position="popper"
                      side="bottom"
                      align="start"
                    >
                      {opcionesEntidad.map((entidad) => (
                        <SelectItem key={entidad.id} value={entidad.id}>
                          {entidad.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtroSucursalId)}
                  onLimpiar={() => setFiltroSucursalId("")}
                >
                  <Select
                    value={filtroSucursalId ?? ""}
                    onValueChange={setFiltroSucursalId}
                  >
                    <SelectTrigger
                      className={SELECT_TRIGGER_FILTER_CLASS}
                      aria-label="Sucursal"
                    >
                      <SelectValue placeholder="SUCURSAL" />
                    </SelectTrigger>
                    <SelectContent
                      className="select-content-filtro"
                      position="popper"
                      side="bottom"
                      align="start"
                    >
                      {sucursales.map((suc) => (
                        <SelectItem key={suc.id} value={suc.id}>
                          {suc.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                <div className={cn(FILTER_INLINE_ACTION_SLOT_CLASS, "col-span-2 gap-2")}>
                  <span className={FILTER_COUNT_CLASS}>
                    {filasFiltradas.length.toLocaleString("es-AR")} COBRO
                    {filasFiltradas.length === 1 ? "" : "S"}
                  </span>
                  <LimpiarFiltrosButton onClick={limpiarFiltros} />
                </div>
              </FilaFiltrosDesplegables>
            </FilterRowSelection>
          </FilterBar>
        }
      >
        <div className="contenedor-tabla-gestion flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
            <Table variant="compact">
              <TableHeader>
                <TableRow>
                  <TableHead className={cn("min-w-[12rem]", TH_CLASS)}>
                    FORMA PAGO
                  </TableHead>
                  <TableHead className={cn("min-w-[10rem]", TH_CLASS)}>ENTIDAD</TableHead>
                  <TableHead className={cn("min-w-[8rem]", TH_CLASS)}>SUCURSAL</TableHead>
                  <TableHead className={cn("min-w-[14rem]", TH_CLASS)}>
                    OBSERVACIÓN
                  </TableHead>
                  {esEditor ? (
                    <TableHead className={cn("min-w-[6rem]", TH_CLASS)}>ACCIONES</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filasFiltradas.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4 + (esEditor ? 1 : 0)}
                      className="celda-datos text-center text-muted-foreground"
                    >
                      {filas.length === 0
                        ? "No hay cobros creados. Usá Crear Cobro en ACCIONES."
                        : "Ninguna combinación coincide con los filtros."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filasFiltradas.map((fila) => (
                    <TableRow key={fila.id}>
                      <TableCell className="celda-datos text-left text-xs font-medium">
                        {fila.pagoNombre}
                      </TableCell>
                      <TableCell className="celda-datos text-center text-xs font-medium">
                        {fila.entidadNombre}
                      </TableCell>
                      <TableCell className="celda-datos text-center text-xs font-medium">
                        {fila.sucursalNombre}
                      </TableCell>
                      <TableCell
                        className="celda-datos text-left text-xs"
                        title={fila.observacion || undefined}
                      >
                        {fila.observacion.trim().length > 0 ? fila.observacion : "—"}
                      </TableCell>
                      {esEditor ? (
                        <TableCell className="celda-datos celda-datos--accion-relleno-fila">
                          <div
                            className={cn(
                              TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
                              "flex-wrap justify-center gap-1"
                            )}
                          >
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              disabled={isPending}
                              aria-label={`Editar cobro ${fila.pagoNombre} ${fila.entidadNombre} ${fila.sucursalNombre}`}
                              title="Editar"
                              onClick={() =>
                                setModal({ open: true, mode: "editar", fila })
                              }
                            >
                              <Pencil
                                className={TABLE_ROW_ACTION_ICON_CLASS}
                                aria-hidden
                              />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              disabled={isPending}
                              aria-label={`Eliminar cobro ${fila.pagoNombre} ${fila.entidadNombre} ${fila.sucursalNombre}`}
                              title="Eliminar"
                              onClick={() => setFilaBorrar(fila)}
                            >
                              <Trash2
                                className={TABLE_ROW_ACTION_ICON_CLASS}
                                aria-hidden
                              />
                            </Button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </ClassicFilteredTableLayout>

      <CrearEditarCobroModal
        open={modal.open}
        onOpenChange={(open) => {
          if (!open) setModal({ open: false });
        }}
        mode={modal.open ? modal.mode : "crear"}
        fila={modal.open && modal.mode === "editar" ? modal.fila : null}
        pagos={pagos}
        entidades={entidades}
        vinculosPagoEntidad={vinculosPagoEntidad}
        cajas={cajas}
        onSaved={handleSaved}
      />

      <Dialog
        open={Boolean(filaBorrar)}
        onOpenChange={(open) => {
          if (!open && !isPending) setFilaBorrar(null);
        }}
      >
        <AppModal
          title="ELIMINAR COBRO"
          size="sm"
          className="max-w-md"
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setFilaBorrar(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isPending || !filaBorrar}
                onClick={() => confirmarBorrar()}
              >
                Eliminar
              </Button>
            </div>
          }
        >
          <p className="text-sm text-muted-foreground">
            ¿Eliminar el cobro{" "}
            <span className="font-semibold text-foreground">
              {filaBorrar?.pagoNombre} · {filaBorrar?.entidadNombre} ·{" "}
              {filaBorrar?.sucursalNombre}
            </span>
            ?
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
