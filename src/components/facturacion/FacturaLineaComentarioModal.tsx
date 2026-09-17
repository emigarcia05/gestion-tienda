"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Descripción del ítem de remito; omitir en comentario de cabecera. */
  descripcionItem?: string;
  comentarioInicial: string;
  onGuardar: (comentario: string) => void;
}

/**
 * Modal de comentario (línea del remito o cabecera de Factura · Crear).
 * El padre remonta con `key` al abrir.
 */
export default function FacturaLineaComentarioModal({
  open,
  onOpenChange,
  descripcionItem,
  comentarioInicial,
  onGuardar,
}: Props) {
  const [texto, setTexto] = useState(comentarioInicial);

  function handleGuardar() {
    onGuardar(texto.trim().toLocaleUpperCase("es"));
    onOpenChange(false);
  }

  function handleQuitar() {
    onGuardar("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="sm"
        padding="sm"
        title="COMENTARIO"
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="ghost" onClick={handleQuitar}>
              Quitar
            </Button>
            <Button type="button" onClick={handleGuardar}>
              Guardar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {descripcionItem ? (
            <p className="text-sm text-muted-foreground">{descripcionItem}</p>
          ) : null}
          <label className="flex flex-col gap-1">
            <ModalMicroLabel>COMENTARIO</ModalMicroLabel>
            <Input
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribí un comentario…"
              autoComplete="off"
              autoFocus
              aria-label="Comentario"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleGuardar();
                }
              }}
            />
          </label>
        </div>
      </AppModal>
    </Dialog>
  );
}
