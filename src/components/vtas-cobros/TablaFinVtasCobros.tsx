"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import { fmtCelda } from "@/lib/format";
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import type { FinVtasCobroFila } from "@/services/finVtasCobros.service";

function fmtMonto(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function TablaFinVtasCobros({
  filas,
}: {
  filas: FinVtasCobroFila[];
}) {
  return (
    <div className="contenedor-tabla-gestion flex-1 min-h-0">
      <Table variant="compact">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[10%] text-left">FECHA</TableHead>
            <TableHead className="w-[12%] text-left">ID COBRO</TableHead>
            <TableHead className="w-[8%] text-right">ID SUC.</TableHead>
            <TableHead className="w-[12%] text-left">TIPO VALOR</TableHead>
            <TableHead className="text-left">DESCRIPCION</TableHead>
            <TableHead className="w-[12%] text-right">MONTO</TableHead>
            <TableHead className="w-[10%] text-right">ID TARJETA</TableHead>
            <TableHead className="w-[10%] text-right">ID PLAN</TableHead>
            <TableHead className="w-[10%] text-right">ID TERMINAL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.length === 0 ? (
            <EmptyTableRow
              colSpan={9}
              message="NO HAY COBROS PARA ESTE PERIODO. USÁ CONSULTAR PARA TRAER DESDE LA ÚLTIMA FECHA."
            />
          ) : (
            filas.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="celda-datos text-left tabular-nums">
                  {formatIsoYmdDdMmYyyyArgentina(f.fecha)}
                </TableCell>
                <TableCell className="celda-datos text-left tabular-nums">
                  {fmtCelda(f.idCobro)}
                </TableCell>
                <TableCell className="celda-datos text-right tabular-nums">
                  {fmtCelda(f.idSucursal)}
                </TableCell>
                <TableCell className="celda-datos text-left">
                  {fmtCelda(f.tipoValor)}
                </TableCell>
                <TableCell className="celda-datos text-left">
                  {fmtCelda(f.descripcion)}
                </TableCell>
                <TableCell className="celda-datos text-right tabular-nums">
                  {fmtMonto(f.monto)}
                </TableCell>
                <TableCell className="celda-datos text-right tabular-nums">
                  {fmtCelda(f.idTarjeta)}
                </TableCell>
                <TableCell className="celda-datos text-right tabular-nums">
                  {fmtCelda(f.idPlanTarjeta)}
                </TableCell>
                <TableCell className="celda-datos text-right tabular-nums">
                  {fmtCelda(f.idTerminal)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
