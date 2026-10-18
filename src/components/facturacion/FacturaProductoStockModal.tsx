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
import { evaluarCoberturaStock, type AporteStockSucursal } from "@/lib/facturaStockCobertura";
import { cn } from "@/lib/utils";
import type { ProductoFacturaBusquedaItem } from "@/services/facturaProductos.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: ProductoFacturaBusquedaItem | null;
  /** Sucursal de la sesión. Su fila se separa del resto. */
  sucursalCodigo: string | null;
  /**
   * Cantidad de la línea del remito. Si viene, el modal explica cómo completar
   * el faltante de la sucursal activa.
   */
  cantidadSolicitada?: number | null;
}

function PlanAportes({ aportes }: { aportes: AporteStockSucursal[] }) {
  return (
    <div className="contenedor-tabla-gestion min-h-0 overflow-auto">
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>SUCURSAL</TableHead>
            <TableHead className="w-[8rem] text-right">A TRAER</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {aportes.map((a) => (
            <TableRow key={a.codigo}>
              <TableCell className="celda-datos text-left">
                {a.nombre.toLocaleUpperCase("es")}
              </TableCell>
              <TableCell className="celda-datos text-right tabular-nums">
                {fmtCantidad(a.aTraer)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Detalle de stock por sucursal (ícono Store del typeahead y del remito).
 * Título fijo. El ítem va en el cuerpo. La sucursal activa queda aparte de las demás.
 * Con `cantidadSolicitada`, indica cómo completar el faltante.
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
      ? (filas.find((f) => f.codigo === sucursalCodigo) ?? null)
      : null;
  const otras = filas.filter((f) => f.codigo !== activa?.codigo);

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
          <p className="text-center text-sm font-semibold uppercase leading-snug text-foreground">
            {nombreItem}
          </p>
          {cobertura ? (
            <section className="flex flex-col gap-2">
              <ModalMicroLabel>CANT. SOLICITADA</ModalMicroLabel>
              <p className="text-sm font-bold tabular-nums text-foreground">
                {fmtCantidad(cobertura.cantidad)}
              </p>
              <ModalMicroLabel>COMPLETAR STOCK</ModalMicroLabel>
              {cobertura.estado === "sucursal_activa" ? (
                <p className="text-sm text-foreground">
                  La sucursal activa cubre la cantidad.
                </p>
              ) : cobertura.estado === "otras_sucursales" ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-foreground">
                    {`Faltan ${fmtCantidad(cobertura.faltanteActiva)} en ${
                      cobertura.nombreActiva?.toLocaleUpperCase("es") ?? "la sucursal activa"
                    }. Se puede completar así:`}
                  </p>
                  <PlanAportes aportes={cobertura.aportes} />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-foreground">
                    {`Faltan ${fmtCantidad(cobertura.faltanteTotal)} unidades entre todas las sucursales.`}
                  </p>
                  {cobertura.aportes.length > 0 ? (
                    <>
                      <p className="text-sm text-foreground">
                        Con lo disponible en otras sucursales se puede traer:
                      </p>
                      <PlanAportes aportes={cobertura.aportes} />
                    </>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}

          {activa ? (
            <section className="flex flex-col gap-2">
              <ModalMicroLabel>SUCURSAL ACTIVA</ModalMicroLabel>
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
            </section>
          ) : null}

          <section className={cn("flex flex-col gap-2", activa && "border-t border-border pt-4")}>
            <ModalMicroLabel>
              {activa ? "OTRAS SUCURSALES" : "SUCURSALES"}
            </ModalMicroLabel>
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
