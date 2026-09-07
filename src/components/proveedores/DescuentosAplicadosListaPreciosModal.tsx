"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import MontoArInput from "@/components/shared/MontoArInput";
import { Label } from "@/components/ui/label";
import { CAMPO_PX_PROMO_FIJO } from "@/lib/descuentosListaPrecioReglasConstants";
import { fmtPorcentajeTabla, fmtPrecio } from "@/lib/format";
import { cn } from "@/lib/utils";
import { clampPercent, roundPrecioListaTienda } from "@/lib/calculos";
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

const VACIO = "-";
const GRID_CLASS =
  "grid grid-cols-[minmax(0,1.35fr)_minmax(7.25rem,auto)_minmax(5.5rem,1fr)] gap-x-3 gap-y-2 items-center";
const LABEL_CLASS = "font-medium text-sm text-foreground text-left";
const MONTO_CLASS = "text-sm tabular-nums text-foreground text-right";

function fmtUsdPromo(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPesos(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return VACIO;
  return `$${fmtPrecio(n)}`;
}

function dtoTotalFila(fila: FilaListaPrecioParaCliente): number {
  return clampPercent(
    fila.dtoProveedor +
      fila.dtoMarca +
      fila.dtoRubro +
      fila.dtoCantidad +
      fila.dtoFinanciero +
      fila.descEspecial
  );
}

function nominalRegla(
  fila: FilaListaPrecioParaCliente,
  descuento: DescuentoActivoListaPrecio,
  hayPromo: boolean
): string {
  if (hayPromo) return VACIO;
  if (descuento.tipo === "descuento") {
    return fmtPesos(fila.pxListaProveedor * (descuento.valor / 100));
  }
  const baseTrasDto = fila.pxListaProveedor * (1 - dtoTotalFila(fila) / 100);
  return fmtPesos(baseTrasDto * (descuento.valor / 100));
}

function FilaTres({
  etiqueta,
  htmlFor,
  porcentaje,
  nominal,
}: {
  etiqueta: string;
  htmlFor?: string;
  porcentaje: ReactNode;
  nominal: ReactNode;
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
      <div className="flex min-w-0 items-center justify-end">{porcentaje}</div>
      <div className="min-w-0">{nominal}</div>
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
            <span className="sr-only">Etiqueta</span>
            <span className="sr-only">Valor porcentual</span>
            <span className="sr-only">Valor nominal</span>

            <FilaTres
              etiqueta="PX. PROMO FIJO (USD)"
              htmlFor="pxPromoFijo"
              porcentaje={null}
              nominal={
                puedeEditar ? (
                  <MontoArInput
                    id="pxPromoFijo"
                    placeholder={VACIO}
                    valueNormalized={pxPromoFijoNorm}
                    onValueNormalizedChange={setPxPromoFijoNorm}
                    treatEmptyNormalizedAsBlank
                    disabled={pending}
                    className="tabular-nums border-primary w-full min-w-0 text-right"
                  />
                ) : (
                  <p className={MONTO_CLASS}>
                    {hayPromo && fila.pxPromoFijo != null
                      ? `$${fmtUsdPromo(fila.pxPromoFijo)}`
                      : VACIO}
                  </p>
                )
              }
            />

            <FilaTres
              etiqueta="PX. LISTA"
              porcentaje={null}
              nominal={<p className={MONTO_CLASS}>{fmtPesos(fila.pxListaProveedor)}</p>}
            />

            {descuentosReglas.map((descuento) => (
              <FilaTres
                key={descuento.campo}
                etiqueta={descuento.label}
                porcentaje={
                  <div className="flex items-center justify-end gap-0.5">
                    <span className={cn(MONTO_CLASS, "min-w-0 truncate")}>
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
                }
                nominal={
                  <p className={MONTO_CLASS}>
                    {nominalRegla(fila, descuento, hayPromo)}
                  </p>
                }
              />
            ))}

            <FilaTres
              etiqueta="PX. FINAL"
              porcentaje={null}
              nominal={
                <p className={cn(MONTO_CLASS, "font-semibold")}>
                  {fmtPesos(fila.pxCompraFinalSinIva)}
                </p>
              }
            />
          </div>
        )}
      </AppModal>
    </Dialog>
  );
}
