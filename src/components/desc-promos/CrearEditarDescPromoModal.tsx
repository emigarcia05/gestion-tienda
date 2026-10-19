"use client";

import { useMemo, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import {
  crearDescPromoAction,
  editarDescPromoAction,
} from "@/actions/descPromo";
import DescPromoAgregarProductosModal from "@/components/desc-promos/DescPromoAgregarProductosModal";
import { cuotasParaFormaPago, type CobrosCuotaItem } from "@/lib/cobrosCuotas";
import {
  ALCANCES_DESC_PROMO,
  ETIQUETA_ALCANCE_DESC_PROMO,
  type AlcanceDescPromoValor,
  type DescPromoFila,
} from "@/lib/descPromo";
import { fmtCelda } from "@/lib/format";
import type { MarcaCatalogoItem, RubroCatalogoItem } from "@/lib/listaProductos";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { CrearDescPromoInput } from "@/lib/validations/descPromo";

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
  /** Precarga el formulario como alta (no edita el original). */
  duplicar?: boolean;
  productos: DescPromoOpcionProductoUi[];
  pagos: DescPromoOpcionPago[];
  cuotas: CobrosCuotaItem[];
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

function pagoIdsDesdeItem(item: DescPromoFila | null): string[] {
  if (item == null) return [];
  return [...new Set(item.formasPago.map((fp) => fp.pagoId))];
}

function cuotaIdsPorPagoDesdeItem(item: DescPromoFila | null): Record<string, string[]> {
  if (item == null) return {};
  const map: Record<string, string[]> = {};
  for (const fp of item.formasPago) {
    if (!fp.cuotaId) continue;
    const actual = map[fp.pagoId] ?? [];
    if (!actual.includes(fp.cuotaId)) actual.push(fp.cuotaId);
    map[fp.pagoId] = actual;
  }
  return map;
}

export default function CrearEditarDescPromoModal({
  open,
  onOpenChange,
  item,
  duplicar = false,
  productos,
  pagos,
  cuotas,
  rubros,
  marcas,
  onSuccess,
}: Props) {
  const esAlta = item == null || duplicar;
  const [alcance, setAlcance] = useState<AlcanceDescPromoValor>(item?.alcance ?? "TODOS");
  const [nombre, setNombre] = useState(item?.nombre ?? "");
  const [descuentoTexto, setDescuentoTexto] = useState(
    item != null ? String(item.descuento) : ""
  );
  const [itemsElegidos, setItemsElegidos] = useState<DescPromoOpcionProductoUi[]>(
    () =>
      item?.items.map((i) => ({
        codTienda: i.codTienda,
        descripcion: i.descripcion,
      })) ?? []
  );
  const [agregarProductosOpen, setAgregarProductosOpen] = useState(false);
  const [pagoIds, setPagoIds] = useState<string[]>(() => pagoIdsDesdeItem(item));
  const [cuotaIdsPorPago, setCuotaIdsPorPago] = useState<Record<string, string[]>>(
    () => cuotaIdsPorPagoDesdeItem(item)
  );
  const [idMarca, setIdMarca] = useState(item?.idMarca ?? "");
  const [idRubro, setIdRubro] = useState(item?.idRubro ?? "");
  const [saving, setSaving] = useState(false);

  const opcionesPago = useMemo<FiltroMultiSelectOpcion[]>(
    () => pagos.map((p) => ({ value: p.id, label: p.nombre })),
    [pagos]
  );

  const pagosConCuotas = useMemo(
    () =>
      pagoIds
        .map((pagoId) => {
          const pago = pagos.find((p) => p.id === pagoId);
          const opciones = cuotasParaFormaPago(cuotas, pagoId);
          return { pagoId, nombre: pago?.nombre ?? "", opciones };
        })
        .filter((row) => row.opciones.length > 0),
    [pagoIds, pagos, cuotas]
  );

  const descuento = parseDescuento(descuentoTexto);
  const pideMarca = alcance === "MARCA" || alcance === "MARCA_RUBRO";
  const pideRubro = alcance === "RUBRO" || alcance === "MARCA_RUBRO";
  const pideItems = alcance === "ITEMS";
  const codTiendas = itemsElegidos.map((i) => i.codTienda);
  const vinculosOk =
    pagoIds.length > 0 &&
    pagosConCuotas.every(
      (row) => (cuotaIdsPorPago[row.pagoId]?.length ?? 0) > 0
    );
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
    if (valor !== "ITEMS") setItemsElegidos([]);
    if (valor !== "MARCA" && valor !== "MARCA_RUBRO") setIdMarca("");
    if (valor !== "RUBRO" && valor !== "MARCA_RUBRO") setIdRubro("");
  }

  async function handleSubmit() {
    if (!puedeGuardar || saving || descuento == null) return;
    setSaving(true);
    const vinculosCobro = pagoIds.flatMap(
      (pagoId): CrearDescPromoInput["vinculosCobro"] => {
        const opciones = cuotasParaFormaPago(cuotas, pagoId);
        if (opciones.length === 0) {
          return [{ pagoId, cuotaId: null }];
        }
        return (cuotaIdsPorPago[pagoId] ?? []).map((cuotaId) => ({
          pagoId,
          cuotaId,
        }));
      }
    );
    const payload = {
      alcance,
      nombre: nombre.trim(),
      descuento,
      idMarca: pideMarca ? idMarca : null,
      idRubro: pideRubro ? idRubro : null,
      codTiendas: pideItems ? codTiendas : [],
      vinculosCobro,
    };
    const res =
      item != null && !duplicar
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

  function quitarItem(codTienda: string) {
    setItemsElegidos((prev) => prev.filter((i) => i.codTienda !== codTienda));
  }

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        if (!next && agregarProductosOpen) return;
        onOpenChange(next);
      }}
    >
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
              onChange={(e) => setDescuentoTexto(digitsDescuento(e.target.value))}
              placeholder="0 A 100"
              inputMode="numeric"
              disabled={saving}
              aria-label="Descuento"
            />
          </div>
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>Forma De Pago</ModalMicroLabel>
            <FiltroMultiSelect
              opciones={opcionesPago}
              selected={pagoIds}
              onChange={(next) => {
                setPagoIds(next);
                setCuotaIdsPorPago((prev) => {
                  const keep: Record<string, string[]> = {};
                  for (const id of next) {
                    if (prev[id]) keep[id] = prev[id];
                  }
                  return keep;
                });
              }}
              placeholder="FORMA DE PAGO"
              ariaLabel="Formas de pago"
              disabled={saving}
            />
          </div>
          {pagosConCuotas.map((row) => (
            <div key={row.pagoId} className="flex flex-col gap-1">
              <ModalMicroLabel>
                {pagosConCuotas.length === 1
                  ? "Cant. Cuotas"
                  : `Cant. Cuotas · ${row.nombre}`}
              </ModalMicroLabel>
              <FiltroMultiSelect
                opciones={row.opciones.map((c) => ({
                  value: c.id,
                  label: c.cuotas,
                }))}
                selected={cuotaIdsPorPago[row.pagoId] ?? []}
                onChange={(next) =>
                  setCuotaIdsPorPago((prev) => ({
                    ...prev,
                    [row.pagoId]: next,
                  }))
                }
                placeholder="CANT. CUOTAS"
                ariaLabel={`Cantidad de cuotas ${row.nombre}`}
                disabled={saving}
              />
            </div>
          ))}
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
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <ModalMicroLabel>Productos</ModalMicroLabel>
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  className="h-10 w-10"
                  disabled={saving}
                  aria-label="Agregar productos"
                  onClick={() => setAgregarProductosOpen(true)}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              <div className="contenedor-tabla-gestion min-h-0 max-h-[min(18rem,40vh)] overflow-auto rounded-md border border-primary">
                <Table variant="compact" className="tabla-gestion-compacta w-full">
                  <colgroup>
                    <col className="w-[88%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DESCRIPCIÓN</TableHead>
                      <TableHead className="text-center">ACCIONES</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsElegidos.length === 0 ? (
                      <EmptyTableRow colSpan={2} message="NO HAY PRODUCTOS." />
                    ) : (
                      itemsElegidos.map((producto) => (
                        <TableRow key={producto.codTienda}>
                          <TableCell className="celda-datos min-w-0">
                            <span
                              className="block truncate"
                              title={producto.descripcion || producto.codTienda}
                            >
                              {fmtCelda(
                                producto.descripcion || producto.codTienda
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="celda-datos celda-datos--accion-relleno-fila p-0">
                            <div
                              className={cn(
                                TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
                                "justify-center"
                              )}
                            >
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                disabled={saving}
                                aria-label={`Quitar ${producto.descripcion || producto.codTienda}`}
                                onClick={() => quitarItem(producto.codTienda)}
                              >
                                <Trash2
                                  className={TABLE_ROW_ACTION_ICON_CLASS}
                                  aria-hidden
                                />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </div>
      </AppModal>
    </Dialog>
    <DescPromoAgregarProductosModal
      key={agregarProductosOpen ? "abierto" : "cerrado"}
      open={agregarProductosOpen}
      onOpenChange={setAgregarProductosOpen}
      productos={productos}
      codigosSeleccionados={codTiendas}
      onConfirm={(nuevos) => {
        setItemsElegidos((prev) => {
          const existentes = new Set(prev.map((p) => p.codTienda));
          const merged = [...prev];
          for (const p of nuevos) {
            if (!existentes.has(p.codTienda)) merged.push(p);
          }
          return merged;
        });
        setAgregarProductosOpen(false);
      }}
    />
    </>
  );
}
