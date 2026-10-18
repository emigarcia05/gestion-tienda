"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
  DESC_PROMO_SUBRUBRO_TODOS,
  ETIQUETA_TIPO_DESC_PROMO,
  TIPOS_DESC_PROMO,
  type DescPromoFila,
  type TipoDescPromoValor,
} from "@/lib/descPromo";
import type { RubroCatalogoItem } from "@/lib/listaProductos";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export type DescPromoOpcionPago = {
  id: string;
  nombre: string;
};

export type DescPromoOpcionProductoUi = {
  codTienda: string;
  descripcion: string;
};

type ReglaDraft = {
  key: string;
  idRubro: string;
  idSubRubro: string;
  descuentoTexto: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DescPromoFila | null;
  productos: DescPromoOpcionProductoUi[];
  pagos: DescPromoOpcionPago[];
  rubros: RubroCatalogoItem[];
  onSuccess?: () => void;
}

const RUBRO_VACIO = "none";
const REGLAS_GRID_CLASS =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5.5rem_auto] items-end gap-2";

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

function nuevaRegla(): ReglaDraft {
  return {
    key: crypto.randomUUID(),
    idRubro: "",
    idSubRubro: DESC_PROMO_SUBRUBRO_TODOS,
    descuentoTexto: "",
  };
}

