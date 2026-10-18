"use client";

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
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { fmtCantidad } from "@/lib/format";
import { evaluarCoberturaStock } from "@/lib/facturaStockCobertura";
import { cn } from "@/lib/utils";
import type { ProductoFacturaBusquedaItem } from "@/services/facturaProductos.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: ProductoFacturaBusquedaItem | null;
  /** Sucursal de la sesión. Su fila se destaca del resto. */
  sucursalCodigo: string | null;
  /**
   * Cantidad de la línea del remito. Si viene, el modal muestra SOLICITADO
   * y, si la sucursal activa no alcanza, MOVIMIENTOS.
   */
  cantidadSolicitada?: number | null;
}

const SECCION_TITULO_CLASS =
  "text-center text-xs font-bold uppercase tracking-wide text-foreground";

function mismoCodigo(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Detalle de stock por sucursal (ícono Store del typeahead y del remito).
 * Tres secciones: SOLICITADO, MOVIMIENTOS (solo si la sucursal activa no cubre) y STOCK.
 */
export default function FacturaProductoStockModal({
  open,
  onOpenChange,
  producto,
  sucursalCodigo,
  cantidadSolicitada = null,
}: Props) {
  const nombreItem = producto?.descripcion?.trim() ?? "";
  const filas = producto?.stockPorSucursal ?? [];
  const cobertura =
    cantidadSolicitada == null
      ? null
      : evaluarCoberturaStock({
          cantidad: cantidadSolicitada,
          sucursalCodigo,
          stockPorSucursal: filas,
        });
  const activa =
    sucursalCodigo != null
      ? (filas.find((f) => mismoCodigo(f.codigo, sucursalCodigo)) ?? null)
      : null;
  const otras = filas.filter((f) => activa == null || !mismoCodigo(f.codigo, activa.codigo));
  const mostrarMovimientos = cobertura != null && cobertura.estado !== "sucursal_activa";
  const unidadesTrasladar = cobertura
    ? cobertura.aportes.reduce((acc, a) => acc + a.aTraer, 0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="md"
        padding="sm"
        title="STOCK POR SUCURSALES"
        actions={
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <section className="modal-seccion-formulario flex flex-col gap-2">
            <h3 className={SECCION_TITULO_CLASS}>SOLICITADO</h3>
            <div className="flex flex-col items-center gap-0.5 text-center">
              <p className="text-sm font-semibold uppercase leading-snug text-foreground">
                {nombreItem}
              </p>
              {cobertura ? (
                <>
                  <ModalMicroLabel align="center">CANT. SOLICITADA</ModalMicroLabel>
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {fmtCantidad(cobertura.cantidad)}
                  </p>
                </>
              ) : null}
            </div>
          </section>

          {mostrarMovimientos && cobertura ? (
            <section className="modal-seccion-formulario flex flex-col gap-2">
              <h3 className={SECCION_TITULO_CLASS}>MOVIMIENTOS</h3>
              <p className="text-sm text-foreground">
                <span className="font-semibold uppercase">Unidades a comprar: </span>
                <span className="font-bold tabular-nums">{fmtCantidad(cobertura.faltanteTotal)}</span>
              </p>
              <p className="text-sm text-foreground">
                <span className="font-semibold uppercase">Unidades a trasladar: </span>
                <span className="font-bold tabular-nums">{fmtCantidad(unidadesTrasladar)}</span>
              </p>
              {cobertura.aportes.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold uppercase text-foreground">Traslados</p>
                  {cobertura.aportes.map((a) => (
                    <div
                      key={a.codigo}
                      className="flex items-center justify-between gap-3 text-sm text-foreground"
                    >
                      <span className="min-w-0 truncate uppercase">{a.nombre}</span>
                      <span className="shrink-0 font-bold tabular-nums">{fmtCantidad(a.aTraer)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="modal-seccion-formulario flex flex-col gap-2">
            <h3 className={SECCION_TITULO_CLASS}>STOCK</h3>
            {activa ? (
              <div
                className={cn(
                  "flex min-h-10 items-center justify-between gap-3 rounded-md border border-primary bg-primary/10 px-3"
                )}
              >
                <span className="min-w-0 truncate text-sm font-semibold uppercase text-foreground">
                  {activa.nombre.toLocaleUpperCase("es")}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                  {fmtCantidad(activa.stock)}
                </span>
              </div>
            ) : null}
            <div className="contenedor-tabla-gestion min-h-0 max-h-[40vh] overflow-auto">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead>SUCURSAL</TableHead>
                    <TableHead className="w-[8rem] text-right">STOCK</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {otras.length === 0 ? (
                    <EmptyTableRow
                      colSpan={2}
                      message={
                        activa ? "Sin otras sucursales." : "Sin sucursales con depósito."
                      }
                    />
                  ) : (
                    otras.map((f) => (
                      <TableRow key={f.codigo}>
                        <TableCell className="celda-datos text-left">
                          {f.nombre.toLocaleUpperCase("es")}
                        </TableCell>
                        <TableCell className="celda-datos text-right tabular-nums">
                          {fmtCantidad(f.stock)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      </AppModal>
    </Dialog>
  );
}
