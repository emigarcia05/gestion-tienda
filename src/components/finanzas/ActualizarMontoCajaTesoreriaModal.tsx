"use client";

import { useEffect, useMemo, useState } from "react";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MontoArInput from "@/components/shared/MontoArInput";
import { ajustarMontoCajaTesoreriaAction } from "@/actions/tesoreriaMovimientos";
import type { TesoreriaCajaFila } from "@/components/finanzas/TablaTesoreriaCajas";
import {
  montoArNormalizedStringToPesosIntRounded,
  montoArNumberToNormalizedString,
} from "@/lib/montoArMask";
import { leerUsuarioSesion } from "@/lib/usuarioSesion";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caja: TesoreriaCajaFila | null;
  onUpdated?: () => void;
}

export default function ActualizarMontoCajaTesoreriaModal({
  open,
  onOpenChange,
  caja,
  onUpdated,
}: Props) {
  const [montoNorm, setMontoNorm] = useState("");
  const [saving, setSaving] = useState(false);

  const saldoActual = caja?.montoDisponible ?? 0;

  useEffect(() => {
    if (!open) {
      setMontoNorm("");
      return;
    }
    if (!caja) return;
    setMontoNorm(montoArNumberToNormalizedString(caja.montoDisponible));
  }, [open, caja]);

  const parsedMonto = useMemo(
    () => montoArNormalizedStringToPesosIntRounded(montoNorm),
    [montoNorm]
  );

  const disabledSubmit = useMemo(
    () =>
      saving ||
      !caja ||
      montoNorm.trim() === "" ||
      parsedMonto === saldoActual,
    [saving, caja, montoNorm, parsedMonto, saldoActual]
  );

  async function handleSubmit() {
    if (!caja || disabledSubmit) return;
    setSaving(true);
    try {
      const sucursalCodigo = leerUsuarioSesion()?.sucursalPorDefecto;
      const res = await ajustarMontoCajaTesoreriaAction({
        cajaId: caja.id,
        montoObjetivo: parsedMonto,
        ...(caja.sucursalId ? {} : sucursalCodigo ? { sucursalCodigo } : {}),
      });

      if (!res.ok) {
        toast.error(res.error ?? "No se pudo ajustar el monto.");
        return;
      }

      toast.success("Monto ajustado.");
      onOpenChange(false);
      onUpdated?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!saving ? onOpenChange(next) : undefined)}>
      <AppModal
        title="AJUSTAR MONTO"
        size="sm"
        className="max-w-md"
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
            <Button type="button" disabled={disabledSubmit} onClick={handleSubmit}>
              Guardar
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3">
          <label className="flex flex-col gap-1">
            <ModalMicroLabel>ENTIDAD</ModalMicroLabel>
            <Input value={caja?.entidadNombre ?? ""} disabled readOnly />
          </label>
          <label className="flex flex-col gap-1">
            <ModalMicroLabel>TITULAR</ModalMicroLabel>
            <Input value={caja?.titular ?? ""} disabled readOnly />
          </label>
          <label className="flex flex-col gap-1">
            <ModalMicroLabel>MONTO</ModalMicroLabel>
            <MontoArInput
              valueNormalized={montoNorm}
              onValueNormalizedChange={setMontoNorm}
              treatEmptyNormalizedAsBlank
              disabled={saving}
              aria-label="Monto objetivo de la caja"
            />
          </label>
        </div>
      </AppModal>
    </Dialog>
  );
}
