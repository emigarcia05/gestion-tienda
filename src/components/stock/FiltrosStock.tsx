"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FilterBar, {
  FiltroIndividualContainer,
  FilterRowSelection,
  FilterRowSearch,
  FilaFiltrosDesplegables,
  FILTER_SELECT_WRAPPER_CLASS,
  FILTER_COUNT_CLASS,
  LimpiarFiltrosButton,
} from "@/components/FilterBar";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import { cn } from "@/lib/utils";
import type { ControlStockData, Sucursal } from "@/actions/stock";

interface Props {
  data: ControlStockData;
  sucursalActual: Sucursal | null;
  qActual: string;
  marcaActual: string;
  rubroActual: string;
  soloNegativoActual: boolean;
  ordenActual: string;
  totalItems: number;
}

export default function FiltrosStock({
  data,
  sucursalActual,
  qActual,
  marcaActual,
  rubroActual,
  soloNegativoActual,
  ordenActual,
  totalItems,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const {
    q,
    setQ,
    ref: inputRef,
    handleQChange,
    isDebouncing,
  } = useFiltrosConBusqueda({
    qActual,
    debounceMs: 700,
    onDebouncedSearch: (value) => navigate({ q: value }),
  });

  function buildParams(updates: {
    q?: string;
    marca?: string;
    rubro?: string;
    soloNegativo?: boolean;
    orden?: string;
  }): URLSearchParams {
    const p = new URLSearchParams();
    const qVal = updates.q !== undefined ? updates.q : q;
    const marcaVal = updates.marca !== undefined ? updates.marca : marcaActual;
    const rubroVal = updates.rubro !== undefined ? updates.rubro : rubroActual;
    const soloVal =
      updates.soloNegativo !== undefined
        ? updates.soloNegativo
        : soloNegativoActual;
    const ordenVal = updates.orden !== undefined ? updates.orden : ordenActual;

    if (sucursalActual) p.set("sucursal", sucursalActual);
    if (qVal) p.set("q", qVal);
    if (marcaVal) p.set("marca", marcaVal);
    if (rubroVal) p.set("rubro", rubroVal);
    if (soloVal) p.set("soloNegativo", "true");
    if (ordenVal) p.set("orden", ordenVal);
    return p;
  }

  function navigate(updates: {
    q?: string;
    marca?: string;
    rubro?: string;
    soloNegativo?: boolean;
    orden?: string;
  }) {
    const p = buildParams(updates);
    const query = p.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function handleMarca(value: string) {
    navigate({ marca: value, rubro: "" });
  }
  function handleRubro(value: string) {
    navigate({ rubro: value });
  }
  function handleSoloNegativo(value: string) {
    navigate({ soloNegativo: value === "negativo" });
  }

  function handleOrden(value: string) {
    navigate({ orden: value });
  }

  function limpiarFiltros() {
    setQ("");
    if (sucursalActual) {
      router.push(`${pathname}?sucursal=${sucursalActual}`);
    } else {
      router.push(pathname);
    }
  }

  const sucursalSeleccionada = sucursalActual !== null;

  return (
    <FilterBar className="filtros-contenedor-tienda bg-card">
      <FilterRowSelection>
        <FilaFiltrosDesplegables columnas={4}>
          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={Boolean(marcaActual)}
            onLimpiar={() => handleMarca("")}
          >
            <Select
              value={marcaActual ?? ""}
              onValueChange={(v) => handleMarca(v)}
              disabled={!sucursalSeleccionada}
            >
              <SelectTrigger
                id="filtro-stock-marca"
                className="input-filtro-unificado"
              >
                <SelectValue placeholder="MARCA" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                {data.marcas.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>
          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={Boolean(rubroActual)}
            onLimpiar={() => handleRubro("")}
          >
            <Select
              value={rubroActual ?? ""}
              onValueChange={(v) => handleRubro(v)}
              disabled={!sucursalSeleccionada}
            >
              <SelectTrigger
                id="filtro-stock-rubro"
                className="input-filtro-unificado"
              >
                <SelectValue placeholder="RUBRO" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                {data.rubros.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>
          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={soloNegativoActual}
            onLimpiar={() => handleSoloNegativo("")}
          >
            <Select
              value={soloNegativoActual ? "negativo" : undefined}
              onValueChange={handleSoloNegativo}
              disabled={!sucursalSeleccionada}
            >
              <SelectTrigger
                id="filtro-stock-estado"
                className="input-filtro-unificado"
              >
                <SelectValue placeholder="STOCK" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                <SelectItem value="negativo">STOCK NEGATIVO</SelectItem>
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>
          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={ordenActual === "segunTiempoControl"}
            onLimpiar={() => handleOrden("")}
          >
            <Select
              value={ordenActual || ""}
              onValueChange={(v) => handleOrden(v)}
              disabled={!sucursalSeleccionada}
            >
              <SelectTrigger
                id="filtro-stock-orden"
                className="input-filtro-unificado"
              >
                <SelectValue placeholder="ORDEN" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                <SelectItem value="segunTiempoControl">
                  SEGUN TIEMPO CONTROL
                </SelectItem>
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>
        </FilaFiltrosDesplegables>
      </FilterRowSelection>
      <div className="flex items-center gap-3">
        <FilterRowSearch className="flex-1">
          <FiltroBusquedaInput
            id="filtro-stock-busqueda"
            placeholder="BUSCAR POR DESCRIPCIÓN O CÓDIGO..."
            value={q}
            onChange={handleQChange}
            isDebouncing={isDebouncing}
            inputRef={inputRef}
            disabled={!sucursalSeleccionada}
          />
        </FilterRowSearch>
        <LimpiarFiltrosButton onClick={limpiarFiltros} />
        <span className={cn(FILTER_COUNT_CLASS, "ml-auto")}>
          {totalItems.toLocaleString("es-AR")} ÍTEM
          {totalItems !== 1 ? "S" : ""}
        </span>
      </div>
    </FilterBar>
  );
}
