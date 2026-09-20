"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { matchByMultiTerm } from "@/lib/busqueda";
import { cn } from "@/lib/utils";
import type { CobrosPorSucursalCajaOption } from "@/services/cobrosPorSucursal.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Contexto: forma · entidad · sucursal. */
  contexto: string;
  cajas: CobrosPorSucursalCajaOption[];
  cajaSeleccionadaId: string | null;
  pending?: boolean;
  onSeleccionar: (cajaId: string | null) => void;
}

export default function SeleccionarCajaCobrosModal({
  open,
  onOpenChange,
  contexto,
  cajas,
  cajaSeleccionadaId,
  pending = false,
  onSeleccionar,
}: Props) {
  const [busqueda, setBusqueda] = useState("");

  const listaFiltrada = useMemo(() => {
    const q = busqueda.trim();
    if (!q) return cajas;
    return cajas.filter((c) =>
      matchByMultiTerm(
        [c.etiqueta, c.tipoCaja, c.entidadNombre, c.sucursalNombre, c.titular],
        q
      )
    );
  }, [cajas, busqueda]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) setBusqueda("");
        onOpenChange(next);
      }}
    >
      <AppModal
        title="SELECCIONAR CAJA"
        size="lg"
        scrollBody
        hideBodyScrollbars
        actions={
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending || cajaSeleccionadaId == null}
              onClick={() => onSeleccionar(null)}
            >
              Quitar vínculo
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{contexto}</p>
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="BUSCAR CAJA..."
              className="h-10 pl-9"
              aria-label="Buscar caja"
              disabled={pending}
            />
          </div>
          <div className="min-h-[12rem]">
            {cajas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay cajas de esta entidad (excepto CHEQUE).
              </p>
            ) : listaFiltrada.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ninguna caja coincide con la búsqueda.
              </p>
            ) : (
              <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-1">
                {listaFiltrada.map((caja) => {
                  const selected = caja.id === cajaSeleccionadaId;
                  return (
                    <li key={caja.id}>
                      <button
                        type="button"
                        disabled={pending}
                        className={cn(
                          "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                          selected
                            ? "border-primary bg-primary/5 font-medium text-foreground"
                            : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted/40",
                          pending && "opacity-50"
                        )}
                        onClick={() => onSeleccionar(caja.id)}
                      >
                        <span className="block truncate">{caja.etiqueta}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </AppModal>
    </Dialog>
  );
}
