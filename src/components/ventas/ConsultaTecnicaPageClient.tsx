"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  buscarItemsConsultaTecnicaAction,
  crearFichaItemConsultaTecnicaAction,
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
import { CONSULTA_TECNICA_AUTOR_USUARIO } from "@/lib/consultaTecnica";
import { formatInstanteDdMmYyHhMmArgentina } from "@/lib/fechaArgentina";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import { cn } from "@/lib/utils";
import type { ItemConsultaTecnica } from "@/services/consultaTecnica.service";

type PasoConsulta = "tipo" | "item";

const URL_EN_TEXTO = /(https?:\/\/\S+)/g;

function TextoConEnlace({ texto }: { texto: string }) {
  const partes = texto.split(URL_EN_TEXTO);
  return (
    <p className="whitespace-pre-wrap text-sm">
      {partes.map((parte, indice) =>
        /^https?:\/\/\S+$/i.test(parte) ? (
          <a
            key={`${indice}-${parte}`}
            href={parte}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {parte}
          </a>
        ) : (
          <span key={`${indice}-texto`}>{parte}</span>
        )
      )}
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

  const lista = [
    ...propias.filter((fila) => !conversaciones.some((item) => item.id === fila.id)),
    ...conversaciones,
  ].sort((a, b) => (a.actualizadoEnIso < b.actualizadoEnIso ? 1 : -1));

  const activa = lista.find((fila) => fila.id === seleccionId) ?? null;

  function bajarAlFinal() {
    queueMicrotask(() => {
      const hilo = hiloRef.current;
      if (hilo) hilo.scrollTop = hilo.scrollHeight;
    });
  }

  function abrirNuevaConsulta() {
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

  return (
    <ClassicFilteredTableLayout title="Ventas" subtitle="Consulta Técnica" contentWidth="full">
      <div className="grid min-h-0 flex-1 grid-cols-[20rem_minmax(0,1fr)] gap-4">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <h2 className="shrink-0 bg-sidebar px-4 py-3 text-sm font-semibold uppercase tracking-tight text-sidebar-foreground">
            Consultas
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {lista.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">NO HAY CONSULTAS.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {lista.map((fila) => {
                  const elegido = fila.id === seleccionId;
                  return (
                    <li key={fila.id}>
                      <button
                        type="button"
                        onClick={() => void elegir(fila.id)}
                        className={cn(
                          "flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left",
                          elegido ? "bg-sidebar text-sidebar-foreground" : "hover:bg-muted"
                        )}
                      >
                        <span className="text-xs font-semibold uppercase tracking-tight">
                          Tipo consulta
                        </span>
                        <span className="truncate text-sm font-semibold">{fila.tipoEtiqueta}</span>
                        <span
                          className={cn(
                            "mt-1 text-xs font-semibold uppercase tracking-tight",
                            elegido ? "text-sidebar-foreground" : "text-muted-foreground"
                          )}
                        >
                          Usuario
                        </span>
                        <span className="truncate text-sm">{fila.usuario}</span>
                      </button>
                    </li>
                  );
                })}
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
                return (
                  <article
                    key={mensaje.id}
                    className={cn(
                      "flex w-fit max-w-[32rem] flex-col gap-1 rounded-lg px-3 py-2",
                      propio
                        ? "self-end bg-sidebar text-sidebar-foreground"
                        : "self-start border border-border bg-muted text-foreground"
                    )}
                  >
                    <TextoConEnlace texto={mensaje.texto} />
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
          <div className="shrink-0 border-t border-border p-3">
            <Button type="button" className="w-full" onClick={abrirNuevaConsulta} disabled={creando}>
              <Plus className="h-4 w-4" />
              Nueva Consulta
            </Button>
          </div>
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
    </ClassicFilteredTableLayout>
  );
}
