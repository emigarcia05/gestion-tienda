"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import ModalSiNoChoice from "@/components/shared/ModalSiNoChoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  CobrosPorSucursalTitularOption,
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
  titulares: CobrosPorSucursalTitularOption[];
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
  titulares,
  onSaved,
}: Props) {
  const [pagoId, setPagoId] = useState("");
  const [entidadId, setEntidadId] = useState("");
  const [sucursalId, setSucursalId] = useState("");
  const [cajaDestinoId, setCajaDestinoId] = useState("");
  const [generaIvaCredito, setGeneraIvaCredito] = useState(false);
  const [seguimientoFiscal, setSeguimientoFiscal] = useState(false);
  const [titularId, setTitularId] = useState("");
  const [esCheque, setEsCheque] = useState(false);
  const [alias, setAlias] = useState("");
  const [observacion, setObservacion] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const esEditar = mode === "editar";
  const muestraEntidad = vinculosPagoEntidad.some((v) => v.pagoId === pagoId);
  const pagoUsaAlias = pagos.some((p) => p.id === pagoId && p.alias);

  useEffect(() => {
    if (!open) return;
    if (esEditar && fila) {
      setPagoId(fila.pagoId);
      setEntidadId(fila.entidadId ?? "");
      setSucursalId(fila.sucursalId);
      setCajaDestinoId(fila.cajaDestinoId ?? "");
      setGeneraIvaCredito(fila.generaIvaCredito);
      setSeguimientoFiscal(fila.seguimientoFiscal);
      setTitularId(fila.titularId ?? "");
      setEsCheque(fila.esCheque);
      setAlias(fila.alias ?? "");
      setObservacion(fila.observacion);
      return;
    }
    setPagoId("");
    setEntidadId("");
    setSucursalId("");
    setCajaDestinoId("");
    setGeneraIvaCredito(false);
    setSeguimientoFiscal(false);
    setTitularId("");
    setEsCheque(false);
    setAlias("");
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

  const titularesDisponibles = useMemo(
    () => titulares.filter((t) => t.tienePtoVta || t.id === titularId),
    [titulares, titularId]
  );

  const cajasDisponibles = useMemo(() => {
    if (!pagoId) return [];
    return esCheque ? cajas.filter((c) => c.recibeCheque) : cajas;
  }, [cajas, esCheque, pagoId]);

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
    cajaDestinoId.trim().length === 0 ||
    (seguimientoFiscal && titularId.length === 0) ||
    (pagoUsaAlias && alias.trim().length === 0);

  async function handleSubmit() {
    if (disabledSubmit) return;
    setSaving(true);
    try {
      const res = esEditar && fila
        ? await actualizarCobroPorSucursalAction({
            id: fila.id,
            cajaDestinoId,
            generaIvaCredito,
            seguimientoFiscal,
            titularId: seguimientoFiscal ? titularId : null,
            esCheque,
            alias: pagoUsaAlias ? alias : "",
            observacion,
          })
        : await crearCobroPorSucursalAction({
            pagoId,
            entidadId: muestraEntidad ? entidadId : null,
            sucursalId,
            cajaDestinoId,
            generaIvaCredito,
            seguimientoFiscal,
            titularId: seguimientoFiscal ? titularId : null,
            esCheque,
            alias: pagoUsaAlias ? alias : "",
            observacion,
          });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar el cobro.");
        return;
      }
      toast.success(esEditar ? "Cobro actualizado." : "Cobro creado.");
      onSaved(res.data);
      router.refresh();
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
                setEsCheque(false);
                setAlias("");
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

          <div className="flex flex-col gap-1.5">
            <ModalMicroLabel>ALIAS</ModalMicroLabel>
            <Input
              value={pagoUsaAlias ? alias : ""}
              onChange={(e) => setAlias(e.target.value)}
              disabled={saving || !pagoUsaAlias}
              required={pagoUsaAlias}
              aria-required={pagoUsaAlias}
              maxLength={100}
              placeholder={
                pagoUsaAlias ? "Obligatorio" : "La forma de pago no usa alias"
              }
              aria-label="Alias"
            />
          </div>

          <ModalSiNoChoice
            label="ES CHEQUE"
            value={esCheque}
            onChange={setEsCheque}
            disabled={saving || !pagoId}
          />

          <ModalSiNoChoice
            label="IVA CRED."
            value={generaIvaCredito}
            onChange={setGeneraIvaCredito}
            disabled={saving}
          />

          <ModalSiNoChoice
            label="SEGUIMIENTO FISCAL"
            value={seguimientoFiscal}
            onChange={(value) => {
              setSeguimientoFiscal(value);
              if (!value) setTitularId("");
            }}
            disabled={saving}
          />

          {seguimientoFiscal ? (
            <div className="flex flex-col gap-1.5">
              <ModalMicroLabel>TITULAR</ModalMicroLabel>
              <Select
                value={titularId || undefined}
                onValueChange={setTitularId}
                disabled={saving}
              >
                <SelectTrigger
                  className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                  aria-label="Titular"
                >
                  <SelectValue placeholder="Seleccionar titular" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  {titularesDisponibles.map((titular) => (
                    <SelectItem key={titular.id} value={titular.id}>
                      {titular.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

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
