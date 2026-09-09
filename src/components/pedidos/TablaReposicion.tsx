"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  TableEmptyState,
  tableEmptyStateContainerVariants,
  tableEmptyStateMessageVariants,
} from "@/components/shared/TableEmptyState";
import { cn } from "@/lib/utils";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import type { ReposicionData, ItemReposicion, SucursalReposicion } from "@/actions/reposicion";
import { deleteReglaReposicion } from "@/actions/reposicion";
import ConfigurarReposicionModal from "./ConfigurarReposicionModal";
import { fmtCelda } from "@/lib/format";
import { labelReposicionFormaPedidoVendedor } from "@/lib/validations/reposicion";

const COL_WIDTHS_PCT = [50, 12, 8, 8, 8, 7, 7] as const;
const CELL_MIN = "min-w-0";

interface Props {
  data: ReposicionData;
  sucursalActual: SucursalReposicion | null;
}

export default function TablaReposicion({
  data,
  sucursalActual,
}: Props) {
  const router = useRouter();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<ItemReposicion | null>(null);
  const items = data.items;

  const handleDelete = useCallback(
    async (item: ItemReposicion) => {
      if (!item.idReposicion) return;
      setSavingId(item.idListaTienda);
      const res = await deleteReglaReposicion({ id: item.idReposicion });
      setSavingId(null);
      if (res.ok) {
        router.refresh();
      } else {
        toast.error(res.error ?? "Error al eliminar.");
      }
    },
    [router]
  );

  const sucursalSeleccionada = sucursalActual !== null;

  return (
    <div className="contenedor-tabla-gestion no-scroll-x">
      {!sucursalSeleccionada ? (
        <TableEmptyState
          placement="blockedPanel"
          textSize="sm"
          maxWidth="full"
          message="Seleccioná una sucursal para ver los ítems."
        />
      ) : (
        <Table variant="compact" className="tabla-gestion-compacta w-full table-fixed">
          <colgroup>
            {COL_WIDTHS_PCT.map((pct, i) => (
              <col key={i} style={{ width: `${pct}%` }} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {/* Información principal */}
              <TableHead className={CELL_MIN}>
                DESCRIPCIÓN
              </TableHead>
              <TableHead className={CELL_MIN}>
                FORMA PEDIR
              </TableHead>
              <TableHead className={CELL_MIN}>
                PUNTO REPOSIC.
              </TableHead>
              <TableHead className={CELL_MIN}>
                CANT. REPOSIC.
              </TableHead>
              <TableHead className={cn(CELL_MIN, "text-center")} aria-label="Eliminar">
                <div className="flex items-center justify-center w-full">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </div>
              </TableHead>
              {/* Información secundaria */}
              <TableHead className={cn(CELL_MIN, "tabla-bloque-secundario-head-divider")}>
                STOCK
              </TableHead>
              <TableHead className={cn(CELL_MIN, "tabla-bloque-secundario-head")}>
                CANT. A PEDIR
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className={cn(
                    tableEmptyStateContainerVariants({
                      placement: "tableCellTall",
                      textSize: "xs",
                    })
                  )}
                >
                  <span
                    className={tableEmptyStateMessageVariants({
                      maxWidth: "full",
                    })}
                  >
                    Sin resultados
                  </span>
                </TableCell>
              </TableRow>
            )}
            {items.map((item) => {
              const key = item.idListaTienda;
              const isSaving = savingId === key;
              const tieneRegla = item.idReposicion != null;
              const puntoVal = tieneRegla ? item.puntoReposicion : "";
              const cantReposicVal = tieneRegla ? item.cant : "";
              const cantAPedirVal = tieneRegla ? item.cantPedir : "";

              return (
                <TableRow
                  key={key}
                  className="cursor-pointer"
                  onDoubleClick={(e) => {
                    if ((e.target as HTMLElement).closest("button[aria-label='Eliminar regla de reposición']")) return;
                    setModalItem(item);
                  }}
                >
                  {/* Principal */}
                  <TableCell className="celda-datos">
                    {fmtCelda(item.descripcionTienda)}
                  </TableCell>
                  <TableCell className="celda-datos">
                    {item.formaPedir
                      ? labelReposicionFormaPedidoVendedor(item.formaPedir)
                      : fmtCelda(null)}
                  </TableCell>
                  <TableCell className="celda-datos tabular-nums">
                    {puntoVal === "" ? "" : puntoVal}
                  </TableCell>
                  <TableCell className="celda-datos tabular-nums">
                    {cantReposicVal === "" ? "" : cantReposicVal}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "celda-datos text-center",
                      item.idReposicion && "celda-datos--accion-relleno-fila"
                    )}
                  >
                    {item.idReposicion ? (
                      <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          onClick={() => handleDelete(item)}
                          disabled={isSaving}
                          aria-label="Eliminar regla de reposición"
                        >
                          <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                        </Button>
                      </div>
                    ) : (
                      <span className="inline-block w-8" aria-hidden />
                    )}
                  </TableCell>
                  {/* Secundaria */}
                  <TableCell className="celda-datos celda-numero tabular-nums tabla-bloque-secundario-cell-divider">
                    {item.stock}
                  </TableCell>
                  <TableCell className="celda-datos celda-numero tabular-nums tabla-bloque-secundario-cell">
                    {cantAPedirVal === "" ? "" : cantAPedirVal}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {sucursalActual && modalItem && (
        <ConfigurarReposicionModal
          open={!!modalItem}
          onOpenChange={(open) => !open && setModalItem(null)}
          item={modalItem}
          sucursal={sucursalActual}
        />
      )}
    </div>
  );
}
