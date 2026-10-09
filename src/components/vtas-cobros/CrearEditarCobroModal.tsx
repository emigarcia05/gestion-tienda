"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import ModalSiNoChoice from "@/components/shared/ModalSiNoChoice";
import { Button } from "@/components/ui/button";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  actualizarCobroPorSucursalAction,
  crearCobroPorSucursalAction,
} from "@/actions/cobrosPorSucursal";
import { cn } from "@/lib/utils";
import type {
  CobrosPorSucursalCajaOption,
  CobrosPorSucursalCatalogoItem,
  CobrosPorSucursalFila,
  CobrosPorSucursalPagoCatalogo,
  CobrosPorSucursalSucursalCol,
  CobrosPorSucursalVinculoPagoEntidad,
} from "@/services/cobrosPorSucursal.service";

export type CrearEditarCobroModalMode = "crear" | "editar";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: CrearEditarCobroModalMode;
  fila?: CobrosPorSucursalFila | null;
  pagos: CobrosPorSucursalPagoCatalogo[];
  entidades: CobrosPorSucursalCatalogoItem[];
  vinculosPagoEntidad: CobrosPorSucursalVinculoPagoEntidad[];
  cajas: CobrosPorSucursalCajaOption[];
  sucursales: CobrosPorSucursalSucursalCol[];
  onSaved: (fila: CobrosPorSucursalFila) => void;
}

