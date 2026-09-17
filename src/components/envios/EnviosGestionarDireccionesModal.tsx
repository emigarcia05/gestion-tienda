"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import CrearEditarClienteModal from "@/components/envios/CrearEditarClienteModal";
import CrearEditarEnviosDireccionModal from "@/components/envios/CrearEditarEnviosDireccionModal";
import EnviosMapsLink from "@/components/envios/EnviosMapsLink";
import EnviosPintorConsumidoresButton from "@/components/envios/EnviosPintorConsumidoresButton";
import { eliminarClienteAction, eliminarEnviosDireccionAction } from "@/actions/envios";
import CatalogoFinderColumn from "@/components/shared/catalogo-finder/CatalogoFinderColumn";
import CatalogoFinderEmpty from "@/components/shared/catalogo-finder/CatalogoFinderEmpty";
import CatalogoFinderRow from "@/components/shared/catalogo-finder/CatalogoFinderRow";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { matchByMultiTerm } from "@/lib/busqueda";
import {
  etiquetaClienteListado,
  etiquetaDepartamentoEnvio,
  etiquetaDireccionEnvio,
  etiquetaDireccionEnvioFilaListado,
  nombreCompletoCliente,
  nombrePintorAsociadoCliente,
  partesNombreClienteListado,
  type ClienteItem,
  type EnviosDireccionItem,
} from "@/lib/envios";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientesCatalogo: ClienteItem[];
  direcciones: EnviosDireccionItem[];
  onCatalogoChanged: () => void;
}

