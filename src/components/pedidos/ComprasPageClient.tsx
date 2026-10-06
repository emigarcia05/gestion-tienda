"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Undo2 } from "lucide-react";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import PaginacionTabla from "@/components/shared/PaginacionTabla";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { PAGE_SIZE } from "@/lib/pagination";
import type { CompraRecepcionadaFila } from "@/services/compras.service";
import PedidoHistoriaDetalleModal from "@/components/pedidos/PedidoHistoriaDetalleModal";
import PedidoHistoriaLecturaModal from "@/components/pedidos/PedidoHistoriaLecturaModal";
import FiltrosCompras from "@/components/pedidos/FiltrosCompras";

interface Props {
  items: CompraRecepcionadaFila[];
  total: number;
  totalPaginas: number;
  paginaNum: number;
  errorMsg: string | null;
  proveedores: Array<{ id: string; nombre: string; prefijo: string }>;
  proveedorId: string;
  sucursalCodigo: string;
  q: string;
}

const COL_WIDTHS_PCT = [10, 20, 12, 16, 7, 11, 11, 13] as const;

function fmtPesos(n: number): string {
  return `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtFechaIso(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export default function ComprasPageClient({
  items,
  total,
  totalPaginas,
  paginaNum,
  errorMsg,
  proveedores,
  proveedorId,
  sucursalCodigo,
  q,
}: Props) {
  const router = useRouter();
  const [notaCreditoPedidoId, setNotaCreditoPedidoId] = useState<string | null>(null);
  const [verPedidoId, setVerPedidoId] = useState<string | null>(null);
  const showingEmpty = items.length === 0;

  return (
    <ClassicFilteredTableLayout
      title="Compras"
      subtitle="Compras"
      filters={
        <FiltrosCompras
          proveedores={proveedores}
          proveedorId={proveedorId}
          sucursalCodigo={sucursalCodigo}
          q={q}
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-0">
        <Card className="card-tabla-envoltorio">
          <CardContent className="flex-1 min-h-0 flex flex-col p-0 overflow-hidden">
            <div className="flex flex-col flex-1 min-h-0">
              <div className="contenedor-tabla-gestion no-scroll-x flex-1 min-h-0">
                <Table
                  variant="compact"
                  scrollX={false}
                  className="tabla-gestion-compacta w-full table-fixed"
                >
                  <colgroup>
                    {COL_WIDTHS_PCT.map((pct, i) => (
                      <col key={i} style={{ width: `${pct}%` }} />
                    ))}
                  </colgroup>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>FECHA</TableHead>
                      <TableHead>PROVEEDOR</TableHead>
                      <TableHead>SUCURSAL</TableHead>
                      <TableHead>N° COMPROBANTE</TableHead>
                      <TableHead>FISCAL</TableHead>
                      <TableHead className="text-right">TOTAL</TableHead>
                      <TableHead className="text-right">SALDO</TableHead>
                      <TableHead className="tabla-bloque-secundario-head-divider">
                        ACCIONES
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {showingEmpty ? (
                      <EmptyTableRow
                        colSpan={COL_WIDTHS_PCT.length}
                        message={errorMsg ?? "No se encontraron compras recepcionadas."}
                      />
                    ) : (
                      items.map((it) => {
                        const conSaldo = it.saldo > 0;
                        return (
                          <TableRow key={it.id}>
                            <TableCell className="celda-datos tabular-nums">
                              {fmtFechaIso(it.fechaIso)}
                            </TableCell>
                            <TableCell
                              className="celda-datos min-w-0 truncate"
                              title={it.proveedorNombre}
                            >
                              {it.proveedorNombre}
                            </TableCell>
                            <TableCell
                              className="celda-datos min-w-0 truncate"
                              title={it.sucursalNombre}
                            >
                              {it.sucursalNombre}
                            </TableCell>
                            <TableCell
                              className="celda-datos min-w-0 truncate tabular-nums"
                              title={
                                it.notasCredito > 0
                                  ? `${it.numero} · ${it.notasCredito} NC`
                                  : it.numero
                              }
                            >
                              {it.numero}
                            </TableCell>
                            <TableCell className="celda-datos">{it.fiscal ? "SI" : "NO"}</TableCell>
                            <TableCell className="celda-datos text-right tabular-nums">
                              {fmtPesos(it.total)}
                            </TableCell>
                            <TableCell className="celda-datos text-right tabular-nums">
                              {fmtPesos(it.saldo)}
                            </TableCell>
                            <TableCell className="celda-datos celda-datos--accion-relleno-fila tabla-bloque-secundario-cell-divider">
                              <div className={cn(TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS, "gap-2")}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      disabled={!it.pedidoHistoriaId}
                                      onClick={() => setVerPedidoId(it.pedidoHistoriaId)}
                                      aria-label="Ver Compra"
                                      className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                    >
                                      <Eye className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">Ver Compra</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        disabled={!conSaldo || !it.pedidoHistoriaId}
                                        onClick={() => setNotaCreditoPedidoId(it.pedidoHistoriaId)}
                                        aria-label="Nota de Crédito"
                                        className={cn(
                                          TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
                                          "disabled:cursor-not-allowed"
                                        )}
                                      >
                                        <Undo2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    {conSaldo ? "Nota de Crédito" : "Nota de Crédito (sin saldo)"}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
        {!showingEmpty && totalPaginas > 1 ? (
          <div className="flex justify-end pt-2 shrink-0">
            <PaginacionTabla
              basePath={GP_ROUTES.pedidoMercaderia.compras}
              params={{ proveedor: proveedorId, sucursal: sucursalCodigo, q }}
              paginaActual={paginaNum}
              totalPaginas={totalPaginas}
              total={total}
              pageSize={PAGE_SIZE}
            />
          </div>
        ) : null}
        <PedidoHistoriaDetalleModal
          variante="nota-credito"
          open={notaCreditoPedidoId != null}
          onOpenChange={(v) => {
            if (!v) {
              setNotaCreditoPedidoId(null);
              router.refresh();
            }
          }}
          pedidoHistoriaId={notaCreditoPedidoId}
        />
        <PedidoHistoriaLecturaModal
          variante="compra"
          open={verPedidoId != null}
          onOpenChange={(v) => {
            if (!v) setVerPedidoId(null);
          }}
          pedidoHistoriaId={verPedidoId}
        />
      </div>
    </ClassicFilteredTableLayout>
  );
}
