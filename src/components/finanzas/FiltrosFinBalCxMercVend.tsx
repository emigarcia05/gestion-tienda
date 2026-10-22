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
  LimpiarFiltrosButton,
  SELECT_TRIGGER_FILTER_CLASS,
} from "@/components/FilterBar";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import type { OpcionFiltroCxMercVend } from "@/services/balCxMercaderia.service";

const FOCUS_KEY = "filtros-fin-bal-cx-merc-vend-focus";

interface Props {
  periodos: OpcionFiltroCxMercVend[];
  rubros: OpcionFiltroCxMercVend[];
  sucursales: OpcionFiltroCxMercVend[];
  periodoDefault: string;
  periodoActual: string;
  rubroActual: string;
  sucursalActual: string;
  qActual: string;
}

export default function FiltrosFinBalCxMercVend({
  periodos,
  rubros,
  sucursales,
  periodoDefault,
  periodoActual,
  rubroActual,
  sucursalActual,
  qActual,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const { q, setQ, ref: inputRef, handleQChange, isDebouncing, prepareNavigate } =
    useFiltrosConBusqueda({
      qActual,
      debounceMs: 700,
      focusStorageKey: FOCUS_KEY,
      onDebouncedSearch: (value) => {
        prepareNavigate();
        navigate({ q: value });
      },
    });

  function navigate(updates: {
    periodo?: string;
    rubro?: string;
    sucursal?: string;
    q?: string;
  }) {
    const p = new URLSearchParams();
    const periodoVal = updates.periodo !== undefined ? updates.periodo : periodoActual;
    const rubroVal = updates.rubro !== undefined ? updates.rubro : rubroActual;
    const sucursalVal = updates.sucursal !== undefined ? updates.sucursal : sucursalActual;
    const qVal = updates.q !== undefined ? updates.q : q;
    if (periodoVal && periodoVal !== periodoDefault) p.set("periodo", periodoVal);
    if (rubroVal) p.set("rubro", rubroVal);
    if (sucursalVal) p.set("sucursal", sucursalVal);
    if (qVal) p.set("q", qVal);
    const query = p.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function limpiarFiltros() {
    setQ("");
    router.push(pathname);
  }

  return (
    <FilterBar className="filtros-contenedor-tienda bg-card">
      <FilterRowSelection>
        <FilaFiltrosDesplegables>
          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={periodoActual !== periodoDefault}
            onLimpiar={() => navigate({ periodo: periodoDefault })}
          >
            <Select value={periodoActual} onValueChange={(v) => navigate({ periodo: v })}>
              <SelectTrigger
                id="filtro-cx-merc-vend-fecha"
                className={SELECT_TRIGGER_FILTER_CLASS}
                aria-label="Fecha"
              >
                <SelectValue placeholder="FECHA" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro max-h-60"
              >
                {periodos.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>
          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={Boolean(rubroActual)}
            onLimpiar={() => navigate({ rubro: "" })}
          >
            <Select
              value={rubroActual || "todos"}
              onValueChange={(v) => navigate({ rubro: v === "todos" ? "" : v })}
            >
              <SelectTrigger
                id="filtro-cx-merc-vend-rubro"
                className={SELECT_TRIGGER_FILTER_CLASS}
                aria-label="Rubro"
              >
                <SelectValue placeholder="RUBRO" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro max-h-60"
              >
                <SelectItem value="todos">RUBRO</SelectItem>
                {rubros.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>
          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={Boolean(sucursalActual)}
            onLimpiar={() => navigate({ sucursal: "" })}
          >
            <Select
              value={sucursalActual || "todos"}
              onValueChange={(v) => navigate({ sucursal: v === "todos" ? "" : v })}
            >
              <SelectTrigger
                id="filtro-cx-merc-vend-sucursal"
                className={SELECT_TRIGGER_FILTER_CLASS}
                aria-label="Sucursal"
              >
                <SelectValue placeholder="SUC" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                <SelectItem value="todos">SUC</SelectItem>
                {sucursales.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>
        </FilaFiltrosDesplegables>
      </FilterRowSelection>
      <div className="flex items-center gap-3">
        <FilterRowSearch className="flex-1">
          <FiltroBusquedaInput
            id="filtro-cx-merc-vend-busqueda"
            placeholder="BUSCAR POR DESCRIPCIÓN O CÓDIGO..."
            value={q}
            onChange={handleQChange}
            isDebouncing={isDebouncing}
            inputRef={inputRef}
          />
        </FilterRowSearch>
        <LimpiarFiltrosButton onClick={limpiarFiltros} />
      </div>
    </FilterBar>
  );
}
