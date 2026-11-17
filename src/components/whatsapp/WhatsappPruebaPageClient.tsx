"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { enviarTextoWhatsappPruebaAction } from "@/actions/whatsappPrueba";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function WhatsappPruebaPageClient() {
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function enviar() {
    startTransition(async () => {
      const res = await enviarTextoWhatsappPruebaAction({ to, body });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Meta aceptó el mensaje.");
    });
  }

  return (
    <ClassicFilteredTableLayout title="Administrador" subtitle="Prueba">
      <form
        className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-lg border border-border bg-card p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending) enviar();
        }}
      >
        <p className="text-sm text-muted-foreground">
          Sale por el número de prueba de Meta. El WhatsApp de la sucursal no se usa.
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
        <Button type="submit" disabled={pending}>
          {pending ? "Enviando…" : "Enviar Prueba"}
        </Button>
      </form>
    </ClassicFilteredTableLayout>
  );
}
