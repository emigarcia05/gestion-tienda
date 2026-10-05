"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FilterBar, {
  FILTER_INLINE_ACTION_SLOT_CLASS,
  FILTER_SELECT_WRAPPER_CLASS,
  FiltroIndividualContainer,
  FilaFiltrosDesplegables,
  FilterRowSelection,
  LimpiarFiltrosButton,
} from "@/components/FilterBar";
import { cn } from "@/lib/utils";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import CrearFinBalVtasModal from "@/components/finanzas/CrearFinBalVtasModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import { fmtPrecio } from "@/lib/format";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { eliminarFinBalVtasPorPeriodoAction } from "@/actions/finBalVtas";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { FinBalVtasItem, SucursalGeneraBalanceOption } from "@/services/finBalVtas.service";

const MESES: { valor: number; etiqueta: string }[] = [
  { valor: 1, etiqueta: "ENERO" },
  { valor: 2, etiqueta: "FEBRERO" },
  { valor: 3, etiqueta: "MARZO" },
  { valor: 4, etiqueta: "ABRIL" },
  { valor: 5, etiqueta: "MAYO" },
  { valor: 6, etiqueta: "JUNIO" },
  { valor: 7, etiqueta: "JULIO" },
  { valor: 8, etiqueta: "AGOSTO" },
  { valor: 9, etiqueta: "SEPTIEMBRE" },
  { valor: 10, etiqueta: "OCTUBRE" },
  { valor: 11, etiqueta: "NOVIEMBRE" },
  { valor: 12, etiqueta: "DICIEMBRE" },
];

const ANIO_MIN = 2026;
const ANIO_MAX = 2046;
const ANIOS = Array.from({ length: ANIO_MAX - ANIO_MIN + 1 }, (_, i) => ANIO_MIN + i);

const FILTRO_TODOS = "none";

const TH_ACCIONES =
  "min-w-0 tabla-bloque-secundario-head-divider text-center text-[11px] font-bold uppercase";
const TD_ACCIONES =
  "celda-datos min-w-0 bg-muted/25 text-muted-foreground tabla-bloque-secundario-cell-divider celda-datos--accion-relleno-fila";

type ModoModalVtas = "cargar" | "editar";

type PeriodoVtasRow = {
  mes: number;
  anio: number;
  porSucursalId: Record<string, FinBalVtasItem | undefined>;
};

interface Props {
  filas: FinBalVtasItem[];
  sucursales: SucursalGeneraBalanceOption[];
  esEditor: boolean;
  /** Mes calendario AR (1–12) al renderizar la página. */
  mesActual: number;
  anioActual: number;
}

function fmtMontoEntero(n: number) {
  return `$${fmtPrecio(n)}`;
}

function etiquetaMes(mes: number): string {
  return MESES.find((m) => m.valor === mes)?.etiqueta ?? String(mes);
}

function clavePeriodo(mes: number, anio: number): string {
  return `${anio}-${mes}`;
}

function agruparPorPeriodo(filas: FinBalVtasItem[]): Map<string, PeriodoVtasRow> {
  const map = new Map<string, PeriodoVtasRow>();
  for (const f of filas) {
    const key = clavePeriodo(f.mes, f.anio);
    let row = map.get(key);
    if (!row) {
      row = { mes: f.mes, anio: f.anio, porSucursalId: {} };
      map.set(key, row);
    }
    row.porSucursalId[f.sucursalId] = f;
  }
  return map;
}

function periodoEsAnteriorOIgual(
  mes: number,
  anio: number,
  mesRef: number,
  anioRef: number
): boolean {
  return anio < anioRef || (anio === anioRef && mes <= mesRef);
}

/** De `(mesDesde, anioDesde)` hacia atrás inclusive hasta `(mesHasta, anioHasta)`. */
function enumerarPeriodosHaciaAtras(
  mesDesde: number,
  anioDesde: number,
  mesHasta: number,
  anioHasta: number
): { mes: number; anio: number }[] {
  const out: { mes: number; anio: number }[] = [];
  let mes = mesDesde;
  let anio = anioDesde;
  while (periodoEsAnteriorOIgual(mesHasta, anioHasta, mes, anio)) {
    out.push({ mes, anio });
    mes -= 1;
    if (mes < 1) {
      mes = 12;
      anio -= 1;
    }
    if (out.length > 600) break;
  }
  return out;
}

function periodoMasAntiguo(filas: FinBalVtasItem[]): { mes: number; anio: number } | null {
  if (filas.length === 0) return null;
  let mejor = { mes: filas[0]!.mes, anio: filas[0]!.anio };
  for (const f of filas) {
    if (periodoEsAnteriorOIgual(f.mes, f.anio, mejor.mes, mejor.anio)) {
      mejor = { mes: f.mes, anio: f.anio };
    }
  }
  return mejor;
}

