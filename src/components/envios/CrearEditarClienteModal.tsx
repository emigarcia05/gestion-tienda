"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import MontoArInput from "@/components/shared/MontoArInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CrearEditarEnviosDireccionModal from "@/components/envios/CrearEditarEnviosDireccionModal";
import EnviosMapsLink from "@/components/envios/EnviosMapsLink";
import SeleccionarPintorModal from "@/components/envios/SeleccionarPintorModal";
import ModalSiNoChoice from "@/components/shared/ModalSiNoChoice";
import {
  crearClienteAction,
  editarClienteAction,
  eliminarEnviosDireccionAction,
} from "@/actions/envios";
import EnviosProyectoListadoLineas from "@/components/envios/EnviosProyectoListadoLineas";
import {
  etiquetaDireccionEnvio,
  formatearCuitMascara,
  nombreCompletoCliente,
  normalizarCelCliente,
  normalizarNombreCliente,
  soloDigitos,
  type ClienteItem,
  type EnviosDireccionItem,
} from "@/lib/envios";
import { parseArcaConstanciaApiJson } from "@/lib/arcaConstancia";
import { ARCA_CONDICION_IVA, esCuitValido } from "@/lib/facturaFiscal";
import type { PtoVentasCodArcaItem } from "@/lib/globalPtoVtas";
import { etiquetaCondicionIvaArca } from "@/lib/globalPtoVtas";
import {
  montoArNormalizedStringToCents,
  montoArNumberToNormalizedString,
} from "@/lib/montoArMask";
import { listarPtoVentasCodArcaAction } from "@/actions/globalPtoVtas";
import {
  CATALOGO_FINDER_COLUMN_NOVO_BUTTON_CLASS,
  TABLE_ROW_ACTION_ICON_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modo: "crear" | "editar";
  item?: ClienteItem | null;
  /** Si está definido, ES PINTOR no se elige en el formulario. */
  esPintorFijo?: boolean;
  pintores?: ClienteItem[];
  direcciones?: EnviosDireccionItem[];
  /** Catálogo ARCA; si no se pasa, se carga al abrir el modal. */
  condicionesIva?: PtoVentasCodArcaItem[];
  onSuccess?: (item: ClienteItem) => void;
  onCatalogoChanged?: () => void;
}

