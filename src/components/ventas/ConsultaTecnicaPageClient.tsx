"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  agregarItemConsultaTecnicaAction,
  buscarItemsConsultaTecnicaAction,
  conversarConsultaTecnicaAction,
  crearFichaItemConsultaTecnicaAction,
  elegirCoincidenciaConsultaTecnicaAction,
  eliminarConversacionConsultaTecnicaAction,
  listarMensajesConsultaTecnicaAction,
} from "@/actions/consultaTecnica";
import AppModal from "@/components/shared/AppModal";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type {
  ConsultaTecnicaConversacionItem,
  ConsultaTecnicaMensajeItem,
} from "@/lib/consultaTecnica";
import {
  CONSULTA_TECNICA_AUTOR_USUARIO,
  CONSULTA_TECNICA_CATEGORIAS_FICHA,
  CONSULTA_TECNICA_ETIQUETAS_FICHA,
  leerMensajeCoincidencias,
  type CoincidenciaConsulta,
} from "@/lib/consultaTecnica";
import { formatFechaCortaArgentina, formatInstanteDdMmYyHhMmArgentina } from "@/lib/fechaArgentina";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import { cn } from "@/lib/utils";
import type { ItemConsultaTecnica } from "@/services/consultaTecnica.service";

type PasoConsulta = "tipo" | "item";

const URL_EN_TEXTO = /(https?:\/\/\S+)/g;

function FragmentoConEnlace({ texto, clave }: { texto: string; clave: string }) {
  const partes = texto.split(URL_EN_TEXTO);
  return partes.map((parte, indice) =>
    /^https?:\/\/\S+$/i.test(parte) ? (
      <a
        key={`${clave}-${indice}-${parte}`}
        href={parte}
        target="_blank"
        rel="noreferrer"
        className="underline"
      >
        {parte}
      </a>
    ) : (
      <span key={`${clave}-${indice}-texto`}>{parte}</span>
    )
  );
}

function LineaInstructivo({ linea, indice }: { linea: string; indice: number }) {
  const titulo = (CONSULTA_TECNICA_CATEGORIAS_FICHA as readonly string[]).includes(linea.trim());
  const etiqueta = CONSULTA_TECNICA_ETIQUETAS_FICHA.find((nombre) => linea.startsWith(`${nombre}:`));
  return (
    <span>
      {indice > 0 ? "\n" : null}
      {titulo ? (
        <strong className="font-bold">{linea}</strong>
      ) : etiqueta ? (
        <>
          <strong className="font-bold">{etiqueta}:</strong>
          <FragmentoConEnlace texto={linea.slice(etiqueta.length + 1)} clave={`${indice}-resto`} />
        </>
      ) : (
        <FragmentoConEnlace texto={linea} clave={`${indice}-linea`} />
      )}
    </span>
  );
}

function TextoConEnlace({ texto }: { texto: string }) {
  const lineas = texto.split("\n");
  return (
    <p className="whitespace-pre-wrap text-sm">
      {lineas.map((linea, indice) => (
        <LineaInstructivo key={`${indice}-${linea}`} linea={linea} indice={indice} />
      ))}
    </p>
  );
}

