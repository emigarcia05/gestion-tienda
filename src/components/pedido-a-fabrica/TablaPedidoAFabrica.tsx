"use client";

import { useMemo, useState } from "react";
import { Check, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PaginacionClient from "@/components/shared/PaginacionClient";
import EnteroStepperInput from "@/components/shared/EnteroStepperInput";
import DetalleSucursalesPedidoAFabricaModal, {
  type DetalleSucursalesPedidoAFabricaVariante,
} from "@/components/pedido-a-fabrica/DetalleSucursalesPedidoAFabricaModal";
import { cn } from "@/lib/utils";
import { fmtCantidad, fmtNumero } from "@/lib/format";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import {
  calcularDiasProvisionHastaLlegadaPedidoAFabrica,
  calcularStockAFechaLlegadaPedidoAFabrica,
  esStockQuebradoPedidoAFabrica,
  redondearPromVtaUnDecimal,
  resolverCantSugeridaPedidoAFabrica,
  sucursalPedidoAFabricaTieneDeposito,
  cantPedidaPedidoAFabricaEsPositiva,
} from "@/lib/pedidoAFabricaPromVta";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REPOSICION_FORMA_PEDIDO_FABRICA_LABELS,
  REPOSICION_FORMA_PEDIDO_FABRICA_VALUES,
  reposicionFormaPedidoFabricaSchema,
  type ReposicionFormaPedidoFabrica,
} from "@/lib/validations/reposicion";
import type {
  DatosSucursalProductoPedidoAFabrica,
  ProductoPedidoAFabricaItem,
  SucursalPedidoAFabrica,
} from "@/services/pedidoAFabrica.service";

export type FiltroSiNoPedidoAFabrica = "" | "si" | "no";

interface Props {
  sucursales: SucursalPedidoAFabrica[];
  productos: ProductoPedidoAFabricaItem[];
  pagina: number;
  totalPaginas: number;
  onPaginaChange: (pagina: number) => void;
  loading?: boolean;
  emptyMessage: string;
  /** Días de entrega del proveedor seleccionado (`tiempo_entrega_en_dias`). */
  tiempoEntregaEnDias: number | null;
  /** `YYYY-MM-DD` (vacío/inválido → hoy AR para cálculo de provisión). */
  fechaPedidoIso: string;
  /** Días **calendario** del filtro **TIEMPO STOCKEO** (null si vacío). */
  tiempoStockeo: number | null;
  /** Filtro **PROD. VINCULADO** (`cod_tienda` en lista proveedor). */
  filtroProdVinculado: FiltroSiNoPedidoAFabrica;
  /** Filtro **STOCK QUEBRADO** (stock hasta llegada ≤ 0). */
  filtroStockQuebrado: FiltroSiNoPedidoAFabrica;
  /** Filtro **PEDIDO** (CANT. PED. > 0). */
  filtroPedido: FiltroSiNoPedidoAFabrica;
  /** Cant. a pedir por `codExt` (texto; solo dígitos). */
  cantAPedirByCodExt: Record<string, string>;
  formaPedirByCodExt: Record<string, ReposicionFormaPedidoFabrica>;
  onCantAPedirChange: (codExt: string, value: string) => void;
  onCantAPedirCommit: (codExt: string, value: string) => void;
  onFormaPedirChange: (codExt: string, forma: ReposicionFormaPedidoFabrica) => void;
  onAplicarCantSugerida: (codExt: string, cantSugerida: number) => void;
}

const TD_NUM = "celda-datos celda-numero tabular-nums text-center";

/** Anchos fijos (suma 100 %). STOCK | COMPRA: FORMA | BULTO | CANT. PEDIR | CANT. SUGERIDA. */
const PCT_DESC = 44;
const PCT_STOCK = 12;
const PCT_FORMA = 9;
const PCT_BULTO = 6;
const PCT_CANT_PEDIR = 19;
const PCT_CANT_SUGERIDA = 7;
const PCT_INFO = 3;

const COL_COUNT = 7;

