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

type FilaPivote = {
  ptoVtaId: string;
  ptoVenta: number;
  nombrePtoVenta: string;
  porLetra: Record<string, number>;
  total: number;
};

function agruparPorPtoYLetra(filas: FinFactCobrosPtoVtaFila[]): {
  letras: string[];
  grupos: FilaPivote[];
} {
  const letrasSet = new Set<string>();
  const porPto = new Map<string, FilaPivote>();
  for (const f of filas) {
    const letra = f.letra.trim().toLocaleUpperCase("es-AR");
    if (letra) letrasSet.add(letra);
    const monto = Number(f.total) || 0;
    const actual = porPto.get(f.ptoVtaId);
    if (actual) {
      actual.porLetra[letra] = (actual.porLetra[letra] ?? 0) + monto;
      actual.total += monto;
    } else {
      porPto.set(f.ptoVtaId, {
        ptoVtaId: f.ptoVtaId,
        ptoVenta: f.ptoVenta,
        nombrePtoVenta: f.nombrePtoVenta,
        porLetra: { [letra]: monto },
        total: monto,
      });
    }
  }
  const letras = [...letrasSet].sort((a, b) => a.localeCompare(b, "es-AR"));
  const grupos = [...porPto.values()].sort((a, b) => a.ptoVenta - b.ptoVenta);
  return { letras, grupos };
}

export default function TablaFinFactCobros({
  filas,
}: {
  filas: FinFactCobrosPtoVtaFila[];
}) {
  const { letras, grupos } = agruparPorPtoYLetra(filas);
  const colSpanVacio = 3 + letras.length;
  const totPorLetra: Record<string, number> = {};
  let totalGral = 0;
  for (const g of grupos) {
    totalGral += g.total;
    for (const letra of letras) {
      totPorLetra[letra] = (totPorLetra[letra] ?? 0) + (g.porLetra[letra] ?? 0);
    }
  }

  return (
    <div className="contenedor-tabla-gestion flex-1 min-h-0">
      <Table variant="compact">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[12%] text-center">PTO. VENTA</TableHead>
            <TableHead className="w-[28%] text-left">NOMBRE PTO. VENTA</TableHead>
            {letras.map((letra) => (
              <TableHead key={letra} className="text-right">
                {letra}
              </TableHead>
            ))}
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
                <TableCell className="celda-datos text-center tabular-nums">
                  {g.ptoVenta}
                </TableCell>
                <TableCell className="celda-datos text-left">
                  {fmtCelda(g.nombrePtoVenta)}
                </TableCell>
                {letras.map((letra) => (
                  <TableCell
                    key={letra}
                    className="celda-datos text-right tabular-nums"
                  >
                    {g.porLetra[letra] != null
                      ? fmtMonto(g.porLetra[letra].toFixed(2))
                      : ""}
                  </TableCell>
                ))}
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
              <TableCell className="font-semibold text-center">TOTAL</TableCell>
              <TableCell className="celda-datos" />
              {letras.map((letra) => (
                <TableCell
                  key={letra}
                  className={cn("celda-datos text-right tabular-nums font-semibold")}
                >
                  {fmtMonto((totPorLetra[letra] ?? 0).toFixed(2))}
                </TableCell>
              ))}
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
