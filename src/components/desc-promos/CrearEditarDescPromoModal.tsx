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
  claveReglaDescPromo,
  conflictosReglasDescPromo,
  DESC_PROMO_EJE_TODOS,
  ETIQUETA_TIPO_DESC_PROMO,
  etiquetaCondicionDescPromo,
  TIPOS_DESC_PROMO,
  type DescPromoFila,
  type DescPromoReglaCondicion,
  type TipoDescPromoValor,
} from "@/lib/descPromo";
import type { MarcaCatalogoItem, RubroCatalogoItem } from "@/lib/listaProductos";
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
  idMarca: string;
  idRubro: string;
  idSubRubro: string;
  descuentoTexto: string;
};

type CruceDraft = {
  key: string;
  idMarca: string | null;
  idRubro: string | null;
  idSubRubro: string | null;
  etiqueta: string;
  descuentoTexto: string;
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

const EJE_VACIO = DESC_PROMO_EJE_TODOS;
const REGLAS_GRID_CLASS =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem_auto] items-end gap-2";

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
    idMarca: EJE_VACIO,
    idRubro: EJE_VACIO,
    idSubRubro: EJE_VACIO,
    descuentoTexto: "",
  };
}

function ejeToId(valor: string): string | null {
  return valor === EJE_VACIO || valor === "" ? null : valor;
}

function uniqueReglasConDesc<
  T extends {
    idMarca: string | null;
    idRubro: string | null;
    idSubRubro: string | null;
    descuento: number;
  },
>(reglas: T[]): T[] {
  const vistos = new Set<string>();
  const out: T[] = [];
  for (const regla of reglas) {
    const clave = claveReglaDescPromo(regla);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(regla);
  }
  return out;
}

