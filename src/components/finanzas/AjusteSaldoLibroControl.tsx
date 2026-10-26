"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import MontoArInput from "@/components/shared/MontoArInput";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dateToIsoYmdArgentina } from "@/lib/fechaArgentina";
import { montoArNormalizedStringToCents } from "@/lib/montoArMask";
import type { ActionResult } from "@/lib/types";

export interface AjusteSaldoLibroInput<T extends string> {
  fechaIso: string;
  movimiento: T;
  /** Pesos enteros > 0. */
  monto: number;
}

interface Props<T extends string> {
  /** Opciones del select MOVIMIENTO (la primera es el default). */
  movimientos: readonly { value: T; label: string }[];
  guardar: (input: AjusteSaldoLibroInput<T>) => Promise<ActionResult<unknown>>;
  onCreado: () => void;
}

/** Botón **AJUSTE SALDO** de los libros de Balance (IVA, IIBB): FECHA + MOVIMIENTO + MONTO entero. */
export default function AjusteSaldoLibroControl<T extends string>({
  movimientos,
  guardar,
  onCreado,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [fechaIso, setFechaIso] = useState("");
  const [movimiento, setMovimiento] = useState<T | null>(null);
  const [montoNorm, setMontoNorm] = useState("");
  const [guardando, setGuardando] = useState(false);

  const monto = Math.round(montoArNormalizedStringToCents(montoNorm) / 100);
  const puedeGuardar = fechaIso !== "" && movimiento !== null && monto > 0 && !guardando;

  function abrir() {
    setFechaIso(dateToIsoYmdArgentina(new Date()));
    setMovimiento(movimientos[0]?.value ?? null);
    setMontoNorm("");
    setOpen(true);
  }

  async function confirmar() {
    if (!puedeGuardar || movimiento === null) return;
    setGuardando(true);
    try {
      const res = await guardar({ fechaIso, movimiento, monto });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Ajuste de saldo registrado.");
      setOpen(false);
      onCreado();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <ToolbarActionButton type="button" icon={<Plus aria-hidden />} label="AJUSTE SALDO" onClick={abrir} />
      <Dialog open={open} onOpenChange={(o) => (!o && !guardando ? setOpen(false) : null)}>
        {open ? (
          <AppModal
            title="AJUSTE SALDO"
            size="sm"
            actions={
              <>
                <Button type="button" variant="outline" disabled={guardando} onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" disabled={!puedeGuardar} onClick={() => void confirmar()}>
                  {guardando ? "Guardando..." : "Guardar"}
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <ModalMicroLabel>FECHA</ModalMicroLabel>
                <Input
                  type="date"
                  className="input-filtro-unificado tabular-nums"
                  value={fechaIso}
                  onChange={(e) => setFechaIso(e.target.value)}
                />
              </label>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>MOVIMIENTO</ModalMicroLabel>
                <Select
                  value={movimiento ?? undefined}
                  onValueChange={(v) => setMovimiento(movimientos.find((m) => m.value === v)?.value ?? null)}
                >
                  <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS} aria-label="Movimiento">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
                    {movimientos.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex flex-col gap-1">
                <ModalMicroLabel>MONTO</ModalMicroLabel>
                <MontoArInput
                  valueNormalized={montoNorm}
                  onValueNormalizedChange={setMontoNorm}
                  soloPesosEnteros
                  treatEmptyNormalizedAsBlank
                  placeholder="$0"
                />
              </label>
            </div>
          </AppModal>
        ) : null}
      </Dialog>
    </>
  );
}