/** Suma STOCK de sucursales `genera_est` (cada una es depósito) y PROM. VTA. */
export function totalPorSucursalesPedidoAFabrica(
  producto: ProductoPedidoAFabricaItem,
  sucursales: SucursalPedidoAFabrica[]
): DatosSucursalProductoPedidoAFabrica {
  if (!producto.codTienda || sucursales.length === 0) {
    return { stockActual: null, promVta: null };
  }
  let stock = 0;
  let tieneStock = false;
  let prom = 0;
  let tieneProm = false;
  for (const s of sucursales) {
    const d = producto.porSucursal[s.id];
    if (sucursalPedidoAFabricaTieneDeposito(s)) {
      stock += d?.stockActual ?? 0;
      tieneStock = true;
    }
    if (d?.promVta != null && !Number.isNaN(d.promVta)) {
      prom += d.promVta;
      tieneProm = true;
    }
  }
  return {
    stockActual: tieneStock ? stock : null,
    promVta: tieneProm ? redondearPromVtaUnDecimal(prom) : null,
  };
}

function productoPasaFiltrosDerivados(
  producto: ProductoPedidoAFabricaItem,
  sucursales: SucursalPedidoAFabrica[],
  fechaPedidoIso: string,
  tiempoEntregaEnDias: number | null,
  filtroProdVinculado: FiltroSiNoPedidoAFabrica,
  filtroStockQuebrado: FiltroSiNoPedidoAFabrica,
  filtroPedido: FiltroSiNoPedidoAFabrica,
  cantAPedirByCodExt: Record<string, string>
): boolean {
  if (!filtroProdVinculado && !filtroStockQuebrado && !filtroPedido) return true;

  const vinculado = producto.codTienda != null;
  if (filtroProdVinculado === "si" && !vinculado) return false;
  if (filtroProdVinculado === "no" && vinculado) return false;

  const tienePedido = cantPedidaPedidoAFabricaEsPositiva(
    cantAPedirByCodExt[producto.codExt]
  );
  if (filtroPedido === "si" && !tienePedido) return false;
  if (filtroPedido === "no" && tienePedido) return false;

  if (!filtroStockQuebrado) return true;
  const total = totalPorSucursalesPedidoAFabrica(producto, sucursales);
  const diasProvisionHastaLlegada = calcularDiasProvisionHastaLlegadaPedidoAFabrica(
    fechaPedidoIso,
    tiempoEntregaEnDias
  );
  const stockHastaLlegada = calcularStockAFechaLlegadaPedidoAFabrica(
    total.stockActual,
    total.promVta,
    diasProvisionHastaLlegada
  );
  const quebrado = esStockQuebradoPedidoAFabrica(
    stockHastaLlegada,
    total.stockActual
  );
  if (filtroStockQuebrado === "si" && !quebrado) return false;
  if (filtroStockQuebrado === "no" && quebrado) return false;
  return true;
}

/**
 * Grilla Pedido A Fáb.
 * **DESCRIPCIÓN** · **STOCK** (unidades + Info por depósito)
 * · **COMPRA** (FORMA / BULTO / CANT. PEDIR / CANT. SUGERIDA UNIDAD techo / BULTO múltiplo)
 * · Info PROM. VTA. (`genera_est`).
 */
