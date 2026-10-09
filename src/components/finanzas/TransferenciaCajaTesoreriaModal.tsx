"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import MontoArInput from "@/components/shared/MontoArInput";
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
import { crearTransferenciaEntreCajasAction } from "@/actions/tesoreriaMovimientos";
import type { TesoreriaCajaFila } from "@/components/finanzas/TablaTesoreriaCajas";
import {
  compararCajasTesoreriaListado,
  etiquetaTipoCajaEnPantalla,
} from "@/lib/cajasTesoreriaTipos";
import { montoArNormalizedStringToPesosIntRounded } from "@/lib/montoArMask";
import { fmtPrecio } from "@/lib/format";
import { leerUsuarioSesion } from "@/lib/usuarioSesion";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Caja origen (fila desde la que se abrió el modal). */
  caja: TesoreriaCajaFila | null;
  /** Todas las cajas; destino = cualquiera menos la origen. */
  cajas: TesoreriaCajaFila[];
  onTransferred?: () => void;
}

function etiquetaCajaFila(caja: TesoreriaCajaFila): string {
  return [
    etiquetaTipoCajaEnPantalla(caja.tipoCaja),
    caja.entidadNombre,
    caja.sucursalNombre,
    caja.titular,
  ]
    .filter((parte) => parte.trim() !== "")
    .join(" - ");
}

export default function TransferenciaCajaTesoreriaModal({
  open,
  onOpenChange,
  caja,
  cajas,
  onTransferred,
}: Props) {
  const [cajaDestinoId, setCajaDestinoId] = useState("");
  const [montoNorm, setMontoNorm] = useState("");
  const [observacion, setObservacion] = useState("");
  const [saving, setSaving] = useState(false);

  function cerrar() {
    setCajaDestinoId("");
    setMontoNorm("");
    setObservacion("");
    onOpenChange(false);
  }

  const cajasDestino = useMemo(
    () =>
      caja
        ? cajas.filter((c) => c.id !== caja.id).sort(compararCajasTesoreriaListado)
        : [],
    [caja, cajas]
  );

  const disponible = caja?.montoDisponible ?? 0;
  const monto = useMemo(
    () => montoArNormalizedStringToPesosIntRounded(montoNorm),
    [montoNorm]
  );
  const superaDisponible = monto > disponible;

  const disabledSubmit =
    saving ||
    !caja ||
    !cajaDestinoId ||
    montoNorm.trim() === "" ||
    monto <= 0 ||
    superaDisponible;

  async function handleSubmit() {
    if (!caja || disabledSubmit) return;
    const usuario = leerUsuarioSesion();
    if (!usuario) {
      toast.error("Elegí un usuario en el menú de sesión.");
      return;
    }
    setSaving(true);
    try {
      const sucursalCodigo = usuario.sucursalPorDefecto;
      const res = await crearTransferenciaEntreCajasAction({
        cajaOrigenId: caja.id,
        cajaDestinoId,
        monto,
        personalId: usuario.idPersonal,
        observacion,
        ...(sucursalCodigo ? { sucursalCodigo } : {}),
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo registrar la transferencia.");
        return;
      }
      toast.success("Transferencia registrada.");
      cerrar();
      onTransferred?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        if (next) onOpenChange(true);
        else cerrar();
      }}
    >
      <AppModal
        title="TRANSFERENCIA"
        size="sm"
        className="max-w-lg"
        actions={
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={cerrar}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={disabledSubmit} onClick={handleSubmit}>
              Transferir
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <ModalMicroLabel>CAJA ORIGEN</ModalMicroLabel>
            <Input value={caja ? etiquetaCajaFila(caja) : ""} disabled readOnly />
            <span className="text-xs text-muted-foreground">
              Disponible: ${fmtPrecio(disponible)}
            </span>
          </label>

          <div className="flex flex-col gap-1.5">
            <ModalMicroLabel>CAJA DESTINO</ModalMicroLabel>
            <Select
              value={cajaDestinoId || undefined}
              onValueChange={setCajaDestinoId}
              disabled={saving}
            >
              <SelectTrigger
                className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                aria-label="Caja destino"
              >
                <SelectValue placeholder="Seleccionar caja" />
              </SelectTrigger>
              <SelectContent>
                {cajasDestino.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {etiquetaCajaFila(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex flex-col gap-1.5">
            <ModalMicroLabel>MONTO</ModalMicroLabel>
            <MontoArInput
              valueNormalized={montoNorm}
              onValueNormalizedChange={setMontoNorm}
              treatEmptyNormalizedAsBlank
              disabled={saving}
              aria-label="Monto a transferir"
            />
            {superaDisponible ? (
              <span className="text-xs text-destructive">
                El monto supera el disponible de la caja origen.
              </span>
            ) : null}
          </label>

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
