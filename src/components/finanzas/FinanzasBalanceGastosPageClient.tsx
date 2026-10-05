"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Loader2, Plus } from "lucide-react";
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
  SELECT_TRIGGER_FILTER_CLASS,
  FiltroIndividualContainer,
  FilaFiltrosDesplegables,
  FilterRowSelection,
  LimpiarFiltrosButton,
} from "@/components/FilterBar";
import { dateToIsoYmdArgentina } from "@/lib/fechaArgentina";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import TablaGastos, { type BalanceGastoMensualFila } from "@/components/finanzas/TablaGastos";
import BalanceMensualGastoHistoricoModal from "@/components/finanzas/BalanceMensualGastoHistoricoModal";
import EliminarFinBalGastoMensualModal from "@/components/finanzas/EliminarFinBalGastoMensualModal";
import GastoUnicoBalanceModal from "@/components/finanzas/GastoUnicoBalanceModal";
import IvaDiscriminaCargaMesModal from "@/components/finanzas/IvaDiscriminaCargaMesModal";
import RegistrarMontoPagoFinBalGastoMensualModal from "@/components/finanzas/RegistrarMontoPagoFinBalGastoMensualModal";
import {
  cargarFinBalGastoMensualMesAction,
  listarPendientesDiscriminaIvaCargaMesAction,
} from "@/actions/finBalGastoMensualBalance";
import type { PendienteDiscriminaIvaCargaMesItem } from "@/services/finBalGastoMensualBalance.service";
import { cn } from "@/lib/utils";
import { filterItemsBySelectSearch } from "@/lib/selectSearch";
import SelectSearchInput from "@/components/shared/SelectSearchInput";

type DimensionOpcionesFiltro = "sucursal" | "proveedor" | "rubro" | "gasto";

/** Valores del filtro ESTADO (combinación monto / pago). */
type FiltroEstadoBalanceGastos =
  | ""
  | "con_monto_sin_pago"
  | "con_monto_con_pago"
  | "sin_monto"
  | "sin_monto_o_pendiente";

/** Catálogo recurrente mensual vs gasto eventual (`fin_bal_gasto_final.gasto_mensual`). */
type FiltroTipoBalanceGastos = "" | "mensual" | "eventual";

function aplicarFiltroTipoFilas(
  rows: BalanceGastoMensualFila[],
  filtroTipo: FiltroTipoBalanceGastos
): BalanceGastoMensualFila[] {
  if (!filtroTipo) return rows;
  if (filtroTipo === "mensual") return rows.filter((r) => r.esGastoMensual);
  return rows.filter((r) => !r.esGastoMensual);
}

function aplicarFiltroEstadoFilas(
  rows: BalanceGastoMensualFila[],
  filtroEstado: FiltroEstadoBalanceGastos
): BalanceGastoMensualFila[] {
  if (!filtroEstado) return rows;
  switch (filtroEstado) {
    case "con_monto_sin_pago":
      // Pendiente de la imputación = monto − pagado: sin pagar, parcial o con "PAGADO" en —; excluye pagado = monto.
      return rows.filter((r) => r.monto > 0 && r.pagado < r.monto);
    case "con_monto_con_pago":
      return rows.filter((r) => r.monto > 0 && r.pagado > 0);
    case "sin_monto":
      return rows.filter((r) => r.monto === 0);
    case "sin_monto_o_pendiente":
      // Unión de SIN MONTO + CON MONTO Y PENDIENTE.
      return rows.filter((r) => r.monto === 0 || (r.monto > 0 && r.pagado < r.monto));
    default:
      return rows;
  }
}

/**
 * Filas coherentes con los filtros activos **excepto** la dimensión del desplegable
 * que se está poblando (así, si elegís RUBRO, PROVEEDOR solo lista proveedores que
 * tienen al menos una fila con ese rubro en el periodo filtrado).
 */
