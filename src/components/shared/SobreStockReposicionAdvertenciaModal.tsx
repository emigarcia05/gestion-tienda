"use client";

import { useEffect, useMemo, useState } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, Check, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  EmptyTableRow,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AppModal from "@/components/shared/AppModal";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  TEXT_WARNING_CLASS,
} from "@/lib/ui-classes";
import type { SobreStockReposicionItem } from "@/services/sobreStock.service";
import type { SucursalPedidoEnvio } from "@/services/pedidosEnvio.service";

function etiquetaSucursalTabla(codigo: SucursalPedidoEnvio): string {
  return codigo === "maipu" ? "MAIPÚ" : "GUAYMALLÉN";
}

const sobreStockAdvertenciaLayoutVariants = cva("flex min-h-0 flex-col", {
  variants: {
    gap: {
      default: "gap-3",
      tight: "gap-2",
    },
  },
  defaultVariants: {
    gap: "default",
  },
});

const sobreStockAdvertenciaTableShellVariants = cva(
  "min-h-0 overflow-hidden rounded-lg border border-border bg-background",
  {
    variants: {
      flex: {
        grow: "flex-1",
      },
    },
    defaultVariants: {
      flex: "grow",
    },
  }
);

export type SobreStockReposicionAdvertenciaModalLayoutProps = VariantProps<
  typeof sobreStockAdvertenciaLayoutVariants
>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: SobreStockReposicionItem[];
  pending?: boolean;
  onPedirAlProveedorIgual: (
    ajustes: Array<{ idItemPedidoEnvio: string; cantPedir: number }>
  ) => void | Promise<void>;
  layoutGap?: SobreStockReposicionAdvertenciaModalLayoutProps["gap"];
}

function fmtNumero(n: number): string {
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("es-AR");
}

const inputBorderClassName = "border-[#0072bb] focus-visible:ring-[#0072bb]";

/**
 * Modal de advertencia antes de generar/enviar un pedido cuando hay sobrestock en la **otra** sucursal
 * (ítems con `cod_tienda`). Orquestado por `GenerarPedidoToolbarButton`, `getSobreStockReposicionParaModalAction`
 * y `generarPdfEnviarPedidoAction`.
 */
