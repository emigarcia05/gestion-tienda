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
} from "@/components/FilterBar";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import {
  OPCIONES_FILTRO_PX_PROMEDIO_COMPETENCIA,
  type FiltroPxPromedioCompetencia,
} from "@/lib/pxCompetenciaFiltros";
const FOCUS_KEY = "filtros-px-competencia-focus";

interface Props {
  marcas: string[];
  rubros: string[];
  qActual: string;
  marcaActual: string;
  rubroActual: string;
  filtroPxPromedioActual: FiltroPxPromedioCompetencia;
}

export default function FiltrosPxCompetencia({
  marcas,
  rubros,
  qActual,
  marcaActual,
  rubroActual,
  filtroPxPromedioActual,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const {
    q,
    setQ,
    ref: inputRef,
    handleQChange,
    isDebouncing,
    prepareNavigate,
  } = useFiltrosConBusqueda({
    qActual,
    debounceMs: 700,
    focusStorageKey: FOCUS_KEY,
    onDebouncedSearch: (value) => {
      prepareNavigate();
      navigate({ q: value });
    },
  });


  function navigate(updates: {
    q?: string;
    marca?: string;
    rubro?: string;
    filtroPxPromedio?: FiltroPxPromedioCompetencia;
  }) {
    const p = new URLSearchParams();
    const qVal = updates.q !== undefined ? updates.q : q;
    const marcaVal = updates.marca !== undefined ? updates.marca : marcaActual;
    const rubroVal = updates.rubro !== undefined ? updates.rubro : rubroActual;
    const filtroPxPromedioVal =
      updates.filtroPxPromedio !== undefined
        ? updates.filtroPxPromedio
        : filtroPxPromedioActual;
    if (qVal) p.set("q", qVal);
    if (marcaVal) p.set("marca", marcaVal);
    if (rubroVal) p.set("rubro", rubroVal);
    if (filtroPxPromedioVal) p.set("filtroPxPromedio", filtroPxPromedioVal);
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
            activo={Boolean(marcaActual)}
            onLimpiar={() => navigate({ marca: "" })}
          >
            <Select
              value={marcaActual ?? ""}
              onValueChange={(v) => navigate({ marca: v, rubro: "" })}
            >
              <SelectTrigger
                id="filtro-px-listas-marca"
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
                {marcas.map((m) => (
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
            onLimpiar={() => navigate({ rubro: "" })}
          >
            <Select
              value={rubroActual ?? ""}
              onValueChange={(v) => navigate({ rubro: v })}
            >
              <SelectTrigger
                id="filtro-px-listas-rubro"
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
                {rubros.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>
          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={Boolean(filtroPxPromedioActual)}
            onLimpiar={() => navigate({ filtroPxPromedio: "" })}
          >
            <Select
              value={filtroPxPromedioActual ?? ""}
              onValueChange={(v) =>
                navigate({ filtroPxPromedio: v as FiltroPxPromedioCompetencia })
              }
            >
              <SelectTrigger
                id="filtro-px-listas-px-promedio"
                className="input-filtro-unificado"
              >
                <SelectValue placeholder="PX PROMEDIO" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                {OPCIONES_FILTRO_PX_PROMEDIO_COMPETENCIA.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
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
            id="filtro-px-listas-busqueda"
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
