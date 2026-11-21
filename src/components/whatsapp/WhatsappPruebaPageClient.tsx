"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  enviarTextoWhatsappPruebaAction,
  listarChatsWhatsappPruebaAction,
  listarMensajesWhatsappPruebaAction,
  sugerirRespuestaWhatsappIaAction,
} from "@/actions/whatsappPrueba";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatInstanteDdMmYyHhMmArgentina } from "@/lib/fechaArgentina";
import { CALLOUT_WARNING_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { claveChatWhatsapp } from "@/lib/whatsapp/telefono";
import type { WhatsappPruebaChatItem, WhatsappPruebaMensajeItem } from "@/lib/whatsapp/tipos";
import { telefonoWhatsappSchema } from "@/lib/validations/whatsappPrueba";

const ETIQUETA_ESTADO: Record<WhatsappPruebaMensajeItem["estado"], string> = {
  RECIBIDO: "Recibido",
  ACEPTADO: "Aceptado",
  ENVIADO: "Enviado",
  ENTREGADO: "Entregado",
  LEIDO: "Leído",
  FALLIDO: "Fallido",
};

function mismoChat(a: string, b: string): boolean {
  const claveA = claveChatWhatsapp(a);
  const claveB = claveChatWhatsapp(b);
  return claveA != null && claveA === claveB;
}

export default function WhatsappPruebaPageClient() {
  const [telefonoNuevo, setTelefonoNuevo] = useState("");
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sugerenciaActiva, setSugerenciaActiva] = useState(false);
  const [borradorPrevio, setBorradorPrevio] = useState("");
  const [chats, setChats] = useState<WhatsappPruebaChatItem[]>([]);
  const [filas, setFilas] = useState<WhatsappPruebaMensajeItem[]>([]);
  const [pending, startTransition] = useTransition();
  const [redactando, startRedaccion] = useTransition();
  const pedidoChats = useRef(0);
  const pedidoMensajes = useRef(0);
  const pedidoSugerencia = useRef(0);
  const hiloRef = useRef<HTMLDivElement>(null);
  const mensajeRef = useRef<HTMLTextAreaElement>(null);
  const telefonoNuevoValido = telefonoWhatsappSchema.safeParse(telefonoNuevo).success;

  const cargarChats = useCallback(async (avisar: boolean) => {
    const n = pedidoChats.current + 1;
    pedidoChats.current = n;
    const res = await listarChatsWhatsappPruebaAction();
    if (n !== pedidoChats.current) return;
    if (!res.ok) {
      if (avisar) toast.error(res.error);
      return;
    }
    setChats(res.data);
  }, []);

  const cargarMensajes = useCallback(async (telefono: string, avisar: boolean) => {
    const n = pedidoMensajes.current + 1;
    pedidoMensajes.current = n;
    const res = await listarMensajesWhatsappPruebaAction({ telefono });
    if (n !== pedidoMensajes.current) return;
    if (!res.ok) {
      if (avisar) toast.error(res.error);
      return;
    }
    setFilas(res.data);
  }, []);

  useEffect(() => {
    const inicial = window.setTimeout(() => {
      void cargarChats(false);
    }, 0);
    const id = window.setInterval(() => {
      void cargarChats(false);
    }, 15000);
    return () => {
      window.clearTimeout(inicial);
      window.clearInterval(id);
    };
  }, [cargarChats]);

  useEffect(() => {
    if (!seleccionado) return;
    const telefono = seleccionado;
    const inicial = window.setTimeout(() => {
      void cargarMensajes(telefono, false);
    }, 0);
    const id = window.setInterval(() => {
      void cargarMensajes(telefono, false);
    }, 15000);
    return () => {
      window.clearTimeout(inicial);
      window.clearInterval(id);
    };
  }, [seleccionado, cargarMensajes]);

  useEffect(() => {
    const nodo = hiloRef.current;
    if (!nodo) return;
    nodo.scrollTop = nodo.scrollHeight;
  }, [filas, seleccionado]);

  function limpiarBorrador() {
    pedidoSugerencia.current += 1;
    setSugerenciaActiva(false);
    setBorradorPrevio("");
    setBody("");
  }

  function elegirChat(telefono: string) {
    if (seleccionado != null && mismoChat(telefono, seleccionado)) return;
    limpiarBorrador();
    setSeleccionado(telefono);
  }

  function abrirTelefonoNuevo() {
    if (!telefonoNuevoValido) {
      toast.error("El teléfono tiene que empezar con + y el código de país.");
      return;
    }
    if (seleccionado != null && mismoChat(telefonoNuevo, seleccionado)) return;
    limpiarBorrador();
    setSeleccionado(telefonoNuevo);
    setFilas([]);
  }

  function enviar() {
    if (!seleccionado) return;
    const destino = seleccionado;
    startTransition(async () => {
      const res = await enviarTextoWhatsappPruebaAction({ to: destino, body });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Meta aceptó el mensaje.");
      setSugerenciaActiva(false);
      setBorradorPrevio("");
      setBody("");
      await cargarMensajes(destino, true);
      await cargarChats(false);
    });
  }

  function sugerir() {
    if (!seleccionado || redactando || pending) return;
    const destino = seleccionado;
    const n = pedidoSugerencia.current + 1;
    pedidoSugerencia.current = n;
    const previo = body;
    startRedaccion(async () => {
      const res = await sugerirRespuestaWhatsappIaAction({ telefono: destino });
      if (n !== pedidoSugerencia.current) return;
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setBorradorPrevio(previo);
      setBody(res.data.texto);
      setSugerenciaActiva(true);
      mensajeRef.current?.focus();
    });
  }

  function descartarSugerencia() {
    setBody(borradorPrevio);
    setSugerenciaActiva(false);
    setBorradorPrevio("");
  }

  const chatActivo = chats.find((chat) => seleccionado != null && mismoChat(chat.telefono, seleccionado));
  const tituloChat = chatActivo?.nombre ?? seleccionado;
  const ultimoEntrante = filas[filas.length - 1]?.direccion === "ENTRANTE";

  return (
    <ClassicFilteredTableLayout title="Administrador" subtitle="Prueba" contentWidth="full">
      <div className="grid min-h-0 flex-1 grid-cols-[20rem_minmax(0,1fr)] gap-4">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <h2 className="shrink-0 bg-sidebar px-4 py-3 text-sm font-semibold uppercase tracking-tight text-sidebar-foreground">
            Chats
          </h2>
          <form
            className="flex shrink-0 items-end gap-2 border-b border-border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              abrirTelefonoNuevo();
            }}
          >
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <ModalMicroLabel>Teléfono</ModalMicroLabel>
              <Input
                value={telefonoNuevo}
                onChange={(event) => setTelefonoNuevo(event.target.value.trim())}
                placeholder="+5492610000000"
                autoComplete="off"
                aria-label="Teléfono"
              />
            </label>
            <Button type="submit" variant="outline">
              Abrir
            </Button>
          </form>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {chats.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">NO HAY CHATS.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {chats.map((chat) => {
                  const activo = seleccionado != null && mismoChat(chat.telefono, seleccionado);
                  return (
                    <li key={claveChatWhatsapp(chat.telefono) ?? chat.telefono}>
                      <button
                        type="button"
                        onClick={() => elegirChat(chat.telefono)}
                        className={cn(
                          "flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left",
                          activo
                            ? "bg-sidebar text-sidebar-foreground"
                            : "hover:bg-muted"
                        )}
                      >
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="min-w-0 truncate text-sm font-semibold tabular-nums">
                            {chat.nombre ?? chat.telefono}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 text-xs tabular-nums",
                              activo ? "text-sidebar-foreground" : "text-muted-foreground"
                            )}
                          >
                            {formatInstanteDdMmYyHhMmArgentina(new Date(chat.ultimoEnIso))}
                          </span>
                        </span>
                        {chat.nombre ? (
                          <span
                            className={cn(
                              "truncate text-xs tabular-nums",
                              activo ? "text-sidebar-foreground" : "text-muted-foreground"
                            )}
                          >
                            {chat.telefono}
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "truncate text-xs",
                            activo ? "text-sidebar-foreground" : "text-muted-foreground"
                          )}
                        >
                          {chat.ultimoDireccion === "SALIENTE" ? "Enviado: " : "Recibido: "}
                          {chat.ultimoCuerpo}
                        </span>
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
            {tituloChat ?? "Mensajes"}
          </h2>
          <div ref={hiloRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
            {!seleccionado ? (
              <p className="m-auto text-sm text-muted-foreground">ELEGÍ UN CHAT.</p>
            ) : filas.length === 0 ? (
              <p className="m-auto text-sm text-muted-foreground">NO HAY MENSAJES.</p>
            ) : (
              filas.map((fila) => {
                const saliente = fila.direccion === "SALIENTE";
                return (
                  <article
                    key={fila.id}
                    className={cn(
                      "flex w-fit max-w-[32rem] flex-col gap-1 rounded-lg px-3 py-2",
                      saliente
                        ? "self-end bg-sidebar text-sidebar-foreground"
                        : "self-start border border-border bg-muted text-foreground"
                    )}
                  >
                    <p className="whitespace-pre-wrap text-sm">{fila.cuerpo}</p>
                    <p
                      className={cn(
                        "text-xs tabular-nums",
                        saliente ? "text-sidebar-foreground" : "text-muted-foreground"
                      )}
                      title={fila.errorTexto ?? undefined}
                    >
                      {formatInstanteDdMmYyHhMmArgentina(new Date(fila.creadoEnIso))}
                      {" · "}
                      {saliente ? "Enviado" : "Recibido"}
                      {" · "}
                      {ETIQUETA_ESTADO[fila.estado]}
                    </p>
                  </article>
                );
              })
            )}
          </div>
          <div className="shrink-0 border-t border-border">
            {seleccionado && ultimoEntrante ? (
              <div className="px-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={redactando || pending}
                  onClick={sugerir}
                >
                  {redactando ? "Redactando…" : "Respuesta de Sugerencia"}
                </Button>
              </div>
            ) : null}
            {sugerenciaActiva ? (
              <div className={cn(CALLOUT_WARNING_CLASS, "mx-3 mt-3 flex items-center justify-between gap-3")}>
                <p>Sugerencia para revisar. Podés editarla. No se envía sola.</p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || redactando}
                  onClick={descartarSugerencia}
                >
                  Descartar
                </Button>
              </div>
            ) : null}
            <form
              className="flex items-end gap-2 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!pending) enviar();
              }}
            >
              <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                <ModalMicroLabel>Mensaje</ModalMicroLabel>
                <textarea
                  ref={mensajeRef}
                  value={body}
                  onChange={(event) => {
                    const valor = event.target.value;
                    setBody(valor);
                    if (valor.trim() === "") setSugerenciaActiva(false);
                  }}
                  placeholder="TEXTO"
                  rows={2}
                  disabled={pending || redactando || !seleccionado}
                  aria-label="Mensaje"
                  className={cn(
                    "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50",
                    "flex w-full min-w-0 resize-none rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none",
                    "focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                />
              </label>
              <Button type="submit" disabled={pending || redactando || !seleccionado || body.trim() === ""}>
                {pending ? "Enviando…" : "Enviar Prueba"}
              </Button>
            </form>
          </div>
        </section>
      </div>
    </ClassicFilteredTableLayout>
  );
}