function etiquetaDesdeCatalogo(
  cruce: DescPromoReglaCondicion,
  marcas: MarcaCatalogoItem[],
  rubros: RubroCatalogoItem[]
): string {
  const marcaNombre =
    marcas.find((m) => m.id === cruce.idMarca)?.nombre.toLocaleUpperCase("es-AR") ??
    null;
  const rubro = rubros.find((r) => r.id === cruce.idRubro);
  const sub = rubro?.subRubros.find((s) => s.id === cruce.idSubRubro);
  return etiquetaCondicionDescPromo({
    idMarca: cruce.idMarca,
    idRubro: cruce.idRubro,
    idSubRubro: cruce.idSubRubro,
    marcaNombre,
    rubroNombre: rubro?.nombre.toLocaleUpperCase("es-AR") ?? null,
    subRubroNombre: sub?.nombre.toLocaleUpperCase("es-AR") ?? null,
  });
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
  const [tipo, setTipo] = useState<TipoDescPromoValor>("POR_ITEM");
  const [nombre, setNombre] = useState("");
  const [descuentoTexto, setDescuentoTexto] = useState("");
  const [codTiendas, setCodTiendas] = useState<string[]>([]);
  const [pagoIds, setPagoIds] = useState<string[]>([]);
  const [reglas, setReglas] = useState<ReglaDraft[]>([nuevaRegla()]);
  const [cruces, setCruces] = useState<CruceDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCruces([]);
    if (item) {
      setTipo(item.tipo);
      setNombre(item.nombre);
      setDescuentoTexto(item.descuento != null ? String(item.descuento) : "");
      setCodTiendas(item.items.map((i) => i.codTienda));
      setPagoIds(item.formasPago.map((fp) => fp.pagoId));
      setReglas(
        item.tipo === "POR_FORMA_PAGO" && item.reglas.length > 0
          ? item.reglas.map((regla) => ({
              key: regla.id,
              idMarca: regla.idMarca ?? EJE_VACIO,
              idRubro: regla.idRubro ?? EJE_VACIO,
              idSubRubro: regla.idSubRubro ?? EJE_VACIO,
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
  const reglasCompletas = reglas
    .map((regla) => ({
      idMarca: ejeToId(regla.idMarca),
      idRubro: ejeToId(regla.idRubro),
      idSubRubro: ejeToId(regla.idSubRubro),
      descuento: parseDescuento(regla.descuentoTexto),
    }))
    .filter(
      (regla) =>
        regla.idMarca != null ||
        regla.idRubro != null ||
        regla.descuento != null
    );
  const excepcionesVacias = reglasCompletas.length === 0;
  const excepcionesOk =
    excepcionesVacias ||
    reglasCompletas.every(
      (regla) =>
        (regla.idMarca != null || regla.idRubro != null) &&
        regla.descuento != null &&
        (regla.idSubRubro == null || regla.idRubro != null)
    );
  const vinculosOk =
    tipo === "POR_ITEM" ? codTiendas.length > 0 : pagoIds.length > 0;
  const crucesOk =
    cruces.length === 0 || cruces.every((c) => parseDescuento(c.descuentoTexto) != null);
  const puedeGuardar =
    nombre.trim() !== "" &&
    vinculosOk &&
    descuento != null &&
    (tipo === "POR_ITEM" || excepcionesOk) &&
    crucesOk;

  function handleTipoChange(next: string) {
    if (next !== "POR_ITEM" && next !== "POR_FORMA_PAGO") return;
    setTipo(next);
    setCruces([]);
    if (next === "POR_ITEM") {
      setPagoIds([]);
      setReglas([nuevaRegla()]);
      return;
    }
    setCodTiendas([]);
    setReglas((prev) => (prev.length > 0 ? prev : [nuevaRegla()]));
  }

  function actualizarRegla(key: string, patch: Partial<ReglaDraft>) {
    setCruces([]);
    setReglas((prev) =>
      prev.map((regla) => (regla.key === key ? { ...regla, ...patch } : regla))
    );
  }

  async function handleSubmit() {
    if (!puedeGuardar || saving) return;
    if (tipo === "POR_FORMA_PAGO") {
      const payloadReglas = uniqueReglasConDesc([
        ...reglasCompletas
          .filter((r) => r.descuento != null)
          .map((r) => ({
            idMarca: r.idMarca,
            idRubro: r.idRubro,
            idSubRubro: r.idSubRubro,
            descuento: r.descuento as number,
          })),
        ...cruces
          .map((c) => ({
            idMarca: c.idMarca,
            idRubro: c.idRubro,
            idSubRubro: c.idSubRubro,
            descuento: parseDescuento(c.descuentoTexto),
          }))
          .filter(
            (
              r
            ): r is {
              idMarca: string | null;
              idRubro: string | null;
              idSubRubro: string | null;
              descuento: number;
            } => r.descuento != null
          ),
      ]);
      const pendientes = conflictosReglasDescPromo(payloadReglas);
      if (pendientes.length > 0) {
        const pendientesKeys = new Set(
          pendientes.map((p) => claveReglaDescPromo(p.cruce))
        );
        const filled = cruces.filter(
          (c) =>
            parseDescuento(c.descuentoTexto) != null &&
            !pendientesKeys.has(claveReglaDescPromo(c))
        );
        setCruces([
          ...filled,
          ...pendientes.map((p) => ({
            key: crypto.randomUUID(),
            ...p.cruce,
            etiqueta: etiquetaDesdeCatalogo(p.cruce, marcas, rubros),
            descuentoTexto: "",
          })),
        ]);
        toast.error("Hay excepciones que se cruzan. Definí el % de cada cruce.");
        return;
      }
      setSaving(true);
      try {
        await persistir({
          tipo,
          nombre,
          descuento,
          codTiendas: [],
          pagoIds,
          reglas: payloadReglas,
        });
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      await persistir({
        tipo,
        nombre,
        descuento,
        codTiendas,
        pagoIds: [],
        reglas: [],
      });
    } finally {
      setSaving(false);
    }
  }

  async function persistir(payload: {
    tipo: TipoDescPromoValor;
    nombre: string;
    descuento: number | null;
    codTiendas: string[];
    pagoIds: string[];
    reglas: {
      idMarca: string | null;
      idRubro: string | null;
      idSubRubro: string | null;
      descuento: number;
    }[];
  }) {
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
          {tipo === "POR_FORMA_PAGO" ? (
            <section className="modal-seccion-formulario flex flex-col gap-3">
              <h3 className="text-center text-xs font-bold uppercase tracking-wide text-foreground">
                Excepciones
              </h3>
              <div className={REGLAS_GRID_CLASS}>
                <ModalMicroLabel>Marca</ModalMicroLabel>
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
                      value={regla.idMarca || EJE_VACIO}
                      onValueChange={(v) =>
                        actualizarRegla(regla.key, { idMarca: v })
                      }
                      disabled={saving}
                    >
                      <SelectTrigger className="w-full" aria-label="Marca">
                        <SelectValue placeholder="MARCA" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EJE_VACIO}>TODAS</SelectItem>
                        {marcas.map((marca) => (
                          <SelectItem key={marca.id} value={marca.id}>
                            {marca.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={regla.idRubro || EJE_VACIO}
                      onValueChange={(v) =>
                        actualizarRegla(regla.key, {
                          idRubro: v,
                          idSubRubro: EJE_VACIO,
                        })
                      }
                      disabled={saving}
                    >
                      <SelectTrigger className="w-full" aria-label="Rubro">
                        <SelectValue placeholder="RUBRO" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EJE_VACIO}>TODOS</SelectItem>
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
                      disabled={saving || ejeToId(regla.idRubro) == null}
                    >
                      <SelectTrigger className="w-full" aria-label="Sub-rubro">
                        <SelectValue placeholder="SUB-RUBRO" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EJE_VACIO}>TODOS</SelectItem>
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
                      aria-label="Quitar excepción"
                      disabled={saving}
                      onClick={() => {
                        setCruces([]);
                        setReglas((prev) => {
                          const next = prev.filter((r) => r.key !== regla.key);
                          return next.length > 0 ? next : [nuevaRegla()];
                        });
                      }}
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
                  aria-label="Agregar excepción"
                  disabled={saving}
                  onClick={() => setReglas((prev) => [...prev, nuevaRegla()])}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </section>
          ) : null}
          {tipo === "POR_FORMA_PAGO" && cruces.length > 0 ? (
            <section className="modal-seccion-formulario flex flex-col gap-3">
              <h3 className="text-center text-xs font-bold uppercase tracking-wide text-foreground">
                Conflictos
              </h3>
              {cruces.map((cruce) => (
                <label
                  key={cruce.key}
                  className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-2"
                >
                  <span className="text-sm font-medium uppercase text-foreground">
                    {cruce.etiqueta}
                  </span>
                  <Input
                    value={cruce.descuentoTexto}
                    onChange={(e) =>
                      setCruces((prev) =>
                        prev.map((c) =>
                          c.key === cruce.key
                            ? {
                                ...c,
                                descuentoTexto: digitsDescuento(e.target.value),
                              }
                            : c
                        )
                      )
                    }
                    placeholder="%"
                    inputMode="numeric"
                    disabled={saving}
                    aria-label={`Porcentaje para ${cruce.etiqueta}`}
                  />
                </label>
              ))}
            </section>
          ) : null}
        </div>
      </AppModal>
    </Dialog>
  );
}