export default function FinBalVtasPageClient({
  filas,
  sucursales,
  esEditor,
  mesActual,
  anioActual,
}: Props) {
  const router = useRouter();
  const [filtMes, setFiltMes] = useState<string>(FILTRO_TODOS);
  const [filtAnio, setFiltAnio] = useState<string>(FILTRO_TODOS);
  const [filtSucursalId, setFiltSucursalId] = useState<string>(FILTRO_TODOS);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalModo, setModalModo] = useState<ModoModalVtas>("cargar");
  const [modalMes, setModalMes] = useState(mesActual);
  const [modalAnio, setModalAnio] = useState(anioActual);

  const periodosFiltrados = useMemo(() => {
    const porPeriodo = agruparPorPeriodo(filas);
    const antiguo = periodoMasAntiguo(filas);
    const mesHasta = antiguo?.mes ?? mesActual;
    const anioHasta = antiguo?.anio ?? anioActual;
    const hastaEsPosteriorAlActual =
      anioHasta > anioActual || (anioHasta === anioActual && mesHasta > mesActual);
    const rango = hastaEsPosteriorAlActual
      ? [{ mes: mesActual, anio: anioActual }]
      : enumerarPeriodosHaciaAtras(mesActual, anioActual, mesHasta, anioHasta);

    return rango
      .map((p) => {
        const existente = porPeriodo.get(clavePeriodo(p.mes, p.anio));
        return (
          existente ?? { mes: p.mes, anio: p.anio, porSucursalId: {} }
        );
      })
      .filter((p) => {
        if (filtMes !== FILTRO_TODOS && p.mes !== Number(filtMes)) return false;
        if (filtAnio !== FILTRO_TODOS && p.anio !== Number(filtAnio)) return false;
        if (filtSucursalId !== FILTRO_TODOS && !p.porSucursalId[filtSucursalId]) {
          return false;
        }
        return true;
      });
  }, [filas, filtMes, filtAnio, filtSucursalId, mesActual, anioActual]);

  const nSuc = sucursales.length;
  const pctAcciones = esEditor ? 16 : 0;
  const pctMes = 14;
  const pctTotal = 14;
  const pctSuc = nSuc > 0 ? (100 - pctMes - pctTotal - pctAcciones) / nSuc : 0;
  const colSpanVacio = 2 + nSuc + (esEditor ? 1 : 0);

  function limpiarFiltros() {
    setFiltMes(FILTRO_TODOS);
    setFiltAnio(FILTRO_TODOS);
    setFiltSucursalId(FILTRO_TODOS);
  }

  function abrirModal(modo: ModoModalVtas, mes: number, anio: number) {
    setModalModo(modo);
    setModalMes(mes);
    setModalAnio(anio);
    setModalOpen(true);
  }

  async function handleEliminarPeriodo(mes: number, anio: number) {
    if (!esEditor) return;
    const etiqueta = `${etiquetaMes(mes)} ${anio}`;
    if (
      !window.confirm(
        `¿Eliminar las ventas de ${etiqueta} de todas las sucursales?`
      )
    ) {
      return;
    }
    const r = await eliminarFinBalVtasPorPeriodoAction({ mes, anio });
    if (!r.ok) {
      toast.error(r.error ?? "No se pudo eliminar.");
      return;
    }
    toast.success("Periodo eliminado.");
    router.refresh();
  }

  const emptyMessage =
    filas.length > 0 && periodosFiltrados.length === 0
      ? "Ningún registro coincide con los filtros seleccionados."
      : undefined;

  return (
    <>
      <ClassicFilteredTableLayout
        title="FINANZAS"
        subtitle="Ventas Mensuales"
        contentWidth="full"
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilterRowSelection className="w-full min-w-0">
              <FilaFiltrosDesplegables>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={filtMes !== FILTRO_TODOS}
                  onLimpiar={() => setFiltMes(FILTRO_TODOS)}
                >
                  <Select value={filtMes} onValueChange={setFiltMes}>
                    <SelectTrigger className="input-filtro-unificado" aria-label="Mes">
                      <SelectValue placeholder="MES" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro max-h-60"
                    >
                      <SelectItem value={FILTRO_TODOS}>MES</SelectItem>
                      {MESES.map((m) => (
                        <SelectItem key={m.valor} value={String(m.valor)}>
                          {m.etiqueta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>

                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={filtAnio !== FILTRO_TODOS}
                  onLimpiar={() => setFiltAnio(FILTRO_TODOS)}
                >
                  <Select value={filtAnio} onValueChange={setFiltAnio}>
                    <SelectTrigger className="input-filtro-unificado" aria-label="Año">
                      <SelectValue placeholder="AÑO" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro max-h-60"
                    >
                      <SelectItem value={FILTRO_TODOS}>AÑO</SelectItem>
                      {ANIOS.map((a) => (
                        <SelectItem key={a} value={String(a)}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>

                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={filtSucursalId !== FILTRO_TODOS}
                  onLimpiar={() => setFiltSucursalId(FILTRO_TODOS)}
                >
                  <Select value={filtSucursalId} onValueChange={setFiltSucursalId}>
                    <SelectTrigger className="input-filtro-unificado" aria-label="Sucursal">
                      <SelectValue placeholder="SUCURSAL" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      <SelectItem value={FILTRO_TODOS}>SUCURSAL</SelectItem>
                      {sucursales.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>

                <div className={cn(FILTER_INLINE_ACTION_SLOT_CLASS, "col-span-2 gap-2")}>
                  <LimpiarFiltrosButton onClick={limpiarFiltros} />
                </div>
              </FilaFiltrosDesplegables>
            </FilterRowSelection>
          </FilterBar>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {!esEditor ? (
            <p className="text-sm text-muted-foreground">
              Activá el modo editor para cargar o eliminar registros.
            </p>
          ) : null}

          <div className="contenedor-tabla-gestion no-scroll-x min-h-0 flex-1">
            <Table
              variant="compact"
              scrollX={false}
              className="tabla-gestion-compacta w-full table-fixed"
            >
              <colgroup>
                <col style={{ width: `${pctMes}%` }} />
                <col style={{ width: `${pctTotal}%` }} />
                {sucursales.map((s) => (
                  <col key={s.id} style={{ width: `${pctSuc}%` }} />
                ))}
                {esEditor ? <col style={{ width: `${pctAcciones}%` }} /> : null}
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>MES</TableHead>
                  <TableHead className="text-right">TOTAL</TableHead>
                  {sucursales.map((s) => (
                    <TableHead key={s.id} className="text-right">
                      {s.nombre}
                    </TableHead>
                  ))}
                  {esEditor ? <TableHead className={TH_ACCIONES}>ACCIONES</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {periodosFiltrados.length === 0 ? (
                  <EmptyTableRow
                    colSpan={Math.max(colSpanVacio, 1)}
                    message={emptyMessage ?? "No hay cargas registradas."}
                  />
                ) : (
                  periodosFiltrados.map((p) => {
                    const nCargadas = sucursales.filter((s) => p.porSucursalId[s.id]).length;
                    const hayCarga = nCargadas > 0;
                    const periodoCompleto = nSuc > 0 && nCargadas === nSuc;
                    const etiqueta = `${etiquetaMes(p.mes)} ${p.anio}`;
                    const totalPeriodo = sucursales.reduce((acc, s) => {
                      const item = p.porSucursalId[s.id];
                      return acc + (item?.monto ?? 0);
                    }, 0);
                    return (
                      <TableRow key={`${p.anio}-${p.mes}`}>
                        <TableCell className="celda-datos font-medium">
                          {etiqueta}
                        </TableCell>
                        <TableCell className="celda-datos celda-numero celda-destacado tabular-nums text-right">
                          {hayCarga ? fmtMontoEntero(totalPeriodo) : ""}
                        </TableCell>
                        {sucursales.map((s) => {
                          const item = p.porSucursalId[s.id];
                          return (
                            <TableCell
                              key={s.id}
                              className="celda-datos celda-numero tabular-nums text-right"
                            >
                              {item ? fmtMontoEntero(item.monto) : ""}
                            </TableCell>
                          );
                        })}
                        {esEditor ? (
                          <TableCell className={TD_ACCIONES}>
                            <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                disabled={periodoCompleto}
                                aria-label={`Cargar ventas — ${etiqueta}`}
                                title="Cargar"
                                onClick={() => abrirModal("cargar", p.mes, p.anio)}
                              >
                                <Plus className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                disabled={!hayCarga}
                                aria-label={`Editar ventas — ${etiqueta}`}
                                title="Editar"
                                onClick={() => abrirModal("editar", p.mes, p.anio)}
                              >
                                <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                disabled={!hayCarga}
                                aria-label={`Eliminar ventas — ${etiqueta}`}
                                title="Eliminar"
                                onClick={() => void handleEliminarPeriodo(p.mes, p.anio)}
                              >
                                <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                              </Button>
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </ClassicFilteredTableLayout>

      <CrearFinBalVtasModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        sucursales={sucursales}
        modo={modalModo}
        initialMes={modalMes}
        initialAnio={modalAnio}
      />
    </>
  );
}
