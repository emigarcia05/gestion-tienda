"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { crearClienteFacturaAction } from "@/actions/factura";
import {
  formatearCuitMascara,
  normalizarCelCliente,
  normalizarNombreCliente,
  soloDigitos,
  type ClienteItem,
} from "@/lib/envios";
import { ARCA_CONDICION_IVA } from "@/lib/facturaFiscal";
import type { PtoVentasCodArcaItem } from "@/lib/globalPtoVtas";
import { etiquetaCondicionIvaArca } from "@/lib/globalPtoVtas";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  condicionesIva: PtoVentasCodArcaItem[];
  onSuccess?: (item: ClienteItem) => void;
};

/**
 * Alta rápida de cliente desde Factura · Crear.
 * Obligatorio: nombre. Condición IVA default Consumidor Final.
 */
export default function FacturaCrearClienteModal({
  open,
  onOpenChange,
  condicionesIva,
  onSuccess,
}: Props) {
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [cel, setCel] = useState("");
  const [cuitMasked, setCuitMasked] = useState("");
  const [condicionIva, setCondicionIva] = useState(String(ARCA_CONDICION_IVA.CF));
  const [saving, setSaving] = useState(false);

  const opcionesIva = useMemo(() => {
    const activos = condicionesIva.filter((c) => c.activo);
    const cf = activos.find((c) => c.codigo === ARCA_CONDICION_IVA.CF);
    if (cf) return activos;
    const cfCatalogo = condicionesIva.find((c) => c.codigo === ARCA_CONDICION_IVA.CF);
    return cfCatalogo ? [cfCatalogo, ...activos] : activos;
  }, [condicionesIva]);

  useEffect(() => {
    if (!open) return;
    setNombreCompleto("");
    setCel("");
    setCuitMasked("");
    setCondicionIva(String(ARCA_CONDICION_IVA.CF));
  }, [open]);

  const nombreValido = normalizarNombreCliente(nombreCompleto) !== "";
  const cuitDigits = soloDigitos(cuitMasked);
  const cuitValido = cuitDigits === "" || cuitDigits.length === 11;
  const puedeGuardar = nombreValido && cuitValido && !saving;

  async function handleSubmit() {
    if (!puedeGuardar) return;
    if (!nombreValido) {
      toast.error("Ingresá el nombre.");
      return;
    }
    if (!cuitValido) {
      toast.error("El CUIT debe tener 11 dígitos o quedar vacío.");
      return;
    }
    setSaving(true);
    try {
      const res = await crearClienteFacturaAction({
        nombreCompleto,
        cel: normalizarCelCliente(cel),
        tipo: "CONSUMIDOR_FINAL",
        cuit: cuitDigits === "" ? null : cuitDigits,
        condicionIva: Number(condicionIva),
        pintorAsociadoId: null,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo crear el cliente.");
        return;
      }
      toast.success("Cliente creado.");
      onOpenChange(false);
      onSuccess?.(res.data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        title="CREAR CLIENTE"
        size="md"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={!puedeGuardar} onClick={() => void handleSubmit()}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="flex min-w-0 flex-col gap-1">
            <ModalMicroLabel>NOMBRE</ModalMicroLabel>
            <Input
              value={nombreCompleto}
              onChange={(e) =>
                setNombreCompleto(e.target.value.toLocaleUpperCase("es-AR"))
              }
              placeholder="NOMBRE COMPLETO"
              disabled={saving}
              autoComplete="off"
              autoFocus
              aria-required
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1">
            <ModalMicroLabel>CEL</ModalMicroLabel>
            <Input
              value={cel}
              onChange={(e) => setCel(e.target.value)}
              placeholder="TELÉFONO"
              disabled={saving}
              inputMode="tel"
              autoComplete="off"
              aria-label="Celular"
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1">
            <ModalMicroLabel>CUIT</ModalMicroLabel>
            <Input
              value={cuitMasked}
              onChange={(e) => setCuitMasked(formatearCuitMascara(e.target.value))}
              placeholder="##-########-#"
              disabled={saving}
              inputMode="numeric"
              className={cn("tabular-nums")}
              autoComplete="off"
              aria-label="CUIT"
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1">
            <ModalMicroLabel>CONDICIÓN IVA</ModalMicroLabel>
            <Select
              value={condicionIva}
              onValueChange={setCondicionIva}
              disabled={saving}
            >
              <SelectTrigger className="w-full" aria-label="Condición IVA">
                <SelectValue placeholder="SELECCIONAR" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                {opcionesIva.map((c) => (
                  <SelectItem key={c.codigo} value={String(c.codigo)}>
                    {etiquetaCondicionIvaArca(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
      </AppModal>
    </Dialog>
  );
}
