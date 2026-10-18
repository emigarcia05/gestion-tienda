"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import FiltroMultiSelect, {
  type FiltroMultiSelectOpcion,
} from "@/components/shared/FiltroMultiSelect";
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
import {
  crearDescPromoAction,
  editarDescPromoAction,
} from "@/actions/descPromo";
import {
  ETIQUETA_TIPO_DESC_PROMO,
  TIPOS_DESC_PROMO,
  type DescPromoFila,
  type TipoDescPromoValor,
} from "@/lib/descPromo";

export type DescPromoOpcionPago = {
  id: string;
  nombre: string;
};

export type DescPromoOpcionProductoUi = {
  codTienda: string;
  descripcion: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DescPromoFila | null;
  productos: DescPromoOpcionProductoUi[];
  pagos: DescPromoOpcionPago[];
  onSuccess?: () => void;
}

function parseDescuento(texto: string): number | null {
  if (!texto.trim()) return null;
  if (!/^\d{1,3}$/.test(texto.trim())) return null;
  const n = Number.parseInt(texto, 10);
  if (Number.isNaN(n) || n < 0 || n > 100) return null;
  return n;
}

export default function CrearEditarDescPromoModal({
  open,
  onOpenChange,
  item,
  productos,
  pagos,
  onSuccess,
}: Props) {
  const esAlta = item == null;
  const [tipo, setTipo] = useState<TipoDescPromoValor>("POR_ITEM");
  const [nombre, setNombre] = useState("");
  const [descuentoTexto, setDescuentoTexto] = useState("");
  const [codTiendas, setCodTiendas] = useState<string[]>([]);
  const [pagoIds, setPagoIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setTipo(item.tipo);
      setNombre(item.nombre);
      setDescuentoTexto(String(item.descuento));
      setCodTiendas(item.items.map((i) => i.codTienda));
      setPagoIds(item.formasPago.map((fp) => fp.pagoId));
      return;
    }
    setTipo("POR_ITEM");
    setNombre("");
    setDescuentoTexto("");
    setCodTiendas([]);
    setPagoIds([]);
  }, [open, item]);

  const opcionesProducto = useMemo<FiltroMultiSelectOpcion[]>(
    () =>
      productos.map((p) => ({
        value: p.codTienda,
        label: p.descripcion
          ? `${p.codTienda} · ${p.descripcion}`
          : p.codTienda,
      })),
    [productos]
  );

  const opcionesPago = useMemo<FiltroMultiSelectOpcion[]>(
    () => pagos.map((p) => ({ value: p.id, label: p.nombre })),
    [pagos]
  );

  const descuento = parseDescuento(descuentoTexto);
  const vinculosOk =
    tipo === "POR_ITEM" ? codTiendas.length > 0 : pagoIds.length > 0;
  const puedeGuardar = nombre.trim() !== "" && descuento != null && vinculosOk;

  function handleTipoChange(next: string) {
    if (next !== "POR_ITEM" && next !== "POR_FORMA_PAGO") return;
    setTipo(next);
    if (next === "POR_ITEM") {
      setPagoIds([]);
      return;
    }
    setCodTiendas([]);
  }

  function handleDescuentoChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 3);
    if (digits === "") {
      setDescuentoTexto("");
      return;
    }
    const n = Number.parseInt(digits, 10);
    setDescuentoTexto(n > 100 ? "100" : String(n));
  }

  async function handleSubmit() {
    if (!puedeGuardar || saving || descuento == null) return;
    setSaving(true);
    try {
      const payload = {
        tipo,
        nombre,
        descuento,
        codTiendas: tipo === "POR_ITEM" ? codTiendas : [],
        pagoIds: tipo === "POR_FORMA_PAGO" ? pagoIds : [],
      };
      const res = esAlta
        ? await crearDescPromoAction(payload)
        : await editarDescPromoAction({ id: item.id, ...payload });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar el descuento.");
        return;
      }
      toast.success(esAlta ? "Descuento creado." : "Descuento actualizado.");
      onOpenChange(false);
      onSuccess?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving && !next) return;
        onOpenChange(next);
      }}
    >
      <AppModal
        title={esAlta ? "NUEVO DESCUENTO" : "EDITAR DESCUENTO"}
        size="lg"
        scrollBody
        hideBodyScrollbars
        actions={
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={saving || !puedeGuardar}
              onClick={() => void handleSubmit()}
            >
              Guardar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>Tipo</ModalMicroLabel>
            <Select value={tipo} onValueChange={handleTipoChange}>
              <SelectTrigger className="w-full" aria-label="Tipo">
                <SelectValue placeholder="TIPO" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_DESC_PROMO.map((valor) => (
                  <SelectItem key={valor} value={valor}>
                    {ETIQUETA_TIPO_DESC_PROMO[valor]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>Nombre</ModalMicroLabel>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="NOMBRE"
              disabled={saving}
              aria-label="Nombre"
              className="uppercase"
            />
          </div>
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>Desc. (%)</ModalMicroLabel>
            <Input
              value={descuentoTexto}
              onChange={(e) => handleDescuentoChange(e.target.value)}
              placeholder="0 A 100"
              inputMode="numeric"
              disabled={saving}
              aria-label="Descuento"
            />
          </div>
          {tipo === "POR_ITEM" ? (
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>Productos</ModalMicroLabel>
              <FiltroMultiSelect
                opciones={opcionesProducto}
                selected={codTiendas}
                onChange={setCodTiendas}
                placeholder="PRODUCTOS"
                ariaLabel="Productos"
                disabled={saving}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>Formas De Pago</ModalMicroLabel>
              <FiltroMultiSelect
                opciones={opcionesPago}
                selected={pagoIds}
                onChange={setPagoIds}
                placeholder="FORMAS DE PAGO"
                ariaLabel="Formas de pago"
                disabled={saving}
              />
            </div>
          )}
        </div>
      </AppModal>
    </Dialog>
  );
}
