"use client";

import { useMemo, useState, useTransition } from "react";
import { Link2, Pencil } from "lucide-react";
import { toast } from "sonner";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FilterBar, {
  FILTER_COUNT_CLASS,
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
import SeleccionarCajaCobrosModal from "@/components/vtas-cobros/SeleccionarCajaCobrosModal";
import { guardarCobroPorSucursalDestinoAction } from "@/actions/cobrosPorSucursal";
import { TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type {
  CobrosPorSucursalCajaOption,
  CobrosPorSucursalFila,
  CobrosPorSucursalSucursalCol,
} from "@/services/cobrosPorSucursal.service";

const TH_CLASS = "text-center text-xs font-bold uppercase tracking-wide";

const CELDA_ICON_BTN_CLASS = cn(
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  "h-9 w-9 min-h-9 max-h-9"
);

interface Props {
  filas: CobrosPorSucursalFila[];
  sucursales: CobrosPorSucursalSucursalCol[];
  cajas: CobrosPorSucursalCajaOption[];
  esEditor: boolean;
}

type DestinoModalTarget = {
  pagoId: string;
  entidadId: string;
  sucursalId: string;
  pagoNombre: string;
  entidadNombre: string;
  sucursalNombre: string;
  cajaDestinoId: string | null;
};

export default function CobrosPorSucursalPageClient({
  filas: filasIniciales,
  sucursales,
  cajas,
  esEditor,
}: Props) {
  const [filas, setFilas] = useState(filasIniciales);
  const [filtroPagoId, setFiltroPagoId] = useState("");
  const [filtroEntidadId, setFiltroEntidadId] = useState("");
  const [filtroVinculado, setFiltroVinculado] = useState("");
  const [modalTarget, setModalTarget] = useState<DestinoModalTarget | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
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

  function filaCompletamenteVinculada(fila: CobrosPorSucursalFila): boolean {
    if (sucursales.length === 0) return false;
    return sucursales.every((suc) => Boolean(fila.destinosPorSucursalId[suc.id]));
  }

  const filasFiltradas = useMemo(
    () =>
      filas.filter((f) => {
        if (filtroPagoId && f.pagoId !== filtroPagoId) return false;
        if (filtroEntidadId && f.entidadId !== filtroEntidadId) return false;
        if (filtroVinculado === "si" && !filaCompletamenteVinculada(f)) return false;
        if (filtroVinculado === "no" && filaCompletamenteVinculada(f)) return false;
        return true;
      }),
    [filas, filtroPagoId, filtroEntidadId, filtroVinculado, sucursales]
  );

  const hayFiltros = Boolean(filtroPagoId || filtroEntidadId || filtroVinculado);

  const cajasModal = useMemo(() => {
    if (!modalTarget) return [];
    return cajas.filter((c) => c.entidadId === modalTarget.entidadId);
  }, [cajas, modalTarget]);

  function limpiarFiltros() {
    setFiltroPagoId("");
    setFiltroEntidadId("");
    setFiltroVinculado("");
  }

  function abrirModal(
    fila: CobrosPorSucursalFila,
    suc: CobrosPorSucursalSucursalCol
  ) {
    if (!esEditor || isPending) return;
    setModalTarget({
      pagoId: fila.pagoId,
      entidadId: fila.entidadId,
      sucursalId: suc.id,
      pagoNombre: fila.pagoNombre,
      entidadNombre: fila.entidadNombre,
      sucursalNombre: suc.nombre,
      cajaDestinoId: fila.destinosPorSucursalId[suc.id] ?? null,
    });
  }

  function guardarDestino(cajaDestinoId: string | null) {
    if (!modalTarget || isPending) return;
    const { pagoId, entidadId, sucursalId } = modalTarget;
    const key = `${pagoId}:${entidadId}:${sucursalId}`;
    setPendingKey(key);

    startTransition(async () => {
      const res = await guardarCobroPorSucursalDestinoAction({
        pagoId,
        entidadId,
        sucursalId,
        cajaDestinoId,
      });
      setPendingKey(null);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar.");
        return;
      }
      setFilas((prev) =>
        prev.map((fila) => {
          if (fila.pagoId !== pagoId || fila.entidadId !== entidadId) return fila;
          return {
            ...fila,
            destinosPorSucursalId: {
              ...fila.destinosPorSucursalId,
              [sucursalId]: cajaDestinoId,
            },
          };
        })
      );
      setModalTarget(null);
      toast.success(
        cajaDestinoId ? "Caja vinculada." : "Vínculo de caja eliminado."
      );
    });
  }

  return (
    <>
      <ClassicFilteredTableLayout
        title="VTAS. & COBROS"
        subtitle="Cobros & Cajas"
        contentWidth="full"
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilterRowSelection>
              <FilaFiltrosDesplegables columnas={4}>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtroPagoId)}
                  onLimpiar={() => setFiltroPagoId("")}
                >
                  <Select
                    value={filtroPagoId || undefined}
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
                    value={filtroEntidadId || undefined}
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
                  activo={filtroVinculado === "si" || filtroVinculado === "no"}
                  onLimpiar={() => setFiltroVinculado("")}
                >
                  <Select
                    value={filtroVinculado || undefined}
                    onValueChange={setFiltroVinculado}
                  >
                    <SelectTrigger
                      className={SELECT_TRIGGER_FILTER_CLASS}
                      aria-label="Vinculado"
                    >
                      <SelectValue placeholder="VINCULADO" />
                    </SelectTrigger>
                    <SelectContent
                      className="select-content-filtro"
                      position="popper"
                      side="bottom"
                      align="start"
                    >
                      <SelectItem value="si">SI</SelectItem>
                      <SelectItem value="no">NO</SelectItem>
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
              </FilaFiltrosDesplegables>
              <div className="flex items-center gap-3">
                <p className={FILTER_COUNT_CLASS}>
                  {filasFiltradas.length} / {filas.length}
                </p>
                <LimpiarFiltrosButton disabled={!hayFiltros} onClick={limpiarFiltros} />
              </div>
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
                    FORMA DE PAGO
                  </TableHead>
                  <TableHead className={cn("min-w-[10rem]", TH_CLASS)}>ENTIDAD</TableHead>
                  {sucursales.map((suc) => (
                    <TableHead key={suc.id} className={cn("min-w-[6rem]", TH_CLASS)}>
                      {suc.nombre}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filasFiltradas.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2 + sucursales.length}
                      className="celda-datos text-center text-muted-foreground"
                    >
                      {filas.length === 0
                        ? "No hay combinaciones habilitadas en Cx. Fin. Cobros."
                        : "Ninguna combinación coincide con los filtros."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filasFiltradas.map((fila) => (
                    <TableRow key={`${fila.pagoId}:${fila.entidadId}`}>
                      <TableCell className="celda-datos text-left text-xs font-medium">
                        {fila.pagoNombre}
                      </TableCell>
                      <TableCell className="celda-datos text-center text-xs font-medium">
                        {fila.entidadNombre}
                      </TableCell>
                      {sucursales.map((suc) => {
                        const actual = fila.destinosPorSucursalId[suc.id] ?? null;
                        const cellKey = `${fila.pagoId}:${fila.entidadId}:${suc.id}`;
                        const disabled =
                          !esEditor || (isPending && pendingKey === cellKey);
                        const vinculada = actual != null;
                        return (
                          <TableCell
                            key={suc.id}
                            className="celda-datos celda-datos--accion-relleno-fila"
                          >
                            <div className="flex items-center justify-center">
                              {esEditor ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className={CELDA_ICON_BTN_CLASS}
                                  disabled={disabled}
                                  aria-label={
                                    vinculada
                                      ? `Editar caja destino ${suc.nombre} para ${fila.pagoNombre} ${fila.entidadNombre}`
                                      : `Vincular caja destino ${suc.nombre} para ${fila.pagoNombre} ${fila.entidadNombre}`
                                  }
                                  onClick={() => abrirModal(fila, suc)}
                                >
                                  {vinculada ? (
                                    <Pencil className="h-4 w-4" />
                                  ) : (
                                    <Link2 className="h-4 w-4" />
                                  )}
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {vinculada ? "VINCULADA" : "—"}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </ClassicFilteredTableLayout>

      <SeleccionarCajaCobrosModal
        open={Boolean(modalTarget)}
        onOpenChange={(open) => {
          if (!open && !isPending) setModalTarget(null);
        }}
        contexto={
          modalTarget
            ? `${modalTarget.pagoNombre} · ${modalTarget.entidadNombre} · ${modalTarget.sucursalNombre}`
            : ""
        }
        cajas={cajasModal}
        cajaSeleccionadaId={modalTarget?.cajaDestinoId ?? null}
        pending={isPending}
        onSeleccionar={guardarDestino}
      />
    </>
  );
}
