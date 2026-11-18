"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  enviarTextoWhatsappPruebaAction,
  listarMensajesWhatsappPruebaAction,
} from "@/actions/whatsappPrueba";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EmptyTableRow,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatInstanteDdMmYyHhMmArgentina } from "@/lib/fechaArgentina";
import { cn } from "@/lib/utils";
import type { WhatsappPruebaMensajeItem } from "@/lib/whatsapp/tipos";
import { telefonoWhatsappSchema } from "@/lib/validations/whatsappPrueba";

const ETIQUETA_ESTADO: Record<WhatsappPruebaMensajeItem["estado"], string> = {
  RECIBIDO: "Recibido",
  ACEPTADO: "Aceptado",
  ENVIADO: "Enviado",
  ENTREGADO: "Entregado",
  LEIDO: "Leído",
  FALLIDO: "Fallido",
};

export default function WhatsappPruebaPageClient() {
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [filas, setFilas] = useState<WhatsappPruebaMensajeItem[]>([]);
  const [pending, startTransition] = useTransition();
  const pedido = useRef(0);
  const telefonoValido = telefonoWhatsappSchema.safeParse(to).success;

  const cargar = useCallback(async (telefono: string, avisar: boolean) => {
    const n = pedido.current + 1;
    pedido.current = n;
    const res = await listarMensajesWhatsappPruebaAction(telefono);
    if (n !== pedido.current) return;
    if (!res.ok) {
      if (avisar) toast.error(res.error);
      return;
    }
    setFilas(res.data);
  }, []);

  useEffect(() => {
    if (!telefonoValido) return;
    const inicial = window.setTimeout(() => {
      void cargar(to, false);
    }, 0);
    const id = window.setInterval(() => {
      void cargar(to, false);
    }, 15000);
    return () => {
      window.clearTimeout(inicial);
      window.clearInterval(id);
    };
  }, [to, telefonoValido, cargar]);

  const visibles = telefonoValido ? filas : [];

  function enviar() {
    startTransition(async () => {
      const res = await enviarTextoWhatsappPruebaAction({ to, body });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Meta aceptó el mensaje.");
      setBody("");
      await cargar(to, true);
    });
  }

  return (
    <ClassicFilteredTableLayout title="Administrador" subtitle="Prueba">
      <div className="flex flex-col gap-4">
        <form
          className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-lg border border-border bg-card p-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!pending) enviar();
          }}
        >
          <p className="text-sm text-muted-foreground">
            Sale por el número de prueba de Meta. El WhatsApp de la sucursal no se usa. Las
            respuestas de este teléfono se listan abajo.
          </p>
          <label className="flex flex-col gap-1.5">
            <ModalMicroLabel>TELÉFONO</ModalMicroLabel>
            <Input
              value={to}
              onChange={(event) => setTo(event.target.value.trim())}
              placeholder="+5492610000000"
              autoComplete="off"
              disabled={pending}
              aria-label="Teléfono"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <ModalMicroLabel>MENSAJE</ModalMicroLabel>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="TEXTO"
              rows={5}
              disabled={pending}
              aria-label="Mensaje"
              className={cn(
                "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50",
                "flex w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none",
                "focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
              )}
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Enviando…" : "Enviar Prueba"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending || !telefonoValido}
              onClick={() => void cargar(to, true)}
            >
              Actualizar
            </Button>
          </div>
        </form>
        <div className="contenedor-tabla-gestion min-h-0">
          <Table variant="compact" className="tabla-gestion-compacta w-full">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col />
              <col className="w-[14%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>HORA</TableHead>
                <TableHead>SENTIDO</TableHead>
                <TableHead>MENSAJE</TableHead>
                <TableHead>ESTADO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.length === 0 ? (
                <EmptyTableRow colSpan={4} message="NO HAY MENSAJES." />
              ) : (
                visibles.map((fila) => (
                  <TableRow key={fila.id}>
                    <TableCell className="celda-datos">
                      {formatInstanteDdMmYyHhMmArgentina(new Date(fila.creadoEnIso))}
                    </TableCell>
                    <TableCell className="celda-datos">
                      {fila.direccion === "SALIENTE" ? "Enviado" : "Recibido"}
                    </TableCell>
                    <TableCell className="celda-datos celda-datos--crece">{fila.cuerpo}</TableCell>
                    <TableCell className="celda-datos" title={fila.errorTexto ?? undefined}>
                      {ETIQUETA_ESTADO[fila.estado]}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </ClassicFilteredTableLayout>
  );
}