export default function TablaPedidoAFabrica({
  sucursales,
  productos,
  pagina,
  totalPaginas,
  onPaginaChange,
  loading = false,
  emptyMessage,
  fechaPedidoIso,
  tiempoEntregaEnDias,
  tiempoStockeo,
  filtroProdVinculado,
  filtroStockQuebrado,
  filtroPedido,
  cantAPedirByCodExt,
  formaPedirByCodExt,
  onCantAPedirChange,
  onCantAPedirCommit,
  onFormaPedirChange,
  onAplicarCantSugerida,
}: Props) {
  const [detalle, setDetalle] = useState<{
    producto: ProductoPedidoAFabricaItem;
    variante: DetalleSucursalesPedidoAFabricaVariante;
  } | null>(null);

  const productosFiltrados = useMemo(
    () =>
      productos.filter((p) =>
        productoPasaFiltrosDerivados(
          p,
          sucursales,
          fechaPedidoIso,
          tiempoEntregaEnDias,
          filtroProdVinculado,
          filtroStockQuebrado,
          filtroPedido,
          cantAPedirByCodExt
        )
      ),
    [
      productos,
      sucursales,
      fechaPedidoIso,
      tiempoEntregaEnDias,
      filtroProdVinculado,
      filtroStockQuebrado,
      filtroPedido,
      cantAPedirByCodExt,
    ]
  );

  const hayFiltrosDerivados =
    filtroProdVinculado !== "" ||
    filtroStockQuebrado !== "" ||
    filtroPedido !== "";
  const etiquetasFiltrosDerivados = [
    filtroProdVinculado !== "" ? "PROD. VINCULADO" : null,
    filtroStockQuebrado !== "" ? "STOCK QUEBRADO" : null,
    filtroPedido !== "" ? "PEDIDO" : null,
  ].filter((v): v is string => v != null);
  const mensajeVacio =
    productos.length > 0 &&
    productosFiltrados.length === 0 &&
    hayFiltrosDerivados
      ? `Ningún producto coincide con ${etiquetasFiltrosDerivados.join(" / ")}.`
      : emptyMessage;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0.5">
      <div className="contenedor-tabla-gestion no-scroll-x flex-1 min-h-0">
        <Table variant="compact" scrollX={false}>
          <colgroup>
            <col style={{ width: `${PCT_DESC}%` }} />
            <col style={{ width: `${PCT_STOCK}%` }} />
            <col style={{ width: `${PCT_FORMA}%` }} />
            <col style={{ width: `${PCT_BULTO}%` }} />
            <col style={{ width: `${PCT_CANT_PEDIR}%` }} />
            <col style={{ width: `${PCT_CANT_SUGERIDA}%` }} />
            <col style={{ width: `${PCT_INFO}%` }} />
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead rowSpan={2} className="min-w-0 align-middle">
                DESCRIPCIÓN
              </TableHead>
              <TableHead
                rowSpan={2}
                className="text-center align-middle tabla-bloque-secundario-head-divider"
              >
                STOCK
              </TableHead>
              <TableHead
                colSpan={4}
                className="text-center align-middle tabla-bloque-secundario-head-divider"
              >
                COMPRA
              </TableHead>
              <TableHead
                rowSpan={2}
                className="text-center align-middle tabla-bloque-secundario-head-divider"
                aria-label="Promedio de venta por sucursal"
              >
                <div className="flex w-full items-center justify-center">
                  <Info className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                </div>
              </TableHead>
            </TableRow>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-center tabla-bloque-secundario-head-divider">
                FORMA
              </TableHead>
              <TableHead className="text-center tabla-bloque-secundario-head">
                BULTO
              </TableHead>
              <TableHead className="text-center whitespace-nowrap tabla-bloque-secundario-head">
                CANT. PED.
              </TableHead>
              <TableHead className="text-center whitespace-nowrap tabla-bloque-secundario-head">
                CANT. SUG.
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={COL_COUNT}
                  className="celda-datos text-center text-muted-foreground"
                >
                  Cargando productos…
                </TableCell>
              </TableRow>
            ) : productosFiltrados.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={COL_COUNT}
                  className="celda-datos text-center text-muted-foreground"
                >
                  {mensajeVacio}
                </TableCell>
              </TableRow>
            ) : (
              productosFiltrados.map((p) => {
                const total = totalPorSucursalesPedidoAFabrica(p, sucursales);
                const stockUnidades = total.stockActual;
                const promVtaTotal = total.promVta;
                const formaPedir =
                  formaPedirByCodExt[p.codExt] ?? "UNIDADES_FIJAS";
                const cantSugerida = resolverCantSugeridaPedidoAFabrica(
                  {
                    stockActual: stockUnidades ?? 0,
                    promVtaTotal: promVtaTotal ?? 0,
                    tiempoEntregaEnDias,
                    tiempoStockeo,
                  },
                  formaPedir,
                  p.bulto
                );
                const cantAPedirRaw = cantAPedirByCodExt[p.codExt] ?? "";

                return (
                  <TableRow key={p.codExt}>
                    <TableCell className="celda-datos min-w-0">
                      <span
                        className="block min-w-0 flex-1 truncate"
                        title={p.descripcion}
                      >
                        {p.descripcion}
                      </span>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "celda-datos",
                        "tabla-bloque-secundario-cell-divider"
                      )}
                    >
                      <div
                        className={cn(
                          TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
                          "flex-nowrap justify-center gap-3"
                        )}
                      >
                        <span className="inline-block min-w-[2.75rem] text-right tabular-nums">
                          {fmtCantidad(stockUnidades)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setDetalle({ producto: p, variante: "stock" })
                          }
                          className={cn(
                            TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
                            "shrink-0"
                          )}
                          aria-label={`Ver stock por depósito: ${p.descripcion}`}
                        >
                          <Info
                            className={TABLE_ROW_ACTION_ICON_CLASS}
                            aria-hidden
                          />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="celda-datos tabla-bloque-secundario-cell-divider">
                      <Select
                        value={formaPedir}
                        onValueChange={(v) => {
                          const parsed =
                            reposicionFormaPedidoFabricaSchema.safeParse(v);
                          if (parsed.success) {
                            onFormaPedirChange(p.codExt, parsed.data);
                          }
                        }}
                      >
                        <SelectTrigger
                          className={cn(
                            SELECT_TRIGGER_FILTER_CLASS,
                            "h-[calc(var(--tabla-body-row-min-height)-0.5rem)] min-h-0 w-full min-w-0 px-1 text-xs"
                          )}
                          aria-label={`Forma pedir ${p.descripcion}`}
                        >
                          <SelectValue placeholder="FORMA" />
                        </SelectTrigger>
                        <SelectContent
                          className="select-content-filtro"
                          position="popper"
                          side="bottom"
                          align="start"
                        >
                          {REPOSICION_FORMA_PEDIDO_FABRICA_VALUES.map((val) => (
                            <SelectItem key={val} value={val}>
                              {REPOSICION_FORMA_PEDIDO_FABRICA_LABELS[val]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className={cn(TD_NUM, "tabla-bloque-secundario-cell")}>
                      {p.codTienda ? fmtNumero(p.bulto) : ""}
                    </TableCell>
                    <TableCell className="celda-datos tabla-bloque-secundario-cell">
                      <EnteroStepperInput
                        value={cantAPedirRaw}
                        onChange={(v) => onCantAPedirChange(p.codExt, v)}
                        onCommit={(v) => onCantAPedirCommit(p.codExt, v)}
                        min={1}
                        allowEmpty
                        ariaLabel={`Cantidad a pedir ${p.descripcion}`}
                        endAction={
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={cantSugerida == null}
                              onClick={() => {
                                if (cantSugerida == null) return;
                                onAplicarCantSugerida(p.codExt, cantSugerida);
                              }}
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              aria-label={`Confirmar cantidad sugerida: ${p.descripcion}`}
                            >
                              <Check
                                className={TABLE_ROW_ACTION_ICON_CLASS}
                                aria-hidden
                              />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={cantAPedirRaw === ""}
                              onClick={() => onCantAPedirCommit(p.codExt, "")}
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              aria-label={`Vaciar cantidad a pedir: ${p.descripcion}`}
                            >
                              <Trash2
                                className={TABLE_ROW_ACTION_ICON_CLASS}
                                aria-hidden
                              />
                            </Button>
                          </>
                        }
                      />
                    </TableCell>
                    <TableCell
                      className={cn(
                        TD_NUM,
                        "tabla-bloque-secundario-cell"
                      )}
                    >
                      {cantSugerida != null ? fmtNumero(cantSugerida) : ""}
                    </TableCell>
                    <TableCell className="celda-datos celda-datos--accion-relleno-fila text-center tabla-bloque-secundario-cell">
                      <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setDetalle({ producto: p, variante: "promedio" })
                          }
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          aria-label={`Ver promedio de venta por sucursal: ${p.descripcion}`}
                        >
                          <Info
                            className={TABLE_ROW_ACTION_ICON_CLASS}
                            aria-hidden
                          />
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
      <PaginacionClient
        paginaActual={pagina}
        totalPaginas={totalPaginas}
        onPaginaChange={onPaginaChange}
      />

      <DetalleSucursalesPedidoAFabricaModal
        open={detalle != null}
        onOpenChange={(next) => {
          if (!next) setDetalle(null);
        }}
        producto={detalle?.producto ?? null}
        sucursales={sucursales}
        variante={detalle?.variante ?? "promedio"}
      />
    </div>
  );
}
