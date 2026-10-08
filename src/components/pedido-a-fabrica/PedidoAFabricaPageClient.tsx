"use client";

import { useEffect, useRef, useState, startTransition } from "react";
import { CalendarDays, Info } from "lucide-react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FilterBar, {
  FilaFiltrosDesplegables,
  FilterRowSearch,
  FilterRowSelection,
  FiltroIndividualContainer,
  FILTER_SELECT_WRAPPER_CLASS,
  INPUT_FILTER_CLASS,
  LimpiarFiltrosButton,
  SELECT_TRIGGER_FILTER_CLASS,
} from "@/components/FilterBar";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import { cn } from "@/lib/utils";
import {
  dateToIsoYmdArgentina,
  formatIsoYmdDdMmYyyyArgentina,
  maskDigitsToDdMmYyyyDisplay,
  parseDdMmYyyyToIsoYmdArgentina,
} from "@/lib/fechaArgentina";
import { getProductosPedidoAFabricaAction, upsertPedidoAFabricaItemAction } from "@/actions/pedidoAFabrica";
import type {
  ProductoPedidoAFabricaItem,
  SucursalPedidoAFabrica,
} from "@/services/pedidoAFabrica.service";
import type { ReposicionFormaPedidoFabrica } from "@/lib/validations/reposicion";
import TablaPedidoAFabrica, {
  type FiltroSiNoPedidoAFabrica,
} from "@/components/pedido-a-fabrica/TablaPedidoAFabrica";
import InfoPromedioPedidoAFabricaModal from "@/components/pedido-a-fabrica/InfoPromedioPedidoAFabricaModal";
import GenerarPedidoToolbarButton from "@/components/pedidos/GenerarPedidoToolbarButton";
import type { SucursalPedido } from "@/lib/pedidos";
import { toast } from "sonner";

export type ProveedorFabricaOption = {
  id: string;
  nombre: string;
  prefijo: string;
  /** `proveedores.tiempo_entrega_en_dias` (nullable). */
  tiempoEntregaEnDias: number | null;
};

interface Props {
  proveedoresFabrica: ProveedorFabricaOption[];
  sucursalesPedido: SucursalPedidoAFabrica[];
}

const FILTRO_TODOS = "none";
const DEBOUNCE_BUSQUEDA_MS = 350;
const DEBOUNCE_CANT_PEDIR_MS = 400;

function codigoASucursalPedido(codigo: string): SucursalPedido | "" {
  const c = codigo.trim().toLowerCase();
  if (c === "guaymallen" || c === "maipu") return c;
  return "";
}

/** Solo dígitos (enteros ≥ 0); vacío permitido. */
function sanitizeTiempoStockeoInput(raw: string): string {
  return raw.replace(/\D/g, "");
}

function abrirSelectorFechaPedidoNativo(el: HTMLInputElement | null) {
  if (!el) return;
  try {
    void el.showPicker?.();
  } catch {
    el.click();
  }
}

/**
 * Módulo **Pedido A Fáb.** (pilar sidebar Administración).
 * Filtros 1: **PROVEEDOR** + **FECHA DE PEDIDO** + **TIEMPO STOCKEO** (días calendario) + **PROD. VINCULADO** + **STOCK QUEBRADO**.
 * Filtros 2: **MARCA** | **RUBRO** | **SUB-RUBRO** | **PEDIDO** (SI = CANT. PED. > 0) + buscar por descripción.
 */
