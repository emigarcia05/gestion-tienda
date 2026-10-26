"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { crearAjusteBalIvaAction } from "@/actions/balIva";
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
import { COLUMNAS_AJUSTE_BAL_IVA, type ColumnaAjusteBalIva } from "@/lib/validations/balIva";

const ETIQUETA_COLUMNA: Record<ColumnaAjusteBalIva, string> = {
  DEBITO: "DÉBITO",
  CREDITO: "CRÉDITO",
};

interface Props {
  onCreado: () => void;
}

export default function AjusteSaldoBalIvaControl({ onCreado }: Props) {
  const [open, setOpen] = useState(false);
  const [fechaIso, setFechaIso] = useState("");
  const [columna, setColumna] = useState<ColumnaAjusteBalIva>("DEBITO");
  const [montoNorm, setMontoNorm] = useState("");
  const [guardando, setGuardando] = useState(false);

  const monto = Math.round(montoArNormalizedStringToCents(montoNorm) / 100);
  const puedeGuardar = fechaIso !== "" && monto > 0 && !guardando;

  function abrir() {
    setFechaIso(dateToIsoYmdArgentina(new Date()));
    setColumna("DEBITO");
    setMontoNorm("");
    setOpen(true);
  }

  async function guardar() {
    if (!puedeGuardar) return;
    setGuardando(true);
    try {
      const res = await crearAjusteBalIvaAction({ fechaIso, columna, monto });
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
                <Button type="button" disabled={!puedeGuardar} onClick={() => void guardar()}>
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
                <Select value={columna} onValueChange={(v) => setColumna(v as ColumnaAjusteBalIva)}>
                  <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS} aria-label="Movimiento">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
                    {COLUMNAS_AJUSTE_BAL_IVA.map((c) => (
                      <SelectItem key={c} value={c}>
                        {ETIQUETA_COLUMNA[c]}
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
