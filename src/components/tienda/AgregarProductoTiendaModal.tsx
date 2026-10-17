"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import ProductoTiendaCampos, {
  CAMPOS_PRODUCTO_TIENDA_VACIOS,
  PRODUCTO_TIENDA_GRID_CLASS,
  camposProductoTiendaCompletos,
  camposProductoTiendaParaAction,
  type CamposProductoTiendaForm,
} from "@/components/tienda/ProductoTiendaCampos";
import GestionarCatalogosProductoTienda, {
  type CatalogoProductoTienda,
} from "@/components/tienda/GestionarCatalogosProductoTienda";
import SeleccionarComponenteCompuestoModal from "@/components/tienda/SeleccionarComponenteCompuestoModal";
import TablaComponentesCompuesto, {
  aFilaComponente,
  type FilaComponente,
} from "@/components/tienda/TablaComponentesCompuesto";
import { crearProductosTiendaLoteAction } from "@/actions/listaProductos";
import { parseCantidadUnDecimal } from "@/lib/cantidadUnDecimal";
import type { ComponenteCandidatoItem } from "@/lib/productoCompuesto";
import { useCatalogosProductoTienda } from "@/lib/hooks/useCatalogosProductoTienda";
import type { CrearProductoTiendaItemInput } from "@/lib/validations/listaProductos";
import { TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const ROW_ICON_BTN_CLASS = cn(TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS, "h-8 w-8 min-h-8 max-h-8");
const SECCION_TITULO_CLASS = "text-center text-xs font-bold uppercase tracking-wide text-foreground";

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
  const catalogos = useCatalogosProductoTienda(open);
  const [campos, setCampos] = useState<CamposProductoTiendaForm>(CAMPOS_PRODUCTO_TIENDA_VACIOS);
  const [vinculo, setVinculo] = useState<ProductoConProveedor | null>(null);
  const [esPropio, setEsPropio] = useState(false);
  const [esCompuesto, setEsCompuesto] = useState(false);
  const [componentes, setComponentes] = useState<FilaComponente[]>([]);
  const [selectorComponenteAbierto, setSelectorComponenteAbierto] = useState(false);
  const [items, setItems] = useState<ItemPendiente[]>([]);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [pending, setPending] = useState(false);
  const [gestionando, setGestionando] = useState<CatalogoProductoTienda | null>(null);
  const { recargar } = catalogos;
  const cerrarGestion = useCallback(() => {
    setGestionando(null);
    recargar();
  }, [recargar]);

  useEffect(() => {
    if (!open) return;
    setCampos(CAMPOS_PRODUCTO_TIENDA_VACIOS);
    setVinculo(null);
    setEsPropio(false);
    setEsCompuesto(false);
    setComponentes([]);
    setItems([]);
  }, [open]);

  const componentesValidos =
    componentes.length > 0 && componentes.every((c) => parseCantidadUnDecimal(c.cantidadInput) != null);
  const puedeAgregar =
    camposProductoTiendaCompletos(campos) &&
    (esPropio || !!vinculo) &&
    (!esCompuesto || componentesValidos) &&
    !pending;
  const puedeGuardar = items.length > 0 && !pending;

  const rubroSel = catalogos.rubros.find((r) => r.id === campos.idRubro);
  const rubroNombre = rubroSel?.nombre ?? null;
  const subRubroNombre = rubroSel?.subRubros.find((s) => s.id === campos.idSubRubro)?.nombre ?? null;
  const marcaNombre = catalogos.marcas.find((m) => m.id === campos.idMarca)?.nombre ?? null;

  function cambiarPropio(siguiente: boolean) {
    setEsPropio(siguiente);
    if (siguiente) setVinculo(null);
    else cambiarCompuesto(false);
  }

  function cambiarCompuesto(siguiente: boolean) {
    setEsCompuesto(siguiente);
    if (!siguiente) setComponentes([]);
  }

  function agregarComponente(item: ComponenteCandidatoItem) {
    setSelectorComponenteAbierto(false);
    setComponentes((prev) => [...prev, aFilaComponente({ ...item, cantidad: 1 })]);
  }

  function editarCantidadComponente(codTienda: string, valor: string) {
    setComponentes((prev) => prev.map((c) => (c.codTienda === codTienda ? { ...c, cantidadInput: valor } : c)));
  }

  function elegirVinculo(productos: ProductoConProveedor[]) {
    const producto = productos[0];
    if (!producto || productos.length !== 1) {
      toast.error("Elegí una sola línea de proveedor.");
      return;
    }
    if (items.some((i) => i.codExtVinculo === producto.codigoExterno)) {
      toast.error("Esa línea de proveedor ya está en la tabla para otro producto.");
      return;
    }
    setVinculo(producto);
    setSelectorAbierto(false);
  }

  function agregar() {
    if (!puedeAgregar) return;
    const base = camposProductoTiendaParaAction(campos);
    setItems((prev) => [
      ...prev,
      {
        ...base,
        key: crypto.randomUUID(),
        descripcion: base.descripcion.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR"),
        esProductoPropio: esPropio,
        codExtVinculo: esPropio ? null : (vinculo?.codigoExterno ?? null),
        vinculoEtiqueta: esPropio || !vinculo ? null : etiquetaVinculo(vinculo),
        esProductoCompuesto: esPropio && esCompuesto,
        componentes:
          esPropio && esCompuesto
            ? componentes.map((c) => ({
                codTienda: c.codTienda,
                cantidad: parseCantidadUnDecimal(c.cantidadInput) ?? c.cantidad,
              }))
            : [],
      },
    ]);
    // Una línea de proveedor solo puede vincularse a un producto: se elige de nuevo para el siguiente.
    setVinculo(null);
    setComponentes([]);
  }

  function subtituloItem(item: ItemPendiente): string | null {
    if (item.esProductoCompuesto) {
      const n = item.componentes.length;
      return `PRODUCTO COMPUESTO · ${n} ${n === 1 ? "COMPONENTE" : "COMPONENTES"}`;
    }
    return item.esProductoPropio ? "PRODUCTO PROPIO" : item.vinculoEtiqueta;
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
        size="xl"
        className="max-w-[56rem]"
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
        <div className="flex flex-col gap-4">
          <section className="modal-seccion-formulario flex flex-col gap-3">
            <h3 className={SECCION_TITULO_CLASS}>DESCRIPCIÓN Y DATOS</h3>
            <ProductoTiendaCampos
              campos={campos}
              onChange={(patch) => setCampos((prev) => ({ ...prev, ...patch }))}
              catalogos={catalogos}
              disabled={pending}
              autoFocus
              onGestionar={setGestionando}
            />
          </section>
          <section className="modal-seccion-formulario flex flex-col gap-3">
            <h3 className={SECCION_TITULO_CLASS}>TIPO DE PRODUCTO</h3>
            <div className={cn(PRODUCTO_TIENDA_GRID_CLASS, "items-end")}>
              <ModalSiNoChoice label="PROD. PROPIO" value={esPropio} onChange={cambiarPropio} disabled={pending} />
              {esPropio ? (
                <ModalSiNoChoice
                  label="PROD. COMPUESTO"
                  value={esCompuesto}
                  onChange={cambiarCompuesto}
                  disabled={pending}
                />
              ) : null}
            </div>
            {esPropio && esCompuesto ? (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  disabled={pending}
                  onClick={() => setSelectorComponenteAbierto(true)}
                >
                  <Plus aria-hidden />
                  Agregar Componente
                </Button>
                <TablaComponentesCompuesto
                  filas={componentes}
                  bloqueado={pending}
                  onCantidadChange={editarCantidadComponente}
                  onQuitar={(cod) => setComponentes((prev) => prev.filter((c) => c.codTienda !== cod))}
                />
              </div>
            ) : esPropio ? null : (
              <div className="flex min-w-0 flex-col gap-1">
                <ModalMicroLabel>CX. VINC.</ModalMicroLabel>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 min-w-0 flex-1 justify-start gap-2"
                    disabled={pending}
                    onClick={() => setSelectorAbierto(true)}
                  >
                    <Link2 className="shrink-0" aria-hidden />
                    <span
                      className={cn("truncate", !vinculo && "uppercase text-muted-foreground")}
                      title={vinculo ? etiquetaVinculo(vinculo) : undefined}
                    >
                      {vinculo ? etiquetaVinculo(vinculo) : "Elegir línea (obligatorio)"}
                    </span>
                  </Button>
                  {vinculo ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      aria-label="Quitar CX. VINC."
                      disabled={pending}
                      onClick={() => setVinculo(null)}
                    >
                      <X />
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </section>
          <section className="modal-seccion-formulario flex flex-col gap-3">
            <h3 className={SECCION_TITULO_CLASS}>ÍTEMS A CREAR</h3>
            <Button type="button" className="w-full gap-2" disabled={!puedeAgregar} onClick={agregar}>
              <Plus aria-hidden />
              Agregar
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
                    <TableEmptyState message="TODAVÍA NO AGREGASTE PRODUCTOS." placement="panel" />
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.key}>
                    <TableCell className="celda-datos min-w-0">
                      <span className="block truncate" title={item.descripcion}>
                        {item.descripcion}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{subtituloItem(item)}</span>
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
          </section>
        </div>
      </AppModal>
      <SeleccionarProductoModal
        open={selectorAbierto}
        onClose={() => setSelectorAbierto(false)}
        onSeleccionar={elegirVinculo}
        seleccionMultiple={false}
        excluirItemTiendaId=""
        itemDescripcion={campos.descripcion.trim().toLocaleUpperCase("es-AR") || "NUEVO PRODUCTO"}
        marca={marcaNombre}
        rubro={rubroNombre}
        subRubro={subRubroNombre}
      />
      {selectorComponenteAbierto ? (
        <SeleccionarComponenteCompuestoModal
          codTienda={null}
          excluir={componentes.map((c) => c.codTienda)}
          onSeleccionar={agregarComponente}
          onClose={() => setSelectorComponenteAbierto(false)}
        />
      ) : null}
      <GestionarCatalogosProductoTienda
        abierto={gestionando}
        onClose={cerrarGestion}
        esEditor
        onCatalogoChanged={recargar}
      />
    </Dialog>
  );
}
