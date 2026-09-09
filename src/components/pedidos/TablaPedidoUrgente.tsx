"use client";

import type { IvaProveedor } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import { Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import TablaSubencabezadoSeccionRow from "@/components/shared/TablaSubencabezadoSeccionRow";
import { cn } from "@/lib/utils";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";

const WRAPPER_CESTO_URGENTE =
  "flex h-full min-h-0 max-h-full w-full items-center justify-center overflow-hidden p-0";

export interface ProductoPedidoUrgente {
  id: string;
  /** Código externo lista-precios proveedor. */
  codExt: string;
  /** Prefijo proveedor en fila 1:1; vacío en fila agrupada por tienda (payload); con varios miembros Dux la columna PROVEEDOR muestra solo el número de miembros. */
  prefijo: string;
  descripcion: string;
  /** `px_compra_final_sin_iva` desde prod_precios_provee (null si no está disponible). */
  pxCompraFinalSinIva: number | null;
  /** Política IVA del proveedor; solo en filas 1:1 o en cada miembro del grupo. */
  ivaProveedor?: IvaProveedor;
  /** Cantidad pedida (URGENTE) desde `prod_ped_merc.urgente_cant_pedir`. */
  cantPedidaUrgente: number;
  /** true si hay regla REPOSICIÓN en `prod_ped_merc` para el `cod_tienda` del ítem. */
  confReposicion: boolean;
  /** Misma cantidad que **CANT. A PEDIR** en Pedido Reposición (regla forma/punto/stock/stockeable). */
  cantReposicion: number;
  /**
   * `true` si hay `prod_tienda` de Dux (FK `cod_tienda`, CX PROD o match de descripción).
   * La tabla muestra primero **Productos Registrados en Dux** y luego **Sin Registrar**.
   */
  estaVinculadoTienda: boolean;
  /** Mismo vínculo tienda (`cod_tienda`): varios proveedores en una fila; cantidades por `codExt` de cada miembro. */
  miembrosAgrupacion?: Array<{
    codExt: string;
    prefijo: string;
    pxCompraFinalSinIva: number | null;
    ivaProveedor: IvaProveedor;
    cantPedidaUrgente: number;
    estaVinculadoTienda: boolean;
  }>;
}

export type PedidoFilterValor = "urgente" | "reposicion" | "";

const COLUMNS = 7;
const MENSAJE_SIN_RESULTADOS = "No se encontraron productos.";
/** PROVEEDOR, DESCRIPCIÓN, bloque pedido (CANT. PED., PROV. PED., cesto), bloque reposición (CONF., CANT.). */
const COL_WIDTHS_PCT = [10, 60, 6, 6, 6, 6, 6] as const;
const CELL_MIN = "min-w-0";
const TEXTO_SUBENCABEZADO_REGISTRADOS_DUX = "Productos Registrados en Dux";
const TEXTO_SUBENCABEZADO_SIN_REGISTRAR_DUX = "Productos Sin Registrar en Dux";

function cantPedidaUrgenteMostrada(prod: ProductoPedidoUrgente, cantPorId: Record<string, string>): string {
  if (prod.miembrosAgrupacion && prod.miembrosAgrupacion.length > 0) {
    const sum = prod.miembrosAgrupacion.reduce(
      (s, m) => s + Math.max(0, Math.floor(Number(cantPorId[m.codExt] || 0) || 0)),
      0
    );
    return sum > 0 ? String(sum) : "";
  }
  const v = cantPorId[prod.id];
  return v && Number(v) > 0 ? v : "";
}

function hayCantidadPedidaUrgente(prod: ProductoPedidoUrgente, cantPorId: Record<string, string>): boolean {
  if (prod.miembrosAgrupacion && prod.miembrosAgrupacion.length > 0) {
    return prod.miembrosAgrupacion.some((m) => Number(cantPorId[m.codExt] || 0) > 0);
  }
  return Number(cantPorId[prod.id] || 0) > 0;
}

/** Prefijos de proveedor con cantidad pedida > 0 (`cantPorId` por `cod_ext` de lista precios). */
function textoProvPedidaUrgente(prod: ProductoPedidoUrgente, cantPorId: Record<string, string>): string {
  if (!hayCantidadPedidaUrgente(prod, cantPorId)) return "";
  if (prod.miembrosAgrupacion && prod.miembrosAgrupacion.length > 0) {
    const prefs = prod.miembrosAgrupacion
      .filter((m) => Number(cantPorId[m.codExt] || 0) > 0)
      .map((m) => (m.prefijo ?? "").trim())
      .filter(Boolean);
    return prefs.join(" · ");
  }
  return (prod.prefijo ?? "").trim();
}

/** Columna PROVEEDOR: en Dux, un solo vínculo lista prefijo; varios solo el número (ej. "2", "3"). */
function textoProveedorCeldaPedidoUrgente(prod: ProductoPedidoUrgente): string {
  const miembros = prod.miembrosAgrupacion;
  const nMiembros = miembros?.length ?? 0;

  if (prod.estaVinculadoTienda) {
    if (nMiembros > 1) {
      return String(nMiembros);
    }
    return (prod.prefijo ?? "").trim();
  }

  if (nMiembros > 1) return "";
  return (prod.prefijo ?? "").trim();
}


function FilaDatosPedidoUrgente({
  prod,
  cantPorId,
  onRowDoubleClick,
  onRowDeleteClick,
}: {
  prod: ProductoPedidoUrgente;
  cantPorId: Record<string, string>;
  onRowDoubleClick?: (producto: ProductoPedidoUrgente) => void;
  onRowDeleteClick?: (producto: ProductoPedidoUrgente) => void;
}) {
  const textoProveedor = textoProveedorCeldaPedidoUrgente(prod);
  const textoProvPedida = textoProvPedidaUrgente(prod, cantPorId);

  return (
    <TableRow
      className="cursor-pointer"
      title={
        prod.miembrosAgrupacion && prod.miembrosAgrupacion.length > 1
          ? prod.miembrosAgrupacion.map((m) => m.prefijo).filter(Boolean).join(" · ")
          : undefined
      }
      onDoubleClick={() => onRowDoubleClick?.(prod)}
    >
      <TableCell className="celda-datos min-w-0 truncate text-center tabular-nums">{textoProveedor}</TableCell>
      <TableCell className="celda-datos min-w-0 truncate" title={prod.descripcion}>
        {prod.descripcion}
      </TableCell>
      <TableCell className="celda-datos text-center tabular-nums tabla-bloque-secundario-cell-divider">
        {cantPedidaUrgenteMostrada(prod, cantPorId)}
      </TableCell>
      <TableCell
        className={cn(
          "celda-datos min-w-0 truncate text-center tabla-bloque-secundario-cell",
          textoProvPedida && "font-medium"
        )}
        title={textoProvPedida || undefined}
      >
        {textoProvPedida}
      </TableCell>
      <TableCell
        className={cn(
          "celda-datos text-center celda-datos--accion-relleno-fila tabla-bloque-secundario-cell",
          CELL_MIN
        )}
      >
        {hayCantidadPedidaUrgente(prod, cantPorId) ? (
          <div className={WRAPPER_CESTO_URGENTE}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
                "!size-7 min-h-0 max-h-7 shrink-0 !p-0 [&_svg]:size-3.5",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onRowDeleteClick?.(prod);
              }}
              aria-label="Eliminar cantidad pedida"
            >
              <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
            </Button>
          </div>
        ) : (
          ""
        )}
      </TableCell>
      <TableCell className="celda-datos text-center tabla-bloque-secundario-cell-divider">
        {prod.confReposicion ? (
          <Check
            className="h-4 w-4 mx-auto text-primary"
            aria-label="Configurado en reposición"
          />
        ) : (
          ""
        )}
      </TableCell>
      <TableCell className="celda-datos text-center tabla-bloque-secundario-cell tabular-nums">
        {prod.confReposicion ? prod.cantReposicion : ""}
      </TableCell>
    </TableRow>
  );
}

