"use client";

import AppModal from "@/components/shared/AppModal";
import LineaLecturaModal from "@/components/shared/LineaLecturaModal";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  claveFormaPagoCuotaDescPromo,
  etiquetaFormaPagoCuotaDescPromo,
  textoDescuentosDescPromo,
  type DescPromoFila,
} from "@/lib/descPromo";
import { fmtCelda } from "@/lib/format";

const TITULO_SECCION_CLASS =
  "text-center text-xs font-bold uppercase tracking-wide text-foreground";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DescPromoFila | null;
}

export default function VerDescPromoModal({ open, onOpenChange, item }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        title="VER DESCUENTO"
        size="lg"
        actions={
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        }
      >
        {item ? (
          <div className="flex flex-col gap-4">
            <section className="modal-seccion-formulario flex flex-col gap-2">
              <h3 className={TITULO_SECCION_CLASS}>DATOS</h3>
              <LineaLecturaModal etiqueta="NOMBRE" valor={fmtCelda(item.nombre)} />
              <LineaLecturaModal
                etiqueta="DESC. %"
                valor={fmtCelda(textoDescuentosDescPromo(item))}
                tabular
              />
              <LineaLecturaModal
                etiqueta="PRIORIDAD"
                valor={fmtCelda(String(item.prioridad))}
                tabular
              />
            </section>
            <section className="modal-seccion-formulario flex flex-col gap-2">
              <h3 className={TITULO_SECCION_CLASS}>FORMA DE PAGO</h3>
              {item.formasPago.length === 0 ? (
                <p className="text-sm text-muted-foreground">SIN FORMAS DE PAGO.</p>
              ) : (
                item.formasPago.map((fp, indice) => (
                  <LineaLecturaModal
                    key={claveFormaPagoCuotaDescPromo(fp.pagoId, fp.cuotaId)}
                    etiqueta={`FORMA DE PAGO (${indice + 1})`}
                    valor={fmtCelda(etiquetaFormaPagoCuotaDescPromo(fp))}
                  />
                ))
              )}
            </section>
            <section className="modal-seccion-formulario flex flex-col gap-2">
              <h3 className={TITULO_SECCION_CLASS}>ALCANCE</h3>
              <LineaLecturaModal
                etiqueta="ALCANCE"
                valor={fmtCelda(item.alcanceEtiqueta)}
              />
              {item.alcance === "MARCA" || item.alcance === "MARCA_RUBRO" ? (
                <LineaLecturaModal
                  etiqueta="MARCA"
                  valor={fmtCelda(item.marcaNombre)}
                />
              ) : null}
              {item.alcance === "RUBRO" || item.alcance === "MARCA_RUBRO" ? (
                <LineaLecturaModal
                  etiqueta="RUBRO"
                  valor={fmtCelda(item.rubroNombre)}
                />
              ) : null}
              {item.alcance === "ITEMS" ? (
                item.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">SIN PRODUCTOS.</p>
                ) : (
                  item.items.map((prod) => (
                    <LineaLecturaModal
                      key={prod.codTienda}
                      etiqueta={prod.codTienda}
                      valor={fmtCelda(prod.descripcion || prod.codTienda)}
                    />
                  ))
                )
              ) : null}
            </section>
          </div>
        ) : null}
      </AppModal>
    </Dialog>
  );
}
