"use client";

import { useState, useEffect, useRef, useMemo, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Lock, Tag } from "lucide-react";
import { setProductoPropioTiendaAction } from "@/actions/tienda";
import { FiltroIndividualContainer } from "@/components/FilterBar";
import { getProveedores, listarProductosParaVincular } from "@/actions/vinculos";
import type { ProductoProveedorParaVincular } from "@/services/listaPrecios.service";
import {
  TableEmptyState,
  modalListLoadingVariants,
  tableEmptyStateContainerVariants,
  tableEmptyStateMessageVariants,
} from "@/components/shared/TableEmptyState";
import { cn } from "@/lib/utils";

/** Forma que espera TablaTienda (Cx Compra) al seleccionar un producto proveedor. */
export type ProductoConProveedor = {
  id: string;
  proveedorId: string;
  codigoExterno: string;
  codProdProv: string;
  descripcion: string;
  precioLista: number;
  proveedor: { nombre: string; prefijo: string };
};

type ProveedorOption = { id: string; nombre: string; prefijo: string };

interface Props {
  open: boolean;
  onClose: () => void;
  onSeleccionar: (producto: ProductoConProveedor) => void;
  excluirItemTiendaId: string;
  /** IDs de proveedor (`proveedores`) ya vinculados; se excluyen filas de esos proveedores. */
  idsProveedoresYaVinculados?: string[];
  /** Mismo encabezado que en el detalle expandido de **Cx Compra**. */
  itemDescripcion: string;
  marca?: string | null;
  rubro?: string | null;
  subRubro?: string | null;
  /** Permite marcar producto propio en el panel sin filtros. */
  puedeEditar?: boolean;
  esProductoPropio?: boolean;
  onProductoPropioChanged?: () => void;
}

