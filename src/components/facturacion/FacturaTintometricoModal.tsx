"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { obtenerCatalogoTintometricoFacturaAction } from "@/actions/factura";
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
import { cn } from "@/lib/utils";
import type {
  MarcaTintometricaCatalogo,
  ProveedorCoefTintometrico,
} from "@/services/tintometrico.service";

const TITULO_SECCION_CLASS = "text-center text-xs font-bold uppercase tracking-wide text-foreground";
const CAMPO_CLASS = "flex min-w-0 flex-col gap-1";
const VALOR_CALCULADO_CLASS =
  "flex h-10 items-center justify-center rounded-md border border-border bg-background px-3 text-sm tabular-nums text-foreground";

const LISTAS = {
  general: "PX. LISTA GENERAL",
  mayorista: "PX. LISTA MAYORISTA",
} as const;
type ListaTintometrico = keyof typeof LISTAS;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  descripcion: string;
  /** Marca del producto: solo preselecciona MARCA COD. (el código puede ser de cualquier marca). */
  idMarcaProducto: string | null;
  onConfirmar: (datos: { codColor: string; codColorIdMarca: string; pxLista: number }) => void;
}

/**
 * Factura · Crear, producto del rubro TINTOMETRICO.
 * COD. COLOR: MARCA COD. (máscara) | COD. · PRECIO: proveedor × px compra → lista elegida; PX. MANUAL tiene prioridad.
 * El padre remonta con `key` por producto.
 */
export default function FacturaTintometricoModal({
  open,
  onOpenChange,
  descripcion,
  idMarcaProducto,
  onConfirmar,
}: Props) {
  const [marcas, setMarcas] = useState<MarcaTintometricaCatalogo[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorCoefTintometrico[]>([]);
  const [idMarcaCod, setIdMarcaCod] = useState("");
  const [codigo, setCodigo] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [pxCompraNorm, setPxCompraNorm] = useState("");
  const [lista, setLista] = useState<ListaTintometrico>("general");
  const [pxManualNorm, setPxManualNorm] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    void obtenerCatalogoTintometricoFacturaAction().then((res) => {
      if (cancelado) return;
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo cargar el catálogo tintométrico.");
        return;
      }
      setMarcas(res.data.marcas);
      setProveedores(res.data.proveedores);
      const inicial = res.data.marcas.find((m) => m.idMarca === idMarcaProducto);
      if (inicial) {
        setIdMarcaCod(inicial.idMarca);
        setCodigo(aplicarEntradaCodigoFormato(inicial.formatoCod, "").value);
      }
    });
    return () => {
      cancelado = true;
    };
  }, [open, idMarcaProducto]);

  const marcaCod = marcas.find((m) => m.idMarca === idMarcaCod) ?? null;
  const formatoCod = marcaCod?.formatoCod ?? null;
  const codigoTrim = codigo.trim();
  const codigoValido =
    !!marcaCod &&
    codigoTrim.length > 0 &&
    (formatoCod === null || codigoCumpleFormatoCod(codigoTrim, formatoCod));

  const pxCalculado = useMemo(() => {
    const coef = proveedores.find((p) => p.id === proveedorId)?.coeficienteTintometrico ?? null;
    return calcularPxTintometrico(montoArNormalizedStringToPesosNumber(pxCompraNorm), coef)[lista];
  }, [proveedores, proveedorId, pxCompraNorm, lista]);
  const pxManual = montoArNormalizedStringToPesosNumber(pxManualNorm);
  const usaManual = pxManual > 0;
  const pxFinal = usaManual ? pxManual : pxCalculado;

  const puedeAgregar = codigoValido && pxFinal > 0;

  function cambiarMarcaCod(id: string) {
    setIdMarcaCod(id);
    const m = marcas.find((x) => x.idMarca === id);
    setCodigo(aplicarEntradaCodigoFormato(m?.formatoCod ?? null, "").value);
  }

  function handleAgregar() {
    if (!puedeAgregar || !marcaCod) return;
    onConfirmar({ codColor: codigoTrim, codColorIdMarca: marcaCod.idMarca, pxLista: pxFinal });
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

          <section className="modal-seccion-formulario">
            <p className={TITULO_SECCION_CLASS}>COD. COLOR</p>
            <div className="grid grid-cols-2 items-start gap-3">
              <div className={CAMPO_CLASS}>
                <ModalMicroLabel>MARCA COD.</ModalMicroLabel>
                <Select value={idMarcaCod} onValueChange={cambiarMarcaCod}>
                  <SelectTrigger className="h-10 w-full" aria-label="Marca del código">
                    <SelectValue placeholder="MARCA" />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start">
                    {marcas.map((m) => (
                      <SelectItem key={m.idMarca} value={m.idMarca}>
                        {m.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={CAMPO_CLASS}>
                <ModalMicroLabel>COD.</ModalMicroLabel>
                <CodColorTintometricoInput
                  key={idMarcaCod}
                  formatoCod={formatoCod}
                  value={codigo}
                  onChange={setCodigo}
                  disabled={!marcaCod}
                  autoFocus={!!marcaCod}
                />
              </div>
            </div>
          </section>

          <section className="modal-seccion-formulario">
            <p className={TITULO_SECCION_CLASS}>PRECIO</p>
            <div className="grid grid-cols-2 items-start gap-3">
              <div className={CAMPO_CLASS}>
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
              <div className={CAMPO_CLASS}>
                <ModalMicroLabel>PX. COMPRA</ModalMicroLabel>
                <MontoArInput
                  valueNormalized={pxCompraNorm}
                  onValueNormalizedChange={setPxCompraNorm}
                  className="h-10"
                  aria-label="Px. Compra"
                />
              </div>
              <div className={CAMPO_CLASS}>
                <ModalMicroLabel>LISTA</ModalMicroLabel>
                <Select value={lista} onValueChange={(v) => setLista(v as ListaTintometrico)}>
                  <SelectTrigger className="h-10 w-full" aria-label="Lista">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start">
                    {(Object.keys(LISTAS) as ListaTintometrico[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {LISTAS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={CAMPO_CLASS}>
                <ModalMicroLabel>PX. LISTA</ModalMicroLabel>
                <div
                  className={cn(
                    VALOR_CALCULADO_CLASS,
                    usaManual && "text-muted-foreground line-through"
                  )}
                >
                  {`$${fmtPrecio(pxCalculado)}`}
                </div>
              </div>
              <div className={cn(CAMPO_CLASS, "col-span-2")}>
                <ModalMicroLabel>PX. MANUAL</ModalMicroLabel>
                <MontoArInput
                  valueNormalized={pxManualNorm}
                  onValueNormalizedChange={setPxManualNorm}
                  className="h-10"
                  aria-label="Px. Manual"
                />
              </div>
            </div>
          </section>
        </div>
      </AppModal>
    </Dialog>
  );
}
