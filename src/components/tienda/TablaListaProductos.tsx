"use client";

import { Badge } from "@/components/ui/badge";
import {
  EmptyTableRow,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtCelda } from "@/lib/format";
import type { ListaProductoFila } from "@/lib/listaProductos";

const COL_WIDTHS = ["w-[9%]", "w-[37%]", "w-[14%]", "w-[14%]", "w-[12%]", "w-[7%]", "w-[7%]"] as const;

export default function TablaListaProductos({ items }: { items: ListaProductoFila[] }) {
  return (
    <Table variant="compact" scrollX={false}>
      <colgroup>
        {COL_WIDTHS.map((w, i) => (
          <col key={i} className={w} />
        ))}
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>COD. TIENDA</TableHead>
          <TableHead>DESCRIPCIÓN</TableHead>
          <TableHead>RUBRO</TableHead>
          <TableHead>SUB-RUBRO</TableHead>
          <TableHead>MARCA</TableHead>
          <TableHead className="text-center">BULTO</TableHead>
          <TableHead className="text-center">PROPIO</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <EmptyTableRow colSpan={COL_WIDTHS.length} message="No se encontraron productos." />
        ) : (
          items.map((item) => (
            <TableRow key={item.codTienda} className="hover:bg-transparent">
              <TableCell className="celda-datos celda-mono whitespace-nowrap">{item.codTienda}</TableCell>
              <TableCell className="celda-datos celda-destacado min-w-0 overflow-hidden">
                {item.descripcion}
              </TableCell>
              <TableCell className="celda-datos min-w-0 truncate">{item.rubro}</TableCell>
              <TableCell className="celda-datos min-w-0 truncate">{item.subRubro}</TableCell>
              <TableCell className="celda-datos min-w-0 truncate">{item.marca}</TableCell>
              <TableCell className="celda-datos celda-numero tabular-nums text-center">
                {fmtCelda(item.bulto)}
              </TableCell>
              <TableCell className="celda-datos text-center">
                {item.esProductoPropio ? (
                  <Badge variant="secondary" className="font-semibold tracking-wide">
                    PROPIO
                  </Badge>
                ) : null}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
