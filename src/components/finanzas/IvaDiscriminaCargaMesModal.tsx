"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import type { PendienteDiscriminaIvaCargaMesItem } from "@/services/finBalGastoMensualBalance.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PendienteDiscriminaIvaCargaMesItem[];
  onConfirm: (ivaPorGastoFinalId: Record<string, boolean>) => void;
}

/** Modal previo a «Gasto fijo» / cargar mes: política `PREGUNTA` en `bal_gasto.iva`. */
export default function IvaDiscriminaCargaMesModal({ open, onOpenChange, items, onConfirm }: Props) {
  const [decisiones, setDecisiones] = useState<Record<string, "none" | "si" | "no">>({});

  useEffect(() => {
    if (!open) return;
    const init: Record<string, "none" | "si" | "no"> = {};
    for (const it of items) init[it.gastoFinalId] = "none";
    queueMicrotask(() => {
      setDecisiones(init);
    });
  }, [open, items]);

  const completo = useMemo(() => {
    if (items.length === 0) return true;
    return items.every((it) => decisiones[it.gastoFinalId] === "si" || decisiones[it.gastoFinalId] === "no");
  }, [items, decisiones]);

  function handleConfirm() {
    const out: Record<string, boolean> = {};
    for (const it of items) {
      const v = decisiones[it.gastoFinalId];
      if (v !== "si" && v !== "no") return;
      out[it.gastoFinalId] = v === "si";
    }
    onConfirm(out);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        title="Discriminación de IVA"
        size="lg"
        className="max-w-lg"
        padding="sm"
        actions={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={!completo} onClick={handleConfirm}>
              Continuar y cargar mes
            </Button>
          </div>
        }
      >
        <div className="grid max-h-[min(55vh,22rem)] gap-3 overflow-y-auto text-sm">
          <p className="text-muted-foreground">
            Algunos gastos del catálogo tienen política de IVA «pregunta». Indicá si discrimina IVA (SI / NO) por
            cada uno antes de crear las filas del mes.
          </p>
          <ul className="grid gap-3">
            {items.map((it) => (
              <li
                key={it.gastoFinalId}
                className="rounded-md border border-border bg-muted/30 px-3 py-2"
              >
                <div className="mb-2 font-medium text-foreground leading-snug">{it.etiqueta}</div>
                <ModalMicroLabel className="mb-1 block">
                  ¿El gasto discrimina IVA? <span className="text-destructive">*</span>
                </ModalMicroLabel>
                <Select
                  value={decisiones[it.gastoFinalId] ?? "none"}
                  onValueChange={(v) =>
                    setDecisiones((prev) => ({
                      ...prev,
                      [it.gastoFinalId]: v as "none" | "si" | "no",
                    }))
                  }
                >
                  <SelectTrigger
                    className="input-filtro-unificado w-full"
                    aria-label={`¿El gasto discrimina IVA? ${it.etiqueta}`}
                  >
                    <SelectValue placeholder="SELECCIONAR" />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
                    <SelectItem value="none">SELECCIONAR</SelectItem>
                    <SelectItem value="si">SI</SelectItem>
                    <SelectItem value="no">NO</SelectItem>
                  </SelectContent>
                </Select>
              </li>
            ))}
          </ul>
        </div>
      </AppModal>
    </Dialog>
  );
}
