"use client";

import { useMemo, useState } from "react";
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
  ALCANCES_DESC_PROMO,
  ETIQUETA_ALCANCE_DESC_PROMO,
  type AlcanceDescPromoValor,
  type DescPromoFila,
} from "@/lib/descPromo";
import type { MarcaCatalogoItem, RubroCatalogoItem } from "@/lib/listaProductos";

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
  rubros: RubroCatalogoItem[];
  marcas: MarcaCatalogoItem[];
  onSuccess?: () => void;
}

function parseDescuento(texto: string): number | null {
  if (!texto.trim()) return null;
  if (!/^\d{1,3}$/.test(texto.trim())) return null;
  const n = Number.parseInt(texto, 10);
  if (Number.isNaN(n) || n < 0 || n > 100) return null;
  return n;
}

function digitsDescuento(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 3);
  if (digits === "") return "";
  const n = Number.parseInt(digits, 10);
  return n > 100 ? "100" : String(n);
}

export default function CrearEditarDescPromoModal({
  open,
  onOpenChange,
  item,
  productos,
  pagos,
  rubros,
  marcas,
  onSuccess,
}: Props) {
  const esAlta = item == null;
  const [alcance, setAlcance] = useState<AlcanceDescPromoValor>(item?.alcance ?? "TODOS");
  const [nombre, setNombre] = useState(item?.nombre ?? "");
  const [descuentoTexto, setDescuentoTexto] = useState(
    item != null ? String(item.descuento) : ""
  );
  const [codTiendas, setCodTiendas] = useState<string[]>(
    item?.items.map((i) => i.codTienda) ?? []
  );
  const [pagoIds, setPagoIds] = useState<string[]>(
    item?.formasPago.map((fp) => fp.pagoId) ?? []
  );
  const [idMarca, setIdMarca] = useState(item?.idMarca ?? "");
  const [idRubro, setIdRubro] = useState(item?.idRubro ?? "");
  const [saving, setSaving] = useState(false);

  const opcionesProducto = useMemo<FiltroMultiSelectOpcion[]>(
    () =>
      productos.map((p) => ({
        value: p.codTienda,
        label: p.descripcion ? `${p.codTienda} · ${p.descripcion}` : p.codTienda,
      })),
    [productos]
  );

  const opcionesPago = useMemo<FiltroMultiSelectOpcion[]>(
    () => pagos.map((p) => ({ value: p.id, label: p.nombre })),
    [pagos]
  );

  const descuento = parseDescuento(descuentoTexto);
  const pideMarca = alcance === "MARCA" || alcance === "MARCA_RUBRO";
  const pideRubro = alcance === "RUBRO" || alcance === "MARCA_RUBRO";
  const pideItems = alcance === "ITEMS";
  const vinculosOk = pagoIds.length > 0;
  const alcanceOk =
    (!pideMarca || idMarca !== "") &&
    (!pideRubro || idRubro !== "") &&
    (!pideItems || codTiendas.length > 0);
  const puedeGuardar =
    nombre.trim() !== "" && vinculosOk && descuento != null && alcanceOk;

  function handleAlcanceChange(next: string) {
    if (!ALCANCES_DESC_PROMO.includes(next as AlcanceDescPromoValor)) return;
    const valor = next as AlcanceDescPromoValor;
    setAlcance(valor);
    if (valor !== "ITEMS") setCodTiendas([]);
    if (valor !== "MARCA" && valor !== "MARCA_RUBRO") setIdMarca("");
    if (valor !== "RUBRO" && valor !== "MARCA_RUBRO") setIdRubro("");
  }

  async function handleSubmit() {
    if (!puedeGuardar || saving || descuento == null) return;
    setSaving(true);
    const payload = {
      alcance,
      nombre: nombre.trim(),
      descuento,
      idMarca: pideMarca ? idMarca : null,
      idRubro: pideRubro ? idRubro : null,
      codTiendas: pideItems ? codTiendas : [],
      pagoIds,
    };
    const res = item
      ? await editarDescPromoAction({ ...payload, id: item.id })
      : await crearDescPromoAction(payload);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(esAlta ? "Descuento creado." : "Descuento actualizado.");
    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <AppModal
        size="xl"
        title={esAlta ? "NUEVO DESCUENTO" : "EDITAR DESCUENTO"}
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
            <ModalMicroLabel>Alcance</ModalMicroLabel>
            <Select value={alcance} onValueChange={handleAlcanceChange}>
              <SelectTrigger className="w-full" aria-label="Alcance">
                <SelectValue placeholder="ALCANCE" />
              </SelectTrigger>
              <SelectContent>
                {ALCANCES_DESC_PROMO.map((valor) => (
                  <SelectItem key={valor} value={valor}>
                    {ETIQUETA_ALCANCE_DESC_PROMO[valor]}
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
            <ModalMicroLabel>Forma De Pago</ModalMicroLabel>
            <FiltroMultiSelect
              opciones={opcionesPago}
              selected={pagoIds}
              onChange={setPagoIds}
              placeholder="FORMA DE PAGO"
              ariaLabel="Formas de pago"
              disabled={saving}
            />
          </div>
          {pideMarca ? (
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>Marca</ModalMicroLabel>
              <Select
                value={idMarca || undefined}
                onValueChange={setIdMarca}
                disabled={saving}
              >
                <SelectTrigger className="w-full" aria-label="Marca">
                  <SelectValue placeholder="MARCA" />
                </SelectTrigger>
                <SelectContent>
                  {marcas.map((marca) => (
                    <SelectItem key={marca.id} value={marca.id}>
                      {marca.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {pideRubro ? (
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>Rubro</ModalMicroLabel>
              <Select
                value={idRubro || undefined}
                onValueChange={setIdRubro}
                disabled={saving}
              >
                <SelectTrigger className="w-full" aria-label="Rubro">
                  <SelectValue placeholder="RUBRO" />
                </SelectTrigger>
                <SelectContent>
                  {rubros.map((rubro) => (
                    <SelectItem key={rubro.id} value={rubro.id}>
                      {rubro.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {pideItems ? (
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
          ) : null}
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>Desc. (%)</ModalMicroLabel>
            <Input
              value={descuentoTexto}
              onChange={(e) => setDescuentoTexto(digitsDescuento(e.target.value))}
              placeholder="0 A 100"
              inputMode="numeric"
              disabled={saving}
              aria-label="Descuento"
            />
          </div>
        </div>
      </AppModal>
    </Dialog>
  );
}
