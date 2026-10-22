"use client";

import AppModal from "@/components/shared/AppModal";
import LineaLecturaModal from "@/components/shared/LineaLecturaModal";
import {
  DescPromoAlcanceLectura,
  DescPromoFormasPagoLectura,
  SeccionLecturaDescPromo,
} from "@/components/desc-promos/DescPromoLectura";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  textoDescuentosDescPromo,
  textoRangoFechasDescPromo,
  type DescPromoFila,
} from "@/lib/descPromo";
import { fmtCelda } from "@/lib/format";

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
            <SeccionLecturaDescPromo titulo="DATOS">
              <LineaLecturaModal
                etiqueta="CATEGORÍA"
                valor={fmtCelda(item.categoriaEtiqueta)}
              />
              {item.categoria === "FECHA" ? (
                <LineaLecturaModal
                  etiqueta="VIGENCIA"
                  valor={fmtCelda(textoRangoFechasDescPromo(item))}
                  tabular
                />
              ) : null}
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
            </SeccionLecturaDescPromo>
            <SeccionLecturaDescPromo titulo="FORMA DE PAGO">
              <DescPromoFormasPagoLectura item={item} />
            </SeccionLecturaDescPromo>
            <SeccionLecturaDescPromo titulo="ALCANCE">
              <DescPromoAlcanceLectura item={item} />
            </SeccionLecturaDescPromo>
          </div>
        ) : null}
      </AppModal>
    </Dialog>
  );
}
