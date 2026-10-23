"use client";

import type { ReactNode } from "react";
import AppModal from "@/components/shared/AppModal";
import LineaLecturaModal from "@/components/shared/LineaLecturaModal";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  etiquetaDepartamentoEnvio,
  etiquetaFormaPagadoEnvio,
  etiquetaHorarioEnvio,
  etiquetaNombreProyecto,
  etiquetaSucursalEnvio,
  nombreDestinatarioEnvio,
  nombrePintorColumnaEnvio,
  telefonoEnvio,
  type EnviosFinalListItem,
} from "@/lib/envios";
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import { fmtCelda } from "@/lib/format";

const TITULO_SECCION_CLASS =
  "text-center text-xs font-bold uppercase tracking-wide text-foreground";
const LINK_CLASS = "text-primary underline underline-offset-2";

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="modal-seccion-formulario flex flex-col gap-2">
      <h3 className={TITULO_SECCION_CLASS}>{titulo}</h3>
      {children}
    </section>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: EnviosFinalListItem | null;
}

/** Envios · Programados: datos del envío en solo lectura. */
export default function VerEnvioModal({ open, onOpenChange, item }: Props) {
  const dir = item?.direccion;
  const calleNum = dir
    ? [dir.calleNombre.trim(), dir.numeracion.trim()].filter(Boolean).join(" ")
    : "";
  const zona = dir
    ? [dir.distrito.trim(), etiquetaDepartamentoEnvio(dir.departamento)].filter(Boolean).join(", ")
    : "";
  const maps = dir?.urlMaps.trim() ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        title="VER ENVÍO"
        size="lg"
        actions={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        {item && dir ? (
          <div className="flex flex-col gap-4">
            <Seccion titulo="DATOS">
              <LineaLecturaModal
                etiqueta="SUCURSAL"
                valor={etiquetaSucursalEnvio(item.sucursal)}
              />
              <LineaLecturaModal
                etiqueta="CLIENTE"
                valor={fmtCelda(nombreDestinatarioEnvio(item))}
              />
              {nombrePintorColumnaEnvio(item) ? (
                <LineaLecturaModal
                  etiqueta="PINTOR"
                  valor={nombrePintorColumnaEnvio(item)}
                />
              ) : null}
              <LineaLecturaModal
                etiqueta="TELÉFONO"
                valor={fmtCelda(telefonoEnvio(item))}
                tabular
              />
              <LineaLecturaModal
                etiqueta="FECHA"
                valor={formatIsoYmdDdMmYyyyArgentina(item.fechaEnvioIso)}
                tabular
              />
              <LineaLecturaModal
                etiqueta="HORARIO"
                valor={etiquetaHorarioEnvio(item.horaDesde, item.horaHasta)}
                tabular
              />
              <LineaLecturaModal
                etiqueta="FORMA DE PAGO"
                valor={etiquetaFormaPagadoEnvio(item.formaPagado)}
              />
              <LineaLecturaModal
                etiqueta="ENTREGADO"
                valor={item.entregado ? "SÍ" : "NO"}
              />
              {item.observacionEnvio.trim() ? (
                <LineaLecturaModal
                  etiqueta="OBSERVACIÓN"
                  valor={item.observacionEnvio.trim()}
                />
              ) : null}
            </Seccion>
            <Seccion titulo="DIRECCIÓN">
              <LineaLecturaModal etiqueta="PROYECTO" valor={etiquetaNombreProyecto(dir)} />
              <LineaLecturaModal etiqueta="DIRECCIÓN" valor={fmtCelda(calleNum)} />
              <LineaLecturaModal etiqueta="ZONA" valor={fmtCelda(zona)} />
              {dir.referencia.trim() ? (
                <LineaLecturaModal etiqueta="REFERENCIA" valor={dir.referencia.trim()} />
              ) : null}
              <LineaLecturaModal
                etiqueta="UBICACIÓN"
                valor={
                  maps ? (
                    <a href={maps} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                      ABRIR EN MAPS
                    </a>
                  ) : (
                    "SIN UBICACIÓN"
                  )
                }
              />
            </Seccion>
            <Seccion titulo="COMPROBANTE">
              <LineaLecturaModal
                etiqueta="PDF"
                valor={
                  item.tienePdf ? (
                    <a
                      href={`/api/envios/${item.id}/comprobante`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={LINK_CLASS}
                    >
                      {item.pdfComprobanteNombre?.trim() || "VER PDF"}
                    </a>
                  ) : (
                    "SIN PDF"
                  )
                }
              />
            </Seccion>
          </div>
        ) : null}
      </AppModal>
    </Dialog>
  );
}
