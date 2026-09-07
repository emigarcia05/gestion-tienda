"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { fmtPorcentajeTabla } from "@/lib/format";
import {
  labelCampoReglaDescuento,
  lineasCondicionReglaDescuento,
} from "@/lib/descuentosListaPrecioReglasUi";
import { CAMPO_DESC_ESPECIAL, CAMPO_PX_PROMO_FIJO } from "@/lib/descuentosListaPrecioReglasConstants";
import type { DescuentoActivoListaPrecio } from "@/services/listaPrecios.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  descuento: DescuentoActivoListaPrecio | null;
}

export default function ReglaDescuentoItemListaPreciosModal({
  open,
  onOpenChange,
  descuento,
}: Props) {
  const titulo = descuento ? labelCampoReglaDescuento(descuento.campo) : "Regla De Descuento";
  const esEspecifica = descuento?.campo === CAMPO_DESC_ESPECIAL;
  const esPromoFijo = descuento?.campo === CAMPO_PX_PROMO_FIJO;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="sm"
        padding="sm"
        title={titulo}
        actions={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        {!descuento ? (
          <p className="text-sm text-muted-foreground">Sin datos de descuento.</p>
        ) : esPromoFijo ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="font-medium text-foreground">Valor</dt>
            <dd className="tabular-nums">
              {descuento.valor.toLocaleString("es-AR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </dd>
            <dt className="font-medium text-foreground">Tipo</dt>
            <dd>Precio de compra final del ítem (misma moneda que la lista)</dd>
            <dt className="font-medium text-foreground">Px. Final</dt>
            <dd>
              Promo × (cotización si el ítem está en US$) × (1 + Cx. Transporte). Sin descuentos % ni
              Dto. extra.
            </dd>
          </dl>
        ) : esEspecifica && descuento.reglaEspecifica ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="font-medium text-foreground">Regla</dt>
            <dd>{descuento.reglaEspecifica.nombre}</dd>
            <dt className="font-medium text-foreground">Valor</dt>
            <dd className="tabular-nums">{fmtPorcentajeTabla(descuento.valor)}</dd>
            <dt className="font-medium text-foreground">Tipo</dt>
            <dd>Descuento por productos vinculados</dd>
          </dl>
        ) : descuento.regla ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="font-medium text-foreground">Valor</dt>
            <dd className="tabular-nums">{fmtPorcentajeTabla(descuento.valor)}</dd>
            <dt className="font-medium text-foreground">Condiciones</dt>
            <dd>
              <CondicionesReglaDetalle regla={descuento.regla} />
            </dd>
            <dt className="font-medium text-foreground">Especificidad</dt>
            <dd className="tabular-nums">{descuento.regla.especificidad}</dd>
          </dl>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="font-medium text-foreground">Valor</dt>
            <dd className="tabular-nums">{fmtPorcentajeTabla(descuento.valor)}</dd>
            <dt className="font-medium text-foreground">Regla</dt>
            <dd className="text-muted-foreground">No se encontró la regla que genera este valor.</dd>
          </dl>
        )}
      </AppModal>
    </Dialog>
  );
}

function CondicionesReglaDetalle({
  regla,
}: {
  regla: NonNullable<DescuentoActivoListaPrecio["regla"]>;
}) {
  const lineas = lineasCondicionReglaDescuento(regla);

  if (lineas.length === 0) {
    return <span className="text-muted-foreground">TODOS</span>;
  }

  return (
    <div className="space-y-0.5 text-sm leading-snug">
      {lineas.map((linea) => (
        <p key={linea.dimension} className="text-foreground">
          {linea.dimension} = &quot;{linea.valor}&quot;
        </p>
      ))}
    </div>
  );
}
