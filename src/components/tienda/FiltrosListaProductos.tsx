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

const FOCUS_KEY = "filtros-lista-productos-focus";

interface Props {
  marcas: { id: string; nombre: string }[];
  rubros: string[];
  qActual: string;
  marcaActual: string;
  rubroActual: string;
}

export default function FiltrosListaProductos({
  marcas,
  rubros,
  qActual,
  marcaActual,
  rubroActual,
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

  function navigate(updates: { q?: string; marca?: string; rubro?: string }) {
    const p = new URLSearchParams();
    const qVal = updates.q ?? q;
    const marcaVal = updates.marca ?? marcaActual;
    const rubroVal = updates.rubro ?? rubroActual;
    if (qVal) p.set("q", qVal);
    if (marcaVal) p.set("marca", marcaVal);
    if (rubroVal) p.set("rubro", rubroVal);
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
            <Select value={marcaActual ?? ""} onValueChange={(v) => navigate({ marca: v })}>
              <SelectTrigger id="filtro-lista-productos-marca" className="input-filtro-unificado">
                <SelectValue placeholder="MARCA" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
                {marcas.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nombre}
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
            <Select value={rubroActual ?? ""} onValueChange={(v) => navigate({ rubro: v })}>
              <SelectTrigger id="filtro-lista-productos-rubro" className="input-filtro-unificado">
                <SelectValue placeholder="RUBRO" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
                {rubros.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
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
            id="filtro-lista-productos-busqueda"
            placeholder="BUSCAR POR DESCRIPCIÓN, CÓDIGO O MARCA..."
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
