"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import {
  PTO_VTA_REGLA_AMBITO_TITULO,
  PTO_VTA_REGLAS,
  type PtoVtaReglaAmbito,
} from "@/lib/ptoVtaReglas";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ambitosEnOrden(): PtoVtaReglaAmbito[] {
  const vistos: PtoVtaReglaAmbito[] = [];
  for (const regla of PTO_VTA_REGLAS) {
    if (!vistos.includes(regla.ambito)) vistos.push(regla.ambito);
  }
  return vistos;
}

/**
 * Modal **Reglas Ptos. Vtas.**: resumen ordenado de elección de punto de venta.
 */
export default function ReglasPtosVtasModal({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="md"
        padding="sm"
        title="REGLAS PTOS. VTAS."
        actions={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        <div className="flex flex-col gap-4 text-sm text-foreground">
          <p className="text-muted-foreground">
            El punto de venta del comprobante se determina con estas reglas, en orden.
          </p>
          {ambitosEnOrden().map((ambito, iAmbito) => {
            const tituloAmbito = PTO_VTA_REGLA_AMBITO_TITULO[ambito];
            const reglas = PTO_VTA_REGLAS.filter((r) => r.ambito === ambito);
            return (
              <section
                key={ambito}
                className="flex flex-col gap-3"
                aria-labelledby={tituloAmbito ? `reglas-pto-vta-${ambito}` : undefined}
              >
                {iAmbito > 0 ? <hr className="border-border" /> : null}
                {tituloAmbito ? (
                  <h3
                    id={`reglas-pto-vta-${ambito}`}
                    className="font-semibold tracking-wide"
                  >
                    {tituloAmbito}
                  </h3>
                ) : null}
                <ol className="list-none space-y-3 pl-0">
                  {reglas.map((regla) => (
                    <li key={regla.id} className="flex flex-col gap-1">
                      <p className="font-semibold">
                        {regla.orden}. {regla.titulo}
                      </p>
                      <p className="font-normal text-foreground">{regla.resumen}</p>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      </AppModal>
    </Dialog>
  );
}
