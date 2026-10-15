"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getVinculos } from "@/actions/vinculos";
import type { ItemTiendaParaTabla } from "@/actions/tienda";
import AppModal from "@/components/shared/AppModal";
import LineaLecturaModal from "@/components/shared/LineaLecturaModal";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { fmtCelda } from "@/lib/format";
import {
  ordenarFilasVinculosTienda,
  type ProductoVinculoTienda,
} from "@/lib/vinculosTiendaUi";

const TITULO_SECCION_CLASS =
  "text-center text-xs font-bold uppercase tracking-wide text-foreground";

function etiquetaVinculo(producto: ProductoVinculoTienda): string {
  const proveedor = (producto.proveedor.nombre || producto.proveedor.prefijo)
    .trim()
    .toLocaleUpperCase("es-AR");
  const item = producto.descripcion.trim().toLocaleUpperCase("es-AR");
  return [proveedor, item].filter((parte) => parte.length > 0).join(" - ");
}

/** Solo lectura. **Editar** cierra este diálogo y abre `EditarProductoTiendaModal`. */
export default function VerProductoTiendaModal({
  item,
  puedeEditar,
  onClose,
  onEditar,
}: {
  item: ItemTiendaParaTabla;
  puedeEditar: boolean;
  onClose: () => void;
  onEditar: () => void;
}) {
  const [vinculos, setVinculos] = useState<ProductoVinculoTienda[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    void getVinculos(item.codItem).then((result) => {
      if (!activo) return;
      if (result.success) {
        const filas = ordenarFilasVinculosTienda(
          result.data.productos as ProductoVinculoTienda[],
          item.proveedorDux ?? ""
        );
        setVinculos(filas.map((fila) => fila.producto));
      } else {
        toast.error(result.error);
        setVinculos([]);
      }
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, [item.codItem, item.proveedorDux]);

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <AppModal
        title="VER PRODUCTO"
        size="lg"
        actions={
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            {puedeEditar ? (
              <Button type="button" onClick={onEditar}>
                Editar
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <section className="modal-seccion-formulario flex flex-col gap-2">
            <h3 className={TITULO_SECCION_CLASS}>DATOS DEL PRODUCTO</h3>
            <LineaLecturaModal etiqueta="COD." valor={fmtCelda(item.codItem)} tabular />
            <LineaLecturaModal etiqueta="DESCRIPCIÓN" valor={fmtCelda(item.descripcion)} />
            <LineaLecturaModal etiqueta="MARCA" valor={fmtCelda(item.marca)} />
            <LineaLecturaModal etiqueta="RUBRO" valor={fmtCelda(item.rubro)} />
            <LineaLecturaModal etiqueta="SUB-RUBRO" valor={fmtCelda(item.subRubro)} />
            <LineaLecturaModal etiqueta="PRESENTACIÓN" valor={fmtCelda(item.presentacion)} />
            <LineaLecturaModal etiqueta="COLOR" valor={fmtCelda(item.color)} />
            <LineaLecturaModal etiqueta="TERMINACIÓN" valor={fmtCelda(item.terminacion)} />
          </section>
          <section className="modal-seccion-formulario flex flex-col gap-2">
            <h3 className={TITULO_SECCION_CLASS}>ITEM VINCULADOS</h3>
            {cargando ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : vinculos.length === 0 ? (
              <p className="text-sm text-muted-foreground">SIN VÍNCULOS CON PROVEEDORES.</p>
            ) : (
              vinculos.map((producto, indice) => (
                <LineaLecturaModal
                  key={producto.id}
                  etiqueta={`PROVEEDOR - ITEM (${indice + 1})`}
                  valor={etiquetaVinculo(producto)}
                />
              ))
            )}
          </section>
        </div>
      </AppModal>
    </Dialog>
  );
}
