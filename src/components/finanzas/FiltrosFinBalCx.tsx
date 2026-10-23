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
import { hrefCxMercVend } from "@/lib/balCxMercVend";
import type { OpcionFiltroCxMercVend } from "@/services/balCxMercaderia.service";

export interface FiltrosBalCxValores {
  periodo: string;
  /** Rubro (Cx Merc. Vend.) o forma de pago (Cx Fin Cobros). */
  grupo: string;
  sucursal: string;
  q: string;
}

interface Props {
  /** Prefijo de ids y de la clave de foco (`cx-merc-vend`, `cx-fin-cobros`). */
  idPrefijo: string;
  /** Vista por sucursal: muestra todos los meses, FECHA no aplica. */
  fechaDeshabilitada: boolean;
  periodos: OpcionFiltroCxMercVend[];
  sucursales: OpcionFiltroCxMercVend[];
  grupo: {
    /** Placeholder / opción "todos" (`RUBRO`, `FORMA DE PAGO`). */
    placeholder: string;
    ariaLabel: string;
    opciones: OpcionFiltroCxMercVend[];
  };
  placeholderBusqueda: string;
  periodoDefault: string;
  actual: FiltrosBalCxValores;
  /** Query params (sin `pagina`) de la vista actual para esos filtros. */
  armarParams: (f: FiltrosBalCxValores) => Record<string, string>;
}

/** Filtros FECHA / agrupador / SUC / búsqueda de Finanzas · Balance · Cx Merc. Vend. y Cx Fin Cobros. */
export default function FiltrosFinBalCx({
  idPrefijo,
  fechaDeshabilitada,
  periodos,
  sucursales,
  grupo,
  placeholderBusqueda,
  periodoDefault,
  actual,
  armarParams,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const { q, setQ, ref: inputRef, handleQChange, isDebouncing, prepareNavigate } =
    useFiltrosConBusqueda({
      qActual: actual.q,
      debounceMs: 700,
      focusStorageKey: `filtros-fin-bal-${idPrefijo}-focus`,
      onDebouncedSearch: (value) => {
        prepareNavigate();
        navigate({ q: value });
      },
    });

  function navigate(updates: Partial<FiltrosBalCxValores>) {
    router.push(hrefCxMercVend(pathname, armarParams({ ...actual, q, ...updates })));
  }

  function limpiarFiltros() {
    setQ("");
    router.push(
      hrefCxMercVend(
        pathname,
        armarParams({ periodo: periodoDefault, grupo: "", sucursal: "", q: "" })
      )
    );
  }

  return (
    <FilterBar className="filtros-contenedor-tienda bg-card">
      <FilterRowSelection>
        <FilaFiltrosDesplegables>
          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={!fechaDeshabilitada && actual.periodo !== periodoDefault}
            onLimpiar={() => navigate({ periodo: periodoDefault })}
          >
            <Select
              value={actual.periodo}
              onValueChange={(v) => navigate({ periodo: v })}
              disabled={fechaDeshabilitada}
            >
              <SelectTrigger
                id={`filtro-${idPrefijo}-fecha`}
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
            activo={Boolean(actual.grupo)}
            onLimpiar={() => navigate({ grupo: "" })}
          >
            <Select
              value={actual.grupo || "todos"}
              onValueChange={(v) => navigate({ grupo: v === "todos" ? "" : v })}
            >
              <SelectTrigger
                id={`filtro-${idPrefijo}-grupo`}
                className={SELECT_TRIGGER_FILTER_CLASS}
                aria-label={grupo.ariaLabel}
              >
                <SelectValue placeholder={grupo.placeholder} />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro max-h-60"
              >
                <SelectItem value="todos">{grupo.placeholder}</SelectItem>
                {grupo.opciones.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>
          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={Boolean(actual.sucursal)}
            onLimpiar={() => navigate({ sucursal: "" })}
          >
            <Select
              value={actual.sucursal || "todos"}
              onValueChange={(v) => navigate({ sucursal: v === "todos" ? "" : v })}
            >
              <SelectTrigger
                id={`filtro-${idPrefijo}-sucursal`}
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
            id={`filtro-${idPrefijo}-busqueda`}
            placeholder={placeholderBusqueda}
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
