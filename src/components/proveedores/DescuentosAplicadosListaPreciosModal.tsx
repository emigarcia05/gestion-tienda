"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import MontoArInput from "@/components/shared/MontoArInput";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Label } from "@/components/ui/label";
import { CAMPO_PX_PROMO_FIJO } from "@/lib/descuentosListaPrecioReglasConstants";
import { fmtPorcentajeTabla, fmtPrecio } from "@/lib/format";
import { cn } from "@/lib/utils";
import { roundPrecioListaTienda } from "@/lib/calculos";
import {
  montoArNumberToNormalizedString,
  montoArNormalizedStringToPesosNumber,
} from "@/lib/montoArMask";
import { actualizarListaPreciosMasivoAction } from "@/actions/listaPrecios";
import type {
  DescuentoActivoListaPrecio,
  FilaListaPrecioParaCliente,
} from "@/services/listaPrecios.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fila: FilaListaPrecioParaCliente | null;
  puedeEditar: boolean;
  onVerRegla: (descuento: DescuentoActivoListaPrecio) => void;
  onSuccess?: () => void;
}

const GRID_CLASS = "grid grid-cols-[1.35fr_minmax(0,1fr)] gap-x-4 gap-y-2 items-center";
const LABEL_CLASS = "text-right font-medium text-sm text-foreground";
const MONTO_CLASS = "text-sm tabular-nums text-foreground";

function fmtUsdPromo(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPesos(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  return `$${fmtPrecio(n)}`;
}

function FilaEtiquetaMonto({
  etiqueta,
  htmlFor,
  children,
}: {
  etiqueta: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <>
      {htmlFor ? (
        <Label htmlFor={htmlFor} className={LABEL_CLASS}>
          {etiqueta}
        </Label>
      ) : (
        <span className={LABEL_CLASS}>{etiqueta}</span>
      )}
      <div className="min-w-0">{children}</div>
    </>
  );
}

export default function DescuentosAplicadosListaPreciosModal({
  open,
  onOpenChange,
  fila,
  puedeEditar,
  onVerRegla,
  onSuccess,
}: Props) {
  const [pxPromoFijoNorm, setPxPromoFijoNorm] = useState("");
  const [pending, setPending] = useState(false);

  const descuentosReglas = useMemo(
    () => (fila?.descuentosActivos ?? []).filter((d) => d.campo !== CAMPO_PX_PROMO_FIJO),
    [fila]
  );
  const hayPromo = fila?.pxPromoFijo != null && fila.pxPromoFijo > 0;

  useEffect(() => {
    if (!open || !fila) return;
    setPxPromoFijoNorm(
      fila.pxPromoFijo != null && fila.pxPromoFijo > 0
        ? montoArNumberToNormalizedString(fila.pxPromoFijo)
        : ""
    );
  }, [open, fila]);

  async function handleGuardarPromo() {
    if (!fila || !puedeEditar) return;
    const norm = pxPromoFijoNorm.trim();
    const pxPromoFijo =
      norm === ""
        ? null
        : roundPrecioListaTienda(montoArNormalizedStringToPesosNumber(norm));
    const valor = pxPromoFijo != null && pxPromoFijo > 0 ? pxPromoFijo : null;
    setPending(true);
    try {
      const result = await actualizarListaPreciosMasivoAction({
        ids: [fila.codExt],
        data: { pxPromoFijo: valor },
      });
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo guardar el Px. Promo Fijo.");
        return;
      }
      toast.success(
        valor == null ? "Se quitó el Px. Promo Fijo." : "Px. Promo Fijo actualizado."
      );
      onOpenChange(false);
      onSuccess?.();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="sm"
        padding="sm"
        title="Descuentos Aplicados"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </Button>
            {puedeEditar ? (
              <Button
                type="button"
                disabled={pending || !fila}
                onClick={() => void handleGuardarPromo()}
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Guardando
                  </>
                ) : (
                  "Guardar"
                )}
              </Button>
            ) : null}
          </>
        }
      >
        {!fila ? (
          <p className="text-sm text-muted-foreground">Sin datos del ítem.</p>
        ) : (
          <div className={GRID_CLASS}>
            <FilaEtiquetaMonto etiqueta="PX. LISTA">
              <p className={MONTO_CLASS}>{fmtPesos(fila.pxListaProveedor)}</p>
            </FilaEtiquetaMonto>

            <FilaEtiquetaMonto etiqueta="PX. PROMO FIJO (USD)" htmlFor="pxPromoFijo">
              {puedeEditar ? (
                <MontoArInput
                  id="pxPromoFijo"
                  placeholder=""
                  valueNormalized={pxPromoFijoNorm}
                  onValueNormalizedChange={setPxPromoFijoNorm}
                  treatEmptyNormalizedAsBlank
                  disabled={pending}
                  className="tabular-nums border-primary w-full min-w-0"
                />
              ) : (
                <p className={MONTO_CLASS}>
                  {hayPromo && fila.pxPromoFijo != null ? fmtUsdPromo(fila.pxPromoFijo) : ""}
                </p>
              )}
            </FilaEtiquetaMonto>

            {hayPromo ? (
              <p className="col-span-2 text-xs text-muted-foreground">
                Con Px. Promo Fijo el Px. Final no usa los descuentos % (sí Cx. Transporte). Las
                reglas siguen guardadas.
              </p>
            ) : null}

            <div className="col-span-2 pt-1">
              <ModalMicroLabel>REGLAS DE DESCUENTO</ModalMicroLabel>
            </div>

            {descuentosReglas.length === 0 ? (
              <p className="col-span-2 text-sm text-muted-foreground">
                No hay descuentos activos en este ítem.
              </p>
            ) : (
              descuentosReglas.map((descuento) => {
                const Icon = descuento.tipo === "descuento" ? ArrowDown : ArrowUp;
                return (
                  <FilaEtiquetaMonto key={descuento.campo} etiqueta={descuento.label}>
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                      <span className={cn(MONTO_CLASS, "min-w-0 flex-1 truncate")}>
                        {fmtPorcentajeTabla(descuento.valor)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-7 w-7 shrink-0 rounded-sm text-primary hover:bg-primary/10 hover:text-primary"
                        )}
                        aria-label={`Ver regla de ${descuento.label}`}
                        onClick={() => onVerRegla(descuento)}
                      >
                        <Info className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </FilaEtiquetaMonto>
                );
              })
            )}

            <FilaEtiquetaMonto etiqueta="PX. FINAL">
              <p className={cn(MONTO_CLASS, "font-semibold")}>
                {fmtPesos(fila.pxCompraFinalSinIva)}
              </p>
            </FilaEtiquetaMonto>
          </div>
        )}
      </AppModal>
    </Dialog>
  );
}
