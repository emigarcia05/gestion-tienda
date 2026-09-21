"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { marcarEnviosFinalEntregadoAction } from "@/actions/envios";
import EnviosConductorDireccionesModal from "@/components/envios/EnviosConductorDireccionesModal";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  compararEnvioPorProximidad,
  etiquetaDepartamentoEnvio,
  etiquetaSucursalEnvio,
  etiquetaHorarioEnvio,
  nombreDestinatarioEnvio,
  nombrePintorAsociadoCliente,
  telefonoEnvio,
  type ClienteItem,
  type EnviosDireccionItem,
  type EnviosFinalListItem,
  type EnviosSucursalOption,
} from "@/lib/envios";
import {
  addDaysToIsoYmdArgentina,
  dateToIsoYmdArgentina,
  formatIsoYmdDdMmYyyyArgentina,
} from "@/lib/fechaArgentina";
import { cn } from "@/lib/utils";

const FILTRO_SUCURSAL_TODAS = "__todos__";
const FILTRO_DIA_HOY = "hoy";
const FILTRO_DIA_MANANA = "manana";

interface Props {
  envios: EnviosFinalListItem[];
  clientes: ClienteItem[];
  direcciones: EnviosDireccionItem[];
  sucursales: EnviosSucursalOption[];
}

