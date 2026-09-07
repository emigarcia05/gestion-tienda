"use client";

import { ArrowDown, ArrowUp, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { CAMPO_PX_PROMO_FIJO } from "@/lib/descuentosListaPrecioReglasConstants";
import { fmtPorcentajeTabla } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DescuentoActivoListaPrecio } from "@/services/listaPrecios.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  descuentos: DescuentoActivoListaPrecio[];
  onVerRegla: (descuento: DescuentoActivoListaPrecio) => void;
}

function fmtUsdPromo(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function DescuentosAplicadosListaPreciosModal({
  open,
  onOpenChange,
  descuentos,
  onVerRegla,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="sm"
        padding="sm"
        title="Descuentos Aplicados"
        actions={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        {descuentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay descuentos activos en este ítem.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {descuentos.some((d) => d.campo === CAMPO_PX_PROMO_FIJO) ? (
              <p className="text-xs text-muted-foreground">
                Con Px Promo Fijo el Px Final no usa los descuentos % (sí Cx. Transporte). Las reglas
                siguen guardadas.
              </p>
            ) : null}
            <ul className="flex flex-col gap-2">
            {descuentos.map((descuento) => {
              const esPromo = descuento.campo === CAMPO_PX_PROMO_FIJO;
              const Icon = descuento.tipo === "descuento" ? ArrowDown : ArrowUp;
              return (
                <li
                  key={descuento.campo}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-sm tabular-nums">
                    <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    <span className="truncate">
                      {esPromo
                        ? `Px Promo Fijo USD ${fmtUsdPromo(descuento.valor)}`
                        : `Desc. ${descuento.etiquetaCorta} ${fmtPorcentajeTabla(descuento.valor)}`}
                    </span>
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
                </li>
              );
            })}
            </ul>
          </div>
        )}
      </AppModal>
    </Dialog>
  );
}
