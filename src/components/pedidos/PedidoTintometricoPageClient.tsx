"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FilterBar, {
  FILTER_SELECT_WRAPPER_CLASS,
  FilaFiltrosDesplegables,
  FilterRowSearch,
  FilterRowSelection,
  SELECT_TRIGGER_FILTER_CLASS,
} from "@/components/FilterBar";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import GenerarPedidoToolbarButton from "@/components/pedidos/GenerarPedidoToolbarButton";
import type { SucursalPedido } from "@/lib/pedidos";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  tableEmptyStateContainerVariants,
  tableEmptyStateMessageVariants,
} from "@/components/shared/TableEmptyState";
import { cn } from "@/lib/utils";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import type { ProveedorTintometrico, SucursalTintometrica } from "@/services/tintometrico.service";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import NuevoItemTintometricoModal, {
  type NuevoItemTintometricoDraft,
} from "@/components/pedidos/NuevoItemTintometricoModal";
import { deletePedidoTintometricoItemAction } from "@/actions/pedidos";
import { buildCodExtTintometrico } from "@/lib/pedidosTintometrico";
import { useAplicarSucursalPreferidaSiVacia } from "@/lib/hooks/useAplicarSucursalPreferidaSiVacia";

type ItemTintometrico = {
  key: string;
  /** Presente cuando la fila viene de BD (`prod_ped_merc`). */
  id?: string;
  sucursalCodigo: string;
  proveedorId: string;
  codExt: string;
  codTienda: string;
  cantidad: number;
  descripcion: string;
};

function claveItemTintometrico(
  i: Pick<ItemTintometrico, "id" | "proveedorId" | "sucursalCodigo" | "codExt">
): string {
  return i.id ?? `${i.proveedorId}:TINTOMETRICO:${i.sucursalCodigo}:${i.codExt}`;
}

const MODAL_PARAM = "nuevo-item-tintometrico";

