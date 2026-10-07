"use client";

import { useEffect, useState } from "react";
import { Link2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
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
} from "@/components/ui/table";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import ModalSiNoChoice from "@/components/shared/ModalSiNoChoice";
import { TableEmptyState } from "@/components/shared/TableEmptyState";
import SeleccionarProductoModal, {
  type ProductoConProveedor,
} from "@/components/tienda/SeleccionarProductoModal";
import {
  crearProductosTiendaLoteAction,
  listarColoresOpcionesAction,
  listarMarcasCatalogoAction,
  listarPresentacionesOpcionesAction,
  listarRubrosCatalogoAction,
} from "@/actions/listaProductos";
import type { MarcaCatalogoItem, OpcionCatalogoItem, RubroCatalogoItem } from "@/lib/listaProductos";
import type { CrearProductoTiendaItemInput } from "@/lib/validations/listaProductos";
import { TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const SIN_VALOR = "none";
const ROW_ICON_BTN_CLASS = cn(TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS, "h-8 w-8 min-h-8 max-h-8");

type ItemPendiente = CrearProductoTiendaItemInput & { key: string; vinculoEtiqueta: string | null };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreado: (codTiendas: string[]) => void;
}

function etiquetaVinculo(p: ProductoConProveedor): string {
  return `[${p.proveedor.prefijo}] ${p.descripcion}`;
}

