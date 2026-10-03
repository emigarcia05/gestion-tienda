"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import ModalSiNoChoice from "@/components/shared/ModalSiNoChoice";
import PorcentajeCentInput from "@/components/shared/PorcentajeCentInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { actualizarFinAnaCosFinaAction } from "@/actions/finAnaCosFina";
import {
  parsePorcentajeCentNormalized,
  porcentajeCentFromNumber,
} from "@/lib/porcentajeCentMask";
import { INPUT_FILTER_CLASS } from "@/components/FilterBar";
import { cn } from "@/lib/utils";
import type { FinAnaCosFinaFila } from "@/components/finanzas/TablaFinAnaCosFina";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fila: FinAnaCosFinaFila | null;
  onGuardado: (fila: FinAnaCosFinaFila) => void;
}

function parseDiasAcreditacionInput(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\d{1,3}$/.test(trimmed)) return undefined;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0 || n > 999) return undefined;
  return n;
}

export default function EditarFinAnaCosFinaModal({
  open,
  onOpenChange,
  fila,
  onGuardado,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [diasDraft, setDiasDraft] = useState("");
  const [arancelDraft, setArancelDraft] = useState("");
  const [costoDraft, setCostoDraft] = useState("");
  const [impCheque, setImpCheque] = useState(false);

  useEffect(() => {
    if (!open || !fila) return;
    setDiasDraft(fila.diasAcreditacion?.toString() ?? "");
    setArancelDraft(porcentajeCentFromNumber(fila.arancel));
    setCostoDraft(porcentajeCentFromNumber(fila.costoFinanciero));
    setImpCheque(fila.impCheque);
  }, [open, fila]);

  async function handleGuardar() {
    if (!fila || saving) return;

    const dias = parseDiasAcreditacionInput(diasDraft);
    if (dias === undefined) {
      toast.error("Ingresá días de acreditación válidos (0–999) o dejá vacío.");
      return;
    }
    const arancel = parsePorcentajeCentNormalized(arancelDraft);
    if (arancel === undefined) {
      toast.error("Ingresá un arancel válido (0–100).");
      return;
    }
    const costoFinanciero = parsePorcentajeCentNormalized(costoDraft);
    if (costoFinanciero === undefined) {
      toast.error("Ingresá un cx. financiero válido (0–100).");
      return;
    }

    setSaving(true);
    try {
      const res = await actualizarFinAnaCosFinaAction({
        id: fila.id,
        campos: {
          diasAcreditacion: dias,
          arancel,
          costoFinanciero,
          impCheque,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onGuardado(res.data);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const contexto = fila
    ? [fila.pagoNombre, fila.terminalNombre, fila.cuotas]
        .map((p) => p?.trim())
        .filter((p): p is string => Boolean(p && p.length > 0))
        .join(" · ")
    : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange(next);
      }}
    >
      <AppModal
        title="EDITAR CX. FIN."
        size="md"
        actions={
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={saving || !fila}
              onClick={() => void handleGuardar()}
            >
              Guardar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {contexto ? (
            <p className="text-center text-sm font-medium text-foreground">
              {contexto}
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <ModalMicroLabel>DÍAS DE ACREDITACIÓN</ModalMicroLabel>
            <Input
              value={diasDraft}
              onChange={(e) => setDiasDraft(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              disabled={saving}
              className={cn(INPUT_FILTER_CLASS, "w-full tabular-nums")}
              aria-label="Días de acreditación"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <ModalMicroLabel>ARANCEL</ModalMicroLabel>
            <PorcentajeCentInput
              valueNormalized={arancelDraft}
              onValueNormalizedChange={setArancelDraft}
              disabled={saving}
              className="w-full"
              aria-label="Arancel"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <ModalMicroLabel>CX FINANCIERO</ModalMicroLabel>
            <PorcentajeCentInput
              valueNormalized={costoDraft}
              onValueNormalizedChange={setCostoDraft}
              disabled={saving}
              className="w-full"
              aria-label="Cx. financiero"
            />
          </div>

          <ModalSiNoChoice
            label="IMP. CHEQUE"
            value={impCheque}
            onChange={setImpCheque}
            disabled={saving}
          />
        </div>
      </AppModal>
    </Dialog>
  );
}