export default function PedidoTintometricoPageClient({
  proveedores,
  sucursales,
  initialItems,
}: {
  proveedores: ProveedorTintometrico[];
  sucursales: SucursalTintometrica[];
  initialItems: Array<{
    id: string;
    sucursalCodigo: string;
    proveedorId: string;
    codExt: string;
    codTienda: string;
    cantidad: number;
    descripcion: string;
  }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ItemTintometrico[]>(
    initialItems.map((i) => ({
      ...i,
      key: claveItemTintometrico(i),
    }))
  );

  useEffect(() => {
    queueMicrotask(() => {
      setItems(
        initialItems.map((i) => ({
          ...i,
          key: claveItemTintometrico(i),
        }))
      );
    });
  }, [initialItems]);
  const [filtroSucursal, setFiltroSucursal] = useState<string>("");
  const [filtroProveedor, setFiltroProveedor] = useState<string>("");
  const [q, setQ] = useState("");
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useAplicarSucursalPreferidaSiVacia(filtroSucursal || null, (codigo) => {
    if (!sucursales.some((s) => s.codigo === codigo)) return;
    setFiltroSucursal(codigo);
  });

  const modalOpen = searchParams.get("modal") === MODAL_PARAM;

  const sucursalParaGenerar: SucursalPedido | "" =
    filtroSucursal === "guaymallen" || filtroSucursal === "maipu"
      ? filtroSucursal
      : "";

  function setModalOpenInUrl(open: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (open) params.set("modal", MODAL_PARAM);
    else params.delete("modal");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const proveedoresById = useMemo(() => {
    const map = new Map<string, ProveedorTintometrico>();
    for (const p of proveedores) map.set(p.id, p);
    return map;
  }, [proveedores]);

  const sucursalPorCodigo = useMemo(() => {
    const map = new Map<string, SucursalTintometrica>();
    for (const s of sucursales) map.set(s.codigo, s);
    return map;
  }, [sucursales]);

  const itemsFiltrados = useMemo(
    () =>
      items.filter((i) => {
        if (filtroSucursal && i.sucursalCodigo !== filtroSucursal) return false;
        if (filtroProveedor && i.proveedorId !== filtroProveedor) return false;
        if (q.trim()) {
          const texto = `${i.descripcion} ${i.codTienda} ${i.codExt}`.toLowerCase();
          if (!texto.includes(q.trim().toLowerCase())) return false;
        }
        return true;
      }),
    [items, filtroSucursal, filtroProveedor, q]
  );

  function agregarItem(draft: NuevoItemTintometricoDraft) {
    const codTienda = draft.base.codTienda.trim();
    const codExt = buildCodExtTintometrico(codTienda, draft.codTintometrico);
    const descripcionBase = (draft.base.descripcionTienda ?? "").trim();
    const codigo = draft.codTintometrico.trim();
    const descripcion =
      descripcionBase && codigo
        ? `${descripcionBase} - COD. ${codigo}`.toUpperCase()
        : (descripcionBase || "").toUpperCase();
    const key = claveItemTintometrico({
      id: undefined,
      proveedorId: draft.proveedorId,
      sucursalCodigo: draft.sucursalCodigo,
      codExt,
    });

    setItems((prev) => {
      const idx = prev.findIndex((p) => p.key === key);
      const nextItem: ItemTintometrico = {
        key,
        sucursalCodigo: draft.sucursalCodigo,
        proveedorId: draft.proveedorId,
        codExt,
        codTienda,
        cantidad: draft.cantidad,
        descripcion,
      };
      if (idx === -1) return [...prev, nextItem];
      const next = [...prev];
      next[idx] = nextItem;
      return next;
    });
  }

  async function borrarItem(item: ItemTintometrico) {
    setDeletingKey(item.key);
    const res = item.id
      ? await deletePedidoTintometricoItemAction({ id: item.id })
      : await deletePedidoTintometricoItemAction({
          sucursalCodigo: item.sucursalCodigo as "guaymallen" | "maipu",
          proveedorId: item.proveedorId,
          codExt: item.codExt,
        });
    setDeletingKey(null);
    if (!res.ok) {
      toast.error(res.error ?? "Error al borrar el ítem.");
      return;
    }
    setItems((prev) => prev.filter((i) => i.key !== item.key));
  }

  const filters = (
    <FilterBar className="filtros-contenedor-tienda bg-card">
      <FilterRowSelection>
        <FilaFiltrosDesplegables>
          <div className={FILTER_SELECT_WRAPPER_CLASS}>
            <Select
              value={filtroSucursal || "todas"}
              onValueChange={(value) => setFiltroSucursal(value === "todas" ? "" : value)}
            >
              <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS}>
                <SelectValue placeholder="SUCURSAL" />
              </SelectTrigger>
              <SelectContent className="select-content-filtro" position="popper" side="bottom" align="start">
                <SelectItem value="todas">SUCURSAL</SelectItem>
                {sucursales.map((s) => (
                  <SelectItem key={s.id} value={s.codigo}>
                    {s.nombre.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={FILTER_SELECT_WRAPPER_CLASS}>
            <Select
              value={filtroProveedor || "todos"}
              onValueChange={(value) => setFiltroProveedor(value === "todos" ? "" : value)}
            >
              <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS}>
                <SelectValue placeholder="PROVEEDORES" />
              </SelectTrigger>
              <SelectContent className="select-content-filtro" position="popper" side="bottom" align="start">
                <SelectItem value="todos">PROVEEDORES</SelectItem>
                {proveedores.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {`${p.prefijo} - ${p.nombre}`.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={FILTER_SELECT_WRAPPER_CLASS} />
          <div className={FILTER_SELECT_WRAPPER_CLASS} />
          <div className={FILTER_SELECT_WRAPPER_CLASS} />
        </FilaFiltrosDesplegables>
      </FilterRowSelection>

      <div className="flex items-center gap-3">
        <FilterRowSearch className="flex-1">
          <FiltroBusquedaInput
            id="filtro-tintometrico-busqueda"
            placeholder="BUSCAR POR DESCRIPCIÓN O CÓDIGO..."
            value={q}
            onChange={setQ}
            isDebouncing={false}
            inputRef={searchRef}
          />
        </FilterRowSearch>
      </div>
    </FilterBar>
  );

  return (
    <ClassicFilteredTableLayout
      title="Compras"
      subtitle="Cant. Pedida"
      subtitleSecondary="Tintométrico"
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="default"
            size="lg"
            onClick={() => setModalOpenInUrl(true)}
            aria-label="Agregar Tintométrico"
            title="Agregar Tintométrico"
            className="h-10 min-h-10 px-6 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Agregar Tintométrico</span>
          </Button>
          <GenerarPedidoToolbarButton
            proveedores={proveedores.map((p) => ({
              id: p.id,
              nombre: p.nombre,
              prefijo: p.prefijo,
            }))}
            defaultSucursal={sucursalParaGenerar}
            defaultProveedor={filtroProveedor}
            defaultTipos={[]}
            modulo="tintometrico"
            triggerSize="lg"
            triggerClassName="h-10 min-h-10 px-6 shrink-0"
          />
        </div>
      }
      filters={filters}
    >
      <div className="flex h-full min-h-0 flex-col gap-0.5">
        <div className="contenedor-tabla-gestion no-scroll-x flex-1 min-h-0">
          <Table variant="compact" className="tabla-gestion-compacta w-full table-fixed">
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[64%]" />
              <col className="w-[8%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>PROVEEDOR</TableHead>
                <TableHead>SUCURSAL</TableHead>
                <TableHead className="text-right">CANT.</TableHead>
                <TableHead>DESCRIPCIÓN</TableHead>
                <TableHead className="text-right">
                  <Trash2 className="h-4 w-4 mx-auto" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className={cn(
                      tableEmptyStateContainerVariants({
                        placement: "tableCellTall",
                        textSize: "sm",
                      })
                    )}
                  >
                    <span
                      className={tableEmptyStateMessageVariants({
                        maxWidth: "full",
                      })}
                    >
                      Sin Ítems. Presioná “+” Para Agregar.
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                itemsFiltrados.map((i) => {
                  const prov = proveedoresById.get(i.proveedorId);
                  const suc = sucursalPorCodigo.get(i.sucursalCodigo);
                  return (
                    <TableRow key={i.key}>
                      <TableCell className="celda-datos">
                        {(prov?.prefijo ?? "").trim()}
                      </TableCell>
                      <TableCell className="celda-datos">
                        {(suc?.nombre ?? "").trim()}
                      </TableCell>
                      <TableCell className="celda-datos text-right tabular-nums">
                        {i.cantidad.toLocaleString()}
                      </TableCell>
                      <TableCell className="celda-datos">
                        {i.descripcion}
                      </TableCell>
                      <TableCell className="celda-datos celda-datos--accion-relleno-fila text-right">
                        <div
                          className={cn(
                            TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
                            "justify-end"
                          )}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => borrarItem(i)}
                            disabled={deletingKey === i.key}
                            className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                            aria-label="Borrar Ítem"
                            title="Borrar Ítem"
                          >
                            <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <NuevoItemTintometricoModal
          open={modalOpen}
          onOpenChange={setModalOpenInUrl}
          proveedores={proveedores}
          sucursales={sucursales}
          onAgregar={agregarItem}
        />
      </div>
    </ClassicFilteredTableLayout>
  );
}