export default function AgregarProductoTiendaModal({ open, onOpenChange, onCreado }: Props) {
  const [rubros, setRubros] = useState<RubroCatalogoItem[]>([]);
  const [marcas, setMarcas] = useState<MarcaCatalogoItem[]>([]);
  const [presentaciones, setPresentaciones] = useState<OpcionCatalogoItem[]>([]);
  const [colores, setColores] = useState<OpcionCatalogoItem[]>([]);
  const [descripcion, setDescripcion] = useState("");
  const [idRubro, setIdRubro] = useState("");
  const [subRubro, setSubRubro] = useState("");
  const [idMarca, setIdMarca] = useState("");
  const [idPresentacion, setIdPresentacion] = useState(SIN_VALOR);
  const [idColor, setIdColor] = useState(SIN_VALOR);
  const [vinculo, setVinculo] = useState<ProductoConProveedor | null>(null);
  const [esPropio, setEsPropio] = useState(false);
  const [bulto, setBulto] = useState("");
  const [items, setItems] = useState<ItemPendiente[]>([]);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDescripcion("");
    setIdRubro("");
    setSubRubro("");
    setIdMarca("");
    setIdPresentacion(SIN_VALOR);
    setIdColor(SIN_VALOR);
    setVinculo(null);
    setEsPropio(false);
    setBulto("");
    setItems([]);
    void Promise.all([
      listarRubrosCatalogoAction(),
      listarMarcasCatalogoAction(),
      listarPresentacionesOpcionesAction(),
      listarColoresOpcionesAction(),
    ]).then(([resRubros, resMarcas, resPres, resColores]) => {
      if (resRubros.ok) setRubros(resRubros.data);
      else toast.error(resRubros.error);
      if (resMarcas.ok) setMarcas(resMarcas.data);
      else toast.error(resMarcas.error);
      if (resPres.ok) setPresentaciones(resPres.data);
      else toast.error(resPres.error);
      if (resColores.ok) setColores(resColores.data);
      else toast.error(resColores.error);
    });
  }, [open]);

  const bultoTrim = bulto.trim();
  const bultoNum = bultoTrim ? Number(bultoTrim) : null;
  const bultoInvalido = bultoNum !== null && (!Number.isInteger(bultoNum) || bultoNum < 1);
  const puedeCrear =
    descripcion.trim().length > 0 &&
    !!idRubro &&
    !!idMarca &&
    (esPropio || !!vinculo) &&
    !bultoInvalido &&
    !pending;
  const puedeGuardar = items.length > 0 && !pending;

  const rubroNombre = rubros.find((r) => r.id === idRubro)?.nombre ?? null;
  const marcaNombre = marcas.find((m) => m.id === idMarca)?.nombre ?? null;

  function cambiarPropio(siguiente: boolean) {
    setEsPropio(siguiente);
    if (siguiente) setVinculo(null);
  }

  function elegirVinculo(producto: ProductoConProveedor) {
    if (items.some((i) => i.codExtVinculo === producto.codigoExterno)) {
      toast.error("Esa línea de proveedor ya está en la tabla para otro producto.");
      return;
    }
    setVinculo(producto);
    setSelectorAbierto(false);
  }

  function crear() {
    if (!puedeCrear) return;
    setItems((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        descripcion: descripcion.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR"),
        idRubro,
        subRubro: subRubro.trim() || null,
        idMarca,
        idPresentacion: idPresentacion === SIN_VALOR ? null : idPresentacion,
        idColor: idColor === SIN_VALOR ? null : idColor,
        bulto: bultoNum,
        esProductoPropio: esPropio,
        codExtVinculo: esPropio ? null : (vinculo?.codigoExterno ?? null),
        vinculoEtiqueta: esPropio || !vinculo ? null : etiquetaVinculo(vinculo),
      },
    ]);
    // Una línea de proveedor solo puede vincularse a un producto: se elige de nuevo para el siguiente.
    setVinculo(null);
  }

  async function guardar() {
    if (!puedeGuardar) return;
    setPending(true);
    try {
      const res = await crearProductosTiendaLoteAction({
        items: items.map(({ key: _key, vinculoEtiqueta: _etiqueta, ...item }) => item),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const { codTiendas } = res.data;
      toast.success(
        codTiendas.length === 1
          ? `Producto creado con código ${codTiendas[0]}.`
          : `${codTiendas.length} productos creados (${codTiendas[0]} a ${codTiendas[codTiendas.length - 1]}).`
      );
      onOpenChange(false);
      onCreado(codTiendas);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AppModal
        title="AGREGAR ITEM"
        size="lg"
        actions={
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={!puedeGuardar} onClick={() => void guardar()}>
              Guardar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>DESCRIPCIÓN</ModalMicroLabel>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="DESCRIPCIÓN DEL PRODUCTO"
              disabled={pending}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>RUBRO</ModalMicroLabel>
            <Select value={idRubro} onValueChange={setIdRubro} disabled={pending}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="RUBRO (OBLIGATORIO)" />
              </SelectTrigger>
              <SelectContent>
                {rubros.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>SUB-RUBRO</ModalMicroLabel>
            <Input
              value={subRubro}
              onChange={(e) => setSubRubro(e.target.value)}
              placeholder="SUB-RUBRO"
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>MARCA</ModalMicroLabel>
            <Select value={idMarca} onValueChange={setIdMarca} disabled={pending}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="MARCA (OBLIGATORIO)" />
              </SelectTrigger>
              <SelectContent>
                {marcas.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>PRESENTACIÓN</ModalMicroLabel>
            <Select value={idPresentacion} onValueChange={setIdPresentacion} disabled={pending}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="PRESENTACIÓN" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_VALOR}>SIN PRESENTACIÓN</SelectItem>
                {presentaciones.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>COLOR</ModalMicroLabel>
            <Select value={idColor} onValueChange={setIdColor} disabled={pending}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="COLOR" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_VALOR}>SIN COLOR</SelectItem>
                {colores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!esPropio ? (
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>CX. VINCULADO</ModalMicroLabel>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-0 flex-1 justify-start gap-2"
                  disabled={pending}
                  onClick={() => setSelectorAbierto(true)}
                >
                  <Link2 className="shrink-0" aria-hidden />
                  <span
                    className={cn("truncate", !vinculo && "uppercase text-muted-foreground")}
                    title={vinculo ? etiquetaVinculo(vinculo) : undefined}
                  >
                    {vinculo ? etiquetaVinculo(vinculo) : "Elegir línea de proveedor (obligatorio)"}
                  </span>
                </Button>
                {vinculo ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Quitar CX. VINCULADO"
                    disabled={pending}
                    onClick={() => setVinculo(null)}
                  >
                    <X />
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          <ModalSiNoChoice label="PROD. PROPIO" value={esPropio} onChange={cambiarPropio} disabled={pending} />
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>BULTO</ModalMicroLabel>
            <Input
              value={bulto}
              onChange={(e) => setBulto(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="UNIDADES POR BULTO"
              disabled={pending}
              aria-invalid={bultoInvalido || undefined}
            />
          </div>
          <Button type="button" className="w-full gap-2" disabled={!puedeCrear} onClick={crear}>
            <Plus aria-hidden />
            Crear
          </Button>
          <Table variant="compact" scrollX={false} className="table-fixed w-full">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>DESCRIPCIÓN</TableHead>
                <TableHead className="w-14 text-center" aria-label="Acciones" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={2}>
                    <TableEmptyState message="TODAVÍA NO CREASTE PRODUCTOS." placement="panel" />
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.key}>
                    <TableCell className="celda-datos min-w-0">
                      <span className="block truncate" title={item.descripcion}>
                        {item.descripcion}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.esProductoPropio ? "PRODUCTO PROPIO" : item.vinculoEtiqueta}
                      </span>
                    </TableCell>
                    <TableCell className="w-14 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={ROW_ICON_BTN_CLASS}
                        aria-label={`Quitar ${item.descripcion}`}
                        disabled={pending}
                        onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </AppModal>
      <SeleccionarProductoModal
        open={selectorAbierto}
        onClose={() => setSelectorAbierto(false)}
        onSeleccionar={elegirVinculo}
        excluirItemTiendaId=""
        itemDescripcion={descripcion.trim().toLocaleUpperCase("es-AR") || "NUEVO PRODUCTO"}
        marca={marcaNombre}
        rubro={rubroNombre}
        subRubro={subRubro.trim().toLocaleUpperCase("es-AR") || null}
      />
    </Dialog>
  );
}
