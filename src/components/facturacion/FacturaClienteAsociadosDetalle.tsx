"use client";

import { TableCell, TableRow } from "@/components/ui/table";
import { etiquetaClienteListado, type ClienteListaItem } from "@/lib/envios";
import { cn } from "@/lib/utils";

const SUBFILA_DETALLE_CLASS = "tabla-fila-detalle-competencia";
const SUBFILA_CELDA_BLOQUE_CLASS = "tabla-fila-detalle-competencia-celda";
const SUBFILA_CELDA_HUECA_CLASS = "tabla-fila-detalle-competencia-hueca";

interface Props {
  asociados: ClienteListaItem[];
}

export default function FacturaClienteAsociadosDetalle({ asociados }: Props) {
  if (asociados.length === 0) {
    return (
      <TableRow
        className={cn(
          SUBFILA_DETALLE_CLASS,
          "tabla-fila-detalle-competencia--cierre",
          "hover:bg-transparent"
        )}
      >
        <TableCell className={cn("celda-datos", SUBFILA_CELDA_HUECA_CLASS)} aria-hidden />
        <TableCell
          colSpan={7}
          className={cn("celda-datos text-xs text-muted-foreground", SUBFILA_CELDA_BLOQUE_CLASS)}
        >
          NO HAY CLIENTES ASOCIADOS.
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {asociados.map((cliente, index) => {
        const nombre = etiquetaClienteListado(cliente);
        const esUltima = index === asociados.length - 1;
        return (
          <TableRow
            key={cliente.id}
            className={cn(
              SUBFILA_DETALLE_CLASS,
              esUltima && "tabla-fila-detalle-competencia--cierre",
              "hover:bg-transparent"
            )}
          >
            <TableCell className={cn("celda-datos", SUBFILA_CELDA_HUECA_CLASS)} aria-hidden />
            <TableCell
              colSpan={7}
              className={cn("celda-datos max-w-0", SUBFILA_CELDA_BLOQUE_CLASS)}
            >
              <span className="block truncate text-xs text-foreground" title={nombre}>
                {nombre}
              </span>
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}
