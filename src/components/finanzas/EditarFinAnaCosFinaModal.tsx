"use client";

import { useEffect, useMemo, useState } from "react";
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
import { fmtCelda } from "@/lib/format";
import type { FinAnaCosFinaFila } from "@/components/finanzas/TablaFinAnaCosFina";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fila: FinAnaCosFinaFila | null;
  onFilaActualizada: (fila: FinAnaCosFinaFila) => void;
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
  onFilaActualizada,
}: Props) {
  const [diasDraft, setDiasDraft] = useState("");
  const [arancelDraft, setArancelDraft] = useState("");
  const [costoDraft, setCostoDraft] = useState("");
  const [impCheque, setImpCheque] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !fila) return;
    setDiasDraft(fila.diasAcreditacion?.toString() ?? "");
    setArancelDraft(porcentajeCentFromNumber(fila.arancel));
    setCostoDraft(porcentajeCentFromNumber(fila.costoFinanciero));
    setImpCheque(fila.impCheque);
  }, [open, fila]);

  const diasParsed = useMemo(() => parseDiasAcreditacionInput(diasDraft), [diasDraft]);
  const arancelParsed = useMemo(
    () => parsePorcentajeCentNormalized(arancelDraft),
    [arancelDraft]
  );
  const costoParsed = useMemo(
    () => parsePorcentajeCentNormalized(costoDraft),
    [costoDraft]
  );

  const hasChanges = useMemo(() => {
    if (!fila) return false;
    if (diasParsed === undefined || arancelParsed === undefined || costoParsed === undefined) {
      return false;
    }
    return (
      diasParsed !== fila.diasAcreditacion ||
      arancelParsed !== fila.arancel ||
      costoParsed !== fila.costoFinanciero ||
      impCheque !== fila.impCheque
    );
  }, [fila, diasParsed, arancelParsed, costoParsed, impCheque]);

  const disabledSubmit =
    saving ||
    !fila ||
    !hasChanges ||
    diasParsed === undefined ||
    arancelParsed === undefined ||
    costoParsed === undefined;

  async function handleSubmit() {
    if (disabledSubmit || !fila || diasParsed === undefined) return;
    if (arancelParsed === undefined || costoParsed === undefined) return;
    setSaving(true);
    try {
      const res = await actualizarFinAnaCosFinaAction({
        id: fila.id,
        campos: {
          diasAcreditacion: diasParsed,
          arancel: arancelParsed,
          costoFinanciero: costoParsed,
          impCheque,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onFilaActualizada(res.data);
      toast.success("Combinación actualizada.");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        title="EDITAR COSTO FINANCIERO"
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={disabledSubmit} onClick={() => void handleSubmit()}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
        {fila ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <ModalMicroLabel>FORMA DE PAGO</ModalMicroLabel>
                <p className="truncate text-sm text-foreground">{fila.pagoNombre}</p>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <ModalMicroLabel>ENTIDAD</ModalMicroLabel>
                <p className="truncate text-sm text-foreground">
                  {fmtCelda(fila.terminalNombre)}
                </p>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <ModalMicroLabel>CUOTAS</ModalMicroLabel>
                <p className="truncate text-sm text-foreground">{fmtCelda(fila.cuotas)}</p>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <ModalMicroLabel>DÍAS DE ACREDITACIÓN</ModalMicroLabel>
              <Input
                value={diasDraft}
                onChange={(e) => setDiasDraft(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                disabled={saving}
                className="tabular-nums"
                aria-label="Días de acreditación"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>ARANCEL</ModalMicroLabel>
                <PorcentajeCentInput
                  valueNormalized={arancelDraft}
                  onValueNormalizedChange={setArancelDraft}
                  disabled={saving}
                  pctSuffixAlwaysVisible
                  aria-label="Arancel"
                />
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>CX FINANCIERO</ModalMicroLabel>
                <PorcentajeCentInput
                  valueNormalized={costoDraft}
                  onValueNormalizedChange={setCostoDraft}
                  disabled={saving}
                  pctSuffixAlwaysVisible
                  aria-label="Cx. financiero"
                />
              </div>
            </div>

            <ModalSiNoChoice
              label="IMP. CHEQUE"
              value={impCheque}
              onChange={setImpCheque}
              disabled={saving}
            />
          </div>
        ) : null}
      </AppModal>
    </Dialog>
  );
}
