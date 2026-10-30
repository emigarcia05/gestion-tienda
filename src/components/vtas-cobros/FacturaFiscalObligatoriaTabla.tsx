"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import MontoArInput from "@/components/shared/MontoArInput";
import {
  EmptyTableRow,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { guardarFacturaFiscalObligatoriaAction } from "@/actions/facturaFiscalObligatoria";
import { fmtCx } from "@/lib/balCxMercVend";
import {
  montoArCentsToNormalizedString,
  montoArNormalizedStringToCents,
} from "@/lib/montoArMask";
import type { FacturaFiscalObligatoriaFila } from "@/services/facturaFiscalObligatoria.service";

/** Restante a mostrar en pesos enteros (≤ 0 = cumplida → 0); `null` = sin obligación. */
function restantePesos(restante: number | null): number | null {
  return restante == null ? null : Math.max(0, Math.ceil(restante));
}

function normalizadoDesdePesos(pesos: number | null): string {
  return pesos == null ? "" : montoArCentsToNormalizedString(pesos * 100);
}

function CeldaFacturaObligatoria({
  fila,
  esEditor,
  onGuardado,
}: {
  fila: FacturaFiscalObligatoriaFila;
  esEditor: boolean;
  onGuardado: (fila: FacturaFiscalObligatoriaFila) => void;
}) {
  const pesosActuales = restantePesos(fila.restante);
  const [valor, setValor] = useState(() => normalizadoDesdePesos(pesosActuales));
  const [saving, startTransition] = useTransition();

  if (!esEditor) {
    return <>{pesosActuales == null ? "" : fmtCx(pesosActuales)}</>;
  }

  function guardar() {
    const pesos = valor.trim() === "" ? 0 : Math.floor(montoArNormalizedStringToCents(valor) / 100);
    const monto = pesos > 0 ? pesos : null;
    if (monto === pesosActuales || (monto == null && pesosActuales == null)) return;
    startTransition(async () => {
      const res = await guardarFacturaFiscalObligatoriaAction({ titularId: fila.titularId, monto });
      if (!res.ok) {
        toast.error(res.error);
        setValor(normalizadoDesdePesos(pesosActuales));
        return;
      }
      onGuardado(res.data);
      setValor(normalizadoDesdePesos(restantePesos(res.data.restante)));
      toast.success(`Facturación obligatoria de ${fila.titular} guardada.`);
    });
  }

  return (
    <div onBlur={guardar}>
      <MontoArInput
        soloPesosEnteros
        treatEmptyNormalizedAsBlank
        valueNormalized={valor}
        onValueNormalizedChange={setValor}
        onKeyUp={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        disabled={saving}
        className="h-8"
        aria-label={`Facturación obligatoria ${fila.titular}`}
      />
    </div>
  );
}

interface Props {
  filasIniciales: FacturaFiscalObligatoriaFila[];
  esEditor: boolean;
}

/** Monto que cada titular debe facturar sí o sí como fiscal (se descuenta con cada comprobante fiscal). */
export default function FacturaFiscalObligatoriaTabla({ filasIniciales, esEditor }: Props) {
  const [filas, setFilas] = useState(filasIniciales);

  function actualizarFila(actualizada: FacturaFiscalObligatoriaFila) {
    setFilas((prev) => prev.map((f) => (f.titularId === actualizada.titularId ? actualizada : f)));
  }

  return (
    <Table variant="compact" className="tabla-gestion-compacta w-full">
      <colgroup>
        <col />
        <col className="w-[40%]" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>TITULAR</TableHead>
          <TableHead className="text-center">FACTURACIÓN OBLIGATORIA</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.length === 0 ? (
          <EmptyTableRow colSpan={2} message="No hay titulares con puntos de venta." />
        ) : (
          filas.map((fila) => (
            <TableRow key={fila.titularId}>
              <TableCell className="celda-datos text-left font-medium">{fila.titular}</TableCell>
              <TableCell className="celda-datos text-center tabular-nums">
                <CeldaFacturaObligatoria
                  fila={fila}
                  esEditor={esEditor}
                  onGuardado={actualizarFila}
                />
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
