"use client";

import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import CatalogoFinderEmpty from "@/components/shared/catalogo-finder/CatalogoFinderEmpty";
import EnviosProyectoListadoLineas from "@/components/envios/EnviosProyectoListadoLineas";
import CatalogoFinderRow from "@/components/shared/catalogo-finder/CatalogoFinderRow";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { matchByMultiTerm } from "@/lib/busqueda";
import {
  etiquetaClienteListado,
  etiquetaDireccionEnvio,
  etiquetaNombreProyecto,
  nombrePintorAsociadoCliente,
  partesNombreClienteListado,
  type ClienteItem,
  type EnviosDireccionItem,
} from "@/lib/envios";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import { cn } from "@/lib/utils";

type PasoDirecciones = 1 | 2 | 3;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: ClienteItem[];
  direcciones: EnviosDireccionItem[];
}

export default function EnviosConductorDireccionesModal({
  open,
  onOpenChange,
  clientes,
  direcciones,
}: Props) {
  const [paso, setPaso] = useState<PasoDirecciones>(1);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [direccionId, setDireccionId] = useState<string | null>(null);
  const [qDebounced, setQDebounced] = useState("");
  const { q, setQ, handleQChange, isDebouncing, ref: searchRef } = useFiltrosConBusqueda({
    qActual: qDebounced,
    debounceMs: 300,
    onDebouncedSearch: setQDebounced,
  });

  const clientesFiltrados = useMemo(() => {
    if (!qDebounced.trim()) return clientes;
    return clientes.filter((item) =>
      matchByMultiTerm(
        [item.nombreCompleto, item.cel, item.pintorAsociado?.nombreCompleto ?? ""],
        qDebounced
      )
    );
  }, [clientes, qDebounced]);

  const clienteSeleccionado = useMemo(
    () => clientes.find((item) => item.id === clienteId) ?? null,
    [clientes, clienteId]
  );

  const direccionesCliente = useMemo(() => {
    if (!clienteId) return [];
    return direcciones.filter((item) => item.personaId === clienteId);
  }, [direcciones, clienteId]);

  const direccionSeleccionada = useMemo(
    () => direccionesCliente.find((item) => item.id === direccionId) ?? null,
    [direccionesCliente, direccionId]
  );

  function resetEstado() {
    setPaso(1);
    setClienteId(null);
    setDireccionId(null);
    setQ("");
    setQDebounced("");
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      resetEstado();
    }
    onOpenChange(next);
  }

  function handleAtras() {
    if (paso === 3) {
      setDireccionId(null);
      setPaso(2);
      return;
    }
    if (paso === 2) {
      setClienteId(null);
      setPaso(1);
    }
  }

  function handleSelectCliente(item: ClienteItem) {
    setClienteId(item.id);
    setDireccionId(null);
    setPaso(2);
  }

  function handleSelectDireccion(item: EnviosDireccionItem) {
    setDireccionId(item.id);
    setPaso(3);
  }

  const maps = direccionSeleccionada?.urlMaps.trim() ?? "";
  const referencia = direccionSeleccionada?.referencia.trim() ?? "";
  const nombreCliente = clienteSeleccionado
    ? etiquetaClienteListado(clienteSeleccionado)
    : "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <AppModal
        title="Direcciones"
        size="sm"
        className="h-[85vh] max-h-[85vh]"
        scrollBody={false}
        bodyClassName="flex min-h-0 flex-1 flex-col"
        actions={
          <div className={cn("flex w-full", paso > 1 ? "justify-between" : "justify-end")}>
            {paso > 1 ? (
              <Button type="button" variant="outline" onClick={handleAtras}>
                Atrás
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        }
      >
        <div className={cn("flex min-h-0 flex-1 flex-col gap-3")}>
          {paso === 1 ? (
            <>
              <FiltroBusquedaInput
                id="filtro-conductor-direcciones-cliente"
                placeholder="BUSCAR CLIENTE..."
                value={q}
                onChange={handleQChange}
                isDebouncing={isDebouncing}
                inputRef={searchRef}
              />
              <div className={cn("min-h-0 flex-1 overflow-y-auto rounded-md border border-border")}>
                {clientes.length === 0 ? (
                  <CatalogoFinderEmpty mensaje="No hay clientes." />
                ) : clientesFiltrados.length === 0 ? (
                  <CatalogoFinderEmpty mensaje="Ningún cliente coincide con la búsqueda." />
                ) : (
                  clientesFiltrados.map((item) => (
                    <CatalogoFinderRow
                      key={item.id}
                      nombre={partesNombreClienteListado(item).principal}
                      nombreSufijo={
                        partesNombreClienteListado(item).sufijo ??
                        nombrePintorAsociadoCliente(item) ??
                        undefined
                      }
                      selected={item.id === clienteId}
                      onClick={() => handleSelectCliente(item)}
                      mostrarAcciones={false}
                      onEditar={() => undefined}
                      onEliminar={() => undefined}
                    />
                  ))
                )}
              </div>
            </>
          ) : null}

          {paso === 2 ? (
            <>
              <ModalMicroLabel align="center">{nombreCliente}</ModalMicroLabel>
              <div className={cn("min-h-0 flex-1 overflow-y-auto rounded-md border border-border")}>
                {direccionesCliente.length === 0 ? (
                  <CatalogoFinderEmpty mensaje="No hay direcciones." />
                ) : (
                  direccionesCliente.map((item) => (
                    <CatalogoFinderRow
                      key={item.id}
                      nombre={etiquetaNombreProyecto(item)}
                      nombreContenido={<EnviosProyectoListadoLineas dir={item} />}
                      selected={item.id === direccionId}
                      onClick={() => handleSelectDireccion(item)}
                      mostrarAcciones={false}
                      onEditar={() => undefined}
                      onEliminar={() => undefined}
                    />
                  ))
                )}
              </div>
            </>
          ) : null}

          {paso === 3 && direccionSeleccionada ? (
            <div className={cn("flex min-h-0 flex-1 flex-col gap-3")}>
              <ModalMicroLabel align="center">{nombreCliente}</ModalMicroLabel>
              <p className="text-sm text-foreground">
                {etiquetaDireccionEnvio(direccionSeleccionada)}
              </p>
              {referencia !== "" ? (
                <p className="text-sm text-muted-foreground">{referencia}</p>
              ) : null}
              {maps !== "" ? (
                <Button asChild className="h-12 w-full">
                  <a href={maps} target="_blank" rel="noopener noreferrer">
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
            </div>
          ) : null}
        </div>
      </AppModal>
    </Dialog>
  );
}
