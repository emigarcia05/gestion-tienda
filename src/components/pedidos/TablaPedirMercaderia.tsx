"use client";

import { PackagePlus, Trash2 } from "lucide-react";
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
import TablaSubencabezadoSeccionRow from "@/components/shared/TablaSubencabezadoSeccionRow";
import { cn } from "@/lib/utils";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { labelReposicionFormaPedidoVendedor } from "@/lib/validations/reposicion";
import type { PedidoUrgenteItem } from "@/services/listaPrecios.service";

const COLUMNS = 8;
/** PROVEEDOR, DESCRIPCIÓN, REPOSICIÓN (FORMA, PTO., CANT.), CANT. A PEDIR (CANT., FORMA), ACCIONES. */
const COL_WIDTHS_PCT = [8, 41, 8, 7, 7, 7, 12, 10] as const;
const MENSAJE_SIN_RESULTADOS = "No se encontraron productos.";
const TEXTO_SECCION_REGISTRADOS = "Productos Registrados en Tienda";
const TEXTO_SECCION_SIN_REGISTRAR = "Productos Sin Registrar en Tienda";
const TEXTO_SECCION_TINTOMETRICOS = "Tintométricos";

/** Fila `prod_ped_merc` tipo TINTOMETRICO (base + código de color). */
export interface FilaTintometricoPedir {
  id: string;
  prefijoProveedor: string;
  descripcion: string;
  cantidad: number;
}

