"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import EditarFinAnaCosFinaModal from "@/components/finanzas/EditarFinAnaCosFinaModal";
import { actualizarFinAnaCosFinaAction } from "@/actions/finAnaCosFina";
import {
  cxTotalConIvaFinAnaCosFina,
  cxTotalSinIvaFinAnaCosFina,
  fmtPorcentajeDosDecimalesFinAnaCosFina,
} from "@/lib/finAnaCosFina";
import { cn } from "@/lib/utils";
import { fmtCelda } from "@/lib/format";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import type { FinAnaCosFinaItem } from "@/services/finAnaCosFina.service";

export type FinAnaCosFinaFila = FinAnaCosFinaItem;

interface Props {
  filas: FinAnaCosFinaFila[];
  esEditor: boolean;
  onFilaActualizada: (fila: FinAnaCosFinaFila) => void;
}

const TH_COLUMNA_CLASS = "text-center leading-tight";

function CeldaHabilitadoToggleVisual({ activo }: { activo: boolean }) {
  return (
    <span
      className={cn(
        "tabla-check-toggle tabla-check-toggle--alto-fila shrink-0 !bg-background",
        activo && "[&_svg]:!text-[#0072bb]"
      )}
      role="img"
      aria-hidden={!activo}
    >
      {activo ? <Check className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden /> : null}
    </span>
  );
}

