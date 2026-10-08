"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { listarProveedoresTintometricoFacturaAction } from "@/actions/factura";
import AppModal from "@/components/shared/AppModal";
import CodColorTintometricoInput from "@/components/shared/CodColorTintometricoInput";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import MontoArInput from "@/components/shared/MontoArInput";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calcularPxTintometrico, descripcionConCodColor } from "@/lib/codColorTintometrico";
import { fmtPrecio } from "@/lib/format";
import { montoArNormalizedStringToPesosNumber } from "@/lib/montoArMask";
import { aplicarEntradaCodigoFormato, codigoCumpleFormatoCod } from "@/lib/tintometricoFormatoCod";
import type { ProveedorCoefTintometrico } from "@/services/tintometrico.service";

const VALOR_CALCULADO_CLASS =
  "flex h-10 items-center justify-center rounded-md border border-border bg-background px-3 text-sm tabular-nums text-foreground";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  descripcion: string;
  /** Máscara de la marca del producto; `null` = código libre. */
  formatoCod: string | null;
  onConfirmar: (datos: { codColor: string; pxLista: number }) => void;
}

/**
 * Factura · Crear: al elegir un producto del rubro TINTOMETRICO se piden COD. COLOR
 * (máscara de Pedir Tintométrico) y precio (cálculo de Px Tintométrico → PX. LISTA = lista general).
 * El padre remonta con `key` por producto.
 */
export default function FacturaTintometricoModal({
  open,
  onOpenChange,
  descripcion,
  formatoCod,
  onConfirmar,
}: Props) {
  const [codigo, setCodigo] = useState(() => aplicarEntradaCodigoFormato(formatoCod, "").value);
  const [proveedores, setProveedores] = useState<ProveedorCoefTintometrico[]>([]);
  const [proveedorId, setProveedorId] = useState("");
  const [pxCompraNorm, setPxCompraNorm] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    void listarProveedoresTintometricoFacturaAction().then((res) => {
      if (cancelado) return;
      if (!res.ok) {
        toast.error(res.error ?? "No se pudieron cargar los proveedores.");
        return;
      }
      setProveedores(res.data);
    });
    return () => {
      cancelado = true;
    };
  }, [open]);

  const codigoTrim = codigo.trim();
  const codigoValido =
    codigoTrim.length > 0 && (formatoCod === null || codigoCumpleFormatoCod(codigoTrim, formatoCod));

  const px = useMemo(() => {
    const coef = proveedores.find((p) => p.id === proveedorId)?.coeficienteTintometrico ?? null;
    return calcularPxTintometrico(montoArNormalizedStringToPesosNumber(pxCompraNorm), coef);
  }, [proveedores, proveedorId, pxCompraNorm]);

  const puedeAgregar = codigoValido && px.general > 0;

  function handleAgregar() {
    if (!puedeAgregar) return;
    onConfirmar({ codColor: codigoTrim, pxLista: px.general });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="sm"
        padding="sm"
        title="TINTOMÉTRICO"
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleAgregar} disabled={!puedeAgregar}>
              Agregar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium uppercase text-foreground">
            {descripcionConCodColor(descripcion, codigoValido ? codigoTrim : null)}
          </p>

          <div className="flex flex-col gap-1">
            <ModalMicroLabel>COD. COLOR</ModalMicroLabel>
            <CodColorTintometricoInput
              formatoCod={formatoCod}
              value={codigo}
              onChange={setCodigo}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <ModalMicroLabel>PROVEEDOR</ModalMicroLabel>
              <Select value={proveedorId} onValueChange={setProveedorId}>
                <SelectTrigger className="h-10 w-full" aria-label="Proveedor">
                  <SelectValue placeholder="SIN COEF." />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start">
                  {proveedores.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.prefijo ? `[${p.prefijo}] ${p.nombre}` : p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <ModalMicroLabel>PX. COMPRA</ModalMicroLabel>
              <MontoArInput
                valueNormalized={pxCompraNorm}
                onValueNormalizedChange={setPxCompraNorm}
                className="h-10"
                aria-label="Px. Compra"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <ModalMicroLabel>PX. LISTA GENERAL</ModalMicroLabel>
              <div className={VALOR_CALCULADO_CLASS}>{`$${fmtPrecio(px.general)}`}</div>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <ModalMicroLabel>PX. LISTA MAYORISTA</ModalMicroLabel>
              <div className={VALOR_CALCULADO_CLASS}>{`$${fmtPrecio(px.mayorista)}`}</div>
            </div>
          </div>
        </div>
      </AppModal>
    </Dialog>
  );
}