export default function EnviosGestionarDireccionesModal({
  open,
  onOpenChange,
  clientesCatalogo,
  direcciones,
  onCatalogoChanged,
}: Props) {
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [direccionId, setDireccionId] = useState<string | null>(null);
  const [qClienteDebounced, setQClienteDebounced] = useState("");
  const [qDireccionDebounced, setQDireccionDebounced] = useState("");
  const busquedaCliente = useFiltrosConBusqueda({
    qActual: qClienteDebounced,
    debounceMs: 300,
    onDebouncedSearch: setQClienteDebounced,
  });
  const busquedaDireccion = useFiltrosConBusqueda({
    qActual: qDireccionDebounced,
    debounceMs: 300,
    onDebouncedSearch: setQDireccionDebounced,
  });
  const [modalCliente, setModalCliente] = useState<
    { open: false } | { open: true; modo: "crear" | "editar"; item?: ClienteItem }
  >({ open: false });
  const [modalDireccion, setModalDireccion] = useState<
    { open: false } | { open: true; modo: "crear" | "editar"; item?: EnviosDireccionItem }
  >({ open: false });
  const [modalEliminar, setModalEliminar] = useState<
    { open: false } | { open: true; kind: "cliente" | "direccion"; id: string; label: string }
  >({ open: false });
  const [filtroPintorId, setFiltroPintorId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pintores = useMemo(
    () => clientesCatalogo.filter((c) => c.tipo === "PINTOR"),
    [clientesCatalogo]
  );

  useEffect(() => {
    if (!open) return;
    setClienteId(null);
    setDireccionId(null);
    setQClienteDebounced("");
    setQDireccionDebounced("");
    setModalCliente({ open: false });
    setModalDireccion({ open: false });
    setModalEliminar({ open: false });
    setFiltroPintorId(null);
  }, [open]);

  const clientesFiltrados = useMemo(() => {
    const q = qClienteDebounced.trim();
    const coincide = (item: ClienteItem) =>
      !q ||
      matchByMultiTerm(
        [item.nombreCompleto, item.cel, item.pintorAsociado?.nombreCompleto ?? ""],
        qClienteDebounced
      );

    if (!filtroPintorId) {
      return clientesCatalogo.filter(coincide);
    }

    const pintor = clientesCatalogo.find((item) => item.id === filtroPintorId);
    const clientesDelPintor = clientesCatalogo
      .filter((item) => item.pintorAsociadoId === filtroPintorId)
      .sort((a, b) =>
        nombreCompletoCliente(a).localeCompare(nombreCompletoCliente(b), "es", { sensitivity: "base" })
      )
      .filter(coincide);

    return pintor ? [pintor, ...clientesDelPintor] : clientesDelPintor;
  }, [clientesCatalogo, qClienteDebounced, filtroPintorId]);

  const pintorFiltro = useMemo(
    () => (filtroPintorId ? clientesCatalogo.find((c) => c.id === filtroPintorId) ?? null : null),
    [clientesCatalogo, filtroPintorId]
  );

  const clienteSeleccionado = useMemo(
    () => clientesCatalogo.find((c) => c.id === clienteId) ?? null,
    [clientesCatalogo, clienteId]
  );

  const direccionesDelCliente = useMemo(() => {
    if (!clienteId) return [];
    return direcciones.filter((d) => d.personaId === clienteId);
  }, [direcciones, clienteId]);

  const direccionesFiltradas = useMemo(() => {
    if (!qDireccionDebounced.trim()) return direccionesDelCliente;
    return direccionesDelCliente.filter((item) =>
      matchByMultiTerm(
        [
          item.nombreProyecto,
          item.calleNombre,
          item.numeracion,
          item.distrito,
          etiquetaDepartamentoEnvio(item.departamento),
          item.referencia,
          item.urlMaps,
        ],
        qDireccionDebounced
      )
    );
  }, [direccionesDelCliente, qDireccionDebounced]);

  function handleSelectCliente(id: string) {
    if (id !== clienteId) {
      setDireccionId(null);
      busquedaDireccion.setQ("");
      setQDireccionDebounced("");
    }
    setClienteId(id);
  }

  function handleCerrar() {
    if (deleting) return;
    onOpenChange(false);
  }

  async function handleEliminar() {
    if (!modalEliminar.open || deleting) return;
    setDeleting(true);
    try {
      const res =
        modalEliminar.kind === "cliente"
          ? await eliminarClienteAction({ id: modalEliminar.id })
          : await eliminarEnviosDireccionAction({ id: modalEliminar.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success(modalEliminar.kind === "cliente" ? "Cliente eliminado." : "Dirección eliminada.");
      if (modalEliminar.kind === "cliente" && clienteId === modalEliminar.id) {
        setClienteId(null);
        setDireccionId(null);
      }
      if (modalEliminar.kind === "direccion" && direccionId === modalEliminar.id) {
        setDireccionId(null);
      }
      setModalEliminar({ open: false });
      onCatalogoChanged();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) handleCerrar();
        }}
      >
        <AppModal
          title="Gestionar Direcciones"
          size="xl"
          scrollBody={false}
          padding="sm"
          className="h-[85vh] max-h-[85vh]"
          bodyShellClassName="h-full min-h-0"
          bodyClassName="flex h-full min-h-0 flex-col overflow-hidden p-4"
          actions={
            <div className="flex w-full justify-end">
              <Button type="button" variant="outline" disabled={deleting} onClick={handleCerrar}>
                Cerrar
              </Button>
            </div>
          }
        >
          <div className="grid h-full min-h-0 grid-cols-2 gap-3">
            <div className="flex min-h-0 flex-col">
              <CatalogoFinderColumn
                titulo="CLIENTES"
                mostrarNuevo={false}
                headerVariant="titulo"
                className="h-full min-h-0 flex-1"
              >
                <div className="sticky top-0 z-10 border-b border-border bg-card p-2">
                  <FiltroBusquedaInput
                    id="filtro-envios-gestionar-clientes"
                    placeholder="BUSCAR CLIENTE..."
                    value={busquedaCliente.q}
                    onChange={busquedaCliente.handleQChange}
                    isDebouncing={busquedaCliente.isDebouncing}
                    inputRef={busquedaCliente.ref}
                  />
                  {pintorFiltro ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2 h-8 w-full"
                      onClick={() => setFiltroPintorId(null)}
                    >
                      {nombreCompletoCliente(pintorFiltro)} · Limpiar Filtro
                    </Button>
                  ) : null}
                </div>
                {clientesCatalogo.length === 0 ? (
                  <CatalogoFinderEmpty mensaje="No hay clientes. Usá Nuevo Cliente para crear el primero." />
                ) : clientesFiltrados.length === 0 ? (
                  <CatalogoFinderEmpty
                    mensaje={
                      pintorFiltro
                        ? "Ningún cliente asociado a ese pintor coincide con la búsqueda."
                        : "Ningún cliente coincide con la búsqueda."
                    }
                  />
                ) : (
                  clientesFiltrados.map((item) => (
                    <CatalogoFinderRow
                      key={item.id}
                      iconoIzquierda={
                        item.tipo === "PINTOR" ? (
                          <EnviosPintorConsumidoresButton
                            pintorNombre={nombreCompletoCliente(item)}
                            activo={filtroPintorId === item.id}
                            onClick={() =>
                              setFiltroPintorId((prev) => (prev === item.id ? null : item.id))
                            }
                          />
                        ) : undefined
                      }
                      reservarEspacioIconoIzquierda
                      nombre={partesNombreClienteListado(item).principal}
                      nombreSufijo={
                        partesNombreClienteListado(item).sufijo ??
                        nombrePintorAsociadoCliente(item) ??
                        undefined
                      }
                      selected={item.id === clienteId}
                      onClick={() => handleSelectCliente(item.id)}
                      mostrarAcciones
                      eliminarSiempreVisible
                      accionesSiempreVisibles
                      onEditar={() => setModalCliente({ open: true, modo: "editar", item })}
                      onEliminar={() =>
                        setModalEliminar({
                          open: true,
                          kind: "cliente",
                          id: item.id,
                          label: etiquetaClienteListado(item),
                        })
                      }
                    />
                  ))
                )}
              </CatalogoFinderColumn>
              <div className="shrink-0 p-4">
                <Button
                  type="button"
                  className="h-10 w-full"
                  title="Nuevo"
                  aria-label="Nuevo Cliente"
                  onClick={() => setModalCliente({ open: true, modo: "crear" })}
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                  Nuevo Cliente
                </Button>
              </div>
            </div>

            <div className="flex min-h-0 flex-col">
              <CatalogoFinderColumn
                titulo="DIRECCIONES"
                subtitulo={
                  clienteSeleccionado
                    ? etiquetaClienteListado(clienteSeleccionado)
                    : "Seleccioná un cliente"
                }
                mostrarNuevo={false}
                deshabilitada={!clienteSeleccionado}
                headerVariant="titulo"
                className="h-full min-h-0 flex-1"
              >
                {!clienteSeleccionado ? (
                  <CatalogoFinderEmpty mensaje="Seleccioná un cliente para ver sus direcciones." />
                ) : (
                  <>
                    <div className="sticky top-0 z-10 border-b border-border bg-card p-2">
                      <FiltroBusquedaInput
                        id="filtro-envios-gestionar-direcciones"
                        placeholder="BUSCAR DIRECCIÓN..."
                        value={busquedaDireccion.q}
                        onChange={busquedaDireccion.handleQChange}
                        isDebouncing={busquedaDireccion.isDebouncing}
                        inputRef={busquedaDireccion.ref}
                      />
                    </div>
                    {direccionesDelCliente.length === 0 ? (
                      <CatalogoFinderEmpty mensaje="No hay direcciones. Usá Nueva Dirección para crear la primera." />
                    ) : direccionesFiltradas.length === 0 ? (
                      <CatalogoFinderEmpty mensaje="Ninguna dirección coincide con la búsqueda." />
                    ) : (
                      direccionesFiltradas.map((item) => (
                        <CatalogoFinderRow
                          key={item.id}
                          nombre={etiquetaDireccionEnvioFilaListado(item)}
                          nombreLineas={2}
                          nombreAccion={<EnviosMapsLink url={item.urlMaps} />}
                          selected={item.id === direccionId}
                          onClick={() => setDireccionId(item.id)}
                          mostrarAcciones
                          eliminarSiempreVisible
                          accionesSiempreVisibles
                          onEditar={() => setModalDireccion({ open: true, modo: "editar", item })}
                          onEliminar={() =>
                            setModalEliminar({
                              open: true,
                              kind: "direccion",
                              id: item.id,
                              label: etiquetaDireccionEnvio(item),
                            })
                          }
                        />
                      ))
                    )}
                  </>
                )}
              </CatalogoFinderColumn>
              <div className="shrink-0 p-4">
                <Button
                  type="button"
                  className="h-10 w-full"
                  title="Nuevo"
                  aria-label="Nueva Dirección"
                  disabled={!clienteSeleccionado}
                  onClick={() => setModalDireccion({ open: true, modo: "crear" })}
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                  Nueva Dirección
                </Button>
              </div>
            </div>
          </div>
        </AppModal>
      </Dialog>

      <CrearEditarClienteModal
        open={modalCliente.open}
        onOpenChange={(next) => {
          if (!next) setModalCliente({ open: false });
        }}
        modo={modalCliente.open ? modalCliente.modo : "crear"}
        item={modalCliente.open ? modalCliente.item : null}
        pintores={pintores}
        direcciones={direcciones}
        onCatalogoChanged={onCatalogoChanged}
        onSuccess={(item) => {
          handleSelectCliente(item.id);
          onCatalogoChanged();
        }}
      />
      <CrearEditarEnviosDireccionModal
        open={modalDireccion.open}
        onOpenChange={(next) => {
          if (!next) setModalDireccion({ open: false });
        }}
        modo={modalDireccion.open ? modalDireccion.modo : "crear"}
        personaId={clienteId ?? ""}
        item={modalDireccion.open ? modalDireccion.item : null}
        onSuccess={(item) => {
          setDireccionId(item.id);
          onCatalogoChanged();
        }}
      />
      <Dialog
        open={modalEliminar.open}
        onOpenChange={(next) => {
          if (!next && !deleting) setModalEliminar({ open: false });
        }}
      >
        <AppModal
          title={modalEliminar.open && modalEliminar.kind === "cliente" ? "Eliminar Cliente" : "Eliminar Dirección"}
          size="sm"
          actions={
            <div className={cn("flex w-full justify-end gap-2")}>
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                onClick={() => setModalEliminar({ open: false })}
              >
                Cancelar
              </Button>
              <Button type="button" disabled={deleting} onClick={() => void handleEliminar()}>
                Eliminar
              </Button>
            </div>
          }
        >
          <p className="text-sm text-foreground">
            ¿Eliminar {modalEliminar.open ? modalEliminar.label : ""}?
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
