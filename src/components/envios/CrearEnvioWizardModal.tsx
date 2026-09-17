"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import EnviosMapsLink from "@/components/envios/EnviosMapsLink";
import EnviosProyectoListadoLineas from "@/components/envios/EnviosProyectoListadoLineas";
import EnviosPintorConsumidoresButton from "@/components/envios/EnviosPintorConsumidoresButton";
import EnviosFechaHorarioCampos from "@/components/envios/EnviosFechaHorarioCampos";
import EnviosWizardPasos, {
  type EnvioWizardPaso,
} from "@/components/envios/EnviosWizardPasos";
import CrearEditarEnviosDireccionModal from "@/components/envios/CrearEditarEnviosDireccionModal";
import CrearEditarClienteModal from "@/components/envios/CrearEditarClienteModal";
import { leerPdfComprobante } from "@/components/envios/leerPdfComprobante";
import CatalogoFinderColumn from "@/components/shared/catalogo-finder/CatalogoFinderColumn";
import CatalogoFinderEmpty from "@/components/shared/catalogo-finder/CatalogoFinderEmpty";
import CatalogoFinderRow from "@/components/shared/catalogo-finder/CatalogoFinderRow";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { crearEnviosFinalAction, editarEnviosFinalAction, eliminarClienteAction, eliminarEnviosDireccionAction } from "@/actions/envios";
import { matchByMultiTerm } from "@/lib/busqueda";
import {
  ENVIOS_FORMA_PAGADO_LABELS,
  ENVIOS_FORMA_PAGADO_VALUES,
  etiquetaClienteListado,
  esFormaPagadoEnvioValida,
  esHoraEnvioValida,
  pagadoDesdeFormaPagado,
  etiquetaDepartamentoEnvio,
  etiquetaDireccionEnvio,
  etiquetaNombreProyecto,
  etiquetaSucursalEnvio,
  nombreCompletoCliente,
  nombrePintorAsociadoCliente,
  partesNombreClienteListado,
  type ClienteItem,
  type EnviosDireccionItem,
  type EnviosFinalListItem,
  type EnviosFormaPagadoValue,
  type EnviosHoraValue,
  type EnviosSucursalOption,
} from "@/lib/envios";
import { dateToIsoYmdArgentina, formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientesCatalogo: ClienteItem[];
  direcciones: EnviosDireccionItem[];
  sucursales: EnviosSucursalOption[];
  /** Si hay ítem, el wizard abre en modo edición con los datos cargados. */
  item?: EnviosFinalListItem | null;
  onCatalogoChanged: () => void;
  onSuccess: () => void;
}