export default function CrearEditarClienteModal({
  open,
  onOpenChange,
  modo,
  item = null,
  esPintorFijo,
  pintores = [],
  direcciones = [],
  condicionesIva: condicionesIvaProp,
  onSuccess,
  onCatalogoChanged,
}: Props) {
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [cel, setCel] = useState("");
  const [cuitMasked, setCuitMasked] = useState("");
  const [condicionIva, setCondicionIva] = useState(String(ARCA_CONDICION_IVA.CF));
  const [ctaCorrientePlazo, setCtaCorrientePlazo] = useState("");
  const [ctaCorrienteMontoMaxNorm, setCtaCorrienteMontoMaxNorm] = useState("");
  const [condicionesIvaLocal, setCondicionesIvaLocal] = useState<PtoVentasCodArcaItem[]>(
    condicionesIvaProp ?? []
  );
  const [cargarComoConsFinal, setCargarComoConsFinal] = useState(false);
  const [esPintor, setEsPintor] = useState(esPintorFijo ?? false);
  const [pintorAsociadoId, setPintorAsociadoId] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [direccionesLocal, setDireccionesLocal] = useState<EnviosDireccionItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [modalListaPintores, setModalListaPintores] = useState(false);
  const [modalFormPintor, setModalFormPintor] = useState<
    { open: false } | { open: true; modo: "crear" | "editar"; item?: ClienteItem }
  >({ open: false });
  const [modalDireccion, setModalDireccion] = useState<
    | { open: false }
    | { open: true; modo: "crear" | "editar"; personaId: string; item?: EnviosDireccionItem }
  >({ open: false });
  const [modalEliminarDireccion, setModalEliminarDireccion] = useState<
    { open: false } | { open: true; item: EnviosDireccionItem }
  >({ open: false });
  const [deletingDireccion, setDeletingDireccion] = useState(false);
  const [consultandoArca, setConsultandoArca] = useState(false);

  const esPintorEfectivo = esPintorFijo ?? esPintor;
  const muestraPintorAsociado = !esPintorEfectivo;
  const muestraDirecciones = !esPintorEfectivo;

  const condicionesIva = condicionesIvaProp ?? condicionesIvaLocal;
  const opcionesIva = useMemo(() => {
    const activos = condicionesIva.filter((c) => c.activo);
    const cf = activos.find((c) => c.codigo === ARCA_CONDICION_IVA.CF);
    if (cf) return activos;
    const cfCatalogo = condicionesIva.find((c) => c.codigo === ARCA_CONDICION_IVA.CF);
    return cfCatalogo ? [cfCatalogo, ...activos] : activos;
  }, [condicionesIva]);

  const pintoresDisponibles = useMemo(
    () => pintores.filter((p) => p.esPintor && p.id !== item?.id),
    [pintores, item?.id]
  );

  const pintorAsociado = useMemo(() => {
    if (!pintorAsociadoId) return null;
    return (
      pintoresDisponibles.find((p) => p.id === pintorAsociadoId) ??
      (item?.pintorAsociado?.id === pintorAsociadoId ? item.pintorAsociado : null)
    );
  }, [pintorAsociadoId, pintoresDisponibles, item?.pintorAsociado]);

  useEffect(() => {
    if (!open) return;
    if (!condicionesIvaProp) {
      void listarPtoVentasCodArcaAction().then((res) => {
        if (res.ok) setCondicionesIvaLocal(res.data);
      });
    }
    if (modo === "editar" && item) {
      setNombreCompleto(normalizarNombreCliente(item.nombreCompleto));
      setCel(item.cel);
      setCuitMasked(item.cuit ? formatearCuitMascara(item.cuit) : "");
      setCondicionIva(String(item.condicionIva ?? ARCA_CONDICION_IVA.CF));
      setCtaCorrientePlazo(
        item.ctaCorrientePlazo != null ? String(item.ctaCorrientePlazo) : ""
      );
      setCtaCorrienteMontoMaxNorm(
        item.ctaCorrienteMontoMax != null
          ? montoArNumberToNormalizedString(item.ctaCorrienteMontoMax)
          : ""
      );
      setEsPintor(esPintorFijo ?? item.esPintor);
      setCargarComoConsFinal(
        !(esPintorFijo ?? item.esPintor) &&
          normalizarNombreCliente(item.nombreCompleto) === ""
      );
      setPintorAsociadoId(item.pintorAsociadoId);
      setClienteId(item.id);
      setDireccionesLocal(direcciones.filter((d) => d.personaId === item.id));
      return;
    }
    setNombreCompleto("");
    setCel("");
    setCuitMasked("");
    setCondicionIva(String(ARCA_CONDICION_IVA.CF));
    setCtaCorrientePlazo("");
    setCtaCorrienteMontoMaxNorm("");
    setCargarComoConsFinal(false);
    setEsPintor(esPintorFijo ?? false);
    setPintorAsociadoId(null);
    setClienteId(null);
    setDireccionesLocal([]);
    // Init al abrir: no re-sincronizar si el catálogo se refresca con el modal abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- direcciones solo al abrir
  }, [open, modo, item, esPintorFijo, condicionesIvaProp]);

  const tituloBase = esPintorEfectivo ? "Pintor" : "Cliente";
  const yaPersistido = Boolean(clienteId);
  const esConsFinalCargado = !esPintorEfectivo && cargarComoConsFinal;
  const nombreRequerido = esPintorEfectivo || !esConsFinalCargado;
  const nombreValido = nombreRequerido ? normalizarNombreCliente(nombreCompleto) !== "" : true;
  const celValido = esConsFinalCargado ? cel.trim() !== "" : true;
  const cuitDigits = soloDigitos(cuitMasked);
  const cuitValido = cuitDigits === "" || cuitDigits.length === 11;
  const puedeGuardar = nombreValido && celValido && cuitValido;
  const puedeConsultarArca = esCuitValido(cuitDigits) && !saving && !consultandoArca;

  async function consultarConstanciaArca() {
    if (!esCuitValido(cuitDigits)) {
      toast.error("Ingresá un CUIT válido.");
      return;
    }
    if (consultandoArca || saving) return;
    setConsultandoArca(true);
    try {
      const res = await fetch(
        `/api/arca/constancia?cuit=${encodeURIComponent(cuitDigits)}`,
        { cache: "no-store" }
      );
      const json: unknown = await res.json().catch(() => null);
      const parsed = parseArcaConstanciaApiJson(json);
      if (!parsed.ok) {
        toast.error(parsed.error);
        return;
      }
      const data = parsed.data;
      setCargarComoConsFinal(false);
      setNombreCompleto(data.nombre);
      if (data.condicionIva != null) {
        setCondicionIva(String(data.condicionIva));
      } else {
        toast.error("ARCA no informó la condición IVA.");
      }
    } catch {
      toast.error("No se pudo consultar el CUIT en ARCA.");
    } finally {
      setConsultandoArca(false);
    }
  }

  async function persistirCliente(): Promise<ClienteItem | null> {
    const esPintorGuardar = esPintorFijo ?? esPintor;
    const payload = {
      nombreCompleto: !esPintorGuardar && cargarComoConsFinal ? "" : nombreCompleto,
      cel: normalizarCelCliente(cel),
      esPintor: esPintorGuardar,
      pintorAsociadoId: esPintorGuardar ? null : pintorAsociadoId,
      cuit: cuitDigits === "" ? null : cuitDigits,
      condicionIva: Number(condicionIva),
      ctaCorrientePlazo: ctaCorrientePlazo.trim() === "" ? null : Number(ctaCorrientePlazo),
      ctaCorrienteMontoMax:
        ctaCorrienteMontoMaxNorm.trim() === ""
          ? null
          : montoArNormalizedStringToCents(ctaCorrienteMontoMaxNorm) / 100,
    };
    const res = clienteId
      ? await editarClienteAction({ id: clienteId, ...payload })
      : await crearClienteAction(payload);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar.");
      return null;
    }
    setClienteId(res.data.id);
    return res.data;
  }

  async function handleSubmit() {
    if (!puedeGuardar || saving) return;
    setSaving(true);
    try {
      const data = await persistirCliente();
      if (!data) return;
      toast.success(yaPersistido ? `${tituloBase} actualizado.` : `${tituloBase} creado.`);
      onOpenChange(false);
      onSuccess?.(data);
    } finally {
      setSaving(false);
    }
  }

  async function handleNuevaDireccion() {
    if (saving) return;
    if (!puedeGuardar) {
      toast.error(
        esConsFinalCargado
          ? "Completá el CEL para asociar un proyecto."
          : "Completá el nombre para asociar un proyecto."
      );
      return;
    }
    let personaId = clienteId;
    if (!personaId) {
      setSaving(true);
      try {
        const data = await persistirCliente();
        if (!data) return;
        personaId = data.id;
        toast.success(`${tituloBase} creado.`);
        onSuccess?.(data);
        onCatalogoChanged?.();
      } finally {
        setSaving(false);
      }
    }
    if (!personaId) return;
    setModalDireccion({ open: true, modo: "crear", personaId });
  }

  async function handleEliminarDireccion() {
    if (!modalEliminarDireccion.open || deletingDireccion) return;
    setDeletingDireccion(true);
    try {
      const res = await eliminarEnviosDireccionAction({ id: modalEliminarDireccion.item.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success("Proyecto eliminado.");
      setDireccionesLocal((prev) => prev.filter((d) => d.id !== modalEliminarDireccion.item.id));
      setModalEliminarDireccion({ open: false });
      onCatalogoChanged?.();
    } finally {
      setDeletingDireccion(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
        <AppModal
          title={modo === "editar" ? `Editar ${tituloBase}` : `Nuevo ${tituloBase}`}
          size="lg"
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" disabled={saving || !puedeGuardar} onClick={() => void handleSubmit()}>
                Guardar
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-3">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground">
                DATOS CONTACTO
              </p>
              <label className="flex flex-col gap-1">
                <ModalMicroLabel>NOMBRE</ModalMicroLabel>
                <Input
                  value={nombreCompleto}
                  onChange={(e) =>
                    setNombreCompleto(e.target.value.toLocaleUpperCase("es-AR"))
                  }
                  autoComplete="off"
                  disabled={esConsFinalCargado}
                />
              </label>
              {!esPintorEfectivo ? (
                <label className="inline-flex cursor-pointer items-center gap-2 self-start text-sm font-medium text-foreground select-none">
                  <input
                    type="checkbox"
                    checked={cargarComoConsFinal}
                    onChange={(e) => {
                      const activo = e.target.checked;
                      setCargarComoConsFinal(activo);
                      if (activo) {
                        setNombreCompleto("");
                      }
                    }}
                    className="sr-only"
                  />
                  <span className="flex h-5 w-5 items-center justify-center rounded-sm border-2 border-primary bg-white">
                    {cargarComoConsFinal ? <Check className="h-3.5 w-3.5 text-primary" aria-hidden /> : null}
                  </span>
                  <span>Cliente Sin Nombre - Identificado por Num. Celular</span>
                </label>
              ) : null}
              <label className="flex flex-col gap-1">
                <ModalMicroLabel>{esConsFinalCargado ? "CEL (OBLIGATORIO)" : "CEL"}</ModalMicroLabel>
                <Input
                  value={cel}
                  onChange={(e) => setCel(e.target.value)}
                  autoComplete="off"
                  inputMode="tel"
                  disabled={saving}
                />
              </label>
              {esPintorFijo == null ? (
                <ModalSiNoChoice
                  label="ES PINTOR"
                  value={esPintor}
                  disabled={saving}
                  onChange={(next) => {
                    setEsPintor(next);
                    if (next) {
                      setPintorAsociadoId(null);
                      setCargarComoConsFinal(false);
                    }
                  }}
                />
              ) : null}
              {muestraPintorAsociado ? (
                <div className="flex flex-col gap-2">
                  <ModalMicroLabel>PINTOR ASOCIADO</ModalMicroLabel>
                  {pintorAsociado ? (
                    <div
                      className={cn(
                        "flex min-h-9 items-center gap-2 rounded-md border border-input px-3 py-1"
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {nombreCompletoCliente(pintorAsociado)}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={CATALOGO_FINDER_COLUMN_NOVO_BUTTON_CLASS}
                          title="Editar"
                          aria-label={`Editar ${nombreCompletoCliente(pintorAsociado)}`}
                          disabled={saving}
                          onClick={() => {
                            const pintorItem =
                              pintoresDisponibles.find((p) => p.id === pintorAsociado.id) ??
                              (item?.pintorAsociado?.id === pintorAsociado.id
                                ? {
                                    ...item.pintorAsociado,
                                    pintorAsociadoId: null,
                                    pintorAsociado: null,
                                    cuit: null,
                                    condicionIva: null,
                                    ctaCorrientePlazo: null,
                                    ctaCorrienteMontoMax: null,
                                  }
                                : null);
                            if (!pintorItem) return;
                            setModalFormPintor({ open: true, modo: "editar", item: pintorItem });
                          }}
                        >
                          <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={CATALOGO_FINDER_COLUMN_NOVO_BUTTON_CLASS}
                          title="Borrar"
                          aria-label={`Quitar pintor asociado ${nombreCompletoCliente(pintorAsociado)}`}
                          disabled={saving}
                          onClick={() => setPintorAsociadoId(null)}
                        >
                          <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(CATALOGO_FINDER_COLUMN_NOVO_BUTTON_CLASS, "self-center")}
                      title="Nuevo"
                      aria-label="Asociar pintor"
                      disabled={saving}
                      onClick={() => setModalListaPintores(true)}
                    >
                      <Plus className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                    </Button>
                  )}
                </div>
              ) : null}
            </section>

            <section className="flex flex-col gap-3 border-t border-border pt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground">
                DATOS FISCALES
              </p>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>CUIT</ModalMicroLabel>
                <div className="relative">
                  <Input
                    value={cuitMasked}
                    onChange={(e) => setCuitMasked(formatearCuitMascara(e.target.value))}
                    placeholder="##-########-#"
                    autoComplete="off"
                    inputMode="numeric"
                    className={cn("tabular-nums", "pr-10")}
                    disabled={saving}
                    aria-label="CUIT"
                  />
                  <div className="absolute inset-y-[0.2rem] right-[0.3rem] z-10 aspect-square">
                    <Button
                      type="button"
                      variant="default"
                      size="icon-xs"
                      className="size-full p-0 shadow-none"
                      disabled={!puedeConsultarArca}
                      onClick={() => void consultarConstanciaArca()}
                      aria-label={
                        consultandoArca
                          ? "Consultando CUIT en ARCA"
                          : "Consultar CUIT en ARCA"
                      }
                      title="Consultar ARCA"
                    >
                      <RefreshCw
                        className={cn(
                          "size-3.5 shrink-0",
                          consultandoArca && "animate-spin"
                        )}
                        aria-hidden
                      />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>CONDICIÓN IVA</ModalMicroLabel>
                <Select
                  value={condicionIva}
                  onValueChange={setCondicionIva}
                  disabled={saving}
                >
                  <SelectTrigger className={cn("w-full")} aria-label="Condición IVA">
                    <SelectValue placeholder="SELECCIONAR" />
                  </SelectTrigger>
                  <SelectContent
                    className="select-content-filtro"
                    position="popper"
                    side="bottom"
                    align="start"
                  >
                    {opcionesIva.map((c) => (
                      <SelectItem key={c.codigo} value={String(c.codigo)}>
                        {etiquetaCondicionIvaArca(c.descripcion)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="flex flex-col gap-3 border-t border-border pt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground">
                CUENTA CORRIENTE
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <ModalMicroLabel>PLAZO DÍAS</ModalMicroLabel>
                  <Input
                    inputMode="numeric"
                    autoComplete="off"
                    value={ctaCorrientePlazo}
                    disabled={saving}
                    placeholder="DÍAS"
                    onChange={(e) => {
                      const next = e.target.value.replace(/\D/g, "").slice(0, 3);
                      setCtaCorrientePlazo(next);
                    }}
                    aria-label="Plazo días cuenta corriente"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <ModalMicroLabel>MONTO MÁX.</ModalMicroLabel>
                  <MontoArInput
                    valueNormalized={ctaCorrienteMontoMaxNorm}
                    onValueNormalizedChange={setCtaCorrienteMontoMaxNorm}
                    treatEmptyNormalizedAsBlank
                    disabled={saving}
                    aria-label="Monto máximo cuenta corriente"
                  />
                </div>
              </div>
            </section>

            {muestraDirecciones ? (
              <section className="flex flex-col gap-3 border-t border-border pt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-foreground">
                  PROYECTOS
                </p>
                {direccionesLocal.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {direccionesLocal.map((dir) => (
                      <div
                        key={dir.id}
                        className={cn(
                          "flex items-start gap-2 rounded-md border border-input px-3 py-1"
                        )}
                      >
                        <EnviosProyectoListadoLineas dir={dir} />
                        <div className="flex shrink-0 items-center gap-1">
                          <EnviosMapsLink url={dir.urlMaps} />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={CATALOGO_FINDER_COLUMN_NOVO_BUTTON_CLASS}
                            title="Editar"
                            aria-label={`Editar ${etiquetaDireccionEnvio(dir)}`}
                            disabled={saving}
                            onClick={() =>
                              setModalDireccion({
                                open: true,
                                modo: "editar",
                                personaId: dir.personaId,
                                item: dir,
                              })
                            }
                          >
                            <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={CATALOGO_FINDER_COLUMN_NOVO_BUTTON_CLASS}
                            title="Borrar"
                            aria-label={`Eliminar ${etiquetaDireccionEnvio(dir)}`}
                            disabled={saving}
                            onClick={() => setModalEliminarDireccion({ open: true, item: dir })}
                          >
                            <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(CATALOGO_FINDER_COLUMN_NOVO_BUTTON_CLASS, "self-center")}
                  title="Nuevo"
                  aria-label="Asociar proyecto"
                  disabled={saving}
                  onClick={() => void handleNuevaDireccion()}
                >
                  <Plus className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                </Button>
              </section>
            ) : null}
          </div>
        </AppModal>
      </Dialog>
      {muestraPintorAsociado ? (
        <>
          <SeleccionarPintorModal
            open={modalListaPintores}
            onOpenChange={setModalListaPintores}
            pintores={pintoresDisponibles}
            seleccionadoId={pintorAsociadoId}
            onSelect={(pintor) => {
              setPintorAsociadoId(pintor.id);
              setModalListaPintores(false);
            }}
          />
          <CrearEditarClienteModal
            open={modalFormPintor.open}
            onOpenChange={(nextOpen) => {
              if (!nextOpen) setModalFormPintor({ open: false });
            }}
            modo={modalFormPintor.open ? modalFormPintor.modo : "crear"}
            item={modalFormPintor.open ? modalFormPintor.item : null}
            esPintorFijo
            condicionesIva={condicionesIva}
            onCatalogoChanged={onCatalogoChanged}
            onSuccess={(creado) => {
              setPintorAsociadoId(creado.id);
              onCatalogoChanged?.();
            }}
          />
        </>
      ) : null}
      {muestraDirecciones ? (
        <>
          <CrearEditarEnviosDireccionModal
            open={modalDireccion.open}
            onOpenChange={(nextOpen) => {
              if (!nextOpen) setModalDireccion({ open: false });
            }}
            modo={modalDireccion.open ? modalDireccion.modo : "crear"}
            personaId={modalDireccion.open ? modalDireccion.personaId : ""}
            item={modalDireccion.open ? modalDireccion.item : null}
            onSuccess={(dir) => {
              setDireccionesLocal((prev) => {
                const idx = prev.findIndex((d) => d.id === dir.id);
                if (idx === -1) return [...prev, dir];
                return prev.map((d) => (d.id === dir.id ? dir : d));
              });
              onCatalogoChanged?.();
            }}
          />
          <Dialog
            open={modalEliminarDireccion.open}
            onOpenChange={(nextOpen) => {
              if (!nextOpen && !deletingDireccion) setModalEliminarDireccion({ open: false });
            }}
          >
            <AppModal
              title="Eliminar Proyecto"
              size="sm"
              actions={
                <div className="flex w-full justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deletingDireccion}
                    onClick={() => setModalEliminarDireccion({ open: false })}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    disabled={deletingDireccion}
                    onClick={() => void handleEliminarDireccion()}
                  >
                    Eliminar
                  </Button>
                </div>
              }
            >
              <p className="text-sm text-foreground">
                ¿Eliminar {modalEliminarDireccion.open ? etiquetaDireccionEnvio(modalEliminarDireccion.item) : ""}?
              </p>
            </AppModal>
          </Dialog>
        </>
      ) : null}
    </>
  );
}