export default function CrearEditarDescPromoModal({
  open,
  onOpenChange,
  item,
  productos,
  pagos,
  rubros,
  onSuccess,
}: Props) {
  const esAlta = item == null;
  const [tipo, setTipo] = useState<TipoDescPromoValor>("POR_ITEM");
  const [nombre, setNombre] = useState("");
  const [descuentoTexto, setDescuentoTexto] = useState("");
  const [codTiendas, setCodTiendas] = useState<string[]>([]);
  const [pagoIds, setPagoIds] = useState<string[]>([]);
  const [reglas, setReglas] = useState<ReglaDraft[]>([nuevaRegla()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setTipo(item.tipo);
      setNombre(item.nombre);
      setDescuentoTexto(
        item.tipo === "POR_ITEM" && item.descuento != null
          ? String(item.descuento)
          : ""
      );
      setCodTiendas(item.items.map((i) => i.codTienda));
      setPagoIds(item.formasPago.map((fp) => fp.pagoId));
      setReglas(
        item.tipo === "POR_FORMA_PAGO" && item.reglas.length > 0
          ? item.reglas.map((regla) => ({
              key: regla.id,
              idRubro: regla.idRubro,
              idSubRubro: regla.idSubRubro ?? DESC_PROMO_SUBRUBRO_TODOS,
              descuentoTexto: String(regla.descuento),
            }))
          : [nuevaRegla()]
      );
      return;
    }
    setTipo("POR_ITEM");
    setNombre("");
    setDescuentoTexto("");
    setCodTiendas([]);
    setPagoIds([]);
    setReglas([nuevaRegla()]);
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
  const reglasPayload = reglas.map((regla) => ({
    idRubro: regla.idRubro,
    idSubRubro:
      regla.idSubRubro === DESC_PROMO_SUBRUBRO_TODOS ? null : regla.idSubRubro,
    descuento: parseDescuento(regla.descuentoTexto),
  }));
  const reglasOk =
    reglasPayload.length > 0 &&
    reglasPayload.every(
      (regla) => regla.idRubro !== "" && regla.descuento != null
    );
  const vinculosOk =
    tipo === "POR_ITEM" ? codTiendas.length > 0 : pagoIds.length > 0;
  const puedeGuardar =
    nombre.trim() !== "" &&
    vinculosOk &&
    (tipo === "POR_ITEM" ? descuento != null : reglasOk);

  function handleTipoChange(next: string) {
    if (next !== "POR_ITEM" && next !== "POR_FORMA_PAGO") return;
    setTipo(next);
    if (next === "POR_ITEM") {
      setPagoIds([]);
      setReglas([nuevaRegla()]);
      return;
    }
    setCodTiendas([]);
    setDescuentoTexto("");
    setReglas((prev) => (prev.length > 0 ? prev : [nuevaRegla()]));
  }

  function actualizarRegla(key: string, patch: Partial<ReglaDraft>) {
    setReglas((prev) =>
      prev.map((regla) => (regla.key === key ? { ...regla, ...patch } : regla))
    );
  }

  async function handleSubmit() {
    if (!puedeGuardar || saving) return;
    setSaving(true);
    try {
      const payload = {
        tipo,
        nombre,
        descuento: tipo === "POR_ITEM" ? descuento : null,
        codTiendas: tipo === "POR_ITEM" ? codTiendas : [],
        pagoIds: tipo === "POR_FORMA_PAGO" ? pagoIds : [],
        reglas:
          tipo === "POR_FORMA_PAGO"
            ? reglasPayload.map((regla) => ({
                idRubro: regla.idRubro,
                idSubRubro: regla.idSubRubro,
                descuento: regla.descuento ?? 0,
              }))
            : [],
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
        size="xl"
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
          )}
          {tipo === "POR_ITEM" ? (
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
          ) : (
            <section className="modal-seccion-formulario flex flex-col gap-3">
              <h3 className="text-center text-xs font-bold uppercase tracking-wide text-foreground">
                Descuentos
              </h3>
              <div className={REGLAS_GRID_CLASS}>
                <ModalMicroLabel>Rubro</ModalMicroLabel>
                <ModalMicroLabel>Sub-Rubro</ModalMicroLabel>
                <ModalMicroLabel>% Desc.</ModalMicroLabel>
                <span />
              </div>
              {reglas.map((regla) => {
                const subRubros =
                  rubros.find((r) => r.id === regla.idRubro)?.subRubros ?? [];
                return (
                  <div key={regla.key} className={REGLAS_GRID_CLASS}>
                    <Select
                      value={regla.idRubro || RUBRO_VACIO}
                      onValueChange={(v) =>
                        actualizarRegla(regla.key, {
                          idRubro: v === RUBRO_VACIO ? "" : v,
                          idSubRubro: DESC_PROMO_SUBRUBRO_TODOS,
                        })
                      }
                      disabled={saving}
                    >
                      <SelectTrigger className="w-full" aria-label="Rubro">
                        <SelectValue placeholder="RUBRO" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={RUBRO_VACIO}>RUBRO</SelectItem>
                        {rubros.map((rubro) => (
                          <SelectItem key={rubro.id} value={rubro.id}>
                            {rubro.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={regla.idSubRubro}
                      onValueChange={(v) =>
                        actualizarRegla(regla.key, { idSubRubro: v })
                      }
                      disabled={saving || !regla.idRubro}
                    >
                      <SelectTrigger className="w-full" aria-label="Sub-rubro">
                        <SelectValue placeholder="SUB-RUBRO" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={DESC_PROMO_SUBRUBRO_TODOS}>
                          TODOS
                        </SelectItem>
                        {subRubros.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            {sub.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={regla.descuentoTexto}
                      onChange={(e) =>
                        actualizarRegla(regla.key, {
                          descuentoTexto: digitsDescuento(e.target.value),
                        })
                      }
                      placeholder="%"
                      inputMode="numeric"
                      disabled={saving}
                      aria-label="Porcentaje de descuento"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                      title="Quitar"
                      aria-label="Quitar descuento"
                      disabled={saving || reglas.length === 1}
                      onClick={() =>
                        setReglas((prev) => prev.filter((r) => r.key !== regla.key))
                      }
                    >
                      <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                    </Button>
                  </div>
                );
              })}
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  className={cn("h-9 w-9")}
                  aria-label="Agregar descuento"
                  disabled={saving}
                  onClick={() => setReglas((prev) => [...prev, nuevaRegla()])}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </section>
          )}
        </div>
      </AppModal>
    </Dialog>
  );
}
