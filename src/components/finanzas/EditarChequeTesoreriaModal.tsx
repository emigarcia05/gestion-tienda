"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MontoArInput from "@/components/shared/MontoArInput";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import type { TipoChequeTesoreria } from "@prisma/client";
import { actualizarFinTesoreriaChequeAction } from "@/actions/finTesoreriaCheques";
import type { FinTesoreriaChequeItem } from "@/services/finTesoreriaCheques.service";
import { useTitularesFinancierosTesoreria } from "@/lib/hooks/useTitularesFinancierosTesoreria";
import { montoArNormalizedStringToPesosIntRounded, montoArPesosEnterosToNormalizedString } from "@/lib/montoArMask";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cheque: FinTesoreriaChequeItem | null;
  onUpdated?: () => void;
}

const TIPOS_CHEQUE: readonly TipoChequeTesoreria[] = ["FISICO", "ECHEQUE"];

function tipoChequeValido(o: string): o is TipoChequeTesoreria {
  return TIPOS_CHEQUE.includes(o as TipoChequeTesoreria);
}

export default function EditarChequeTesoreriaModal({
  open,
  onOpenChange,
  cheque,
  onUpdated,
}: Props) {
  const [tipo, setTipo] = useState<TipoChequeTesoreria>("FISICO");
  const [tenedor, setTenedor] = useState("");
  const titulares = useTitularesFinancierosTesoreria(open, cheque?.tenedor);
  const [emisor, setEmisor] = useState("");
  const [montoNorm, setMontoNorm] = useState("");
  const [fechaAcreditacionIso, setFechaAcreditacionIso] = useState("");
  const [fechaRecibidoIso, setFechaRecibidoIso] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !cheque) return;
    setEmisor(cheque.emisor.toLocaleUpperCase("es-AR"));
    setMontoNorm(montoArPesosEnterosToNormalizedString(cheque.monto));
    setFechaAcreditacionIso(cheque.fechaAcreditacionIso);
    setFechaRecibidoIso(cheque.fechaRecibidoIso);
    setTipo(tipoChequeValido(cheque.tipo) ? cheque.tipo : "FISICO");
    setTenedor(cheque.tenedor);
  }, [open, cheque]);

  const parsedMonto = useMemo(() => montoArNormalizedStringToPesosIntRounded(montoNorm), [montoNorm]);

  const disabledSubmit = useMemo(() => {
    return (
      saving ||
      !cheque ||
      emisor.trim().length === 0 ||
      parsedMonto < 0 ||
      !tenedor ||
      fechaAcreditacionIso.length === 0 ||
      fechaRecibidoIso.length === 0
    );
  }, [saving, cheque, emisor, parsedMonto, tenedor, fechaAcreditacionIso, fechaRecibidoIso]);

  async function handleSubmit() {
    if (disabledSubmit || !cheque || !tenedor) return;
    setSaving(true);
    try {
      const res = await actualizarFinTesoreriaChequeAction({
        id: cheque.id,
        tipo,
        tenedor,
        emisor: emisor.trim(),
        monto: parsedMonto,
        fechaAcreditacion: fechaAcreditacionIso,
        fechaRecibido: fechaRecibidoIso,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar el cheque.");
        return;
      }
      toast.success("Cheque actualizado correctamente.");
      onOpenChange(false);
      onUpdated?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!saving ? onOpenChange(next) : undefined)}>
      <AppModal
        title="Editar Cheque"
        size="sm"
        className="max-w-md"
        scrollBody={false}
        actions={
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
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
            <ModalMicroLabel>TIPO</ModalMicroLabel>
            <Select
              value={tipo}
              onValueChange={(value) => setTipo(value as TipoChequeTesoreria)}
              disabled={saving || !cheque}
            >
              <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                <SelectValue placeholder="TIPO DE CHEQUE" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                {TIPOS_CHEQUE.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt === "ECHEQUE" ? "E-CHEQUE" : "FÍSICO"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <ModalMicroLabel>TENEDOR</ModalMicroLabel>
            <Select
              value={tenedor || "none"}
              onValueChange={(value) =>
                setTenedor(value === "none" ? "" : value)
              }
              disabled={saving || !cheque}
            >
              <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                <SelectValue placeholder="SELECCIONAR TENEDOR" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                <SelectItem value="none">SELECCIONAR TENEDOR</SelectItem>
                {titulares.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <ModalMicroLabel>EMISOR</ModalMicroLabel>
            <Input
              value={emisor}
              onChange={(e) => setEmisor(e.target.value.toLocaleUpperCase("es-AR"))}
              disabled={saving}
              placeholder="Nombre del emisor"
              aria-label="Emisor del cheque"
            />
          </label>
          <label className="flex flex-col gap-1">
            <ModalMicroLabel>MONTO</ModalMicroLabel>
            <MontoArInput
              valueNormalized={montoNorm}
              onValueNormalizedChange={setMontoNorm}
              disabled={saving}
              aria-label="Monto del cheque"
            />
          </label>
          <label className="flex flex-col gap-1">
            <ModalMicroLabel>FECHA RECIBIDO</ModalMicroLabel>
            <Input
              type="date"
              name="fecha_recibido"
              value={fechaRecibidoIso}
              onChange={(e) => setFechaRecibidoIso(e.target.value)}
              disabled={saving}
              aria-label="Fecha en que se recibió el cheque"
            />
          </label>
          <label className="flex flex-col gap-1">
            <ModalMicroLabel>FECHA ACREDITACIÓN</ModalMicroLabel>
            <Input
              type="date"
              name="fecha_acreditacion"
              value={fechaAcreditacionIso}
              onChange={(e) => setFechaAcreditacionIso(e.target.value)}
              disabled={saving}
              aria-label="Fecha de acreditación del cheque"
            />
          </label>
        </div>
      </AppModal>
    </Dialog>
  );
}