function filasParaOpcionesDesplegable(
  filas: BalanceGastoMensualFila[],
  omitir: DimensionOpcionesFiltro,
  estado: {
    filtSucursal: string;
    filtProveedor: string;
    filtRubro: string;
    filtGasto: string;
    filtEstado: FiltroEstadoBalanceGastos;
    filtTipo: FiltroTipoBalanceGastos;
  }
): BalanceGastoMensualFila[] {
  let out = aplicarFiltroTipoFilas(filas, estado.filtTipo);
  if (omitir !== "sucursal" && estado.filtSucursal) {
    out = out.filter((r) => r.sucursalNombre === estado.filtSucursal);
  }
  if (omitir !== "proveedor" && estado.filtProveedor) {
    out = out.filter((r) => r.proveedorNombre === estado.filtProveedor);
  }
  if (omitir !== "rubro" && estado.filtRubro) {
    out = out.filter((r) => r.rubroNombre === estado.filtRubro);
  }
  if (omitir !== "gasto" && estado.filtGasto) {
    out = out.filter((r) => r.gastoNombre === estado.filtGasto);
  }
  return aplicarFiltroEstadoFilas(out, estado.filtEstado);
}

/** Filtros de periodo (Balance · Gastos): acotados a los mismos límites que `mesAnioQuerySchema`. */
const ANIO_FILTRO_MIN = 2026;
const ANIO_FILTRO_MAX = 2046;
const ANIOS_FILTRO_BALANCE_GASTOS = Array.from(
  { length: ANIO_FILTRO_MAX - ANIO_FILTRO_MIN + 1 },
  (_, i) => ANIO_FILTRO_MIN + i
);

