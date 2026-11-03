"use client";

import { useEffect, useState, type ReactElement } from "react";
import { toast } from "sonner";
import { getPxVentaItemModalAction } from "@/actions/listaProductos";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtPrecio } from "@/lib/format";
import { resolverCategoriaMargenPxListas } from "@/lib/pxListasPreciosCategoria";
import type { FinAnaMcCategoriaItem } from "@/lib/finAnaMcCategorias";
import type {
  ItemPxListasPreciosTabla,
  ListaPrecioPxListasColumna,
  PrecioListaPxListasCelda,
} from "@/lib/pxListasPrecios";
import { cn } from "@/lib/utils";

interface DatosPxListasItem {
  listas: ListaPrecioPxListasColumna[];
  idListaGeneral: number | null;
  categoriasMc: FinAnaMcCategoriaItem[];
  item: ItemPxListasPreciosTabla;
}

function textoPx(valor: number | null): string {
  if (valor == null || !(valor > 0)) return "";
  return `$${fmtPrecio(valor)}`;
}

function textoPorc(valor: number | null): string {
  if (valor == null || !Number.isFinite(valor)) return "";
  return `${valor.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function celdaDe(
  item: ItemPxListasPreciosTabla,
  idLista: number
): PrecioListaPxListasCelda | null {
  return item.preciosPorLista.find((c) => c.idLista === idLista) ?? null;
}

/**
 * Fila de Px Listas dentro de Nuevo / Editar Item.
 * Misma grilla que la página: CAT. M.C. y, por lista, PX + PORC. UTILIDAD.
 * REF. solo en 1 - GENERAL.
 */
export default function PxListasItemEnProducto({
  codTienda,
}: {
  codTienda: string | null;
}) {
  const [datos, setDatos] = useState<DatosPxListasItem | null>(null);

  useEffect(() => {
    let cancelado = false;
    getPxVentaItemModalAction(codTienda).then((res) => {
      if (cancelado) return;
      if (!res.ok) {
        toast.error(res.error);
        setDatos(null);
        return;
      }
      setDatos(res.data);
    });
    return () => {
      cancelado = true;
    };
  }, [codTienda]);

  if (!datos) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  const { listas, idListaGeneral, categoriasMc, item } = datos;
  const general =
    idListaGeneral == null ? null : celdaDe(item, idListaGeneral);
  const categoria = resolverCategoriaMargenPxListas(general?.margenPct, categoriasMc);
  const refGeneral =
    item.opcionesCompetenciaRef.find(
      (op) => op.competenciaId === item.competenciaIdPxListaGeneral
    )?.etiqueta ?? "";
  const columnas = 1 + listas.reduce((acc, lista) => acc + (lista.idLista === idListaGeneral ? 3 : 2), 0);

  return (
    <div className="overflow-x-auto">
      <Table variant="compact" className="w-full min-w-[36rem]" scrollX={false}>
        <TableHeader>
          <TableRow>
            <TableHead rowSpan={2} className="align-middle text-center">
              CAT. M.C.
            </TableHead>
            {listas.map((lista) => {
              const esGeneral = lista.idLista === idListaGeneral;
              return (
                <TableHead
                  key={lista.idLista}
                  colSpan={esGeneral ? 3 : 2}
                  className="border-l border-primary-foreground/25 text-center"
                >
                  {lista.nombreLista.toUpperCase()}
                </TableHead>
              );
            })}
          </TableRow>
          <TableRow>
            {listas.flatMap((lista) => {
              const esGeneral = lista.idLista === idListaGeneral;
              const heads: ReactElement[] = [];
              if (esGeneral) {
                heads.push(
                  <TableHead
                    key={`${lista.idLista}-ref`}
                    className="border-l border-primary-foreground/25 text-center"
                  >
                    REF.
                  </TableHead>
                );
              }
              heads.push(
                <TableHead
                  key={`${lista.idLista}-px`}
                  className={cn(
                    "text-center",
                    !esGeneral && "border-l border-primary-foreground/25"
                  )}
                >
                  PX
                </TableHead>,
                <TableHead key={`${lista.idLista}-mg`} className="text-center">
                  PORC. UTILIDAD
                </TableHead>
              );
              return heads;
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {listas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnas} className="celda-datos text-center text-sm text-muted-foreground">
                Sin listas de precios.
              </TableCell>
            </TableRow>
          ) : (
            <TableRow>
              <TableCell className="celda-datos whitespace-nowrap text-center" title={categoria || undefined}>
                {categoria}
              </TableCell>
              {listas.flatMap((lista) => {
                const esGeneral = lista.idLista === idListaGeneral;
                const celda = celdaDe(item, lista.idLista);
                const celdas: ReactElement[] = [];
                if (esGeneral) {
                  celdas.push(
                    <TableCell
                      key={`${lista.idLista}-ref`}
                      className="celda-datos border-l border-border text-center"
                      title={
                        item.opcionesCompetenciaRef.find(
                          (op) => op.competenciaId === item.competenciaIdPxListaGeneral
                        )?.nombre
                      }
                    >
                      {refGeneral}
                    </TableCell>
                  );
                }
                celdas.push(
                  <TableCell
                    key={`${lista.idLista}-px`}
                    className={cn(
                      "celda-datos celda-numero text-center",
                      !esGeneral && "border-l border-border"
                    )}
                  >
                    {textoPx(celda?.pxEfectivo ?? null)}
                  </TableCell>,
                  <TableCell
                    key={`${lista.idLista}-mg`}
                    className="celda-datos celda-numero text-center"
                  >
                    {textoPorc(celda?.margenPct ?? null)}
                  </TableCell>
                );
                return celdas;
              })}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