export default function PedidoAFabricaPageClient({
  proveedoresFabrica,
  sucursalesPedido,
}: Props) {
  const fechaPedidoPickerRef = useRef<HTMLInputElement>(null);
  const [proveedorId, setProveedorId] = useState<string>("");
  /** Display `dd/mm/aaaa` del filtro **FECHA DE PEDIDO** (vacío = sin valor). */
  const [fechaPedidoDdMm, setFechaPedidoDdMm] = useState<string>("");
  const [tiempoStockeo, setTiempoStockeo] = useState<string>("");
  const [prodVinculado, setProdVinculado] =
    useState<FiltroSiNoPedidoAFabrica>("");
  const [stockQuebrado, setStockQuebrado] =
    useState<FiltroSiNoPedidoAFabrica>("");
  const [pedido, setPedido] = useState<FiltroSiNoPedidoAFabrica>("");
  const [marca, setMarca] = useState(FILTRO_TODOS);
  const [rubro, setRubro] = useState(FILTRO_TODOS);
  const [subRubro, setSubRubro] = useState(FILTRO_TODOS);
  const [qDebounced, setQDebounced] = useState("");
  const [pagina, setPagina] = useState(1);
  const [sucursales, setSucursales] =
    useState<SucursalPedidoAFabrica[]>(sucursalesPedido);
  const [productos, setProductos] = useState<ProductoPedidoAFabricaItem[]>([]);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [marcas, setMarcas] = useState<string[]>([]);
  const [rubros, setRubros] = useState<string[]>([]);
  const [subRubros, setSubRubros] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [infoPromedioOpen, setInfoPromedioOpen] = useState(false);
  const [cantAPedirByCodExt, setCantAPedirByCodExt] = useState<
    Record<string, string>
  >({});
  const [formaPedirByCodExt, setFormaPedirByCodExt] = useState<
    Record<string, ReposicionFormaPedidoFabrica>
  >({});
  const cantPersistTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  );
  const formaPedirRef = useRef(formaPedirByCodExt);

  useEffect(() => {
    formaPedirRef.current = formaPedirByCodExt;
  }, [formaPedirByCodExt]);

  const {
    q,
    setQ,
    ref: inputBusquedaRef,
    handleQChange,
    isDebouncing,
  } = useFiltrosConBusqueda({
    qActual: qDebounced,
    debounceMs: DEBOUNCE_BUSQUEDA_MS,
    onDebouncedSearch: (value) => {
      setQDebounced(value);
      setPagina(1);
    },
  });

  const proveedorActivo = proveedorId !== "";
  const fechaPedidoIsoParseada = parseDdMmYyyyToIsoYmdArgentina(fechaPedidoDdMm);
  const fechaPedidoActiva = fechaPedidoDdMm !== "";
  const tiempoStockeoActivo = tiempoStockeo !== "";
  const prodVinculadoActivo = prodVinculado !== "";
  const stockQuebradoActivo = stockQuebrado !== "";
  const pedidoActivo = pedido !== "";
  const marcaActiva = marca !== FILTRO_TODOS;
  const rubroActivo = rubro !== FILTRO_TODOS;
  const subRubroActivo = subRubro !== FILTRO_TODOS;

  const proveedorSeleccionado = proveedoresFabrica.find(
    (p) => p.id === proveedorId
  );
  const tiempoEntregaEnDias =
    proveedorSeleccionado?.tiempoEntregaEnDias ?? null;
  const tiempoStockeoNumero =
    tiempoStockeo === "" ? null : Number(tiempoStockeo);
  const tiempoStockeoValor =
    tiempoStockeoNumero != null && Number.isFinite(tiempoStockeoNumero)
      ? tiempoStockeoNumero
      : null;
  const isoPickerFechaPedido =
    fechaPedidoIsoParseada || dateToIsoYmdArgentina(new Date());

  function resetFiltrosCatalogo() {
    setMarca(FILTRO_TODOS);
    setRubro(FILTRO_TODOS);
    setSubRubro(FILTRO_TODOS);
    setPedido("");
    setQ("");
    setQDebounced("");
  }

  function handleProveedorChange(value: string) {
    setProveedorId(value);
    setPagina(1);
    setCantAPedirByCodExt({});
    setFormaPedirByCodExt({});
    resetFiltrosCatalogo();
  }

  function handleLimpiarProveedor() {
    setProveedorId("");
    setPagina(1);
    setProductos([]);
    setTotalPaginas(0);
    setSucursales(sucursalesPedido);
    setMarcas([]);
    setRubros([]);
    setSubRubros([]);
    setCantAPedirByCodExt({});
    setFormaPedirByCodExt({});
    resetFiltrosCatalogo();
  }

  function handleTiempoStockeoChange(raw: string) {
    setTiempoStockeo(sanitizeTiempoStockeoInput(raw));
  }

  function handleFechaPedidoDdMmChange(raw: string) {
    setFechaPedidoDdMm(maskDigitsToDdMmYyyyDisplay(raw));
  }

  function handleLimpiarFechaPedido() {
    setFechaPedidoDdMm("");
  }

  function handleMarcaChange(value: string) {
    setMarca(value);
    setRubro(FILTRO_TODOS);
    setSubRubro(FILTRO_TODOS);
    setPagina(1);
  }

  function handleRubroChange(value: string) {
    setRubro(value);
    setSubRubro(FILTRO_TODOS);
    setPagina(1);
  }

  function handleSubRubroChange(value: string) {
    setSubRubro(value);
    setPagina(1);
  }

  function limpiarFiltrosCatalogo() {
    resetFiltrosCatalogo();
    setPagina(1);
  }

  function persistPedidoAFabrica(
    codExt: string,
    value: string,
    forma: ReposicionFormaPedidoFabrica
  ) {
    const prev = cantPersistTimersRef.current[codExt];
    if (prev) clearTimeout(prev);
    cantPersistTimersRef.current[codExt] = setTimeout(() => {
      void (async () => {
        const cant = value === "" ? 0 : Number(value);
        if (!Number.isFinite(cant) || cant < 0) return;
        const res = await upsertPedidoAFabricaItemAction({
          listaPrecioProveedorId: codExt,
          cant: Math.floor(cant),
          formaPedir: forma,
        });
        if (!res.ok) {
          toast.error(res.error || "No se pudo guardar el pedido a fábrica.");
        }
      })();
    }, DEBOUNCE_CANT_PEDIR_MS);
  }

  function persistCantAPedir(codExt: string, value: string) {
    persistPedidoAFabrica(
      codExt,
      value,
      formaPedirRef.current[codExt] ?? "UNIDADES_FIJAS"
    );
  }

  function handleFormaPedirChange(
    codExt: string,
    forma: ReposicionFormaPedidoFabrica
  ) {
    setFormaPedirByCodExt((prev) => ({ ...prev, [codExt]: forma }));
    const cantRaw = cantAPedirByCodExt[codExt] ?? "";
    persistPedidoAFabrica(codExt, cantRaw, forma);
  }

  function applyCantAPedirLocal(codExt: string, value: string) {
    setCantAPedirByCodExt((prev) => {
      if (value === "") {
        if (!(codExt in prev)) return prev;
        const next = { ...prev };
        delete next[codExt];
        return next;
      }
      return { ...prev, [codExt]: value };
    });
  }

  function handleCantAPedirChange(codExt: string, value: string) {
    applyCantAPedirLocal(codExt, value);
  }

  function handleCantAPedirCommit(codExt: string, value: string) {
    applyCantAPedirLocal(codExt, value);
    persistCantAPedir(codExt, value);
  }

  function handleAplicarCantSugerida(codExt: string, cantSugerida: number) {
    const value = String(cantSugerida);
    applyCantAPedirLocal(codExt, value);
    persistCantAPedir(codExt, value);
  }

  function handleGeneradoPedidoExito() {
    setCantAPedirByCodExt({});
    setFormaPedirByCodExt({});
  }

  useEffect(() => {
    if (!proveedorId) {
      queueMicrotask(() => {
        setProductos([]);
        setTotalPaginas(0);
        setLoading(false);
        setSucursales(sucursalesPedido);
        setMarcas([]);
        setRubros([]);
        setSubRubros([]);
        setCantAPedirByCodExt({});
        setFormaPedirByCodExt({});
      });
      return;
    }

    let cancelled = false;
    queueMicrotask(() => setLoading(true));

    startTransition(() => {
      void (async () => {
        const res = await getProductosPedidoAFabricaAction({
          proveedorId,
          pagina,
          marca: marcaActiva ? marca : undefined,
          rubro: rubroActivo ? rubro : undefined,
          subRubro: subRubroActivo ? subRubro : undefined,
          q: qDebounced.trim() || undefined,
          prodVinculado: prodVinculadoActivo ? prodVinculado : undefined,
          pedido: pedidoActivo ? pedido : undefined,
        });
        if (cancelled) return;
        setSucursales(
          res.sucursales.length > 0 ? res.sucursales : sucursalesPedido
        );
        setProductos(res.productos);
        setTotalPaginas(res.totalPaginas);
        setMarcas(res.marcas);
        setRubros(res.rubros);
        setSubRubros(res.subRubros);
        const nextCant: Record<string, string> = {};
        for (const [cod, n] of Object.entries(res.cantAPedirByCodExt ?? {})) {
          if (n > 0) nextCant[cod] = String(n);
        }
        setCantAPedirByCodExt(nextCant);
        setFormaPedirByCodExt(res.formaPedirByCodExt ?? {});
        setLoading(false);
      })();
    });

    return () => {
      cancelled = true;
    };
  }, [
    proveedorId,
    pagina,
    marca,
    rubro,
    subRubro,
    marcaActiva,
    rubroActivo,
    subRubroActivo,
    qDebounced,
    sucursalesPedido,
    prodVinculado,
    prodVinculadoActivo,
    pedido,
    pedidoActivo,
  ]);

  const defaultSucursalGenerar =
    codigoASucursalPedido(sucursales[0]?.codigo ?? "") ||
    codigoASucursalPedido(sucursalesPedido[0]?.codigo ?? "");

  return (
    <>
      <ClassicFilteredTableLayout
        title="PEDIDO A FÁB."
        subtitle="Pedido A Fáb."
        contentWidth="full"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <GenerarPedidoToolbarButton
              proveedores={
                proveedorSeleccionado
                  ? [
                      {
                        id: proveedorSeleccionado.id,
                        nombre: proveedorSeleccionado.nombre,
                        prefijo: proveedorSeleccionado.prefijo,
                      },
                    ]
                  : []
              }
              defaultSucursal={defaultSucursalGenerar}
              defaultProveedor={proveedorId}
              defaultTipos={["A FÁBRICA"]}
              modulo="a-fabrica"
              triggerClassName="h-10 px-4"
              triggerSize="default"
              onGeneradoExito={handleGeneradoPedidoExito}
            />
            <ToolbarActionButton
              type="button"
              label="Info Formulas"
              icon={<Info aria-hidden />}
              className="h-10 px-4"
              onClick={() => setInfoPromedioOpen(true)}
            />
          </div>
        }
        filters={
          <div className="filtros-doble-bloque-compacto">
            <FilterBar className="filtros-contenedor-tienda bg-card">
              <FilterRowSelection>
                <FilaFiltrosDesplegables columnas={5}>
                  <FiltroIndividualContainer
                    activo={proveedorActivo}
                    onLimpiar={handleLimpiarProveedor}
                  >
                    <Select
                      value={proveedorId ?? ""}
                      onValueChange={handleProveedorChange}
                    >
                      <SelectTrigger
                        className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                        aria-label="PROVEEDOR"
                      >
                        <SelectValue placeholder="PROVEEDOR" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        align="start"
                        className="select-content-filtro"
                      >
                        {proveedoresFabrica.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.prefijo
                              ? `[${p.prefijo}] ${p.nombre}`.toLocaleUpperCase(
                                  "es"
                                )
                              : p.nombre.toLocaleUpperCase("es")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FiltroIndividualContainer>

                  <FiltroIndividualContainer
                    activo={fechaPedidoActiva}
                    onLimpiar={handleLimpiarFechaPedido}
                  >
                    <div className="relative w-full min-w-0">
                      <Input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="FECHA DE PEDIDO"
                        aria-label="FECHA DE PEDIDO"
                        title="FECHA DE PEDIDO — dd/mm/aaaa o ícono de calendario"
                        value={fechaPedidoDdMm}
                        onChange={(e) =>
                          handleFechaPedidoDdMmChange(e.target.value)
                        }
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          abrirSelectorFechaPedidoNativo(
                            fechaPedidoPickerRef.current
                          );
                        }}
                        className={cn(INPUT_FILTER_CLASS, "w-full pr-10")}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-9 w-9 shrink-0 rounded-r-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={(e) => {
                          e.preventDefault();
                          abrirSelectorFechaPedidoNativo(
                            fechaPedidoPickerRef.current
                          );
                        }}
                        aria-label="Abrir calendario para fecha de pedido"
                        title="Abrir calendario"
                      >
                        <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
                      </Button>
                      <input
                        ref={fechaPedidoPickerRef}
                        type="date"
                        tabIndex={-1}
                        aria-hidden
                        className="sr-only"
                        value={isoPickerFechaPedido}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) {
                            setFechaPedidoDdMm(
                              formatIsoYmdDdMmYyyyArgentina(v)
                            );
                          }
                        }}
                      />
                    </div>
                  </FiltroIndividualContainer>

                  <FiltroIndividualContainer
                    activo={tiempoStockeoActivo}
                    onLimpiar={() => setTiempoStockeo("")}
                  >
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="TIEMPO STOCKEO"
                      aria-label="TIEMPO STOCKEO"
                      value={tiempoStockeo}
                      onChange={(e) =>
                        handleTiempoStockeoChange(e.target.value)
                      }
                      className={cn(INPUT_FILTER_CLASS, "w-full")}
                    />
                  </FiltroIndividualContainer>

                  <FiltroIndividualContainer
                    className={FILTER_SELECT_WRAPPER_CLASS}
                    activo={prodVinculadoActivo}
                    onLimpiar={() => {
                      setProdVinculado("");
                      setPagina(1);
                    }}
                  >
                    <Select
                      value={prodVinculado ?? ""}
                      onValueChange={(v) => {
                        setProdVinculado(v as FiltroSiNoPedidoAFabrica);
                        setPagina(1);
                      }}
                    >
                      <SelectTrigger
                        className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                        aria-label="PROD. VINCULADO"
                      >
                        <SelectValue placeholder="PROD. VINCULADO" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        align="start"
                        className="select-content-filtro"
                      >
                        <SelectItem value="si">SI</SelectItem>
                        <SelectItem value="no">NO</SelectItem>
                      </SelectContent>
                    </Select>
                  </FiltroIndividualContainer>

                  <FiltroIndividualContainer
                    className={FILTER_SELECT_WRAPPER_CLASS}
                    activo={stockQuebradoActivo}
                    onLimpiar={() => setStockQuebrado("")}
                  >
                    <Select
                      value={stockQuebrado ?? ""}
                      onValueChange={(v) =>
                        setStockQuebrado(v as FiltroSiNoPedidoAFabrica)
                      }
                    >
                      <SelectTrigger
                        className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                        aria-label="STOCK QUEBRADO"
                      >
                        <SelectValue placeholder="STOCK QUEBRADO" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        align="start"
                        className="select-content-filtro"
                      >
                        <SelectItem value="si">SI</SelectItem>
                        <SelectItem value="no">NO</SelectItem>
                      </SelectContent>
                    </Select>
                  </FiltroIndividualContainer>
                </FilaFiltrosDesplegables>
              </FilterRowSelection>
            </FilterBar>

            <FilterBar className="filtros-contenedor-tienda bg-card">
              <FilterRowSelection>
                <FilaFiltrosDesplegables columnas={5}>
                  <FiltroIndividualContainer
                    className={FILTER_SELECT_WRAPPER_CLASS}
                    activo={marcaActiva}
                    onLimpiar={() => {
                      setMarca(FILTRO_TODOS);
                      setRubro(FILTRO_TODOS);
                      setSubRubro(FILTRO_TODOS);
                      setPagina(1);
                    }}
                  >
                    <Select
                      value={marca}
                      onValueChange={handleMarcaChange}
                      disabled={!proveedorActivo}
                    >
                      <SelectTrigger
                        className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                        aria-label="MARCA"
                      >
                        <SelectValue placeholder="MARCA" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        align="start"
                        className="select-content-filtro"
                      >
                        <SelectItem value={FILTRO_TODOS}>MARCA</SelectItem>
                        {marcas.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m.toLocaleUpperCase("es")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FiltroIndividualContainer>

                  <FiltroIndividualContainer
                    className={FILTER_SELECT_WRAPPER_CLASS}
                    activo={rubroActivo}
                    onLimpiar={() => {
                      setRubro(FILTRO_TODOS);
                      setSubRubro(FILTRO_TODOS);
                      setPagina(1);
                    }}
                  >
                    <Select
                      value={rubro}
                      onValueChange={handleRubroChange}
                      disabled={!proveedorActivo}
                    >
                      <SelectTrigger
                        className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                        aria-label="RUBRO"
                      >
                        <SelectValue placeholder="RUBRO" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        align="start"
                        className="select-content-filtro"
                      >
                        <SelectItem value={FILTRO_TODOS}>RUBRO</SelectItem>
                        {rubros.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r.toLocaleUpperCase("es")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FiltroIndividualContainer>

                  <FiltroIndividualContainer
                    className={FILTER_SELECT_WRAPPER_CLASS}
                    activo={subRubroActivo}
                    onLimpiar={() => {
                      setSubRubro(FILTRO_TODOS);
                      setPagina(1);
                    }}
                  >
                    <Select
                      value={subRubro}
                      onValueChange={handleSubRubroChange}
                      disabled={!proveedorActivo}
                    >
                      <SelectTrigger
                        className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                        aria-label="SUB-RUBRO"
                      >
                        <SelectValue placeholder="SUB-RUBRO" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        align="start"
                        className="select-content-filtro"
                      >
                        <SelectItem value={FILTRO_TODOS}>SUB-RUBRO</SelectItem>
                        {subRubros.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.toLocaleUpperCase("es")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FiltroIndividualContainer>

                  <FiltroIndividualContainer
                    className={FILTER_SELECT_WRAPPER_CLASS}
                    activo={pedidoActivo}
                    onLimpiar={() => {
                      setPedido("");
                      setPagina(1);
                    }}
                  >
                    <Select
                      value={pedido ?? ""}
                      onValueChange={(v) => {
                        setPedido(v as FiltroSiNoPedidoAFabrica);
                        setPagina(1);
                      }}
                      disabled={!proveedorActivo}
                    >
                      <SelectTrigger
                        className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                        aria-label="PEDIDO"
                      >
                        <SelectValue placeholder="PEDIDO" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        align="start"
                        className="select-content-filtro"
                      >
                        <SelectItem value="si">SI</SelectItem>
                        <SelectItem value="no">NO</SelectItem>
                      </SelectContent>
                    </Select>
                  </FiltroIndividualContainer>
                </FilaFiltrosDesplegables>
              </FilterRowSelection>

              <div className="flex items-center gap-3">
                <FilterRowSearch className="flex-1">
                  <FiltroBusquedaInput
                    id="filtro-pedido-a-fabrica-descripcion"
                    placeholder="BUSCAR POR DESCRIPCIÓN..."
                    value={q}
                    onChange={handleQChange}
                    isDebouncing={isDebouncing}
                    inputRef={inputBusquedaRef}
                    disabled={!proveedorActivo}
                  />
                </FilterRowSearch>
                <LimpiarFiltrosButton onClick={limpiarFiltrosCatalogo} />
              </div>
            </FilterBar>
          </div>
        }
      >
        {proveedorActivo ? (
          <TablaPedidoAFabrica
            sucursales={sucursales}
            productos={productos}
            pagina={pagina}
            totalPaginas={totalPaginas}
            onPaginaChange={setPagina}
            loading={loading}
            emptyMessage={
              prodVinculadoActivo || pedidoActivo
                ? `Ningún producto coincide con ${[
                    prodVinculadoActivo ? "PROD. VINCULADO" : null,
                    pedidoActivo ? "PEDIDO" : null,
                  ]
                    .filter((v): v is string => v != null)
                    .join(" / ")}.`
                : "Este proveedor no tiene productos en la lista de precios."
            }
            fechaPedidoIso={fechaPedidoIsoParseada}
            tiempoEntregaEnDias={tiempoEntregaEnDias}
            tiempoStockeo={tiempoStockeoValor}
            filtroProdVinculado={prodVinculado}
            filtroStockQuebrado={stockQuebrado}
            filtroPedido={pedido}
            cantAPedirByCodExt={cantAPedirByCodExt}
            formaPedirByCodExt={formaPedirByCodExt}
            onCantAPedirChange={handleCantAPedirChange}
            onCantAPedirCommit={handleCantAPedirCommit}
            onFormaPedirChange={handleFormaPedirChange}
            onAplicarCantSugerida={handleAplicarCantSugerida}
          />
        ) : (
          <div className="flex min-h-[12rem] flex-1 items-center justify-center rounded-lg border border-border bg-card p-6 shadow-sm">
            <p className="max-w-md text-center text-sm text-muted-foreground">
              Seleccioná un proveedor de fábrica para ver sus productos.
            </p>
          </div>
        )}
      </ClassicFilteredTableLayout>

      <InfoPromedioPedidoAFabricaModal
        open={infoPromedioOpen}
        onOpenChange={setInfoPromedioOpen}
        fechaPedidoIso={fechaPedidoIsoParseada}
        tiempoEntregaEnDias={tiempoEntregaEnDias}
        tiempoStockeo={tiempoStockeoValor}
      />
    </>
  );
}