const MESES_CALENDARIO: { valor: number; etiqueta: string }[] = [
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

interface Props {
  filas: BalanceGastoMensualFila[];
  esEditor: boolean;
  /** Meses 1–12 seleccionados (URL `mes=6` o `mes=6,7,8`). */
  meses: number[];
  anio: number;
  /** Selectores de sucursal (centro de costo) para gasto eventual. */
  sucursalesCentroCosto: { id: string; nombre: string }[];
}

function etiquetaMesesSeleccionados(mesesSel: number[]): string {
  if (mesesSel.length === 0) return "MES";
  if (mesesSel.length === 1) {
    return MESES_CALENDARIO.find((m) => m.valor === mesesSel[0])?.etiqueta ?? "MES";
  }
  return mesesSel
    .map((n) => MESES_CALENDARIO.find((m) => m.valor === n)?.etiqueta ?? String(n))
    .join(", ");
}

export default function FinanzasBalanceGastosPageClient({
  filas,
  esEditor,
  meses,
  anio,
  sucursalesCentroCosto,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const mesesMultiRef = useRef<HTMLDivElement>(null);
  const [mesesOpen, setMesesOpen] = useState(false);
  const [mesesQuery, setMesesQuery] = useState("");
  const mesesFiltrados = useMemo(
    () => filterItemsBySelectSearch(MESES_CALENDARIO, mesesQuery, (m) => m.etiqueta),
    [mesesQuery]
  );

  const [filtRubro, setFiltRubro] = useState("");
  const [filtGasto, setFiltGasto] = useState("");
  const [filtSucursal, setFiltSucursal] = useState("");
  const [filtProveedor, setFiltProveedor] = useState("");
  /** Filtro ESTADO (monto + pago); vacío = sin filtrar por estado. */
  const [filtEstado, setFiltEstado] = useState<FiltroEstadoBalanceGastos>("");
  /** MENSUAL vs EVENTUAL (`gasto_mensual` en catálogo). */
  const [filtTipo, setFiltTipo] = useState<FiltroTipoBalanceGastos>("");

  const [filaRegistrarMontoPago, setFilaRegistrarMontoPago] = useState<BalanceGastoMensualFila | null>(null);
  const [eliminar, setEliminar] = useState<{ id: string; etiqueta: string } | null>(null);
  const [gastoUnicoOpen, setGastoUnicoOpen] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoGastoFinalId, setHistoricoGastoFinalId] = useState<string | null>(null);
  const [ivaCargaMesModalOpen, setIvaCargaMesModalOpen] = useState(false);
  const [pendientesIvaCargaMes, setPendientesIvaCargaMes] = useState<PendienteDiscriminaIvaCargaMesItem[]>([]);

  const { mesHoy, anioHoy } = useMemo(() => {
    const iso = dateToIsoYmdArgentina(new Date());
    const [yStr, mStr] = iso.split("-");
    const anioN = Number.parseInt(yStr ?? "", 10);
    const mesN = Number.parseInt(mStr ?? "", 10);
    return {
      mesHoy: Number.isFinite(mesN) ? mesN : 1,
      anioHoy: Number.isFinite(anioN) ? anioN : ANIO_FILTRO_MIN,
    };
  }, []);

  const estadoFiltros = useMemo(
    () => ({
      filtSucursal,
      filtProveedor,
      filtRubro,
      filtGasto,
      filtEstado,
      filtTipo,
    }),
    [filtSucursal, filtProveedor, filtRubro, filtGasto, filtEstado, filtTipo]
  );

  const sucursalesOpciones = useMemo(() => {
    const base = filasParaOpcionesDesplegable(filas, "sucursal", estadoFiltros);
    return [...new Set(base.map((f) => f.sucursalNombre))].sort((a, b) => a.localeCompare(b, "es"));
  }, [filas, estadoFiltros]);

  const proveedoresOpciones = useMemo(() => {
    const base = filasParaOpcionesDesplegable(filas, "proveedor", estadoFiltros);
    return [...new Set(base.map((f) => f.proveedorNombre))].sort((a, b) => a.localeCompare(b, "es"));
  }, [filas, estadoFiltros]);

  const rubrosOpciones = useMemo(() => {
    const base = filasParaOpcionesDesplegable(filas, "rubro", estadoFiltros);
    return [...new Set(base.map((f) => f.rubroNombre))].sort((a, b) => a.localeCompare(b, "es"));
  }, [filas, estadoFiltros]);

  const gastosOpciones = useMemo(() => {
    const base = filasParaOpcionesDesplegable(filas, "gasto", estadoFiltros);
    return [...new Set(base.map((f) => f.gastoNombre))].sort((a, b) => a.localeCompare(b, "es"));
  }, [filas, estadoFiltros]);

  useEffect(() => {
    if (filtSucursal && !sucursalesOpciones.includes(filtSucursal)) setFiltSucursal("");
  }, [filtSucursal, sucursalesOpciones]);

  useEffect(() => {
    if (filtProveedor && !proveedoresOpciones.includes(filtProveedor)) setFiltProveedor("");
  }, [filtProveedor, proveedoresOpciones]);

  useEffect(() => {
    if (filtRubro && !rubrosOpciones.includes(filtRubro)) setFiltRubro("");
  }, [filtRubro, rubrosOpciones]);

  useEffect(() => {
    if (filtGasto && !gastosOpciones.includes(filtGasto)) setFiltGasto("");
  }, [filtGasto, gastosOpciones]);

  const filasFiltradas = useMemo(() => {
    let out = aplicarFiltroTipoFilas(filas, filtTipo);
    if (filtRubro) out = out.filter((f) => f.rubroNombre === filtRubro);
    if (filtGasto) out = out.filter((f) => f.gastoNombre === filtGasto);
    if (filtSucursal) out = out.filter((f) => f.sucursalNombre === filtSucursal);
    if (filtProveedor) out = out.filter((f) => f.proveedorNombre === filtProveedor);
    out = aplicarFiltroEstadoFilas(out, filtEstado);
    return out;
  }, [filas, filtTipo, filtRubro, filtGasto, filtSucursal, filtProveedor, filtEstado]);

  /** Periodo: cero o más meses + `anio`. Sin meses = todo el año. */
  function navegarPeriodo(nuevosMeses: number[], nuevoAnio: number) {
    const mesesNorm = [
      ...new Set(nuevosMeses.filter((m) => m >= 1 && m <= 12)),
    ].sort((a, b) => a - b);
    const q = new URLSearchParams();
    if (mesesNorm.length > 0) {
      q.set("mes", mesesNorm.join(","));
    }
    q.set("anio", String(nuevoAnio));
    router.replace(`${pathname}?${q.toString()}`);
    router.refresh();
  }

  function onCambioAnio(nuevoAnioStr: string) {
    const nuevoAnio = parseInt(nuevoAnioStr, 10);
    navegarPeriodo(meses, nuevoAnio);
  }

  function toggleMes(mesValor: number) {
    const tiene = meses.includes(mesValor);
    const next = tiene
      ? meses.filter((m) => m !== mesValor)
      : [...meses, mesValor];
    navegarPeriodo(next, anio);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (mesesMultiRef.current && !mesesMultiRef.current.contains(e.target as Node)) {
        setMesesOpen(false);
        setMesesQuery("");
      }
    }
    if (mesesOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [mesesOpen]);

  /** Mes concreto para alta: si hay uno solo, ese; si no, mes calendario AR. */
  const mesUnico = meses.length === 1 ? meses[0] : null;
  const mesParaAlta = mesUnico ?? mesHoy;
  const mesesFiltroActivo = meses.length > 0;
  const labelMeses = etiquetaMesesSeleccionados(meses);

  function limpiarFiltros() {
    setFiltRubro("");
    setFiltGasto("");
    setFiltSucursal("");
    setFiltProveedor("");
    setFiltEstado("");
    setFiltTipo("");
  }

  async function ejecutarCargaMesDesdeCatalogo(ivaPorGastoFinalId?: Record<string, boolean>) {
    const res = await cargarFinBalGastoMensualMesAction({
      mes: mesParaAlta,
      anio,
      ...(ivaPorGastoFinalId && Object.keys(ivaPorGastoFinalId).length > 0 ? { ivaPorGastoFinalId } : {}),
    });
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo cargar el mes.");
      return;
    }
    const { creados, yaExistentes } = res.data;
    if (creados > 0) {
      toast.success(
        creados === 1
          ? "Se cargó 1 imputación del mes."
          : `Se cargaron ${creados} imputaciones del mes.`
      );
    } else if (yaExistentes > 0) {
      toast.info("Las imputaciones del mes ya estaban cargadas.");
    } else {
      toast.info("No hay gastos mensuales en el catálogo para cargar.");
    }
    router.refresh();
  }

  async function handleCargarMes() {
    if (mesUnico === null) {
      toast.info("Elegí un solo mes para cargar gastos fijos.");
      return;
    }
    setLoading(true);
    try {
      const pre = await listarPendientesDiscriminaIvaCargaMesAction({ mes: mesUnico, anio });
      if (!pre.ok) {
        toast.error(pre.error ?? "No se pudo verificar el alta del mes.");
        return;
      }
      if (pre.data.pendientesPregunta.length > 0) {
        setPendientesIvaCargaMes(pre.data.pendientesPregunta);
        setIvaCargaMesModalOpen(true);
        return;
      }
      await ejecutarCargaMesDesdeCatalogo();
    } finally {
      setLoading(false);
    }
  }

  function handleConfirmIvaCargaMes(ivaPorGastoFinalId: Record<string, boolean>) {
    void (async () => {
      setLoading(true);
      try {
        await ejecutarCargaMesDesdeCatalogo(ivaPorGastoFinalId);
      } finally {
        setLoading(false);
      }
    })();
  }

  const emptyMessage =
    filas.length > 0 && filasFiltradas.length === 0
      ? "Ningún gasto coincide con los filtros seleccionados."
      : undefined;

  return (
    <div className="area-page-shell">
      <ClassicFilteredTableLayout
        title="Balance"
        subtitle="Gastos"
        contentWidth="full"
        actions={
          esEditor ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => void handleCargarMes()}
                disabled={loading || mesUnico === null}
                title={
                  mesUnico === null
                    ? "Elegí un solo mes para cargar gastos fijos"
                    : undefined
                }
                className="h-10 px-4 gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                )}
                GASTO FIJO
              </Button>
              <Button
                type="button"
                onClick={() => setGastoUnicoOpen(true)}
                disabled={loading}
                className="h-10 px-4 gap-2"
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                GASTO EVENTUAL
              </Button>
            </div>
          ) : undefined
        }
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilterRowSelection className="w-full min-w-0">
              <FilaFiltrosDesplegables>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtSucursal)}
                  onLimpiar={() => setFiltSucursal("")}
                >
                  <Select
                    value={filtSucursal ?? ""}
                    onValueChange={(v) => setFiltSucursal(v)}
                  >
                    <SelectTrigger className="input-filtro-unificado">
                      <SelectValue placeholder="SUCURSAL" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {sucursalesOpciones.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>

                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtProveedor)}
                  onLimpiar={() => setFiltProveedor("")}
                >
                  <Select
                    value={filtProveedor ?? ""}
                    onValueChange={(v) => setFiltProveedor(v)}
                  >
                    <SelectTrigger className="input-filtro-unificado">
                      <SelectValue placeholder="PROVEEDOR" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {proveedoresOpciones.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>

                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtRubro)}
                  onLimpiar={() => setFiltRubro("")}
                >
                  <Select value={filtRubro ?? ""} onValueChange={(v) => setFiltRubro(v)}>
                    <SelectTrigger className="input-filtro-unificado">
                      <SelectValue placeholder="RUBRO" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {rubrosOpciones.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>

                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtGasto)}
                  onLimpiar={() => setFiltGasto("")}
                >
                  <Select value={filtGasto ?? ""} onValueChange={(v) => setFiltGasto(v)}>
                    <SelectTrigger className="input-filtro-unificado">
                      <SelectValue placeholder="GASTO" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {gastosOpciones.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>

                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtEstado)}
                  onLimpiar={() => setFiltEstado("")}
                >
                  <Select
                    value={filtEstado ?? ""}
                    onValueChange={(v) => setFiltEstado(v as FiltroEstadoBalanceGastos)}
                  >
                    <SelectTrigger className="input-filtro-unificado" aria-label="Estado (monto / pagado)">
                      <SelectValue placeholder="ESTADO" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      <SelectItem value="con_monto_con_pago">CON MONTO Y PAGADO</SelectItem>
                      <SelectItem value="con_monto_sin_pago">CON MONTO Y PENDIENTE</SelectItem>
                      <SelectItem value="sin_monto">SIN MONTO</SelectItem>
                      <SelectItem value="sin_monto_o_pendiente">SIN MONTO O PENDIENTE</SelectItem>
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
              </FilaFiltrosDesplegables>
            </FilterRowSelection>

            <FilterRowSelection className="w-full min-w-0">
              <FilaFiltrosDesplegables>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={anio !== anioHoy}
                  onLimpiar={() => navegarPeriodo(meses, anioHoy)}
                >
                  <Select value={String(anio)} onValueChange={onCambioAnio}>
                    <SelectTrigger className="input-filtro-unificado" aria-label="Año del periodo">
                      <SelectValue placeholder="AÑO" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {ANIOS_FILTRO_BALANCE_GASTOS.map((a) => (
                        <SelectItem key={a} value={String(a)}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>

                <FiltroIndividualContainer
                  className={cn(FILTER_SELECT_WRAPPER_CLASS, "relative")}
                  activo={mesesFiltroActivo}
                  onLimpiar={() => navegarPeriodo([], anio)}
                >
                  <div className="relative" ref={mesesMultiRef}>
                    <button
                      type="button"
                      onClick={() =>
                        setMesesOpen((o) => {
                          const next = !o;
                          if (!next) setMesesQuery("");
                          return next;
                        })
                      }
                      className={cn(
                        SELECT_TRIGGER_FILTER_CLASS,
                        "flex w-full items-center justify-between gap-2 text-left font-semibold"
                      )}
                      aria-expanded={mesesOpen}
                      aria-haspopup="listbox"
                      aria-label="Mes del periodo (selección múltiple)"
                    >
                      <span
                        className={cn(
                          "truncate",
                          meses.length === 0 && "text-muted-foreground"
                        )}
                      >
                        {labelMeses}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                    </button>
                    {mesesOpen ? (
                      <div
                        className="absolute top-full left-0 z-50 mt-1 flex max-h-72 min-w-full flex-col overflow-hidden rounded-md border border-border bg-popover shadow-md"
                        role="listbox"
                        aria-multiselectable="true"
                      >
                        <div className="shrink-0 border-b border-border p-1">
                          <SelectSearchInput
                            value={mesesQuery}
                            onValueChange={setMesesQuery}
                            autoFocus
                          />
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto p-1">
                          {mesesFiltrados.length === 0 ? (
                            <p className="px-2 py-1.5 text-sm text-muted-foreground" role="status">
                              SIN RESULTADOS
                            </p>
                          ) : (
                            mesesFiltrados.map((m) => {
                              const selected = meses.includes(m.valor);
                              return (
                                <label
                                  key={m.valor}
                                  role="option"
                                  aria-selected={selected}
                                  className={cn(
                                    "flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm font-medium hover:bg-muted",
                                    selected && "bg-muted"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() => toggleMes(m.valor)}
                                    className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
                                    aria-label={m.etiqueta}
                                  />
                                  <span>{m.etiqueta}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </FiltroIndividualContainer>

                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtTipo)}
                  onLimpiar={() => setFiltTipo("")}
                >
                  <Select
                    value={filtTipo ?? ""}
                    onValueChange={(v) => setFiltTipo(v as FiltroTipoBalanceGastos)}
                  >
                    <SelectTrigger className="input-filtro-unificado" aria-label="Tipo de gasto (mensual / eventual)">
                      <SelectValue placeholder="TIPO" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      <SelectItem value="mensual">MENSUAL</SelectItem>
                      <SelectItem value="eventual">EVENTUAL</SelectItem>
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
        <TablaGastos
          filas={filasFiltradas}
          emptyMessage={emptyMessage}
          esEditor={esEditor}
          onRegistrarMontoPago={(f) => setFilaRegistrarMontoPago(f)}
          onEliminar={(f) =>
            setEliminar({
              id: f.id,
              etiqueta: `${f.gastoNombre} · ${f.proveedorNombre}`,
            })
          }
          onVerHistorico={(f) => {
            setHistoricoGastoFinalId(f.gastoFinalId);
            setHistoricoOpen(true);
          }}
        />
      </ClassicFilteredTableLayout>

      <RegistrarMontoPagoFinBalGastoMensualModal
        open={filaRegistrarMontoPago !== null}
        onOpenChange={(next) => !next && setFilaRegistrarMontoPago(null)}
        fila={filaRegistrarMontoPago}
        mes={filaRegistrarMontoPago?.mes ?? mesParaAlta}
        anio={filaRegistrarMontoPago?.anio ?? anio}
        onSuccess={() => router.refresh()}
      />

      <EliminarFinBalGastoMensualModal
        open={eliminar !== null}
        onOpenChange={(next) => !next && setEliminar(null)}
        id={eliminar?.id ?? null}
        etiqueta={eliminar?.etiqueta ?? null}
        onSuccess={() => router.refresh()}
      />

      <GastoUnicoBalanceModal
        open={gastoUnicoOpen}
        onOpenChange={setGastoUnicoOpen}
        mes={mesParaAlta}
        anio={anio}
        sucursalesCentroCosto={sucursalesCentroCosto}
        onSuccess={() => router.refresh()}
      />

      <IvaDiscriminaCargaMesModal
        open={ivaCargaMesModalOpen}
        onOpenChange={setIvaCargaMesModalOpen}
        items={pendientesIvaCargaMes}
        onConfirm={handleConfirmIvaCargaMes}
      />

      <BalanceMensualGastoHistoricoModal
        key={historicoGastoFinalId ?? "sin-gasto"}
        open={historicoOpen}
        onOpenChange={(open) => {
          setHistoricoOpen(open);
          if (!open) {
            setHistoricoGastoFinalId(null);
          }
        }}
        gastoFinalId={historicoGastoFinalId}
      />
    </div>
  );
}
