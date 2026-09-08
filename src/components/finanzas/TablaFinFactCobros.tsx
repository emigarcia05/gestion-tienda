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
import type { FinFactCobrosPtoVtaFila } from "@/services/finFactCobros.service";

function fmtMonto(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function TablaFinFactCobros({
  filas,
}: {
  filas: FinFactCobrosPtoVtaFila[];
}) {
  const total = filas.reduce((acc, f) => acc + (Number(f.montoGravado) || 0), 0);

  return (
    <div className="contenedor-tabla-gestion flex-1 min-h-0">
      <Table variant="compact">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[40%] text-center">NRO. PTO. VTA.</TableHead>
            <TableHead className="w-[60%] text-right">MONTO GRAVADO</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.length === 0 ? (
            <EmptyTableRow
              colSpan={2}
              message="NO HAY TOTALES PARA ESTE PERIODO. SINCRONIZÁ FACTURAS DUX O ELEGÍ OTRO MES."
            />
          ) : (
            filas.map((f) => (
              <TableRow key={f.nroPtoVta}>
                <TableCell className="celda-datos text-center">{f.nroPtoVta}</TableCell>
                <TableCell className="celda-datos text-right tabular-nums">
                  {fmtMonto(f.montoGravado)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        {filas.length > 0 ? (
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold text-center">TOTAL</TableCell>
              <TableCell
                className={cn("celda-datos text-right tabular-nums font-semibold")}
              >
                {fmtMonto(total.toFixed(2))}
              </TableCell>
            </TableRow>
          </TableFooter>
        ) : null}
      </Table>
    </div>
  );
}
