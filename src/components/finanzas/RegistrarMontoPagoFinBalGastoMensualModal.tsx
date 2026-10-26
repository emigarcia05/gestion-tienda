"use client";

import { useEffect, useMemo, useState } from "react";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Check, Loader2, Repeat2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import MontoArInput from "@/components/shared/MontoArInput";
import {
  editarMontoFinBalGastoMensualAction,
  obtenerMontoMesAnteriorFinBalGastoMensualAction,
  registrarPagoFinBalGastoMensualAction,
} from "@/actions/finBalGastoMensualBalance";
import type { BalanceGastoMensualFila } from "@/services/finBalGastoMensualBalance.service";
import {
  montoArNormalizedStringToPesosIntRounded,
  montoArPesosEnterosToNormalizedString,
} from "@/lib/montoArMask";
import { fmtPrecio } from "@/lib/format";
import {
  esGastoReemplazadoPorLibro,
  MENSAJE_GASTO_REEMPLAZADO_POR_LIBRO,
} from "@/lib/balanceMensualLibros";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fila: BalanceGastoMensualFila | null;
  mes: number;
  anio: number;
  onSuccess?: () => void;
}

export default function RegistrarMontoPagoFinBalGastoMensualModal({
  open,
  onOpenChange,
  fila,
  mes,
  anio,
  onSuccess,
}: Props) {
  const [montoNorm, setMontoNorm] = useState("");
  const [pagadoNorm, setPagadoNorm] = useState("");
  const [saving, setSaving] = useState(false);
  const [ultMonto, setUltMonto] = useState<number | null | undefined>(undefined);
  const [loadingUltMonto, setLoadingUltMonto] = useState(false);
  const [aplicandoRepetir, setAplicandoRepetir] = useState(false);

  useEffect(() => {
    if (!open || !fila) return;
    setMontoNorm(montoArPesosEnterosToNormalizedString(fila.monto));
    setPagadoNorm(montoArPesosEnterosToNormalizedString(fila.pagado));
  }, [open, fila]);

  useEffect(() => {
    if (!open || !fila) {
      setUltMonto(undefined);
      return;
    }
    let cancelled = false;
    setLoadingUltMonto(true);
    setUltMonto(undefined);
    void (async () => {
      const r = await obtenerMontoMesAnteriorFinBalGastoMensualAction({
        gastoFinalId: fila.gastoFinalId,
        mes,
        anio,
      });
      if (cancelled) return;
      setLoadingUltMonto(false);
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo obtener el monto del mes anterior.");
        setUltMonto(null);
        return;
      }
      setUltMonto(r.data.monto);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, fila, mes, anio]);

  const montoPesosInt = useMemo(() => montoArNormalizedStringToPesosIntRounded(montoNorm), [montoNorm]);
  const pagadoPesosInt = useMemo(
    () => montoArNormalizedStringToPesosIntRounded(pagadoNorm),
    [pagadoNorm]
  );
  const hayDatoMonto = montoNorm.trim().length > 0;
  const montoBloqueado = !!fila && esGastoReemplazadoPorLibro(fila.tipoGastoNombre, fila.gastoNombre);

  const disabledSubmit = useMemo(() => {
    if (saving || aplicandoRepetir || !fila) return true;
    if (!hayDatoMonto) return true;
    if (pagadoPesosInt > montoPesosInt) return true;
    const montoCambio = montoPesosInt !== fila.monto;
    const pagadoCambio = pagadoPesosInt !== fila.pagado;
    return !montoCambio && !pagadoCambio;
  }, [saving, aplicandoRepetir, fila, hayDatoMonto, montoPesosInt, pagadoPesosInt]);

  const puedeRepetirMonto =
    !!fila &&
    !montoBloqueado &&
    !loadingUltMonto &&
    ultMonto !== undefined &&
    ultMonto !== null &&
    !saving &&
    !aplicandoRepetir;

  async function handleRepetirMonto() {
    if (!fila || !puedeRepetirMonto || ultMonto == null) return;
    setAplicandoRepetir(true);
    try {
      setMontoNorm(montoArPesosEnterosToNormalizedString(ultMonto));
    } finally {
      setAplicandoRepetir(false);
    }
  }

  async function handleGuardar() {
    if (!fila || disabledSubmit) return;
    setSaving(true);
    try {
      const montoCambio = montoPesosInt !== fila.monto;
      const pagadoCambio = pagadoPesosInt !== fila.pagado;

      if (montoCambio) {
        const rMonto = await editarMontoFinBalGastoMensualAction({ id: fila.id, monto: montoPesosInt });
        if (!rMonto.ok) {
          toast.error(rMonto.error ?? "No se pudo guardar el monto.");
          return;
        }
      }

      if (pagadoCambio) {
        const rPago = await registrarPagoFinBalGastoMensualAction({ id: fila.id, pagado: pagadoPesosInt });
        if (!rPago.ok) {
          toast.error(rPago.error ?? "No se pudo guardar el pago.");
          return;
        }
      }

      toast.success("Monto y pago actualizados.");
      onOpenChange(false);
      onSuccess?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if ((saving || aplicandoRepetir) && !next) return;
        onOpenChange(next);
      }}
    >
      <AppModal
        title="Registrar Monto y Pago"
        size="md"
        className="max-w-md"
        actions={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving || aplicandoRepetir}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={disabledSubmit} onClick={() => void handleGuardar()}>
              Guardar
            </Button>
          </div>
        }
      >
        {fila ? (
          <div className="grid gap-3 text-sm">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground">
              <div className="font-medium text-foreground">{fila.gastoNombre}</div>
              <div className="text-xs">
                {fila.proveedorNombre} · {fila.sucursalNombre}
              </div>
            </div>

            <label className="flex w-full flex-col items-center gap-1 text-center">
              <ModalMicroLabel>MONTO</ModalMicroLabel>
              <MontoArInput
                valueNormalized={montoNorm}
                onValueNormalizedChange={setMontoNorm}
                disabled={saving || aplicandoRepetir || montoBloqueado}
                autoFocus={!montoBloqueado}
                aria-label="Monto en pesos"
              />
              {montoBloqueado ? (
                <span className="text-xs text-muted-foreground">
                  {MENSAJE_GASTO_REEMPLAZADO_POR_LIBRO}
                </span>
              ) : null}
            </label>

            <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
              {loadingUltMonto || ultMonto === undefined ? (
                <>
                  <span className="font-semibold text-foreground">Ult. Monto</span>
                  <span className="font-normal text-foreground">…</span>
                </>
              ) : ultMonto !== null ? (
                <>
                  <span className="inline-flex flex-wrap items-center justify-center gap-x-0">
                    <span className="font-semibold text-foreground">Ult. Monto $</span>
                    <span className="font-normal text-foreground">{fmtPrecio(ultMonto)}</span>
                  </span>
                  <Button
                    type="button"
                    variant="primaryIcon"
                    size="icon"
                    className="h-7 w-7 shrink-0 rounded-md"
                    disabled={!puedeRepetirMonto || aplicandoRepetir}
                    onClick={() => void handleRepetirMonto()}
                    aria-label="Repetir último monto"
                    title="Repetir último monto"
                  >
                    {aplicandoRepetir ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Repeat2 className="h-4 w-4" aria-hidden />
                    )}
                  </Button>
                </>
              ) : (
                <span className="font-normal text-foreground">Sin monto en mes anterior</span>
              )}
            </div>

            <label className="flex w-full flex-col items-center gap-1 text-center">
              <ModalMicroLabel>PAGADO</ModalMicroLabel>
              <div className="relative w-full">
                <MontoArInput
                  valueNormalized={pagadoNorm}
                  onValueNormalizedChange={setPagadoNorm}
                  disabled={saving || !hayDatoMonto}
                  aria-label="Importe pagado en pesos"
                  className="pr-12"
                />
                <Button
                  type="button"
                  variant="primaryIcon"
                  size="icon"
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-md"
                  disabled={saving || !hayDatoMonto || montoPesosInt <= 0 || pagadoPesosInt >= montoPesosInt}
                  onClick={() => setPagadoNorm(montoArPesosEnterosToNormalizedString(montoPesosInt))}
                  aria-label="Marcar pago total"
                  title="Pagar total"
                >
                  <Check className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </label>
          </div>
        ) : null}
      </AppModal>
    </Dialog>
  );
}