export default function ConsultaTecnicaPageClient({
  conversaciones,
  conversacionInicialId,
  mensajesIniciales,
}: {
  conversaciones: ConsultaTecnicaConversacionItem[];
  conversacionInicialId: string | null;
  mensajesIniciales: ConsultaTecnicaMensajeItem[];
}) {
  const router = useRouter();
  const hiloRef = useRef<HTMLDivElement>(null);
  const busquedaSeq = useRef(0);
  const [propias, setPropias] = useState<ConsultaTecnicaConversacionItem[]>([]);
  const [seleccionId, setSeleccionId] = useState<string | null>(conversacionInicialId);
  const [mensajes, setMensajes] = useState(mensajesIniciales);
  const [cargando, setCargando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [paso, setPaso] = useState<PasoConsulta>("tipo");
  const [items, setItems] = useState<ItemConsultaTecnica[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [borrarId, setBorrarId] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [ocultas, setOcultas] = useState<string[]>([]);
  const [borrador, setBorrador] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [adjuntoAbierto, setAdjuntoAbierto] = useState(false);
  const [pasoAdjunto, setPasoAdjunto] = useState<"menu" | "item">("menu");
  const fotoRef = useRef<HTMLInputElement>(null);

  const buscarItems = useCallback(async (value: string) => {
    const seq = ++busquedaSeq.current;
    const q = value.trim();
    if (q.length < 3) {
      setItems([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    const out = await buscarItemsConsultaTecnicaAction({ q });
    if (seq !== busquedaSeq.current) return;
    setBuscando(false);
    if (!out.ok) {
      setItems([]);
      toast.error(out.error);
      return;
    }
    setItems(out.data);
  }, []);

  const alBuscar = useCallback(
    (value: string) => {
      void buscarItems(value);
    },
    [buscarItems]
  );

  const { q, setQ, ref: busquedaRef, handleQChange, isDebouncing } = useFiltrosConBusqueda({
    qActual: "",
    debounceMs: 300,
    onDebouncedSearch: alBuscar,
  });

  const lista = [...new Map([...conversaciones, ...propias].map((fila) => [fila.id, fila])).values()]
    .filter((fila) => !ocultas.includes(fila.id))
    .sort((a, b) => (a.actualizadoEnIso < b.actualizadoEnIso ? 1 : -1));

  const activa = lista.find((fila) => fila.id === seleccionId) ?? null;

  function bajarAlFinal() {
    queueMicrotask(() => {
      const hilo = hiloRef.current;
      if (hilo) hilo.scrollTop = hilo.scrollHeight;
    });
  }

  function abrirNuevaConsulta() {
    setAdjuntoAbierto(false);
    setPaso("tipo");
    setItems([]);
    setQ("");
    setModalAbierto(true);
  }

  function cerrarModal(abierto: boolean) {
    setModalAbierto(abierto);
    if (!abierto) {
      setPaso("tipo");
      setItems([]);
      setQ("");
    }
  }

  async function elegir(id: string) {
    if (id === seleccionId || creando) return;
    setSeleccionId(id);
    setCargando(true);
    const out = await listarMensajesConsultaTecnicaAction({ conversacionId: id });
    setCargando(false);
    if (!out.ok) {
      toast.error(out.error);
      return;
    }
    setMensajes(out.data);
    bajarAlFinal();
  }

  async function confirmarBorrar() {
    if (!borrarId || borrando) return;
    const id = borrarId;
    setBorrando(true);
    const out = await eliminarConversacionConsultaTecnicaAction({ conversacionId: id });
    setBorrando(false);
    if (!out.ok) {
      toast.error(out.error);
      return;
    }
    const queda = lista.filter((fila) => fila.id !== id);
    setOcultas((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setPropias((prev) => prev.filter((fila) => fila.id !== id));
    setBorrarId(null);
    toast.success("Consulta borrada.");
    if (seleccionId === id) {
      const siguiente = queda[0] ?? null;
      if (siguiente) {
        void elegir(siguiente.id);
      } else {
        setSeleccionId(null);
        setMensajes([]);
      }
    }
    router.refresh();
  }

  async function elegirItem(codTienda: string) {
    if (creando) return;
    setCreando(true);
    const out = await crearFichaItemConsultaTecnicaAction({ codTienda });
    setCreando(false);
    if (!out.ok) {
      toast.error(out.error);
      return;
    }
    setSeleccionId(out.data.conversacion.id);
    setPropias((prev) => [out.data.conversacion, ...prev.filter((fila) => fila.id !== out.data.conversacion.id)]);
    setMensajes([out.data.mensaje]);
    setModalAbierto(false);
    setPaso("tipo");
    setItems([]);
    setQ("");
    bajarAlFinal();
    router.refresh();
  }

  function recordar(conversacion: ConsultaTecnicaConversacionItem) {
    setPropias((prev) => [conversacion, ...prev.filter((fila) => fila.id !== conversacion.id)]);
  }

  async function enviarTexto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activa || enviando || creando) return;
    const texto = borrador.trim();
    if (texto.length === 0) return;
    setEnviando(true);
    const out = await conversarConsultaTecnicaAction({ conversacionId: activa.id, texto });
    setEnviando(false);
    if (!out.ok) {
      toast.error(out.error);
      return;
    }
    setBorrador("");
    recordar(out.data.conversacion);
    setMensajes((prev) => [...prev, out.data.mensaje, ...(out.data.respuesta ? [out.data.respuesta] : [])]);
    if (!out.data.respuesta) toast.message("No pude responder ahora. El texto quedó en la consulta.");
    bajarAlFinal();
  }

  function abrirAdjuntar() {
    if (!activa || enviando || creando) return;
    setModalAbierto(false);
    setPasoAdjunto("menu");
    setItems([]);
    setQ("");
    setAdjuntoAbierto(true);
  }

  function cerrarAdjunto(abierto: boolean) {
    setAdjuntoAbierto(abierto);
    if (!abierto) {
      setPasoAdjunto("menu");
      setItems([]);
      setQ("");
    }
  }

  async function elegirOpcion(opcion: CoincidenciaConsulta) {
    if (!activa || creando || enviando) return;
    setCreando(true);
    const out = await elegirCoincidenciaConsultaTecnicaAction(
      opcion.tipo === "familia"
        ? { conversacionId: activa.id, tipo: "familia", id: opcion.id }
        : { conversacionId: activa.id, tipo: "item", codTienda: opcion.codTienda }
    );
    setCreando(false);
    if (!out.ok) {
      toast.error(out.error);
      return;
    }
    recordar(out.data.conversacion);
    setMensajes((prev) => [...prev, out.data.mensaje, out.data.respuesta]);
    bajarAlFinal();
    router.refresh();
  }

  async function sumarItem(codTienda: string) {
    if (!activa || creando) return;
    setCreando(true);
    const out = await agregarItemConsultaTecnicaAction({ conversacionId: activa.id, codTienda });
    setCreando(false);
    if (!out.ok) {
      toast.error(out.error);
      return;
    }
    recordar(out.data.conversacion);
    setMensajes((prev) => [...prev, out.data.mensaje, out.data.respuesta]);
    setAdjuntoAbierto(false);
    setPasoAdjunto("menu");
    setItems([]);
    setQ("");
    bajarAlFinal();
    router.refresh();
  }

  async function subirFoto(archivo: File) {
    if (!activa || enviando) return;
    const cuerpo = new FormData();
    cuerpo.set("conversacionId", activa.id);
    cuerpo.set("archivo", archivo);
    setEnviando(true);
    setAdjuntoAbierto(false);
    let respuesta: Response;
    try {
      respuesta = await fetch("/api/consulta-tecnica/adjuntos", { method: "POST", body: cuerpo });
    } catch {
      setEnviando(false);
      toast.error("No se pudo adjuntar la foto.");
      return;
    }
    const json: unknown = await respuesta.json().catch(() => null);
    setEnviando(false);
    if (
      !json ||
      typeof json !== "object" ||
      !("ok" in json) ||
      json.ok !== true ||
      !("data" in json) ||
      !json.data ||
      typeof json.data !== "object" ||
      !("mensaje" in json.data) ||
      !("respuesta" in json.data)
    ) {
      const error =
        json && typeof json === "object" && "error" in json && typeof json.error === "string"
          ? json.error
          : "No se pudo adjuntar la foto.";
      toast.error(error);
      return;
    }
    const data = json.data as {
      mensaje: ConsultaTecnicaMensajeItem;
      respuesta: ConsultaTecnicaMensajeItem;
    };
    setMensajes((prev) => [...prev, data.mensaje, data.respuesta]);
    bajarAlFinal();
    router.refresh();
  }

  return (
    <ClassicFilteredTableLayout title="Ventas" subtitle="Consulta Técnica" contentWidth="full">
      <div className="grid min-h-0 flex-1 grid-cols-[20rem_minmax(0,1fr)] gap-4">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <h2 className="shrink-0 bg-sidebar px-4 py-3 text-sm font-semibold uppercase tracking-tight text-sidebar-foreground">
            Consultas
          </h2>
          <div className="shrink-0 border-b border-border p-2">
            <Button type="button" className="w-full" onClick={abrirNuevaConsulta} disabled={creando || enviando}>
              <Plus className="h-4 w-4" />
              Nueva Consulta
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {lista.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">NO HAY CONSULTAS.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {lista.map((fila) => (
                    <li key={fila.id} className="flex items-stretch gap-1">
                      <button
                        type="button"
                        onClick={() => void elegir(fila.id)}
                        className="consulta-historial-item min-w-0 flex-1 rounded-md text-left"
                      >
                        <div className="flex w-full min-w-0 flex-col items-center gap-0.5">
                          <div className="w-full truncate text-center text-[length:calc(var(--text-xs)*1.1)] font-bold uppercase">
                            {fila.tipoEtiqueta}
                          </div>
                          <div className="w-full truncate text-center text-xs font-normal">
                            {fila.usuario} - {formatFechaCortaArgentina(new Date(fila.creadoEnIso)).slice(0, 5)}
                          </div>
                        </div>
                      </button>
                      <Button
                        type="button"
                        size="icon"
                        className="size-9 shrink-0 self-center"
                        aria-label="Borrar consulta"
                        title="Borrar consulta"
                        disabled={borrando}
                        onClick={() => setBorrarId(fila.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <h2 className="shrink-0 bg-sidebar px-4 py-3 text-center text-sm font-semibold uppercase tracking-tight text-sidebar-foreground">
            {activa ? activa.tipoEtiqueta : "Conversación"}
          </h2>
          <div ref={hiloRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
            {cargando ? (
              <p className="m-auto text-sm text-muted-foreground">CARGANDO…</p>
            ) : mensajes.length === 0 ? (
              <p className="m-auto text-sm text-muted-foreground">ELEGÍ NUEVA CONSULTA.</p>
            ) : (
              mensajes.map((mensaje) => {
                const propio = mensaje.autor === CONSULTA_TECNICA_AUTOR_USUARIO;
                const coincidencias = propio ? null : leerMensajeCoincidencias(mensaje.texto);
                return (
                  <article
                    key={mensaje.id}
                    className={cn(
                      "flex max-w-[32rem] flex-col gap-1 rounded-lg px-3 py-2",
                      coincidencias ? "w-full" : "w-fit",
                      propio
                        ? "self-end bg-sidebar text-sidebar-foreground"
                        : "self-start border border-border bg-muted text-foreground"
                    )}
                  >
                    <TextoConEnlace texto={coincidencias ? coincidencias.intro : mensaje.texto} />
                    {coincidencias ? (
                      <div className="flex flex-col gap-1.5">
                        {coincidencias.opciones.map((opcion) => (
                          <Button
                            key={opcion.tipo === "familia" ? opcion.id : opcion.codTienda}
                            type="button"
                            className="consulta-opcion-item w-full"
                            disabled={creando || enviando}
                            onClick={() => void elegirOpcion(opcion)}
                          >
                            {opcion.etiqueta}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                    {mensaje.tieneImagen ? (
                      // Foto del hilo, mismo origen: next/image no aplica.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/consulta-tecnica/mensajes/${mensaje.id}/imagen`}
                        alt="Foto adjunta"
                        className="max-h-48 rounded-md object-contain"
                      />
                    ) : null}
                    <p
                      className={cn(
                        "text-xs tabular-nums",
                        propio ? "text-sidebar-foreground" : "text-muted-foreground"
                      )}
                    >
                      {formatInstanteDdMmYyHhMmArgentina(new Date(mensaje.creadoEnIso))}
                    </p>
                  </article>
                );
              })
            )}
          </div>
          {activa ? (
            <form className="consulta-composer flex shrink-0 items-stretch gap-2 border-t border-border p-3" onSubmit={(event) => void enviarTexto(event)}>
              <input
                ref={fotoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const archivo = event.target.files?.[0];
                  event.target.value = "";
                  if (archivo) void subirFoto(archivo);
                }}
              />
              <Button
                type="button"
                size="icon"
                className="shrink-0"
                aria-label="Adjuntar"
                disabled={enviando || creando}
                onClick={abrirAdjuntar}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <textarea
                value={borrador}
                onChange={(event) => setBorrador(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="ESCRIBÍ LA CONSULTA..."
                rows={2}
                maxLength={2000}
                disabled={enviando || creando}
                aria-label="Consulta"
                className={cn(
                  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50",
                  "flex min-w-0 flex-1 resize-none rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none",
                  "focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
                )}
              />
              <Button type="submit" className="shrink-0" disabled={enviando || creando || borrador.trim().length === 0}>
                Enviar
              </Button>
            </form>
          ) : null}
        </section>
      </div>

      <Dialog open={modalAbierto} onOpenChange={cerrarModal}>
        <AppModal
          title={paso === "tipo" ? "VAS A EMPEZAR CONSULTANDO SOBRE" : "FICHA TÉCNICA DE UN ÍTEM"}
          size="md"
          actions={
            paso === "tipo" ? (
              <Button type="button" variant="outline" onClick={() => cerrarModal(false)}>
                Cancelar
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => setPaso("tipo")} disabled={creando}>
                  Volver
                </Button>
                <Button type="button" variant="outline" onClick={() => cerrarModal(false)} disabled={creando}>
                  Cancelar
                </Button>
              </>
            )
          }
        >
          {paso === "tipo" ? (
            <div className="flex flex-col gap-3">
              <Button type="button" className="h-auto w-full justify-start whitespace-normal py-3 text-left" onClick={() => setPaso("item")}>
                1. Ficha técnica de un ítem
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-start whitespace-normal border-primary py-3 text-left"
                onClick={() => toast.message("Esa consulta todavía no tiene el paso siguiente.")}
              >
                2. No sé qué producto recomendar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-start whitespace-normal border-primary py-3 text-left"
                onClick={() => toast.message("Esa consulta todavía no tiene el paso siguiente.")}
              >
                3. Manual de uso
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5" htmlFor="consulta-tecnica-item">
                <ModalMicroLabel>Descripción</ModalMicroLabel>
                <FiltroBusquedaInput
                  id="consulta-tecnica-item"
                  placeholder="BUSCAR ÍTEM..."
                  value={q}
                  onChange={handleQChange}
                  isDebouncing={isDebouncing || buscando}
                  inputRef={busquedaRef}
                  disabled={creando}
                />
              </label>
              {q.trim().length < 3 ? (
                <p className="text-sm text-muted-foreground">ESCRIBÍ AL MENOS 3 LETRAS.</p>
              ) : items.length === 0 && !buscando && !isDebouncing ? (
                <p className="text-sm text-muted-foreground">NO HAY ÍTEMS.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {items.map((item) => (
                    <li key={item.codTienda}>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto w-full justify-start whitespace-normal border-primary py-2 text-left"
                        disabled={creando}
                        onClick={() => void elegirItem(item.codTienda)}
                      >
                        {item.descripcion}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </AppModal>
      </Dialog>

      <Dialog open={adjuntoAbierto && borrarId == null} onOpenChange={cerrarAdjunto}>
        <AppModal
          title={pasoAdjunto === "menu" ? "ADJUNTAR" : "ÍTEM"}
          size="md"
          actions={
            pasoAdjunto === "menu" ? (
              <Button type="button" variant="outline" onClick={() => cerrarAdjunto(false)}>
                Cancelar
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => setPasoAdjunto("menu")} disabled={creando}>
                  Volver
                </Button>
                <Button type="button" variant="outline" onClick={() => cerrarAdjunto(false)} disabled={creando}>
                  Cancelar
                </Button>
              </>
            )
          }
        >
          {pasoAdjunto === "menu" ? (
            <div className="flex flex-col gap-3">
              <Button type="button" className="w-full" onClick={() => fotoRef.current?.click()}>
                Foto
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-primary"
                onClick={() => {
                  setItems([]);
                  setQ("");
                  setPasoAdjunto("item");
                }}
              >
                Ítem
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5" htmlFor="consulta-tecnica-adjunto-item">
                <ModalMicroLabel>Descripción</ModalMicroLabel>
                <FiltroBusquedaInput
                  id="consulta-tecnica-adjunto-item"
                  placeholder="BUSCAR ÍTEM..."
                  value={q}
                  onChange={handleQChange}
                  isDebouncing={isDebouncing || buscando}
                  inputRef={busquedaRef}
                  disabled={creando}
                />
              </label>
              {q.trim().length < 3 ? (
                <p className="text-sm text-muted-foreground">ESCRIBÍ AL MENOS 3 LETRAS.</p>
              ) : items.length === 0 && !buscando && !isDebouncing ? (
                <p className="text-sm text-muted-foreground">NO HAY ÍTEMS.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {items.map((item) => (
                    <li key={item.codTienda}>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto w-full justify-start whitespace-normal border-primary py-2 text-left"
                        disabled={creando}
                        onClick={() => void sumarItem(item.codTienda)}
                      >
                        {item.descripcion}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </AppModal>
      </Dialog>

      <Dialog
        open={borrarId != null && !modalAbierto && !adjuntoAbierto}
        onOpenChange={(abierto) => {
          if (!abierto && !borrando) setBorrarId(null);
        }}
      >
        <AppModal
          title="BORRAR CONSULTA"
          size="sm"
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button type="button" variant="outline" disabled={borrando} onClick={() => setBorrarId(null)}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" disabled={borrando} onClick={() => void confirmarBorrar()}>
                Borrar
              </Button>
            </div>
          }
        >
          <p className="text-sm text-muted-foreground">
            ¿Borrar la consulta de{" "}
            <span className="font-semibold text-foreground">
              {lista.find((fila) => fila.id === borrarId)?.usuario ?? ""}
            </span>
            ?
          </p>
        </AppModal>
      </Dialog>
    </ClassicFilteredTableLayout>
  );
}
