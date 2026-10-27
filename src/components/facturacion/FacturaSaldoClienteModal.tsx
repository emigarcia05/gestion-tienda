"use client";

import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { fmtPrecio } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: string;
  saldoTotal: number;
  saldoVencido: number;
}

const FILA_CLASS = "flex items-center justify-between gap-4 text-sm";

/** Detalle del saldo CC del cliente elegido en Factura · Crear. */
export default function FacturaSaldoClienteModal({
  open,
  onOpenChange,
  cliente,
  saldoTotal,
  saldoVencido,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        title="Saldo Cliente"
        size="sm"
        actions={
          <div className="flex w-full justify-end">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="truncate text-center text-sm font-semibold uppercase">{cliente}</p>
          <div className={FILA_CLASS}>
            <span className="font-semibold uppercase">Saldo Total:</span>
            <span className="tabular-nums">{`$${fmtPrecio(saldoTotal)}`}</span>
          </div>
          <div className={FILA_CLASS}>
            <span className="font-semibold uppercase">Saldo Vencido:</span>
            <span
              className={cn(
                "tabular-nums",
                saldoVencido > 0.009 && "font-semibold text-destructive"
              )}
            >
              {`$${fmtPrecio(saldoVencido)}`}
            </span>
          </div>
        </div>
      </AppModal>
    </Dialog>
  );
}