export default function SobreStockReposicionAdvertenciaModal({
  open,
  onOpenChange,
  items,
  pending,
  onPedirAlProveedorIgual,
  layoutGap = "default",
}: Props) {
  const [cantPedirDraftByItem, setCantPedirDraftByItem] = useState<Record<string, string>>(
    {}
  );
  const [confirmadoByItem, setConfirmadoByItem] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    const nextDraft: Record<string, string> = {};
    const nextConfirmado: Record<string, boolean> = {};
    for (const item of items) {
      nextDraft[item.idItemPedidoEnvio] = String(Math.max(0, Math.floor(item.cantPedir)));
      nextConfirmado[item.idItemPedidoEnvio] = false;
    }
    queueMicrotask(() => {
      setCantPedirDraftByItem(nextDraft);
      setConfirmadoByItem(nextConfirmado);
    });
  }, [items, open]);

  const todasConfirmadas = useMemo(() => {
    if (items.length === 0) return false;
    return items.every((item) => confirmadoByItem[item.idItemPedidoEnvio] === true);
  }, [confirmadoByItem, items]);

  function parseCant(value: string): number {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    return Number.isFinite(n) ? n : 0;
  }

  function setDraftCantidad(itemId: string, cantidad: number) {
    const cantNormalizada = Math.max(0, Math.floor(cantidad));
    setCantPedirDraftByItem((prev) => ({
      ...prev,
      [itemId]: String(cantNormalizada),
    }));
    setConfirmadoByItem((prev) => ({
      ...prev,
      [itemId]: false,
    }));
  }

  function ajustarCantidad(itemId: string, delta: number) {
    const actual = parseCant(cantPedirDraftByItem[itemId] ?? "0");
    setDraftCantidad(itemId, actual + delta);
  }

  function confirmarFila(itemId: string) {
    setConfirmadoByItem((prev) => ({
      ...prev,
      [itemId]: true,
    }));
  }

  function vaciarYConfirmarFila(itemId: string) {
    setCantPedirDraftByItem((prev) => ({
      ...prev,
      [itemId]: "0",
    }));
    setConfirmadoByItem((prev) => ({
      ...prev,
      [itemId]: true,
    }));
  }

  function buildAjustesConfirmados(): Array<{
    idItemPedidoEnvio: string;
    cantPedir: number;
  }> {
    return items.map((it) => ({
      idItemPedidoEnvio: it.idItemPedidoEnvio,
      cantPedir: parseCant(cantPedirDraftByItem[it.idItemPedidoEnvio] ?? "0"),
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        title="Advertencia Sobrestock"
        size="lg"
        className="max-w-[72rem]"
        padding="sm"
        scrollBody={false}
        headerClassName="pt-4 pb-3"
        footerClassName="py-3"
        actions={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="default"
              disabled={pending || !todasConfirmadas}
              onClick={() => {
                if (!todasConfirmadas) return;
                void onPedirAlProveedorIgual(buildAjustesConfirmados());
              }}
              className="gap-2 disabled:cursor-not-allowed"
              aria-label="Confirmar Cant. Pedida"
            >
              Confirmar Cant. Pedida
            </Button>
          </div>
        }
      >
        <div className={cn(sobreStockAdvertenciaLayoutVariants({ gap: layoutGap }))}>
          <div className="flex items-start gap-2">
            <AlertCircle
              className={cn("mt-0.5 h-5 w-5 shrink-0", TEXT_WARNING_CLASS)}
              aria-hidden
            />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">
                Confirmar Cantidad Pedida al Proveedor
              </p>
            </div>
          </div>

          <div className={sobreStockAdvertenciaTableShellVariants({ flex: "grow" })}>
            <div className="h-full min-h-0 overflow-y-auto no-scrollbar">
              <Table variant="compact" scrollX={false}>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[6%] text-center">
                      <span className="sr-only">Confirmado</span>
                      <Check
                        className="mx-auto my-0 block h-4 w-4 shrink-0 leading-none text-primary-foreground"
                        aria-hidden
                      />
                    </TableHead>
                    <TableHead className="w-[9%]">SUCURSAL</TableHead>
                    <TableHead className="min-w-0 w-[50%]">DESCRIPCIÓN</TableHead>
                    <TableHead className="w-[8%]">SOBRESTOCK</TableHead>
                    <TableHead className="w-[20%]">CANT. PEDIR</TableHead>
                    <TableHead className="w-[9%] tabla-bloque-secundario-head-divider">
                      ACCIONES
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <EmptyTableRow colSpan={6} message="Sin ítems con sobrestock." />
                  ) : (
                    items.map((it) => (
                      <TableRow
                        key={`${it.idItemPedidoEnvio}-${it.origenDeteccion}-${it.sucursalCodigoSobrestock}`}
                        className={cn(
                          confirmadoByItem[it.idItemPedidoEnvio] === true &&
                            "cursor-not-allowed bg-muted/50 odd:bg-muted/50 even:bg-muted/50 hover:bg-muted/50"
                        )}
                      >
                        <TableCell
                          className={cn(
                            "celda-datos w-[6%] text-center align-middle",
                            confirmadoByItem[it.idItemPedidoEnvio] === true && "opacity-60"
                          )}
                        >
                          {confirmadoByItem[it.idItemPedidoEnvio] === true ? (
                            <Check
                              className="mx-auto h-4 w-4 shrink-0 text-primary"
                              aria-label="Ítem confirmado"
                            />
                          ) : (
                            <span
                              className="inline-block h-7 w-full"
                              aria-label="Pendiente de confirmar"
                            />
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "celda-datos w-[9%] whitespace-nowrap",
                            confirmadoByItem[it.idItemPedidoEnvio] === true && "opacity-60"
                          )}
                        >
                          {etiquetaSucursalTabla(it.sucursalCodigoSobrestock)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "celda-datos min-w-0 w-[50%] truncate text-left",
                            confirmadoByItem[it.idItemPedidoEnvio] === true && "opacity-60"
                          )}
                          title={it.descripcionTienda ?? it.descripcionProveedor ?? it.codExt}
                        >
                          {it.descripcionTienda ??
                            it.descripcionProveedor ??
                            it.codExt}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "celda-datos w-[8%] tabular-nums",
                            confirmadoByItem[it.idItemPedidoEnvio] === true && "opacity-60"
                          )}
                        >
                          {fmtNumero(it.sobreStock)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "celda-datos w-[20%]",
                            confirmadoByItem[it.idItemPedidoEnvio] === true && "opacity-60"
                          )}
                        >
                          <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => ajustarCantidad(it.idItemPedidoEnvio, -1)}
                              disabled={pending}
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              aria-label="Disminuir Cant. Pedir"
                              title="Disminuir"
                            >
                              <span className="text-sm leading-none">-</span>
                            </Button>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              inputMode="numeric"
                              disabled={pending}
                              value={cantPedirDraftByItem[it.idItemPedidoEnvio] ?? "0"}
                              onChange={(e) => {
                                const value = e.target.value
                                  .replace(/\D/g, "")
                                  .slice(0, 6);
                                setCantPedirDraftByItem((prev) => ({
                                  ...prev,
                                  [it.idItemPedidoEnvio]: value === "" ? "0" : value,
                                }));
                                setConfirmadoByItem((prev) => ({
                                  ...prev,
                                  [it.idItemPedidoEnvio]: false,
                                }));
                              }}
                              className={cn(
                                "h-8 w-[3.5rem] min-w-[3.5rem] self-center text-center tabular-nums",
                                inputBorderClassName
                              )}
                              aria-label={`Cantidad a pedir para ${it.descripcionTienda ?? it.descripcionProveedor ?? it.codExt}`}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => ajustarCantidad(it.idItemPedidoEnvio, 1)}
                              disabled={pending}
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              aria-label="Aumentar Cant. Pedir"
                              title="Aumentar"
                            >
                              <span className="text-sm leading-none">+</span>
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="celda-datos w-[9%] tabla-bloque-secundario-cell-divider">
                          <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => confirmarFila(it.idItemPedidoEnvio)}
                              disabled={pending}
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              aria-label="Confirmar"
                              title="Confirmar"
                            >
                              <Check className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => vaciarYConfirmarFila(it.idItemPedidoEnvio)}
                              disabled={pending}
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              aria-label="Poner en cero y confirmar"
                              title="Poner en cero y confirmar"
                            >
                              <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
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
        </div>
      </AppModal>
    </Dialog>
  );
}
