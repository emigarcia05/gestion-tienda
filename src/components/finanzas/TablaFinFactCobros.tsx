"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fmtCelda } from "@/lib/format";
import type { FinFactCobrosPtoVtaFila } from "@/services/finFactCobros.service";

function fmtMonto(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const LETRA_NO_FISCAL = "X";

type FilaPivote = {
  ptoVtaId: string;
  ptoVenta: number;
  nombreTitular: string;
  fiscal: number;
  noFiscal: number;
  total: number;
};

function agruparPorPtoYFiscal(filas: FinFactCobrosPtoVtaFila[]): FilaPivote[] {
  const porPto = new Map<string, FilaPivote>();
  for (const f of filas) {
    const letra = f.letra.trim().toLocaleUpperCase("es-AR");
    const monto = Number(f.total) || 0;
    const actual = porPto.get(f.ptoVtaId);
    if (actual) {
      if (letra === LETRA_NO_FISCAL) {
        actual.noFiscal += monto;
      } else {
        actual.fiscal += monto;
      }
      actual.total += monto;
    } else {
      porPto.set(f.ptoVtaId, {
        ptoVtaId: f.ptoVtaId,
        ptoVenta: f.ptoVenta,
        nombreTitular: f.nombreTitular,
        fiscal: letra === LETRA_NO_FISCAL ? 0 : monto,
        noFiscal: letra === LETRA_NO_FISCAL ? monto : 0,
        total: monto,
      });
    }
  }
  return [...porPto.values()].sort((a, b) => a.ptoVenta - b.ptoVenta);
}

export default function TablaFinFactCobros({
  filas,
}: {
  filas: FinFactCobrosPtoVtaFila[];
}) {
  const grupos = agruparPorPtoYFiscal(filas);
  const colSpanVacio = 4;
  let totFiscal = 0;
  let totNoFiscal = 0;
  let totalGral = 0;
  for (const g of grupos) {
    totFiscal += g.fiscal;
    totNoFiscal += g.noFiscal;
    totalGral += g.total;
  }

  return (
    <div className="contenedor-tabla-gestion flex-1 min-h-0">
      <Table variant="compact">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[36%] text-left">PTO. VTAS.</TableHead>
            <TableHead className="text-right">FISCAL</TableHead>
            <TableHead className="text-right">NO FISCAL</TableHead>
            <TableHead className="w-[16%] text-right">TOTAL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grupos.length === 0 ? (
            <EmptyTableRow
              colSpan={colSpanVacio}
              message="NO HAY TOTALES PARA ESTE PERIODO. SINCRONIZÁ REMITOS DUX O ELEGÍ OTRO MES."
            />
          ) : (
            grupos.map((g) => (
              <TableRow key={g.ptoVtaId}>
                <TableCell className="celda-datos text-left">
                  {fmtCelda(`${g.ptoVenta} - ${g.nombreTitular}`)}
                </TableCell>
                <TableCell className="celda-datos text-right tabular-nums">
                  {g.fiscal > 0 ? fmtMonto(g.fiscal.toFixed(2)) : ""}
                </TableCell>
                <TableCell className="celda-datos text-right tabular-nums">
                  {g.noFiscal > 0 ? fmtMonto(g.noFiscal.toFixed(2)) : ""}
                </TableCell>
                <TableCell className="celda-datos text-right tabular-nums">
                  {fmtMonto(g.total.toFixed(2))}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        {grupos.length > 0 ? (
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold text-left">TOTAL</TableCell>
              <TableCell
                className={cn("celda-datos text-right tabular-nums font-semibold")}
              >
                {fmtMonto(totFiscal.toFixed(2))}
              </TableCell>
              <TableCell
                className={cn("celda-datos text-right tabular-nums font-semibold")}
              >
                {fmtMonto(totNoFiscal.toFixed(2))}
              </TableCell>
              <TableCell
                className={cn("celda-datos text-right tabular-nums font-semibold")}
              >
                {fmtMonto(totalGral.toFixed(2))}
              </TableCell>
            </TableRow>
          </TableFooter>
        ) : null}
      </Table>
    </div>
  );
}