function FilaTintometrico({
  fila,
  onBorrar,
}: {
  fila: FilaTintometricoPedir;
  onBorrar: (fila: FilaTintometricoPedir) => void;
}) {
  return (
    <TableRow>
      <TableCell className="celda-datos min-w-0 truncate text-center">{fila.prefijoProveedor}</TableCell>
      <TableCell className="celda-datos min-w-0 truncate" title={fila.descripcion}>
        {fila.descripcion}
      </TableCell>
      <TableCell className="celda-datos tabla-bloque-secundario-cell-divider" />
      <TableCell className="celda-datos tabla-bloque-secundario-cell" />
      <TableCell className="celda-datos tabla-bloque-secundario-cell" />
      <TableCell className="celda-datos text-center tabular-nums font-medium tabla-bloque-secundario-cell-divider">
        {fila.cantidad}
      </TableCell>
      <TableCell className="celda-datos min-w-0 truncate text-center tabla-bloque-secundario-cell">
        TINTOMÉTRICO
      </TableCell>
      <TableCell className="celda-datos text-center tabla-bloque-secundario-cell-divider">
        <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
            onClick={() => onBorrar(fila)}
            aria-label="Borrar tintométrico"
            title="Borrar tintométrico"
          >
            <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function cantUrgente(prod: PedidoUrgenteItem, cantPorId: Record<string, string>): number {
  const codExts =
    prod.miembrosAgrupacion && prod.miembrosAgrupacion.length > 0
      ? prod.miembrosAgrupacion.map((m) => m.codExt)
      : [prod.id];
  return codExts.reduce((s, ce) => s + Math.max(0, Math.floor(Number(cantPorId[ce] || 0) || 0)), 0);
}

function cantReposicion(prod: PedidoUrgenteItem): number {
  return prod.estaVinculadoTienda && prod.reposicionRegla ? Math.max(0, prod.cantReposicion) : 0;
}

/** Tipos de pedido con cantidad > 0 (Generar Pedido los emite como líneas separadas). */
function textoFormaPedido(urgente: number, reposicion: number): string {
  const partes: string[] = [];
  if (urgente > 0) partes.push("URGENTE");
  if (reposicion > 0) partes.push("REPOSICIÓN");
  return partes.join(" + ");
}

function FilaPedirMercaderia({
  prod,
  cantPorId,
  onAbrirCantidad,
  onBorrar,
}: {
  prod: PedidoUrgenteItem;
  cantPorId: Record<string, string>;
  onAbrirCantidad: (producto: PedidoUrgenteItem) => void;
  onBorrar: (producto: PedidoUrgenteItem) => void;
}) {
  const regla = prod.reposicionRegla;
  const urgente = cantUrgente(prod, cantPorId);
  const reposicion = cantReposicion(prod);
  const total = urgente + reposicion;
  const forma = textoFormaPedido(urgente, reposicion);
  const puedeBorrar = urgente > 0 || Boolean(prod.estaVinculadoTienda && regla);

  return (
    <TableRow>
      <TableCell className="celda-datos min-w-0 truncate text-center tabular-nums">
        {prod.estaVinculadoTienda ? "" : (prod.prefijo ?? "").trim()}
      </TableCell>
      <TableCell className="celda-datos min-w-0 truncate" title={prod.descripcion}>
        {prod.descripcion}
      </TableCell>
      <TableCell className="celda-datos min-w-0 truncate text-center tabla-bloque-secundario-cell-divider">
        {regla ? labelReposicionFormaPedidoVendedor(regla.formaPedir) : ""}
      </TableCell>
      <TableCell className="celda-datos text-center tabular-nums tabla-bloque-secundario-cell">
        {regla ? regla.puntoReposicion : ""}
      </TableCell>
      <TableCell
        className={cn(
          "celda-datos text-center tabular-nums tabla-bloque-secundario-cell",
          regla?.omitidaEnPedido && "text-xs text-muted-foreground"
        )}
        title={regla?.omitidaEnPedido ? "No se pide en este pedido" : undefined}
      >
        {regla ? (regla.omitidaEnPedido ? "NO PEDIR" : prod.cantReposicion) : ""}
      </TableCell>
      <TableCell className="celda-datos text-center tabular-nums font-medium tabla-bloque-secundario-cell-divider">
        {total > 0 ? total : ""}
      </TableCell>
      <TableCell
        className="celda-datos min-w-0 truncate text-center tabla-bloque-secundario-cell"
        title={forma || undefined}
      >
        {forma}
      </TableCell>
      <TableCell className="celda-datos text-center tabla-bloque-secundario-cell-divider">
        <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
            onClick={() => onAbrirCantidad(prod)}
            aria-label="Cant. a pedir"
            title="Cant. a pedir"
          >
            <PackagePlus className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
            onClick={() => onBorrar(prod)}
            disabled={!puedeBorrar}
            aria-label="Borrar"
            title="Borrar"
          >
            <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

interface Props {
  productos: PedidoUrgenteItem[];
  sinFiltros?: boolean;
  mensajeSinFiltros?: string;
  /** Cantidades URGENTE por `cod_ext` (estado optimista de la página). */
  cantPorId: Record<string, string>;
  onAbrirCantidad: (producto: PedidoUrgenteItem) => void;
  onBorrar: (producto: PedidoUrgenteItem) => void;
  /** Sección Tintométricos (la página no la pasa si PEDIDO es URGENTE / REPOSICIÓN / REPOSICIÓN CONF.). */
  tintometricos: FilaTintometricoPedir[];
  onBorrarTintometrico: (fila: FilaTintometricoPedir) => void;
}

export default function TablaPedirMercaderia({
  productos,
  sinFiltros = false,
  mensajeSinFiltros = "Seleccioná una sucursal para ver los productos.",
  cantPorId,
  onAbrirCantidad,
  onBorrar,
  tintometricos,
  onBorrarTintometrico,
}: Props) {
  const registrados = productos.filter((p) => p.estaVinculadoTienda);
  const sinRegistrar = productos.filter((p) => !p.estaVinculadoTienda);
  const mensajeVacio = sinFiltros ? mensajeSinFiltros : MENSAJE_SIN_RESULTADOS;

  const secciones = [
    { key: "registrados", titulo: TEXTO_SECCION_REGISTRADOS, items: registrados },
    { key: "sin-registrar", titulo: TEXTO_SECCION_SIN_REGISTRAR, items: sinRegistrar },
  ];

  return (
    <Table variant="compact" scrollX={false} className="tabla-gestion-compacta w-full table-fixed">
      <colgroup>
        {COL_WIDTHS_PCT.map((pct, i) => (
          <col key={i} style={{ width: `${pct}%` }} />
        ))}
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead rowSpan={2} className="min-w-0 text-center align-middle">
            PROVEEDOR
          </TableHead>
          <TableHead rowSpan={2} className="min-w-0 align-middle">
            DESCRIPCIÓN
          </TableHead>
          <TableHead colSpan={3} className="text-center align-middle tabla-bloque-secundario-head-divider">
            REPOSICIÓN
          </TableHead>
          <TableHead colSpan={2} className="text-center align-middle tabla-bloque-secundario-head-divider">
            CANT. A PEDIR
          </TableHead>
          <TableHead rowSpan={2} className="text-center align-middle tabla-bloque-secundario-head-divider">
            ACCIONES
          </TableHead>
        </TableRow>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-center tabla-bloque-secundario-head-divider">FORMA PEDIR</TableHead>
          <TableHead className="text-center tabla-bloque-secundario-head">PTO. REPO.</TableHead>
          <TableHead className="text-center tabla-bloque-secundario-head">CANT. A PEDIR</TableHead>
          <TableHead className="text-center tabla-bloque-secundario-head-divider">CANT. A PEDIR</TableHead>
          <TableHead className="text-center tabla-bloque-secundario-head">FORMA DE PEDIDO</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tintometricos.length > 0 ? (
          <>
            <TablaSubencabezadoSeccionRow titulo={TEXTO_SECCION_TINTOMETRICOS} colSpan={COLUMNS} />
            {tintometricos.map((t) => (
              <FilaTintometrico key={t.id} fila={t} onBorrar={onBorrarTintometrico} />
            ))}
          </>
        ) : null}
        {productos.length === 0 && tintometricos.length === 0 ? (
          <EmptyTableRow colSpan={COLUMNS} message={mensajeVacio} />
        ) : (
          secciones.map((s) =>
            s.items.length > 0 ? (
              <SeccionFilas
                key={s.key}
                titulo={s.titulo}
                items={s.items}
                cantPorId={cantPorId}
                onAbrirCantidad={onAbrirCantidad}
                onBorrar={onBorrar}
              />
            ) : null
          )
        )}
      </TableBody>
    </Table>
  );
}

function SeccionFilas({
  titulo,
  items,
  cantPorId,
  onAbrirCantidad,
  onBorrar,
}: {
  titulo: string;
  items: PedidoUrgenteItem[];
  cantPorId: Record<string, string>;
  onAbrirCantidad: (producto: PedidoUrgenteItem) => void;
  onBorrar: (producto: PedidoUrgenteItem) => void;
}) {
  return (
    <>
      <TablaSubencabezadoSeccionRow titulo={titulo} colSpan={COLUMNS} />
      {items.map((prod) => (
        <FilaPedirMercaderia
          key={prod.id}
          prod={prod}
          cantPorId={cantPorId}
          onAbrirCantidad={onAbrirCantidad}
          onBorrar={onBorrar}
        />
      ))}
    </>
  );
}
