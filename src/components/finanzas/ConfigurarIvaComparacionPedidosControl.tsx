"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import MontoArSaldoEnteroInput from "@/components/shared/MontoArSaldoEnteroInput";
import {
  guardarIvaComparacionPedidoAction,
  type EstadoIvaComparacionPedido,
} from "@/actions/finBalPosicionIvaComparacionPedido";
import {
  montoArPesosEnterosSignedToDisplayCompact,
  montoArPesosEnterosSignedToParts,
  montoArSaldoEnteroPartsToPesos,
} from "@/lib/montoArMask";
import { cn } from "@/lib/utils";

const TITULO_MODULO = "Conf. IVA Saldo para Comparacion Costo";

interface Props {
  puedeEditar: boolean;
  estadoInicial: EstadoIvaComparacionPedido;
  onActualizado?: () => void;
}

function saldoInicialParaFormulario(estado: EstadoIvaComparacionPedido): number {
  return estado.usarValorConfigurado
    ? estado.saldoPesosConfigurado
    : estado.saldoAcumuladoCalculado;
}

export default function ConfigurarIvaComparacionPedidosControl({
  puedeEditar,
  estadoInicial,
  onActualizado,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [estado, setEstado] = useState(estadoInicial);
  const [magnitudeNorm, setMagnitudeNorm] = useState("");
  const [esNegativo, setEsNegativo] = useState(false);

  const estadoToolbar = open ? estado : estadoInicial;
  const saldoToolbar = estadoToolbar.saldoEfectivoComparacion;
  const labelBoton = montoArPesosEnterosSignedToDisplayCompact(saldoToolbar);

  function handleOpen(next: boolean) {
    if (next) {
      setEstado(estadoInicial);
      const parts = montoArPesosEnterosSignedToParts(saldoInicialParaFormulario(estadoInicial));
      setMagnitudeNorm(parts.magnitudeNormalized);
      setEsNegativo(parts.negativo);
    }
    setOpen(next);
  }

  const handleGuardar = useCallback(() => {
    const saldo = montoArSaldoEnteroPartsToPesos(magnitudeNorm, esNegativo);
    if (saldo === null) {
      toast.error("Ingresá el saldo IVA.");
      return;
    }

    startTransition(async () => {
      const result = await guardarIvaComparacionPedidoAction({
        usarValorConfigurado: true,
        saldoPesos: saldo,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEstado(result.data);
      toast.success("Saldo IVA para comparación guardado.");
      setOpen(false);
      onActualizado?.();
    });
  }, [magnitudeNorm, esNegativo, onActualizado]);

  if (!puedeEditar) {
    return (
      <Button
        type="button"
        variant="default"
        size="default"
        className="btn-primario-gestion shrink-0 tabular-nums pointer-events-none max-w-[22rem] truncate"
        tabIndex={-1}
        title={`${TITULO_MODULO}: ${labelBoton}`}
        aria-label={`${TITULO_MODULO}: ${labelBoton}`}
      >
        {labelBoton}
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="default"
          size="default"
          className="btn-primario-gestion shrink-0 gap-2 tabular-nums max-w-[22rem]"
          title={`${TITULO_MODULO}: ${labelBoton}`}
        >
          <Settings2 className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{labelBoton}</span>
        </Button>
      </DialogTrigger>
      <AppModal
        title={TITULO_MODULO}
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleGuardar} disabled={pending} className="gap-2 min-w-[7.5rem]">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-[1.35fr_minmax(0,1fr)] gap-x-4 gap-y-2 items-center">
          <label htmlFor="posicion-iva-comparacion-saldo" className="text-right font-medium text-sm text-foreground">
            SALDO IVA
          </label>
          <MontoArSaldoEnteroInput
            id="posicion-iva-comparacion-saldo"
            magnitudeNormalized={magnitudeNorm}
            onMagnitudeNormalizedChange={setMagnitudeNorm}
            negativo={esNegativo}
            onNegativoChange={setEsNegativo}
            disabled={pending}
            className={cn("border-primary w-full min-w-0")}
          />
        </div>
      </AppModal>
    </Dialog>
  );
}
