"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ItemTransfDepositos,
  SucursalTransf as Sucursal,
  TransfDepositosData,
} from "@/lib/transfDepositosTypes";
import {
  TableEmptyState,
  tableEmptyStateContainerVariants,
  tableEmptyStateMessageVariants,
} from "@/components/shared/TableEmptyState";
import { cn } from "@/lib/utils";
import {
  ICON_WARNING_INTERACTIVE_CLASS,
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import {
  esBorradorCantidadUnDecimal,
  fmtCantidad,
  formatCantidadInputValor,
  parseCantidadUnDecimal,
  redondearCantidadUnDecimal,
} from "@/lib/cantidadUnDecimal";
import { formatDdMmHhMmArgentina } from "@/lib/fechaArgentina";
import {
  type BorradorTransfDepositos,
  SUCURSAL_LABEL_TRANSF,
  TRANSF_DEPOSITOS_VENTANA_DUPLICADO_DIAS,
  borrarBorradorTransfDepositos,
  borradorDesdeLoteAbiertoTransfDepositos,
  claveStorageBorradorTransfDepositos,
  guardarBorradorTransfDepositos,
  leerBorradorTransfDepositos,
} from "@/lib/transfDepositosControl";

/** DESCRIPCIÓN · CANT. (− input +) · SUC. ORIGEN · SUC. DESTINO · ACCIONES. */
const PCT_DESC = 42;
const PCT_CANT = 18;
const PCT_SUC = 15;
const PCT_ACCIONES = 10;

function CeldaStockTransf({
  actual,
  delta,
}: {
  actual: number | null;
  /** Negativo en origen, positivo en destino; `null` = sin cantidad. */
  delta: number | null;
}) {
  if (actual == null) return "";
  const textoActual = fmtCantidad(actual);
  if (delta == null) return textoActual;
  const luego = redondearCantidadUnDecimal(actual + delta);
  return (
    <span className="tabular-nums">
      {textoActual}
      <span className="text-muted-foreground"> → </span>
      <span className={cn(luego < 0 && "text-destructive")}>
        {fmtCantidad(luego)}
      </span>
    </span>
  );
}

interface Props {
  data: TransfDepositosData;
  origen: Sucursal | null;
  destino: Sucursal | null;
}

export type ItemCantidadTransfTabla = {
  codTienda: string;
  cantidad: number;
};

export type TablaTransfDepositosHandle = {
  getItemsConCantidad: () => ItemCantidadTransfTabla[];
  clearCantidades: () => void;
};

/**
 * Grilla **Trans. Depósitos**:
 * DESCRIPCIÓN · CANT. (−/+) · SUC. ORIGEN · SUC. DESTINO · ACCIONES
 * (Trash2, AlertTriangle). Con cantidad: stock `actual → luego`.
 * Cantidades se conservan al paginar y en `localStorage` por par origen→destino
 * hasta **Generar Transferencia** (crea `stock_transferencias` EMITIDO_PENDIENTE).
 * `data.loteAbierto` (hoy siempre vacío) hidrata si el borrador local está vacío.
 */
const TablaTransfDepositos = forwardRef<TablaTransfDepositosHandle, Props>(
  function TablaTransfDepositos({ data, origen, destino }, ref) {
  const [borrador, setBorrador] = useState<BorradorTransfDepositos>({});

  useImperativeHandle(
    ref,
    () => ({
      getItemsConCantidad: () =>
        Object.entries(borrador)
          .map(([codTienda, item]) => ({
            codTienda,
            cantidad: parseCantidadUnDecimal(item.cantidad),
          }))
          .filter(
            (item): item is ItemCantidadTransfTabla =>
              item.cantidad != null && item.cantidad > 0
          ),
      clearCantidades: () => {
        borrarBorradorTransfDepositos(origen, destino);
        setBorrador({});
      },
    }),
    [borrador, origen, destino]
  );

  useEffect(() => {
    queueMicrotask(() => {
      const local = leerBorradorTransfDepositos(origen, destino);
      if (Object.keys(local).length > 0) {
        setBorrador(local);
        return;
      }
      const desdeLoteAbierto = borradorDesdeLoteAbiertoTransfDepositos(
        data.loteAbierto.map((p) => ({
          codTienda: p.codTienda,
          cantidad: p.cantidad,
          descripcion: p.descripcionTienda,
        }))
      );
      setBorrador(desdeLoteAbierto);
      if (Object.keys(desdeLoteAbierto).length > 0) {
        guardarBorradorTransfDepositos(origen, destino, desdeLoteAbierto);
      }
    });
  }, [origen, destino, data.loteAbierto]);

  useEffect(() => {
    if (!origen || !destino || origen === destino) return;
    const clave = claveStorageBorradorTransfDepositos(origen, destino);
    function onStorage(e: StorageEvent) {
      if (e.key !== clave) return;
      queueMicrotask(() => {
        setBorrador(leerBorradorTransfDepositos(origen, destino));
      });
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [origen, destino]);

  const origenSeleccionado = origen !== null;
  const destinoSeleccionado = destino !== null;
  const origenLabel = origen ? SUCURSAL_LABEL_TRANSF[origen] : "—";

  const controlesPorClave = useMemo(() => {
    const map = new Map<string, { cantidad: number; createdAtIso: string }>();
    for (const c of data.controlesRecientes) {
      const key = `${c.codTienda}|${c.cantidad}`;
      if (!map.has(key)) {
        map.set(key, { cantidad: c.cantidad, createdAtIso: c.createdAtIso });
      }
    }
    return map;
  }, [data.controlesRecientes]);

  const idsEnPagina = useMemo(
    () => new Set(data.items.map((item) => item.id)),
    [data.items]
  );

  const filas = useMemo(() => {
    const extras: ItemTransfDepositos[] = Object.entries(borrador)
      .filter(([id, item]) => {
        if (idsEnPagina.has(id)) return false;
        const n = parseCantidadUnDecimal(item.cantidad);
        return n != null && n > 0;
      })
      .map(([id, item]) => ({
        id,
        codItem: id,
        descripcion: item.descripcion.trim() || id,
        marca: null,
        rubro: null,
        stockOrigen: null,
        stockDestino: null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id, "es"));
    return [...extras, ...data.items];
  }, [borrador, data.items, idsEnPagina]);

  function handleCantidad(id: string, raw: string, descripcion: string) {
    const limpio = raw.trim();
    if (limpio !== "" && !esBorradorCantidadUnDecimal(limpio)) return;
    setBorrador((prev) => {
      const next = { ...prev };
      if (limpio === "") {
        delete next[id];
      } else {
        next[id] = {
          cantidad: limpio,
          descripcion: descripcion || prev[id]?.descripcion || "",
        };
      }
      guardarBorradorTransfDepositos(origen, destino, next);
      return next;
    });
  }

  function ajustarCantidadUnidad(
    id: string,
    descripcion: string,
    delta: -1 | 1
  ) {
    if (!destinoSeleccionado) return;
    const raw = borrador[id]?.cantidad ?? "";
    const parsed =
      raw === "" ? null : parseCantidadUnDecimal(raw, { min: 0 });
    let nextN: number | null;
    if (parsed == null) {
      nextN = delta > 0 ? 1 : null;
    } else {
      const candidato = redondearCantidadUnDecimal(parsed + delta);
      nextN = candidato <= 0 ? null : candidato;
    }
    handleCantidad(
      id,
      nextN == null ? "" : formatCantidadInputValor(nextN),
      descripcion
    );
  }

  function limpiarFila(id: string) {
    setBorrador((prev) => {
      const next = { ...prev };
      delete next[id];
      guardarBorradorTransfDepositos(origen, destino, next);
      return next;
    });
  }

  if (!origenSeleccionado) {
    return (
      <TableEmptyState
        placement="blockedPanel"
        textSize="sm"
        maxWidth="full"
        message="Seleccioná sucursal origen y destino (distintas) para transferir."
      />
    );
  }

  return (
    <Table variant="compact">
        <colgroup>
          <col style={{ width: `${PCT_DESC}%` }} />
          <col style={{ width: `${PCT_CANT}%` }} />
          <col style={{ width: `${PCT_SUC}%` }} />
          <col style={{ width: `${PCT_SUC}%` }} />
          <col style={{ width: `${PCT_ACCIONES}%` }} />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-0 align-middle">DESCRIPCIÓN</TableHead>
            <TableHead className="text-center align-middle">CANT.</TableHead>
            <TableHead className="text-center align-middle">
              {origen ? SUCURSAL_LABEL_TRANSF[origen] : "SUC. ORIGEN"}
            </TableHead>
            <TableHead className="text-center align-middle">
              {destino ? SUCURSAL_LABEL_TRANSF[destino] : "SUC. DESTINO"}
            </TableHead>
            <TableHead className="text-center align-middle">ACCIONES</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className={cn(
                  tableEmptyStateContainerVariants({
                    placement: "tableCellTall",
                    textSize: "xs",
                  })
                )}
              >
                <span
                  className={tableEmptyStateMessageVariants({
                    maxWidth: "full",
                  })}
                >
                  Sin resultados
                </span>
              </TableCell>
            </TableRow>
          )}
          {filas.map((item) => {
            const cantidad = borrador[item.id]?.cantidad ?? "";
            const tieneCantidad = cantidad !== "";
            const cantidadNum = parseCantidadUnDecimal(cantidad);
            const dup =
              cantidadNum != null
                ? controlesPorClave.get(`${item.id}|${cantidadNum}`)
                : undefined;
            const deltaOrigen =
              destinoSeleccionado && cantidadNum != null ? -cantidadNum : null;
            const deltaDestino =
              destinoSeleccionado && cantidadNum != null ? cantidadNum : null;

            return (
              <TableRow key={item.id}>
                <TableCell className="celda-datos min-w-0 overflow-hidden">
                  {item.descripcion}
                </TableCell>
                <TableCell className="celda-datos text-center">
                  <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={cantidad}
                      onChange={(e) =>
                        handleCantidad(item.id, e.target.value, item.descripcion)
                      }
                      className="h-6 w-14 shrink-0 self-center text-center text-sm font-normal tabular-nums"
                      aria-label={`Cantidad a transferir desde ${origenLabel}`}
                      disabled={!destinoSeleccionado}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                      aria-label="Disminuir cantidad"
                      disabled={!destinoSeleccionado}
                      onClick={() =>
                        ajustarCantidadUnidad(item.id, item.descripcion, -1)
                      }
                    >
                      -
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                      aria-label="Aumentar cantidad"
                      disabled={!destinoSeleccionado}
                      onClick={() =>
                        ajustarCantidadUnidad(item.id, item.descripcion, 1)
                      }
                    >
                      +
                    </Button>
                  </div>
                </TableCell>
                <TableCell
                  className={cn(
                    "celda-datos text-center tabular-nums",
                    item.stockOrigen != null &&
                      item.stockOrigen < 0 &&
                      "text-destructive"
                  )}
                >
                  <CeldaStockTransf
                    actual={item.stockOrigen}
                    delta={deltaOrigen}
                  />
                </TableCell>
                <TableCell
                  className={cn(
                    "celda-datos text-center tabular-nums",
                    item.stockDestino != null &&
                      item.stockDestino < 0 &&
                      "text-destructive"
                  )}
                >
                  <CeldaStockTransf
                    actual={item.stockDestino}
                    delta={deltaDestino}
                  />
                </TableCell>
                <TableCell className="celda-datos celda-datos--accion-relleno-fila">
                  <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                      aria-label="Limpiar cantidad"
                      title="Limpiar cantidad"
                      disabled={!tieneCantidad}
                      onClick={() => limpiarFila(item.id)}
                    >
                      <Trash2
                        className={TABLE_ROW_ACTION_ICON_CLASS}
                        aria-hidden
                      />
                    </Button>
                    <span
                      className={cn(
                        ICON_WARNING_INTERACTIVE_CLASS,
                        !dup && "invisible"
                      )}
                      title={
                        dup
                          ? `Transferencia igual en los últimos ${TRANSF_DEPOSITOS_VENTANA_DUPLICADO_DIAS} días (${formatDdMmHhMmArgentina(new Date(dup.createdAtIso))})`
                          : undefined
                      }
                      aria-hidden={!dup}
                    >
                      <AlertTriangle
                        className={TABLE_ROW_ACTION_ICON_CLASS}
                        aria-hidden
                      />
                      {dup ? (
                        <span className="sr-only">Duplicado reciente</span>
                      ) : null}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
    </Table>
  );
});

export default TablaTransfDepositos;
