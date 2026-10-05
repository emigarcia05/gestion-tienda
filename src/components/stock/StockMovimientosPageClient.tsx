"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import {
  listarStockMovimientosSucursalAction,
  type StockMovimientoFila,
} from "@/actions/stockMovimientos";
import FacturaComprobanteDetalleModal from "@/components/facturacion/FacturaComprobanteDetalleModal";
import FilterBar, {
  FILTER_COUNT_CLASS,
  FILTER_INLINE_ACTION_SLOT_CLASS,
  FILTER_SELECT_WRAPPER_CLASS,
  FiltroIndividualContainer,
  FilaFiltrosDesplegables,
  FilterRowSearch,
  FilterRowSelection,
  LimpiarFiltrosButton,
  SELECT_TRIGGER_FILTER_CLASS,
} from "@/components/FilterBar";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import { TableEmptyState } from "@/components/shared/TableEmptyState";
import StockComprobanteDetalleModal from "@/components/stock/StockComprobanteDetalleModal";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EmptyTableRow,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { matchByMultiTerm } from "@/lib/busqueda";
import { fmtCantidad, fmtCelda } from "@/lib/format";
import { formatDdMmHhMmArgentina } from "@/lib/fechaArgentina";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import {
  EVENTO_USUARIO_SESION,
  leerUsuarioSesion,
} from "@/lib/usuarioSesion";

const TIPOS_MOVIMIENTO = ["INGRESO", "EGRESO"] as const;

const CATEGORIAS_MOVIMIENTO = [
  "VENTA",
  "NOTA DE CRÉDITO",
  "AJUSTE STOCK",
  "TRANSF. DEPÓSITO INGRESO",
  "TRANSF. DEPÓSITO EGRESO",
  "COMPRA",
] as const;