interface Props {
  productos: ProductoPedidoUrgente[];
  sinFiltros?: boolean;
  mensajeSinSucursal?: string;
  /** Cantidades mostradas (controlado desde PedidoUrgentePageClient). */
  cantPorId: Record<string, string>;
  /** Callback al hacer doble click en una fila para abrir el modal de edición de cantidad. */
  onRowDoubleClick?: (producto: ProductoPedidoUrgente) => void;
  onRowDeleteClick?: (producto: ProductoPedidoUrgente) => void;
}

export default function TablaPedidoUrgente({
  productos,
  sinFiltros = false,
  mensajeSinSucursal = "Seleccioná una sucursal para ver los productos.",
  cantPorId,
  onRowDoubleClick,
  onRowDeleteClick,
}: Props) {

  const visibleProductos = productos;
  const productosRegistradosDux = visibleProductos.filter((p) => p.estaVinculadoTienda);
  const productosSinRegistrarDux = visibleProductos.filter((p) => !p.estaVinculadoTienda);

  const mensajeVacio = sinFiltros ? mensajeSinSucursal : MENSAJE_SIN_RESULTADOS;

  return (
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
          <TableHead className={cn(CELL_MIN, "text-center")}>PROVEEDOR</TableHead>
          <TableHead className={CELL_MIN}>DESCRIPCIÓN</TableHead>
          <TableHead className={cn(CELL_MIN, "text-center tabla-bloque-secundario-head-divider")}>
            CANT. PED.
          </TableHead>
          <TableHead className={cn(CELL_MIN, "text-center tabla-bloque-secundario-head")}>
            PROV. PED.
          </TableHead>
          <TableHead
            className={cn(CELL_MIN, "text-center tabla-bloque-secundario-head")}
            aria-label="Eliminar cantidad pedida"
          >
            <div className="flex items-center justify-center w-full">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </div>
          </TableHead>
          <TableHead
            className={cn(CELL_MIN, "text-center tabla-bloque-secundario-head-divider")}
          >
            CONF. REPO.
          </TableHead>
          <TableHead className={cn(CELL_MIN, "text-center tabla-bloque-secundario-head")}>
            CANT. REPO.
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visibleProductos.length === 0 ? (
          <EmptyTableRow colSpan={COLUMNS} message={mensajeVacio} />
        ) : (
          <>
            {productosRegistradosDux.length > 0 ? (
              <>
                <TablaSubencabezadoSeccionRow
                  key="subheader-dux-registrados"
                  titulo={TEXTO_SUBENCABEZADO_REGISTRADOS_DUX}
                  colSpan={COLUMNS}
                />
                {productosRegistradosDux.map((prod) => (
                  <FilaDatosPedidoUrgente
                    key={prod.id}
                    prod={prod}
                    cantPorId={cantPorId}
                    onRowDoubleClick={onRowDoubleClick}
                    onRowDeleteClick={onRowDeleteClick}
                  />
                ))}
              </>
            ) : null}
            {productosSinRegistrarDux.length > 0 ? (
              <>
                <TablaSubencabezadoSeccionRow
                  key="subheader-dux-sin-registrar"
                  titulo={TEXTO_SUBENCABEZADO_SIN_REGISTRAR_DUX}
                  colSpan={COLUMNS}
                />
                {productosSinRegistrarDux.map((prod) => (
                  <FilaDatosPedidoUrgente
                    key={prod.id}
                    prod={prod}
                    cantPorId={cantPorId}
                    onRowDoubleClick={onRowDoubleClick}
                    onRowDeleteClick={onRowDeleteClick}
                  />
                ))}
              </>
            ) : null}
          </>
        )}
      </TableBody>
    </Table>
  );
}