export default function EnviosConductorPageClient({
  envios,
  clientes,
  direcciones,
  sucursales,
}: Props) {
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [modalDireccionesOpen, setModalDireccionesOpen] = useState(false);
  const [filtroSucursal, setFiltroSucursal] = useState(FILTRO_SUCURSAL_TODAS);
  const [filtroDia, setFiltroDia] = useState(FILTRO_DIA_HOY);
  const [modalEntregar, setModalEntregar] = useState<
    { open: false } | { open: true; id: string; label: string }
  >({ open: false });
  const [entregando, setEntregando] = useState(false);
  const tarjetasRef = useRef<Map<string, HTMLElement>>(new Map());
  const router = useRouter();

  useLayoutEffect(() => {
    if (!abiertoId) return;
    const el = tarjetasRef.current.get(abiertoId);
    if (!el) return;
    const frame = requestAnimationFrame(() => {
      el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [abiertoId]);

  const enviosVisibles = useMemo(() => {
    const hoyIso = dateToIsoYmdArgentina(new Date());
    const diaIso =
      filtroDia === FILTRO_DIA_MANANA ? addDaysToIsoYmdArgentina(hoyIso, 1) : hoyIso;
    return envios
      .filter((item) => {
        if (filtroSucursal !== FILTRO_SUCURSAL_TODAS && item.sucursal.id !== filtroSucursal) {
          return false;
        }
        return item.fechaEnvioIso === diaIso;
      })
      .sort(compararEnvioPorProximidad);
  }, [envios, filtroSucursal, filtroDia]);

  async function handleConfirmarEntrega() {
    if (!modalEntregar.open || entregando) return;
    setEntregando(true);
    try {
      const res = await marcarEnviosFinalEntregadoAction({
        id: modalEntregar.id,
        entregado: true,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo marcar como entregado.");
        return;
      }
      toast.success("Envío marcado como entregado.");
      setModalEntregar({ open: false });
      setAbiertoId(null);
      router.refresh();
    } finally {
      setEntregando(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 justify-center">
      <div className="flex h-full w-[24rem] min-h-0 flex-col gap-3 p-4">
        <h1 className="text-center text-sm font-semibold uppercase tracking-wide text-foreground">
          CONDUCTOR
        </h1>
        <Button
          type="button"
          className="h-12 w-full"
          onClick={() => setModalDireccionesOpen(true)}
        >
          DIRECCIONES
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <ModalMicroLabel align="center">SUCURSAL</ModalMicroLabel>
            <Select value={filtroSucursal} onValueChange={setFiltroSucursal}>
              <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS}>
                <SelectValue placeholder="SUCURSAL" />
              </SelectTrigger>
              <SelectContent className="select-content-filtro" position="popper" side="bottom" align="start">
                <SelectItem value={FILTRO_SUCURSAL_TODAS}>TODAS</SelectItem>
                {sucursales.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {etiquetaSucursalEnvio(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <ModalMicroLabel align="center">DÍA</ModalMicroLabel>
            <Select value={filtroDia} onValueChange={setFiltroDia}>
              <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS}>
                <SelectValue placeholder="DÍA" />
              </SelectTrigger>
              <SelectContent className="select-content-filtro" position="popper" side="bottom" align="start">
                <SelectItem value={FILTRO_DIA_HOY}>HOY</SelectItem>
                <SelectItem value={FILTRO_DIA_MANANA}>MAÑANA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <EnviosConductorDireccionesModal
          open={modalDireccionesOpen}
          onOpenChange={setModalDireccionesOpen}
          clientes={clientes}
          direcciones={direcciones}
        />
        <Dialog
          open={modalEntregar.open}
          onOpenChange={(open) => {
            if (!open && !entregando) setModalEntregar({ open: false });
          }}
        >
          <AppModal
            title="Entregado"
            size="sm"
            actions={
              <div className={cn("flex w-full justify-end gap-2")}>
                <Button
                  type="button"
                  variant="outline"
                  disabled={entregando}
                  onClick={() => setModalEntregar({ open: false })}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={entregando}
                  onClick={() => void handleConfirmarEntrega()}
                >
                  Entregar
                </Button>
              </div>
            }
          >
            <p className="text-sm text-foreground">
              ¿Confirmás la entrega
              {modalEntregar.open && modalEntregar.label !== ""
                ? ` a ${modalEntregar.label}`
                : ""}
              ?
            </p>
          </AppModal>
        </Dialog>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {enviosVisibles.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              NO HAY ENVÍOS PENDIENTES.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {enviosVisibles.map((item) => {
                const abierto = abiertoId === item.id;
                const maps = item.direccion.urlMaps.trim();
                const tel = telefonoEnvio(item);
                const telHref = tel !== "" ? `tel:${tel.replace(/\s+/g, "")}` : "";
                const calle = item.direccion.calleNombre.trim();
                const numeracion = item.direccion.numeracion.trim();
                const distrito = item.direccion.distrito.trim();
                const departamento = etiquetaDepartamentoEnvio(item.direccion.departamento).trim();
                const referencia = item.direccion.referencia.trim();
                const lineaCalle = [calle, numeracion].filter(Boolean).join(", ");
                const lineaDistrito = [distrito, departamento].filter(Boolean).join(", ");
                const nombreDestinatario = nombreDestinatarioEnvio(item);
                const nombrePintorAsociado = item.clienteFinal
                  ? nombrePintorAsociadoCliente(item.clienteFinal)
                  : null;
                return (
                  <article
                    key={item.id}
                    ref={(node) => {
                      if (node) tarjetasRef.current.set(item.id, node);
                      else tarjetasRef.current.delete(item.id);
                    }}
                    className={cn(
                      "flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm"
                    )}
                  >
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold text-foreground">
                        <span>{nombreDestinatario}</span>
                        {nombrePintorAsociado ? (
                          <span className="font-normal">{` - Cliente de ${nombrePintorAsociado}`}</span>
                        ) : null}
                      </p>
                      <p className="text-sm tabular-nums text-muted-foreground">
                        {formatIsoYmdDdMmYyyyArgentina(item.fechaEnvioIso)}
                        {" · "}
                        {etiquetaHorarioEnvio(item.horaDesde, item.horaHasta)}
                      </p>
                      {item.observacionEnvio.trim() !== "" ? (
                        <p className="whitespace-pre-wrap text-sm text-foreground">
                          {item.observacionEnvio.trim()}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      className="h-12 w-full"
                      variant={abierto ? "outline" : "default"}
                      aria-expanded={abierto}
                      onClick={() => setAbiertoId(abierto ? null : item.id)}
                    >
                      {abierto ? "Cerrar" : "Ver"}
                    </Button>
                    {abierto ? (
                      <div className="flex flex-col gap-3">
                        <div className="text-sm text-foreground">
                          {lineaCalle !== "" ? (
                            <p className="font-semibold">{lineaCalle}.</p>
                          ) : null}
                          {lineaDistrito !== "" ? (
                            <p className="font-semibold">{lineaDistrito}.</p>
                          ) : null}
                          {referencia !== "" ? (
                            <p className="font-normal">({referencia})</p>
                          ) : null}
                        </div>
                        {maps !== "" ? (
                          <Button asChild className="h-12 w-full">
                            <a
                              href={maps}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                              Maps
                            </a>
                          </Button>
                        ) : (
                          <Button type="button" className="h-12 w-full" disabled>
                            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                            Maps
                          </Button>
                        )}
                        {telHref !== "" ? (
                          <Button asChild className="h-12 w-full">
                            <a href={telHref}>
                              <Phone className="h-4 w-4 shrink-0" aria-hidden />
                              Llamar
                            </a>
                          </Button>
                        ) : (
                          <Button type="button" className="h-12 w-full" disabled>
                            <Phone className="h-4 w-4 shrink-0" aria-hidden />
                            Llamar
                          </Button>
                        )}
                        {item.tienePdf ? (
                          <Button asChild className="h-12 w-full">
                            <a
                              href={`/api/envios/${item.id}/comprobante`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <FileText className="h-4 w-4 shrink-0" aria-hidden />
                              PDF
                            </a>
                          </Button>
                        ) : (
                          <Button type="button" className="h-12 w-full" disabled>
                            <FileText className="h-4 w-4 shrink-0" aria-hidden />
                            PDF
                          </Button>
                        )}
                        <Button
                          type="button"
                          className="h-12 w-full"
                          onClick={() =>
                            setModalEntregar({
                              open: true,
                              id: item.id,
                              label: nombreDestinatario,
                            })
                          }
                        >
                          ENTREGADO
                        </Button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