export default function StockMovimientosPageClient() {
  const [filas, setFilas] = useState<StockMovimientoFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tieneUsuario, setTieneUsuario] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [comprobanteVtaIdVer, setComprobanteVtaIdVer] = useState<string | null>(
    null
  );
  const [stockComprobanteIdVer, setStockComprobanteIdVer] = useState<
    string | null
  >(null);

  const { q, setQ, ref, handleQChange, isDebouncing } = useFiltrosConBusqueda({
    qActual: "",
    debounceMs: 200,
    onDebouncedSearch: () => undefined,
  });

  const cargar = useCallback(async () => {
    const usuario = leerUsuarioSesion();
    if (!usuario) {
      setTieneUsuario(false);
      setFilas([]);
      setCargando(false);
      return;
    }
    setTieneUsuario(true);
    setCargando(true);
    const res = await listarStockMovimientosSucursalAction({
      sucursalCodigo: usuario.sucursalPorDefecto,
    });
    setCargando(false);
    if (!res.ok) {
      setFilas([]);
      toast.error(res.error);
      return;
    }
    setFilas(res.data);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void cargar();
    });
    function onUsuario() {
      void cargar();
    }
    window.addEventListener(EVENTO_USUARIO_SESION, onUsuario);
    return () => window.removeEventListener(EVENTO_USUARIO_SESION, onUsuario);
  }, [cargar]);

  const filasFiltradas = useMemo(
    () =>
      filas.filter((fila) => {
        if (filtroTipo && fila.tipoEtiqueta !== filtroTipo) return false;
        if (filtroCategoria && fila.categoriaEtiqueta !== filtroCategoria) {
          return false;
        }
        if (
          q.trim() &&
          !matchByMultiTerm(
            [fila.item, fila.contraparteNombre, fila.usuarioNombre],
            q,
            { numericAsContains: true }
          )
        ) {
          return false;
        }
        return true;
      }),
    [filas, filtroTipo, filtroCategoria, q]
  );

  function limpiarFiltros() {
    setFiltroTipo("");
    setFiltroCategoria("");
    setQ("");
  }

  function abrirPreview(fila: StockMovimientoFila) {
    if (fila.comprobanteVtaId) {
      setStockComprobanteIdVer(null);
      setComprobanteVtaIdVer(fila.comprobanteVtaId);
      return;
    }
    setComprobanteVtaIdVer(null);
    setStockComprobanteIdVer(fila.stockComprobanteId);
  }

  const hayFiltros = Boolean(filtroTipo || filtroCategoria || q.trim());

  return (
    <ClassicFilteredTableLayout
      title="Stock"
      subtitle="Movimientos"
      filters={
        <FilterBar className="filtros-contenedor-tienda bg-card">
          <FilaFiltrosDesplegables columnas={4}>
            <FiltroIndividualContainer
              className={FILTER_SELECT_WRAPPER_CLASS}
              activo={Boolean(filtroTipo)}
              onLimpiar={() => setFiltroTipo("")}
            >
              <Select
                value={filtroTipo || undefined}
                onValueChange={(value) => {
                  if (value === "INGRESO" || value === "EGRESO") {
                    setFiltroTipo(value);
                  }
                }}
              >
                <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                  <SelectValue placeholder="TIPO" />
                </SelectTrigger>
                <SelectContent
                  className="select-content-filtro"
                  position="popper"
                  side="bottom"
                  align="start"
                >
                  {TIPOS_MOVIMIENTO.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FiltroIndividualContainer>
            <FiltroIndividualContainer
              className={FILTER_SELECT_WRAPPER_CLASS}
              activo={Boolean(filtroCategoria)}
              onLimpiar={() => setFiltroCategoria("")}
            >
              <Select
                value={filtroCategoria || undefined}
                onValueChange={setFiltroCategoria}
              >
                <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                  <SelectValue placeholder="CATEGORÍA" />
                </SelectTrigger>
                <SelectContent
                  className="select-content-filtro"
                  position="popper"
                  side="bottom"
                  align="start"
                >
                  {CATEGORIAS_MOVIMIENTO.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FiltroIndividualContainer>
          </FilaFiltrosDesplegables>
          <div className="flex items-center gap-3">
            <FilterRowSearch className="flex-1">
              <FiltroBusquedaInput
                id="filtro-stock-movimientos-item"
                placeholder="BUSCAR ITEM..."
                value={q}
                onChange={handleQChange}
                isDebouncing={isDebouncing}
                inputRef={ref}
                disabled={!tieneUsuario}
              />
            </FilterRowSearch>
            <FilterRowSelection className={FILTER_INLINE_ACTION_SLOT_CLASS}>
              <span className={FILTER_COUNT_CLASS}>
                {filasFiltradas.length}{" "}
                {filasFiltradas.length === 1 ? "MOVIMIENTO" : "MOVIMIENTOS"}
              </span>
              {hayFiltros ? (
                <LimpiarFiltrosButton onClick={limpiarFiltros} />
              ) : null}
            </FilterRowSelection>
          </div>
        </FilterBar>
      }
    >
      {!tieneUsuario && !cargando ? (
        <TableEmptyState
          placement="blockedPanel"
          textSize="sm"
          maxWidth="full"
          message="Seleccioná un usuario en el slidenav para ver los movimientos de su sucursal."
        />
      ) : (
        <div className="contenedor-tabla-gestion">
          <Table variant="compact">
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[45%]" />
              <col className="w-[5%]" />
              <col className="w-[10%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>FECHA</TableHead>
                <TableHead>CATEGORÍA</TableHead>
                <TableHead>USUARIO</TableHead>
                <TableHead>CLIENTE/PROVEEDOR</TableHead>
                <TableHead>ITEM</TableHead>
                <TableHead className="text-right">CANT.</TableHead>
                <TableHead className="text-center">ACCIONES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filasFiltradas.length === 0 ? (
                <EmptyTableRow
                  colSpan={7}
                  message={
                    cargando ? "Cargando movimientos." : "Sin resultados"
                  }
                />
              ) : (
                filasFiltradas.map((fila) => (
                  <TableRow key={fila.id}>
                    <TableCell className="celda-datos tabular-nums">
                      {formatDdMmHhMmArgentina(new Date(fila.fechaMs))}
                    </TableCell>
                    <TableCell className="celda-datos">
                      {fmtCelda(fila.categoriaEtiqueta)}
                    </TableCell>
                    <TableCell className="celda-datos">
                      {fmtCelda(fila.usuarioNombre)}
                    </TableCell>
                    <TableCell className="celda-datos min-w-0">
                      {fmtCelda(fila.contraparteNombre)}
                    </TableCell>
                    <TableCell className="celda-datos min-w-0">
                      {fmtCelda(fila.item)}
                    </TableCell>
                    <TableCell className="celda-datos text-right tabular-nums">
                      {fmtCantidad(fila.cantidad)}
                    </TableCell>
                    <TableCell className="celda-datos text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                        aria-label="Ver comprobante"
                        onClick={() => abrirPreview(fila)}
                      >
                        <Eye className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <FacturaComprobanteDetalleModal
        open={Boolean(comprobanteVtaIdVer)}
        onOpenChange={(open) => {
          if (!open) setComprobanteVtaIdVer(null);
        }}
        comprobanteId={comprobanteVtaIdVer}
      />
      <StockComprobanteDetalleModal
        open={Boolean(stockComprobanteIdVer)}
        onOpenChange={(open) => {
          if (!open) setStockComprobanteIdVer(null);
        }}
        stockComprobanteId={stockComprobanteIdVer}
      />
    </ClassicFilteredTableLayout>
  );
}
