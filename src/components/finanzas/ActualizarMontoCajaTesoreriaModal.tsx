"use client";

import { useEffect, useMemo, useState } from "react";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MontoArInput from "@/components/shared/MontoArInput";
import { editarCajaTesoreriaAction } from "@/actions/cajasTesoreria";
import type { TesoreriaCajaFila } from "@/components/finanzas/TablaTesoreriaCajas";
import { montoArNormalizedStringToPesosIntRounded } from "@/lib/montoArMask";

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

  useEffect(() => {
    if (!open) {
      setMontoNorm("");
      return;
    }
    if (!caja) return;
    setMontoNorm("");
  }, [open, caja]);

  const parsedMonto = useMemo(() => montoArNormalizedStringToPesosIntRounded(montoNorm), [montoNorm]);

  const disabledSubmit = useMemo(
    () =>
      saving ||
      !caja ||
      montoNorm.trim() === "" ||
      parsedMonto === caja.monto,
    [saving, caja, montoNorm, parsedMonto]
  );

  async function handleSubmit() {
    if (!caja || disabledSubmit) return;
    setSaving(true);
    try {
      const res = await editarCajaTesoreriaAction({
        id: caja.id,
        entidadId: caja.entidadId,
        titular: caja.titular,
        sucursalId: caja.sucursalId,
        tipoCaja: caja.tipoCaja,
        tipoValor: caja.tipoValor,
        monto: parsedMonto,
      });

      if (!res.ok) {
        toast.error(res.error ?? "No se pudo actualizar el monto.");
        return;
      }

      toast.success("Monto actualizado correctamente.");
      onOpenChange(false);
      onUpdated?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!saving ? onOpenChange(next) : undefined)}>
      <AppModal
        title="Actualizar Monto"
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
              aria-label="Monto de la caja"
            />
          </label>
        </div>
      </AppModal>
    </Dialog>
  );
}