function normalizarTextoBusqueda(value: string): string {
  return value
    .toLocaleLowerCase("es-AR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function clienteCoincideBusqueda(cliente: ClienteItem, query: string): boolean {
  const terminos = query
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map(normalizarTextoBusqueda);

  if (terminos.length === 0) return true;

  const nombreNorm = normalizarTextoBusqueda(cliente.nombreCompleto);
  const celNorm = normalizarTextoBusqueda(cliente.cel);

  return terminos.every((termino) => nombreNorm.includes(termino) || celNorm.includes(termino));
}

export default function CrearEnvioWizardModal({
  open,
  onOpenChange,
  clientesCatalogo,
  direcciones,
  sucursales,
  item = null,
  onCatalogoChanged,
  onSuccess,
}: Props) {
  const [paso, setPaso] = useState<EnvioWizardPaso>(1);
  const [sucursalId, setSucursalId] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [direccionId, setDireccionId] = useState<string | null>(null);
  const [fechaIso, setFechaIso] = useState(() => dateToIsoYmdArgentina(new Date()));
  const [horaDesde, setHoraDesde] = useState<EnviosHoraValue | "">("");
  const [horaHasta, setHoraHasta] = useState<EnviosHoraValue | "">("");
  const [formaPagado, setFormaPagado] = useState<EnviosFormaPagadoValue | "">("");
  const [observacionEnvio, setObservacionEnvio] = useState("");
  const [pdfAdjunto, setPdfAdjunto] = useState<{ nombre: string; base64: string } | null>(null);
  const [saving, setSaving] = useState(false);
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
  const [quitarPdf, setQuitarPdf] = useState(false);
  const esEdicion = item != null;

  useEffect(() => {
    if (!open) return;
    setPaso(1);
    setQClienteDebounced("");
    setQDireccionDebounced("");
    setModalCliente({ open: false });
    setModalDireccion({ open: false });
    setModalEliminar({ open: false });
    setFiltroPintorId(null);
    setPdfAdjunto(null);
    setQuitarPdf(false);
    if (item) {
      setSucursalId(item.sucursal.id);
      setClienteId(item.clienteFinal?.id ?? item.pintor?.id ?? null);
      setDireccionId(item.direccion.id);
      setFechaIso(item.fechaEnvioIso);
      setHoraDesde(esHoraEnvioValida(item.horaDesde) ? item.horaDesde : "");
      setHoraHasta(esHoraEnvioValida(item.horaHasta) ? item.horaHasta : "");
      setFormaPagado(item.formaPagado);
      setObservacionEnvio(item.observacionEnvio);
      return;
    }
    setSucursalId(null);
    setClienteId(null);
    setDireccionId(null);
    setFechaIso(dateToIsoYmdArgentina(new Date()));
    setHoraDesde("");
    setHoraHasta("");
    setFormaPagado("");
    setObservacionEnvio("");
  }, [open, item]);

  const pintores = useMemo(
    () => clientesCatalogo.filter((c) => c.tipo === "PINTOR"),
    [clientesCatalogo]
  );

  const clientesFiltrados = useMemo(() => {
    const coincide = (item: ClienteItem) => clienteCoincideBusqueda(item, qClienteDebounced);

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

  const horarioValido =
    fechaIso !== "" &&
    esHoraEnvioValida(horaDesde) &&
    esHoraEnvioValida(horaHasta) &&
    horaDesde < horaHasta;
  const pasoSucursalOk = Boolean(sucursalId);
  const pasoClienteOk = Boolean(clienteId);
  const pasoDireccionOk = Boolean(direccionId);
  const puedeGuardar =
    pasoSucursalOk && pasoClienteOk && pasoDireccionOk && horarioValido && formaPagado !== "";

  const pasoMaximoAlcanzable: EnvioWizardPaso = horarioValido && pasoDireccionOk
    ? 5
    : pasoDireccionOk
      ? 4
      : pasoClienteOk
        ? 3
        : pasoSucursalOk
          ? 2
          : 1;

  const sucursalSeleccionada = useMemo(
    () => sucursales.find((s) => s.id === sucursalId) ?? null,
    [sucursales, sucursalId]
  );
  const tituloPaso =
    paso === 1
      ? "SUCURSAL"
      : paso === 2
        ? "CLIENTES"
        : paso === 3
          ? "DIRECCIONES"
          : paso === 4
            ? "FECHA"
            : "MERCADERÍA";
  const subtituloPaso =
    paso === 1
      ? sucursalSeleccionada
        ? etiquetaSucursalEnvio(sucursalSeleccionada)
        : undefined
      : paso === 2
        ? `${clientesFiltrados.length} cliente(s)`
        : paso === 3
          ? clienteSeleccionado
            ? etiquetaClienteListado(clienteSeleccionado)
            : "Seleccioná un cliente"
          : paso === 4
            ? fechaIso
              ? formatIsoYmdDdMmYyyyArgentina(fechaIso)
              : undefined
            : undefined;

  function handleSelectSucursal(id: string) {
    setSucursalId(id);
    setPaso(2);
  }

  function handleSelectCliente(id: string) {
    if (id !== clienteId) {
      setDireccionId(null);
      busquedaDireccion.setQ("");
      setQDireccionDebounced("");
    }
    setClienteId(id);
    setPaso(3);
  }

  function handleSelectDireccion(id: string) {
    setDireccionId(id);
    setPaso(4);
  }

  function handleCerrar() {
    if (saving) return;
    onOpenChange(false);
  }

  function handleSiguiente() {
    if (paso === 1 && pasoSucursalOk) setPaso(2);
    else if (paso === 2 && pasoClienteOk) setPaso(3);
    else if (paso === 3 && pasoDireccionOk) setPaso(4);
    else if (paso === 4 && horarioValido) setPaso(5);
  }

  function handleAtras() {
    if (paso === 1) return;
    setPaso((prev) => (prev - 1) as EnvioWizardPaso);
  }

  async function handlePdfChange(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    const parsed = await leerPdfComprobante(file);
    if (!parsed) return;
    setPdfAdjunto(parsed);
    setQuitarPdf(false);
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
        setPaso(2);
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

  async function handleGuardarEnvio() {
    if (!puedeGuardar || saving || !sucursalId || !clienteId || !direccionId) return;
    if (
      !esHoraEnvioValida(horaDesde) ||
      !esHoraEnvioValida(horaHasta) ||
      !esFormaPagadoEnvioValida(formaPagado)
    ) {
      return;
    }
    setSaving(true);
    try {
      const esPintor = clienteSeleccionado?.tipo === "PINTOR";
      const payload = {
        sucursalId,
        clienteFinalId: esPintor ? null : clienteId,
        pintorId: esPintor ? clienteId : (clienteSeleccionado?.pintorAsociadoId ?? null),
        direccionId,
        fechaEnvioIso: fechaIso,
        horaDesde,
        horaHasta,
        observacionEnvio,
        pagado: pagadoDesdeFormaPagado(formaPagado, item?.pagado ?? false),
        formaPagado,
        ...(pdfAdjunto ? { pdfComprobante: pdfAdjunto } : {}),
      };
      const res = item
        ? await editarEnviosFinalAction({
            id: item.id,
            ...payload,
            quitarPdf: quitarPdf && !pdfAdjunto,
          })
        : await crearEnviosFinalAction(payload);
      if (!res.ok) {
        toast.error(
          res.error ?? (item ? "No se pudo guardar el envío." : "No se pudo crear el envío.")
        );
        return;
      }
      toast.success(item ? "Envío actualizado." : "Envío creado.");
      onOpenChange(false);
      onSuccess();
    } finally {
      setSaving(false);
    }
  }

  const puedeSiguiente =
    (paso === 1 && pasoSucursalOk) ||
    (paso === 2 && pasoClienteOk) ||
    (paso === 3 && pasoDireccionOk) ||
    (paso === 4 && horarioValido);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) handleCerrar();
        }}
      >
        <AppModal
          title={esEdicion ? "Editar Envío" : "Nuevo Envío"}
          size="xl"
          scrollBody={false}
          padding="sm"
          className="h-[85vh] max-h-[85vh]"
          bodyShellClassName="h-full min-h-0"
          bodyClassName="flex h-full min-h-0 flex-col overflow-hidden p-0"
          actions={
            <div className="flex w-full items-center justify-between gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={handleCerrar}>
                Cancelar
              </Button>
              <div className="flex gap-2">
                {paso > 1 ? (
                  <Button type="button" variant="outline" disabled={saving} onClick={handleAtras}>
                    Atrás
                  </Button>
                ) : null}
                {paso < 5 ? (
                  <Button type="button" disabled={saving || !puedeSiguiente} onClick={handleSiguiente}>
                    Siguiente
                  </Button>
                ) : (
                  <Button type="button" disabled={saving || !puedeGuardar} onClick={() => void handleGuardarEnvio()}>
                    {saving
                      ? esEdicion
                        ? "Guardando..."
                        : "Creando Envío..."
                      : esEdicion
                        ? "Guardar"
                        : "Crear Envío"}
                  </Button>
                )}
              </div>
            </div>
          }
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="h-[15%] shrink-0 border-b border-primary p-3">
              <EnviosWizardPasos
                pasoActual={paso}
                pasoMaximoAlcanzable={pasoMaximoAlcanzable}
                onPasoChange={setPaso}
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div
                className={cn(
                  "flex min-h-0 flex-1 flex-col overflow-hidden px-4",
                  paso !== 2 && !(paso === 3 && clienteSeleccionado) && "pb-4"
                )}
              >
                <CatalogoFinderColumn
                  titulo={tituloPaso}
                  subtitulo={subtituloPaso}
                  mostrarNuevo={false}
                  deshabilitada={paso === 3 && !clienteSeleccionado}
                  headerVariant="titulo"
                  className="h-full min-h-0 flex-1"
                >
                  {paso === 1 ? (
                    <div className="flex min-h-full items-center justify-center p-4">
                      <div className="flex w-full flex-col gap-2">
                        {sucursales.length === 0 ? (
                          <p className="text-center text-sm text-muted-foreground">
                            No hay sucursales habilitadas para envíos.
                          </p>
                        ) : (
                          sucursales.map((item) => (
                            <Button
                              key={item.id}
                              type="button"
                              variant={sucursalId === item.id ? "default" : "outline"}
                              className="h-10 w-full"
                              disabled={saving}
                              onClick={() => handleSelectSucursal(item.id)}
                            >
                              {etiquetaSucursalEnvio(item)}
                            </Button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}

                  {paso === 2 ? (
                    <>
                      <div className="sticky top-0 z-10 border-b border-border bg-card p-2">
                        <FiltroBusquedaInput
                          id="filtro-envios-wizard-clientes"
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
                    </>
                  ) : null}

                  {paso === 3 ? (
                    !clienteSeleccionado ? (
                      <CatalogoFinderEmpty mensaje="Seleccioná un cliente para ver sus direcciones." />
                    ) : (
                      <>
                        <div className="sticky top-0 z-10 border-b border-border bg-card p-2">
                          <FiltroBusquedaInput
                            id="filtro-envios-wizard-direcciones"
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
                              nombre={etiquetaNombreProyecto(item)}
                              nombreContenido={<EnviosProyectoListadoLineas dir={item} />}
                              nombreAccion={<EnviosMapsLink url={item.urlMaps} />}
                              selected={item.id === direccionId}
                              onClick={() => handleSelectDireccion(item.id)}
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
                    )
                  ) : null}

                  {paso === 4 ? (
                    <div className="flex min-h-full items-center justify-center p-4">
                      <EnviosFechaHorarioCampos
                        fechaIso={fechaIso}
                        horaDesde={horaDesde}
                        horaHasta={horaHasta}
                        disabled={saving}
                        onFechaChange={setFechaIso}
                        onHoraDesdeChange={setHoraDesde}
                        onHoraHastaChange={setHoraHasta}
                        onCompleto={() => setPaso(5)}
                      />
                    </div>
                  ) : null}

                  {paso === 5 ? (
                    <div className="flex min-h-full items-center justify-center overflow-y-auto p-4">
                      <div className="flex w-full flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <ModalMicroLabel align="center">PDF MERCADERÍA</ModalMicroLabel>
                        {pdfAdjunto ? (
                          <p className="text-center text-sm text-foreground">{pdfAdjunto.nombre}</p>
                        ) : item?.tienePdf && !quitarPdf ? (
                          <p className="text-center text-sm text-foreground">
                            {item.pdfComprobanteNombre ?? "comprobante.pdf"}
                          </p>
                        ) : null}
                        <label
                          className={cn(
                            "border-input bg-transparent text-foreground shadow-xs",
                            "hover:bg-muted/40 flex h-9 w-full min-w-0 cursor-pointer items-center justify-center rounded-md border px-3 py-1 text-sm font-medium transition-[color,box-shadow]",
                            "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
                            saving && "pointer-events-none cursor-not-allowed opacity-50"
                          )}
                        >
                          <Input
                            type="file"
                            accept="application/pdf,.pdf"
                            disabled={saving}
                            className="sr-only"
                            onChange={(e) => void handlePdfChange(e.target.files)}
                          />
                          Subir PDF
                        </label>
                        {item?.tienePdf && !quitarPdf && !pdfAdjunto ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            disabled={saving}
                            onClick={() => {
                              setQuitarPdf(true);
                              setPdfAdjunto(null);
                            }}
                          >
                            Quitar PDF
                          </Button>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-1">
                        <ModalMicroLabel align="center">FORMA DE PAGO</ModalMicroLabel>
                        <Select
                          value={formaPagado || undefined}
                          disabled={saving}
                          onValueChange={(v) => setFormaPagado(v as EnviosFormaPagadoValue)}
                        >
                          <SelectTrigger className="relative w-full justify-center [&_svg]:absolute [&_svg]:right-3">
                            <SelectValue placeholder="ELEGIR FORMA..." />
                          </SelectTrigger>
                          <SelectContent className="select-content-filtro" position="popper" side="bottom" align="start">
                            {ENVIOS_FORMA_PAGADO_VALUES.map((value) => (
                              <SelectItem key={value} value={value}>
                                {ENVIOS_FORMA_PAGADO_LABELS[value]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <label className="flex flex-col gap-1">
                        <ModalMicroLabel align="center">OBSERVACIÓN ENVÍO</ModalMicroLabel>
                        <textarea
                          value={observacionEnvio}
                          onChange={(e) => setObservacionEnvio(e.target.value)}
                          disabled={saving}
                          rows={3}
                          maxLength={5000}
                          aria-label="Observación envío"
                          className={cn(
                            "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50",
                            "block min-h-20 w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-left text-sm shadow-xs outline-none",
                            "text-foreground focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
                          )}
                        />
                      </label>
                      </div>
                    </div>
                  ) : null}
                </CatalogoFinderColumn>
              </div>
              {paso === 2 || (paso === 3 && clienteSeleccionado) ? (
                <div className="shrink-0 p-4">
                  <Button
                    type="button"
                    className="h-10 w-full"
                    title="Nuevo"
                    aria-label={paso === 2 ? "Nuevo Cliente" : "Nueva Dirección"}
                    onClick={() => {
                      if (paso === 2) {
                        setModalCliente({ open: true, modo: "crear" });
                        return;
                      }
                      setModalDireccion({ open: true, modo: "crear" });
                    }}
                  >
                    <Plus className="h-4 w-4 shrink-0" aria-hidden />
                    {paso === 2 ? "Nuevo Cliente" : "Nueva Dirección"}
                  </Button>
                </div>
              ) : null}
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
            <div className="flex w-full justify-end gap-2">
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
