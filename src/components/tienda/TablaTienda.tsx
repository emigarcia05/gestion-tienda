"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import AppModal from "@/components/shared/AppModal";
import EditarProductoTiendaModal from "@/components/tienda/EditarProductoTiendaModal";
import { eliminarProductoTiendaAction } from "@/actions/listaProductos";
import { PERMISOS, puede, type Rol } from "@/lib/permisos";
import type { ItemTiendaParaTabla } from "@/actions/tienda";
import { costoCxProdMostrado } from "@/lib/cxPxTienda";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { fmtCelda, fmtPrecio } from "@/lib/format";

/** COD. · DESCRIPCIÓN · RUBRO · SUB-RUBRO · MARCA · PRESENTACIÓN · COLOR · COSTO · BULTO · ACCIONES */
const COL_WIDTHS = [6, 26, 9, 9, 9, 9, 8, 8, 6, 10] as const;
const COL_COUNT = COL_WIDTHS.length;

const MENSAJE_SIN_FILTRO =
  "Aplicá al menos un filtro (Marca, Rubro, Sub-rubro o búsqueda) para ver los productos.";
const MENSAJE_SIN_RESULTADOS = "No se encontraron items.";

export default function TablaTienda({
  items,
  rol,
  sinFiltros = false,
  puedeEditarCxProd = false,
  esEditor = false,
}: {
  items: ItemTiendaParaTabla[];
  rol: Rol;
  sinFiltros?: boolean;
  puedeEditarCxProd?: boolean;
  esEditor?: boolean;
}) {
  const router = useRouter();
  const puedeVincular = puede(rol, PERMISOS.tienda.tabla.vinculos);
  const [editando, setEditando] = useState<ItemTiendaParaTabla | null>(null);
  const [borrando, setBorrando] = useState<ItemTiendaParaTabla | null>(null);
  const [borrarPending, setBorrarPending] = useState(false);

  async function confirmarBorrar() {
    if (!borrando || borrarPending) return;
    setBorrarPending(true);
    try {
      const res = await eliminarProductoTiendaAction({ codTienda: borrando.codItem });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Producto ${borrando.codItem} borrado.`);
      setBorrando(null);
      router.refresh();
    } finally {
      setBorrarPending(false);
    }
  }

  return (
    <>
      <Table variant="compact" scrollX={false} className="tabla-tienda-listado">
        <colgroup>
          {COL_WIDTHS.map((pct, i) => (
            <col key={i} style={{ width: `${pct}%` }} />
          ))}
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>COD.</TableHead>
            <TableHead>DESCRIPCIÓN</TableHead>
            <TableHead>RUBRO</TableHead>
            <TableHead>SUB-RUBRO</TableHead>
            <TableHead>MARCA</TableHead>
            <TableHead>PRESENTACIÓN</TableHead>
            <TableHead>COLOR</TableHead>
            <TableHead className="text-center">COSTO</TableHead>
            <TableHead className="text-center">BULTO</TableHead>
            <TableHead className="text-center">ACCIONES</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <EmptyTableRow
              colSpan={COL_COUNT}
              message={sinFiltros ? MENSAJE_SIN_FILTRO : MENSAJE_SIN_RESULTADOS}
            />
          ) : (
            items.map((item) => (
              <TableRow key={item.id} className="hover:bg-transparent">
                <TableCell className="celda-datos celda-mono whitespace-nowrap">{item.codItem}</TableCell>
                <TableCell className="celda-datos celda-destacado min-w-0 overflow-hidden">
                  {item.descripcion}
                </TableCell>
                <TableCell className="celda-datos min-w-0 truncate">{fmtCelda(item.rubro)}</TableCell>
                <TableCell className="celda-datos min-w-0 truncate">{fmtCelda(item.subRubro)}</TableCell>
                <TableCell className="celda-datos min-w-0 truncate">{fmtCelda(item.marca)}</TableCell>
                <TableCell className="celda-datos min-w-0 truncate">{fmtCelda(item.presentacion)}</TableCell>
                <TableCell className="celda-datos min-w-0 truncate">{fmtCelda(item.color)}</TableCell>
                <TableCell className="celda-datos celda-numero tabular-nums text-center">
                  ${fmtPrecio(costoCxProdMostrado(item.cxProd))}
                </TableCell>
                <TableCell className="celda-datos celda-numero tabular-nums text-center">
                  {item.bulto ?? ""}
                </TableCell>
                <TableCell className="celda-datos celda-datos--accion-relleno-fila">
                  {esEditor ? (
                    <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                        aria-label={`Editar ${item.codItem}`}
                        title="Editar"
                        onClick={() => setEditando(item)}
                      >
                        <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                        aria-label={`Borrar ${item.codItem}`}
                        title="Borrar"
                        onClick={() => setBorrando(item)}
                      >
                        <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                      </Button>
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {editando ? (
        <EditarProductoTiendaModal
          key={editando.codItem}
          item={editando}
          puedeVincular={puedeVincular}
          puedeEditarCosto={puedeEditarCxProd}
          onClose={() => setEditando(null)}
        />
      ) : null}

      <Dialog open={Boolean(borrando)} onOpenChange={(o) => !o && !borrarPending && setBorrando(null)}>
        <AppModal
          title="BORRAR PRODUCTO"
          size="sm"
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button type="button" variant="outline" disabled={borrarPending} onClick={() => setBorrando(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={borrarPending}
                onClick={() => void confirmarBorrar()}
              >
                Borrar
              </Button>
            </div>
          }
        >
          <p className="text-sm text-muted-foreground">
            ¿Borrar <span className="font-semibold text-foreground">{borrando?.codItem}</span> ·{" "}
            <span className="font-semibold text-foreground">{borrando?.descripcion}</span>? Sus vínculos con
            proveedores quedan libres. Si tiene stock, compras, ventas o estadísticas no se podrá borrar.
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