function CeldaToggleHabilitado({
  fila,
  esEditor,
  onFilaActualizada,
}: {
  fila: FinAnaCosFinaFila;
  esEditor: boolean;
  onFilaActualizada: (fila: FinAnaCosFinaFila) => void;
}) {
  const [saving, startTransition] = useTransition();
  const activo = fila.habilitado;
  const contextoFila = `${fila.terminalNombre} ${fila.pagoNombre}`;

  if (!esEditor) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <CeldaHabilitadoToggleVisual activo={activo} />
      </div>
    );
  }

  function handleToggle() {
    const siguiente = !activo;
    startTransition(async () => {
      const res = await actualizarFinAnaCosFinaAction({
        id: fila.id,
        campos: { habilitado: siguiente },
      });
      if (res.ok) {
        onFilaActualizada(res.data);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex h-full w-full items-center justify-center gap-1">
      {saving && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleToggle}
        disabled={saving}
        className={cn(
          "tabla-check-toggle tabla-check-toggle--alto-fila shrink-0 !bg-background",
          activo && "[&_svg]:!text-[#0072bb]"
        )}
        aria-pressed={activo}
        aria-label={`Habilitar ${contextoFila}`}
      >
        {activo ? <Check className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden /> : null}
      </Button>
    </div>
  );
}

function CeldaPorcentajeLectura({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <span className="block w-full text-center text-xs tabular-nums" aria-label={etiqueta}>
      {fmtPorcentajeDosDecimalesFinAnaCosFina(valor)}%
    </span>
  );
}

export default function TablaFinAnaCosFina({ filas, esEditor, onFilaActualizada }: Props) {
  const [filaEditar, setFilaEditar] = useState<FinAnaCosFinaFila | null>(null);

  return (
    <>
      <div className="contenedor-tabla-gestion flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <Table variant="compact">
            <TableHeader>
              <TableRow>
                <TableHead className={cn("w-[5%]", TH_COLUMNA_CLASS)}>HAB.</TableHead>
                <TableHead className={cn("w-[11%]", TH_COLUMNA_CLASS)}>
                  FORMA DE
                  <br />
                  PAGO
                </TableHead>
                <TableHead className={cn("w-[9%]", TH_COLUMNA_CLASS)}>ENTIDAD</TableHead>
                <TableHead className={cn("w-[7%]", TH_COLUMNA_CLASS)}>CUOTAS</TableHead>
                <TableHead className={cn("w-[8%]", TH_COLUMNA_CLASS)}>
                  DÍAS DE
                  <br />
                  ACREDITACIÓN
                </TableHead>
                <TableHead className={cn("w-[8%]", TH_COLUMNA_CLASS)}>ARANCEL</TableHead>
                <TableHead className={cn("w-[8%]", TH_COLUMNA_CLASS)}>
                  CX
                  <br />
                  FINANCIERO
                </TableHead>
                <TableHead className={cn("w-[6%]", TH_COLUMNA_CLASS)}>
                  IMP.
                  <br />
                  CHEQUE
                </TableHead>
                <TableHead className={cn("w-[10%]", TH_COLUMNA_CLASS)}>
                  CX TOTAL
                  <br />
                  S/ IVA
                </TableHead>
                <TableHead className={cn("w-[10%]", TH_COLUMNA_CLASS)}>
                  CX TOTAL
                  <br />
                  C/ IVA
                </TableHead>
                {esEditor ? (
                  <TableHead className={cn("w-[8%]", TH_COLUMNA_CLASS)}>ACCIONES</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((fila) => (
                <TableRow key={fila.id}>
                  <TableCell className="celda-datos celda-datos--accion-relleno-fila">
                    <CeldaToggleHabilitado
                      fila={fila}
                      esEditor={esEditor}
                      onFilaActualizada={onFilaActualizada}
                    />
                  </TableCell>
                  <TableCell className="celda-datos text-center text-xs">
                    {fila.pagoNombre}
                  </TableCell>
                  <TableCell className="celda-datos text-center text-xs font-medium">
                    {fmtCelda(fila.terminalNombre)}
                  </TableCell>
                  <TableCell className="celda-datos text-center text-xs">
                    {fmtCelda(fila.cuotas)}
                  </TableCell>
                  <TableCell className="celda-datos text-center text-xs tabular-nums">
                    {fila.diasAcreditacion == null ? "" : String(fila.diasAcreditacion)}
                  </TableCell>
                  <TableCell className="celda-datos">
                    <CeldaPorcentajeLectura
                      valor={fila.arancel}
                      etiqueta={`Arancel ${fila.terminalNombre} ${fila.pagoNombre}`}
                    />
                  </TableCell>
                  <TableCell className="celda-datos">
                    <CeldaPorcentajeLectura
                      valor={fila.costoFinanciero}
                      etiqueta={`Cx. financiero ${fila.terminalNombre} ${fila.pagoNombre}`}
                    />
                  </TableCell>
                  <TableCell className="celda-datos celda-datos--accion-relleno-fila">
                    <div className="flex h-full w-full items-center justify-center">
                      <CeldaHabilitadoToggleVisual activo={fila.impCheque} />
                    </div>
                  </TableCell>
                  <TableCell className="celda-datos">
                    <CeldaPorcentajeLectura
                      valor={cxTotalSinIvaFinAnaCosFina(
                        fila.impCheque,
                        fila.arancel,
                        fila.costoFinanciero
                      )}
                      etiqueta={`Cx. total sin IVA ${fila.terminalNombre} ${fila.pagoNombre}`}
                    />
                  </TableCell>
                  <TableCell className="celda-datos">
                    <CeldaPorcentajeLectura
                      valor={cxTotalConIvaFinAnaCosFina(
                        fila.impCheque,
                        fila.arancel,
                        fila.costoFinanciero
                      )}
                      etiqueta={`Cx. total con IVA ${fila.terminalNombre} ${fila.pagoNombre}`}
                    />
                  </TableCell>
                  {esEditor ? (
                    <TableCell className="celda-datos">
                      <div className="flex items-center justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          aria-label={`Editar ${fila.pagoNombre} ${fila.terminalNombre}`}
                          onClick={() => setFilaEditar(fila)}
                        >
                          <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <EditarFinAnaCosFinaModal
        open={filaEditar != null}
        onOpenChange={(next) => {
          if (!next) setFilaEditar(null);
        }}
        fila={filaEditar}
        onFilaActualizada={(actualizada) => {
          onFilaActualizada(actualizada);
          setFilaEditar(actualizada);
        }}
      />
    </>
  );
}