export default function CrearEditarCobroModal({
  open,
  onOpenChange,
  mode,
  fila,
  pagos,
  entidades,
  vinculosPagoEntidad,
  cajas,
  sucursales,
  onSaved,
}: Props) {
  const [pagoId, setPagoId] = useState("");
  const [entidadId, setEntidadId] = useState("");
  const [sucursalId, setSucursalId] = useState("");
  const [cajaDestinoId, setCajaDestinoId] = useState("");
  const [discriminaIva, setDiscriminaIva] = useState(false);
  const [observacion, setObservacion] = useState("");
  const [saving, setSaving] = useState(false);

  const esEditar = mode === "editar";
  const muestraEntidad = vinculosPagoEntidad.some((v) => v.pagoId === pagoId);

  useEffect(() => {
    if (!open) return;
    if (esEditar && fila) {
      setPagoId(fila.pagoId);
      setEntidadId(fila.entidadId ?? "");
      setSucursalId(fila.sucursalId);
      setCajaDestinoId(fila.cajaDestinoId ?? "");
      setDiscriminaIva(fila.discriminaIva);
      setObservacion(fila.observacion);
      return;
    }
    setPagoId("");
    setEntidadId("");
    setSucursalId("");
    setCajaDestinoId("");
    setDiscriminaIva(false);
    setObservacion("");
  }, [open, esEditar, fila]);

  const entidadesDisponibles = useMemo(() => {
    if (!pagoId) return [];
    const ids = new Set(
      vinculosPagoEntidad
        .filter((v) => v.pagoId === pagoId)
        .map((v) => v.entidadId)
    );
    return entidades.filter((e) => ids.has(e.id));
  }, [pagoId, entidades, vinculosPagoEntidad]);

  const cajasDisponibles = useMemo(() => {
    if (!pagoId) return [];
    const esCheque = pagos.some((p) => p.id === pagoId && p.esCheque);
    return esCheque ? cajas.filter((c) => c.recibeCheque) : cajas;
  }, [cajas, pagos, pagoId]);

  useEffect(() => {
    if (!open || !muestraEntidad) return;
    if (entidadId && !entidadesDisponibles.some((e) => e.id === entidadId)) {
      setEntidadId("");
      setCajaDestinoId("");
    }
  }, [open, muestraEntidad, entidadId, entidadesDisponibles]);

  useEffect(() => {
    if (!open) return;
    if (cajaDestinoId && !cajasDisponibles.some((c) => c.id === cajaDestinoId)) {
      setCajaDestinoId("");
    }
  }, [open, cajaDestinoId, cajasDisponibles]);

  const cajaLista =
    !saving &&
    pagoId.trim().length > 0 &&
    sucursalId.trim().length > 0 &&
    (!muestraEntidad || entidadId.trim().length > 0);
  const disabledSubmit =
    saving ||
    pagoId.trim().length === 0 ||
    (muestraEntidad && entidadId.trim().length === 0) ||
    sucursalId.trim().length === 0 ||
    cajaDestinoId.trim().length === 0;

  async function handleSubmit() {
    if (disabledSubmit) return;
    setSaving(true);
    try {
      const res = esEditar && fila
        ? await actualizarCobroPorSucursalAction({
            id: fila.id,
            cajaDestinoId,
            discriminaIva,
            observacion,
          })
        : await crearCobroPorSucursalAction({
            pagoId,
            entidadId: muestraEntidad ? entidadId : null,
            sucursalId,
            cajaDestinoId,
            discriminaIva,
            observacion,
          });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar el cobro.");
        return;
      }
      toast.success(esEditar ? "Cobro actualizado." : "Cobro creado.");
      onSaved(res.data);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange(next);
      }}
    >
      <AppModal
        title={esEditar ? "EDITAR COBRO" : "CREAR COBRO"}
        size="md"
        actions={
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={disabledSubmit}
              onClick={() => void handleSubmit()}
            >
              {esEditar ? "Guardar" : "Crear"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <ModalMicroLabel>FORMA DE PAGO</ModalMicroLabel>
            <Select
              value={pagoId || undefined}
              onValueChange={(value) => {
                setPagoId(value);
                setEntidadId("");
                setSucursalId("");
                setCajaDestinoId("");
              }}
              disabled={saving || esEditar}
            >
              <SelectTrigger
                className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                aria-label="Forma de pago"
              >
                <SelectValue placeholder="Seleccionar forma de pago" />
              </SelectTrigger>
              <SelectContent>
                {pagos.map((pago) => (
                  <SelectItem key={pago.id} value={pago.id}>
                    {pago.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {muestraEntidad ? (
            <div className="flex flex-col gap-1.5">
              <ModalMicroLabel>ENTIDAD</ModalMicroLabel>
              <Select
                value={entidadId || undefined}
                onValueChange={(value) => {
                  setEntidadId(value);
                  setCajaDestinoId("");
                }}
                disabled={saving || esEditar || !pagoId}
              >
                <SelectTrigger
                  className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                  aria-label="Entidad"
                >
                  <SelectValue placeholder="Seleccionar entidad" />
                </SelectTrigger>
                <SelectContent>
                  {entidadesDisponibles.map((entidad) => (
                    <SelectItem key={entidad.id} value={entidad.id}>
                      {entidad.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <ModalMicroLabel>SUCURSAL</ModalMicroLabel>
            <Select
              value={sucursalId || undefined}
              onValueChange={setSucursalId}
              disabled={saving || esEditar}
            >
              <SelectTrigger
                className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                aria-label="Sucursal"
              >
                <SelectValue placeholder="Seleccionar sucursal" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                {sucursales.map((sucursal) => (
                  <SelectItem key={sucursal.id} value={sucursal.id}>
                    {sucursal.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <ModalMicroLabel>CAJA VINCULADA</ModalMicroLabel>
            <Select
              value={cajaDestinoId || undefined}
              onValueChange={setCajaDestinoId}
              disabled={!cajaLista}
            >
              <SelectTrigger
                className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                aria-label="Caja vinculada"
              >
                <SelectValue placeholder="Seleccionar caja" />
              </SelectTrigger>
              <SelectContent>
                {cajasDisponibles.map((caja) => (
                  <SelectItem key={caja.id} value={caja.id}>
                    {caja.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ModalSiNoChoice
            label="DISCRIMINA IVA"
            value={discriminaIva}
            onChange={setDiscriminaIva}
            disabled={saving}
          />

          <div className="flex flex-col gap-1.5">
            <ModalMicroLabel>OBSERVACIÓN</ModalMicroLabel>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              disabled={saving}
              rows={3}
              maxLength={2000}
              placeholder="Texto libre…"
              aria-label="Observación"
              className={cn(
                "min-h-[4.5rem] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            />
          </div>
        </div>
      </AppModal>
    </Dialog>
  );
}