export default function SeleccionarProductoModal({
  open,
  onClose,
  onSeleccionar,
  excluirItemTiendaId,
  idsProveedoresYaVinculados = [],
  itemDescripcion,
  marca,
  rubro,
  subRubro,
  puedeEditar = false,
  esProductoPropio = false,
  onProductoPropioChanged,
}: Props) {
  const [proveedores, setProveedores] = useState<ProveedorOption[]>([]);
  const [proveedorId, setProveedorId] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ProductoProveedorParaVincular[]>([]);
  const [loading, setLoading] = useState(false);
  const [infoVinculo, setInfoVinculo] = useState<
    { codTienda: string; descripcion: string | null; prefijo: string } | null
  >(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [esPropio, setEsPropio] = useState(esProductoPropio);
  const [togglePropioPending, startTogglePropio] = useTransition();

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => setEsPropio(esProductoPropio));
  }, [open, esProductoPropio]);

  useEffect(() => {
    if (!open) return;
    getProveedores().then(setProveedores);
  }, [open]);

  const hayFiltros = !!proveedorId || !!q.trim();

  const lineaMarcaRubroSub = useMemo(
    () =>
      [marca, rubro, subRubro]
        .map((s) => (s ?? "").trim())
        .filter(Boolean)
        .join(" - "),
    [marca, rubro, subRubro]
  );

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!hayFiltros) {
      queueMicrotask(() => {
        setLoading(false);
        setRows([]);
      });
      return;
    }
    queueMicrotask(() => setLoading(true));
    const run = async () => {
      const result = await listarProductosParaVincular(
        proveedorId || undefined,
        q.trim() || undefined
      );
      setLoading(false);
      if (result.success) {
        const filtrados = idsProveedoresYaVinculados.length
          ? result.data.filter((r) => !idsProveedoresYaVinculados.includes(r.idProveedor))
          : result.data;
        setRows(filtrados);
      } else {
        toast.error(result.error);
        setRows([]);
      }
    };
    debounceRef.current = setTimeout(run, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, proveedorId, q, hayFiltros, idsProveedoresYaVinculados]);

  function vinculadoOtraTienda(row: ProductoProveedorParaVincular): boolean {
    return (
      row.tiendaVinculada != null &&
      row.tiendaVinculada.codTienda !== excluirItemTiendaId
    );
  }

  function handleRowDoubleClick(row: ProductoProveedorParaVincular) {
    if (vinculadoOtraTienda(row) && row.tiendaVinculada) {
      setInfoVinculo({
        codTienda: row.tiendaVinculada.codTienda,
        descripcion: row.tiendaVinculada.descripcion,
        prefijo: row.proveedor.prefijo,
      });
      return;
    }
    const producto: ProductoConProveedor = {
      id: row.id,
      proveedorId: row.idProveedor,
      codigoExterno: row.codExt,
      codProdProv: row.codProdProv,
      descripcion: row.descripcionProveedor,
      precioLista: 0,
      proveedor: { nombre: row.proveedor.nombre, prefijo: row.proveedor.prefijo },
    };
    onSeleccionar(producto);
  }

  const MENSAJE_SIN_FILTRO =
    "APLICÁ AL MENOS UN FILTRO (PROVEEDOR O DESCRIPCIÓN) PARA VER LOS PRODUCTOS.";

  function handleToggleProductoPropio() {
    if (!puedeEditar) return;
    const siguiente = !esPropio;
    startTogglePropio(async () => {
      const res = await setProductoPropioTiendaAction({
        codTienda: excluirItemTiendaId,
        esProductoPropio: siguiente,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEsPropio(res.data.esProductoPropio);
      toast.success(
        res.data.esProductoPropio
          ? "Marcado como producto propio."
          : "Ya no es producto propio."
      );
      onProductoPropioChanged?.();
      if (res.data.esProductoPropio) {
        onClose();
      }
    });
  }

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        className={cn(
          "modal-app max-w-[84rem] w-[calc(100%-2rem)] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden"
        )}
      >
        <DialogHeader className="modal-app__header shrink-0">
          <DialogTitle className="modal-app__title">Vincular Nuevo Producto</DialogTitle>
        </DialogHeader>

        {/* Plantilla modal-app: content (cuerpo + footer) según globals.css */}
        <div className="modal-app__content flex-1 min-h-0">
          {/* Cuerpo: Filtro Proveedor (fijo) + Filtro Descripción (fijo) + Encabezado (fijo) + Tabla (scroll) */}
          <div className="modal-app__body flex flex-col flex-1 min-h-0 overflow-hidden px-6 pt-4 pb-0">
            <div className="flex shrink-0 flex-col gap-1 pb-2 text-center">
              <p className="text-sm font-semibold text-foreground break-words">{itemDescripcion}</p>
              {lineaMarcaRubroSub ? (
                <p className="text-xs text-muted-foreground break-words">{lineaMarcaRubroSub}</p>
              ) : null}
            </div>

            {/* Mismo ancho que la tabla: contenedor y filtros a ancho completo */}
            <div className="shrink-0 w-full flex flex-col gap-2 pb-3 border-b border-border">
              {/* Filtro Proveedor (fijo) */}
              <FiltroIndividualContainer
                className="w-full"
                activo={!!proveedorId}
                onLimpiar={() => setProveedorId("")}
              >
                <Select
                  value={proveedorId || "none"}
                  onValueChange={(v) => setProveedorId(v === "none" ? "" : v)}
                >
                  <SelectTrigger className="input-filtro-unificado w-full">
                    <SelectValue placeholder="PROVEEDOR" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">TODOS LOS PROVEEDORES</SelectItem>
                    {proveedores.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        [{p.prefijo}] {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>

              <FiltroIndividualContainer
                className="w-full"
                activo={!!q.trim()}
                onLimpiar={() => setQ("")}
              >
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="DESCRIPCIÓN"
                  className="input-filtro-unificado w-full min-w-0"
                />
              </FiltroIndividualContainer>
            </div>

            {/* Encabezado (fijo, fuera del scroll) + Tabla (solo cuerpo con scroll). Mismo ancho de columnas con table-fixed. */}
            <div className="flex-1 min-h-0 flex flex-col pt-3 pb-3">
              {!hayFiltros ? (
                <div
                  className={cn(
                    tableEmptyStateContainerVariants({ placement: "panel" }),
                    "flex flex-col items-center justify-center gap-4"
                  )}
                >
                  <span
                    className={cn(tableEmptyStateMessageVariants({ maxWidth: "readable" }))}
                  >
                    {MENSAJE_SIN_FILTRO}
                  </span>
                  {puedeEditar ? (
                    <Button
                      type="button"
                      variant="default"
                      className="btn-primario-gestion gap-2"
                      aria-pressed={esPropio}
                      disabled={togglePropioPending}
                      onClick={() => handleToggleProductoPropio()}
                    >
                      <Tag className="h-4 w-4 shrink-0" aria-hidden />
                      Producto Propio
                    </Button>
                  ) : null}
                </div>
              ) : loading ? (
                <div
                  className={cn(modalListLoadingVariants({ padding: "panel" }))}
                  role="status"
                  aria-live="polite"
                >
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                  CARGANDO…
                </div>
              ) : rows.length === 0 ? (
                <TableEmptyState
                  message="NO HAY PRODUCTOS O NO COINCIDEN LOS FILTROS."
                  placement="panel"
                />
              ) : (
                <>
                  {/* Encabezado fijo: fuera del contenedor con scroll */}
                  <div className="shrink-0">
                    <Table variant="compact" scrollX={false} className="table-fixed w-full">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-b-0">
                          <TableHead className="w-28 text-center">PROVEEDOR</TableHead>
                          <TableHead className="min-w-0">DESCRIPCIÓN</TableHead>
                        </TableRow>
                      </TableHeader>
                    </Table>
                  </div>
                  {/* Cuerpo con scroll: solo tbody */}
                  <div className="flex-1 min-h-0 overflow-y-auto border-b border-border">
                    <Table variant="compact" scrollX={false} className="table-fixed w-full">
                      <TableBody>
                        {rows.map((row) => {
                          const bloqueado = vinculadoOtraTienda(row);
                          return (
                            <TableRow
                              key={row.id}
                              onDoubleClick={() => handleRowDoubleClick(row)}
                              className={cn(
                                "select-none",
                                bloqueado
                                  ? "cursor-not-allowed opacity-60 bg-muted/40 hover:bg-muted/50"
                                  : "cursor-pointer hover:bg-primary/5"
                              )}
                              title={
                                bloqueado
                                  ? "Producto ya vinculado a otro ítem. Doble clic para ver detalles."
                                  : "Doble Clic Para Vincular"
                              }
                              aria-disabled={bloqueado || undefined}
                            >
                              <TableCell className="celda-datos w-28 text-center">
                                <Badge variant="secondary" className="font-mono text-xs">
                                  {row.proveedor.prefijo}
                                </Badge>
                              </TableCell>
                              <TableCell className="celda-datos min-w-0">
                                <span
                                  className="flex items-center gap-2 min-w-0"
                                  title={row.descripcionProveedor}
                                >
                                  {bloqueado ? (
                                    <Lock
                                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                      aria-hidden
                                    />
                                  ) : null}
                                  <span className="block truncate">
                                    {row.descripcionProveedor}
                                  </span>
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="modal-app__footer shrink-0 justify-between">
            <p className="text-sm text-muted-foreground tabular-nums">
              {rows.length > 0 && (
                <>
                  <strong className="text-primary font-semibold">{rows.length.toLocaleString()}</strong>
                  {" RESULTADO(S)"}
                </>
              )}
            </p>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog
      open={infoVinculo != null}
      onOpenChange={(v) => {
        if (!v) setInfoVinculo(null);
      }}
    >
      <DialogContent className="modal-app max-w-md w-[calc(100%-2rem)] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="modal-app__header shrink-0">
          <DialogTitle className="modal-app__title">Producto Ya Vinculado</DialogTitle>
        </DialogHeader>
        <div className="modal-app__content">
          <div className="modal-app__body px-6 py-4 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Este producto del proveedor{" "}
              <strong className="text-foreground font-semibold">
                [{infoVinculo?.prefijo}]
              </strong>{" "}
              ya está vinculado al siguiente ítem de tienda:
            </p>
            <div className="rounded-md border border-border bg-card p-3 flex flex-col gap-1">
              <span className="text-xs uppercase text-muted-foreground tracking-wide">
                Cód. Tienda
              </span>
              <span className="text-sm font-mono font-semibold text-foreground">
                {infoVinculo?.codTienda}
              </span>
              <span className="text-xs uppercase text-muted-foreground tracking-wide mt-2">
                Descripción
              </span>
              <span className="text-sm text-foreground break-words">
                {infoVinculo?.descripcion?.trim() || "(sin descripción)"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Para vincularlo a otro ítem, primero desvinculá este producto desde su ítem
              tienda actual.
            </p>
          </div>
          <div className="modal-app__footer shrink-0 justify-end">
            <Button variant="default" size="sm" onClick={() => setInfoVinculo(null)}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
