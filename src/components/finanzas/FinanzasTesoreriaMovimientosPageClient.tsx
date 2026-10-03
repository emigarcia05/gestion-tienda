"use client";

import { useMemo, useState } from "react";
import { Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { eliminarMovimientoTesoreriaAction } from "@/actions/tesoreriaMovimientos";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FacturaComprobanteDetalleModal from "@/components/facturacion/FacturaComprobanteDetalleModal";
import FilterBar, {
  FILTER_COUNT_CLASS,
  FILTER_INLINE_ACTION_SLOT_CLASS,
  FILTER_SELECT_WRAPPER_CLASS,
  FiltroIndividualContainer,
  FilaFiltrosDesplegables,
  FilterRowSelection,
  LimpiarFiltrosButton,
  SELECT_TRIGGER_FILTER_CLASS,
} from "@/components/FilterBar";
import DetalleMovimientoTesoreriaCuerpo from "@/components/finanzas/DetalleMovimientoTesoreriaCuerpo";
import AppModal from "@/components/shared/AppModal";
import FiltroRangoFechasCalendarioModal from "@/components/shared/FiltroRangoFechasCalendarioModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
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
import {
  addDaysToIsoYmdArgentina,
  dateToIsoYmdArgentina,
  formatIsoYmdDdMmYyyyArgentina,
} from "@/lib/fechaArgentina";
import { fmtCelda, fmtPrecio } from "@/lib/format";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { TesoreriaMovimientoFila } from "@/services/tesoreriaMovimientos.service";

const PERIODO_HOY = "hoy";
const PERIODO_RANGO = "rango";

const TIPOS_MOVIMIENTO = ["INGRESO", "EGRESO"] as const;

const CATEGORIAS_MOVIMIENTO = [
  "COBRO",
  "NOTA DE CRÉDITO",
  "PAGO PROVEEDOR",
  "PAGO GASTOS",
  "AJUSTE CAJA",
  "TRANSFERENCIA ENTRE CAJAS",
] as const;

type PeriodoFiltro = "hoy" | "ayer" | "mes" | "rango" | "todos";

function esPeriodoFiltroPreset(
  value: string
): value is Exclude<PeriodoFiltro, "rango"> {
  return (
    value === "hoy" ||
    value === "ayer" ||
    value === "mes" ||
    value === "todos"
  );
}

interface Props {
  filas: TesoreriaMovimientoFila[];
}

export default function FinanzasTesoreriaMovimientosPageClient({ filas }: Props) {
  const [filasState, setFilasState] = useState(filas);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(PERIODO_HOY);
  const [rangoDesde, setRangoDesde] = useState("");
  const [rangoHasta, setRangoHasta] = useState("");
  const [rangoModalOpen, setRangoModalOpen] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroSucursal, setFiltroSucursal] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filaDetalle, setFilaDetalle] = useState<TesoreriaMovimientoFila | null>(null);
  const [filaParaEliminar, setFilaParaEliminar] = useState<TesoreriaMovimientoFila | null>(null);
  const [comprobantePreviewId, setComprobantePreviewId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const hoyIso = dateToIsoYmdArgentina(new Date());
  const ayerIso = addDaysToIsoYmdArgentina(hoyIso, -1);

  const sucursales = useMemo(
    () =>
      [...new Set(filasState.map((f) => f.sucursalNombre).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "es")
      ),
    [filasState]
  );
  const usuarios = useMemo(
    () =>
      [...new Set(filasState.map((f) => f.usuarioNombre).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "es")
      ),
    [filasState]
  );

  const filasFiltradas = useMemo(
    () =>
      filasState.filter((fila) => {
        if (periodo === "hoy" && fila.fechaRegistroIso !== hoyIso) return false;
        if (periodo === "ayer" && fila.fechaRegistroIso !== ayerIso) return false;
        if (
          periodo === "mes" &&
          fila.fechaRegistroIso.slice(0, 7) !== hoyIso.slice(0, 7)
        ) {
          return false;
        }
        if (periodo === "rango") {
          if (!rangoDesde || !rangoHasta) return false;
          if (
            fila.fechaRegistroIso < rangoDesde ||
            fila.fechaRegistroIso > rangoHasta
          ) {
            return false;
          }
        }
        if (filtroTipo && fila.tipoEtiqueta !== filtroTipo) return false;
        if (filtroCategoria && fila.categoriaEtiqueta !== filtroCategoria) {
          return false;
        }
        if (filtroSucursal && fila.sucursalNombre !== filtroSucursal) {
          return false;
        }
        if (filtroUsuario && fila.usuarioNombre !== filtroUsuario) {
          return false;
        }
        return true;
      }),
    [
      filasState,
      periodo,
      rangoDesde,
      rangoHasta,
      hoyIso,
      ayerIso,
      filtroTipo,
      filtroCategoria,
      filtroSucursal,
      filtroUsuario,
    ]
  );

  async function handleConfirmarBorrado() {
    if (!filaParaEliminar) return;
    const fila = filaParaEliminar;
    setDeletingId(fila.id);
    try {
      const res = await eliminarMovimientoTesoreriaAction({ id: fila.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setFilasState((prev) => prev.filter((item) => !res.data.idsEliminados.includes(item.id)));
      if (filaDetalle && res.data.idsEliminados.includes(filaDetalle.id)) {
        setFilaDetalle(null);
      }
      toast.success(
        res.data.idsEliminados.length > 1
          ? "Transferencia eliminada."
          : "Movimiento eliminado."
      );
      setFilaParaEliminar(null);
    } finally {
      setDeletingId(null);
    }
  }

  function onPeriodoChange(value: string) {
    if (value === PERIODO_RANGO) {
      setRangoModalOpen(true);
      return;
    }
    if (!esPeriodoFiltroPreset(value)) return;
    setRangoDesde("");
    setRangoHasta("");
    setPeriodo(value);
  }

  function limpiarPeriodo() {
    setPeriodo(PERIODO_HOY);
    setRangoDesde("");
    setRangoHasta("");
  }

  function limpiarFiltros() {
    limpiarPeriodo();
    setFiltroTipo("");
    setFiltroCategoria("");
    setFiltroSucursal("");
    setFiltroUsuario("");
  }

  const hayFiltros =
    periodo !== PERIODO_HOY ||
    Boolean(filtroTipo || filtroCategoria || filtroSucursal || filtroUsuario);

  return (
    <ClassicFilteredTableLayout
      title="TESORERIA"
      subtitle="Movimientos"
      filters={
        <FilterBar className="filtros-contenedor-tienda bg-card">
          <FilaFiltrosDesplegables columnas={5}>
            <FiltroIndividualContainer
              className={FILTER_SELECT_WRAPPER_CLASS}
              activo={periodo !== PERIODO_HOY}
              onLimpiar={limpiarPeriodo}
            >
              <Select value={periodo} onValueChange={onPeriodoChange}>
                <SelectTrigger
                  className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                >
                  {periodo === PERIODO_RANGO && rangoDesde && rangoHasta ? (
                    <span data-slot="select-value" className="truncate">
                      {`${formatIsoYmdDdMmYyyyArgentina(rangoDesde)} - ${formatIsoYmdDdMmYyyyArgentina(rangoHasta)}`}
                    </span>
                  ) : (
                    <SelectValue placeholder="FECHA" />
                  )}
                </SelectTrigger>
                <SelectContent
                  className="select-content-filtro"
                  position="popper"
                  side="bottom"
                  align="start"
                >
                  <SelectItem value="hoy">HOY</SelectItem>
                  <SelectItem value="ayer">AYER</SelectItem>
                  <SelectItem value="mes">ESTE MES</SelectItem>
                  <SelectItem
                    value={PERIODO_RANGO}
                    onPointerDown={() => {
                      queueMicrotask(() => setRangoModalOpen(true));
                    }}
                  >
                    RANGO PERSONALIZADO
                  </SelectItem>
                  <SelectItem value="todos">TODO</SelectItem>
                </SelectContent>
              </Select>
            </FiltroIndividualContainer>
            <FiltroIndividualContainer
              className={FILTER_SELECT_WRAPPER_CLASS}
              activo={Boolean(filtroTipo)}
              onLimpiar={() => setFiltroTipo("")}
            >
              <Select
                value={filtroTipo || undefined}
                onValueChange={(value) => {
                  if (
                    value === "INGRESO" ||
                    value === "EGRESO"
                  ) {
                    setFiltroTipo(value);
                  }
                }}
              >
                <SelectTrigger
                  className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                >
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
                <SelectTrigger
                  className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                >
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
            <FiltroIndividualContainer
              className={FILTER_SELECT_WRAPPER_CLASS}
              activo={Boolean(filtroSucursal)}
              onLimpiar={() => setFiltroSucursal("")}
            >
              <Select
                value={filtroSucursal || undefined}
                onValueChange={setFiltroSucursal}
              >
                <SelectTrigger
                  className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                >
                  <SelectValue placeholder="SUCURSAL" />
                </SelectTrigger>
                <SelectContent
                  className="select-content-filtro"
                  position="popper"
                  side="bottom"
                  align="start"
                >
                  {sucursales.map((nombre) => (
                    <SelectItem key={nombre} value={nombre}>
                      {nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FiltroIndividualContainer>
            <FiltroIndividualContainer
              className={FILTER_SELECT_WRAPPER_CLASS}
              activo={Boolean(filtroUsuario)}
              onLimpiar={() => setFiltroUsuario("")}
            >
              <Select
                value={filtroUsuario || undefined}
                onValueChange={setFiltroUsuario}
              >
                <SelectTrigger
                  className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                >
                  <SelectValue placeholder="USUARIO" />
                </SelectTrigger>
                <SelectContent
                  className="select-content-filtro"
                  position="popper"
                  side="bottom"
                  align="start"
                >
                  {usuarios.map((nombre) => (
                    <SelectItem key={nombre} value={nombre}>
                      {nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FiltroIndividualContainer>
          </FilaFiltrosDesplegables>
          <FilterRowSelection className={FILTER_INLINE_ACTION_SLOT_CLASS}>
            <span className={FILTER_COUNT_CLASS}>
              {filasFiltradas.length}{" "}
              {filasFiltradas.length === 1 ? "MOVIMIENTO" : "MOVIMIENTOS"}
            </span>
            {hayFiltros ? (
              <LimpiarFiltrosButton onClick={limpiarFiltros} />
            ) : null}
          </FilterRowSelection>
        </FilterBar>
      }
    >
      <div className="contenedor-tabla-gestion">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>FECHA</TableHead>
              <TableHead>SUCURSAL</TableHead>
              <TableHead>TIPO</TableHead>
              <TableHead>CATEGORÍA</TableHead>
              <TableHead>USUARIO</TableHead>
              <TableHead className="text-right">MONTO</TableHead>
              <TableHead className="text-center">ACCIONES</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filasFiltradas.length === 0 ? (
              <EmptyTableRow colSpan={7} message="No hay movimientos." />
            ) : (
              filasFiltradas.map((fila) => (
                <TableRow key={fila.id}>
                  <TableCell className="celda-datos">
                    {formatIsoYmdDdMmYyyyArgentina(fila.fechaRegistroIso)}
                  </TableCell>
                  <TableCell className="celda-datos">
                    {fmtCelda(fila.sucursalNombre)}
                  </TableCell>
                  <TableCell className="celda-datos">
                    {fmtCelda(fila.tipoEtiqueta)}
                  </TableCell>
                  <TableCell className="celda-datos">
                    {fmtCelda(fila.categoriaEtiqueta)}
                  </TableCell>
                  <TableCell className="celda-datos">
                    {fmtCelda(fila.usuarioNombre)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "celda-datos text-right tabular-nums",
                      fila.tipoMovimiento === "EGRESO" && "text-destructive"
                    )}
                  >
                    {fila.tipoMovimiento === "EGRESO" ? "−" : ""}
                    ${fmtPrecio(fila.monto)}
                  </TableCell>
                  <TableCell className="celda-datos">
                    <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Ver movimiento"
                        className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                        onClick={() => setFilaDetalle(fila)}
                      >
                        <Eye className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Borrar movimiento"
                        className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                        disabled={deletingId === fila.id}
                        onClick={() => setFilaParaEliminar(fila)}
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
      <FiltroRangoFechasCalendarioModal
        open={rangoModalOpen}
        onOpenChange={setRangoModalOpen}
        fechaDesde={rangoDesde}
        fechaHasta={rangoHasta}
        onAplicarRango={(desde, hasta) => {
          setRangoDesde(desde);
          setRangoHasta(hasta);
          setPeriodo(PERIODO_RANGO);
        }}
        onLimpiar={limpiarPeriodo}
      />

      <Dialog open={filaDetalle != null} onOpenChange={(open) => (!open ? setFilaDetalle(null) : null)}>
        {filaDetalle ? (
          <AppModal
            title="DETALLE MOVIMIENTO"
            size="md"
            actions={
              <Button type="button" variant="outline" onClick={() => setFilaDetalle(null)}>
                Cerrar
              </Button>
            }
          >
            <DetalleMovimientoTesoreriaCuerpo
              fila={filaDetalle}
              onOpenComprobantePreview={setComprobantePreviewId}
            />
          </AppModal>
        ) : null}
      </Dialog>

      <Dialog
        open={filaParaEliminar != null}
        onOpenChange={(open) => (!open ? setFilaParaEliminar(null) : null)}
      >
        {filaParaEliminar ? (
          <AppModal
            title="CONFIRMAR BORRADO"
            size="sm"
            actions={
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={deletingId === filaParaEliminar.id}
                  onClick={() => setFilaParaEliminar(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={deletingId === filaParaEliminar.id}
                  onClick={() => void handleConfirmarBorrado()}
                >
                  {deletingId === filaParaEliminar.id ? "Borrando..." : "Borrar"}
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-3">
              <p className="text-sm text-foreground">
                ¿Querés borrar este movimiento? Esta acción no se puede deshacer.
              </p>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>FECHA</ModalMicroLabel>
                <p className="text-sm text-foreground">
                  {formatIsoYmdDdMmYyyyArgentina(filaParaEliminar.fechaRegistroIso)}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>CATEGORÍA</ModalMicroLabel>
                <p className="text-sm text-foreground">{fmtCelda(filaParaEliminar.categoriaEtiqueta)}</p>
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>MONTO</ModalMicroLabel>
                <p className="text-sm tabular-nums text-foreground">
                  ${fmtPrecio(filaParaEliminar.monto)}
                </p>
              </div>
            </div>
          </AppModal>
        ) : null}
      </Dialog>

      <FacturaComprobanteDetalleModal
        open={comprobantePreviewId != null}
        onOpenChange={(open) => {
          if (!open) setComprobantePreviewId(null);
        }}
        comprobanteId={comprobantePreviewId}
      />
    </ClassicFilteredTableLayout>
  );
}
