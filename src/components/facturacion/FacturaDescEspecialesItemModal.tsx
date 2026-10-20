"use client";

import AppModal from "@/components/shared/AppModal";
import LineaLecturaModal from "@/components/shared/LineaLecturaModal";
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
import { fmtCelda } from "@/lib/format";
import type { ProductoFacturaBusquedaItem } from "@/services/facturaProductos.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: ProductoFacturaBusquedaItem | null;
}

const SECCION_TITULO_CLASS =
  "text-center text-xs font-bold uppercase tracking-wide text-foreground";

/** Lista las promos de alcance ITEMS (DESC. ESPECIAL) del código buscado. */
export default function FacturaDescEspecialesItemModal({
  open,
  onOpenChange,
  producto,
}: Props) {
  const especiales = producto?.descEspeciales ?? [];
  const itemEtiqueta = producto
    ? [producto.codTienda, producto.descripcion].filter(Boolean).join(" · ")
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="lg"
        padding="sm"
        title="DESC. ESPECIAL"
        actions={
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <section className="modal-seccion-formulario flex flex-col gap-2">
            <h3 className={SECCION_TITULO_CLASS}>ÍTEM</h3>
            <LineaLecturaModal etiqueta="ÍTEM" valor={fmtCelda(itemEtiqueta)} />
          </section>
          <section className="modal-seccion-formulario flex min-h-0 flex-col gap-2">
            <h3 className={SECCION_TITULO_CLASS}>PROMOCIONES</h3>
            <div className="contenedor-tabla-gestion min-h-0 max-h-[40vh] overflow-auto">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead>NOMBRE</TableHead>
                    <TableHead className="w-[5.5rem]">DESC.</TableHead>
                    <TableHead>FORMA DE PAGO</TableHead>
                    <TableHead className="w-[6.5rem]">PRIORIDAD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {especiales.length === 0 ? (
                    <EmptyTableRow
                      colSpan={4}
                      message="Sin promociones especiales."
                    />
                  ) : (
                    especiales.map((promo) => (
                      <TableRow key={promo.id}>
                        <TableCell className="celda-datos min-w-0 truncate text-center">
                          {fmtCelda(promo.nombre)}
                        </TableCell>
                        <TableCell className="celda-datos text-center tabular-nums">
                          {`${Math.round(promo.descuento)}%`}
                        </TableCell>
                        <TableCell className="celda-datos min-w-0 truncate text-center">
                          {fmtCelda(promo.formasPago)}
                        </TableCell>
                        <TableCell className="celda-datos text-center tabular-nums">
                          {fmtCelda(String(promo.prioridad))}
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
