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
const FOCUS_KEY = "filtros-reposicion-corp-focus";

interface Props {
  marcas: string[];
  rubros: string[];
  qActual: string;
  marcaActual: string;
  rubroActual: string;
  configuradoActual: "" | "si";
}

export default function FiltrosReposicionCorp({
  marcas,
  rubros,
  qActual,
  marcaActual,
  rubroActual,
  configuradoActual,
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
    q?: string;
    marca?: string;
    rubro?: string;
    configurado?: "" | "si";
  }) {
    const p = new URLSearchParams();
    const qVal = updates.q !== undefined ? updates.q : q;
    const marcaVal = updates.marca !== undefined ? updates.marca : marcaActual;
    const rubroVal = updates.rubro !== undefined ? updates.rubro : rubroActual;
    const confVal =
      updates.configurado !== undefined ? updates.configurado : configuradoActual;
    if (qVal) p.set("q", qVal);
    if (marcaVal) p.set("marca", marcaVal);
    if (rubroVal) p.set("rubro", rubroVal);
    if (confVal) p.set("configurado", confVal);
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
            onLimpiar={() => navigate({ marca: "", rubro: "" })}
          >
            <Select value={marcaActual || "todos"} onValueChange={(v) => navigate({ marca: v === "todos" ? "" : v, rubro: "" })}>
              <SelectTrigger id="filtro-reposicion-corp-marca" className={SELECT_TRIGGER_FILTER_CLASS}>
                <SelectValue placeholder="MARCA" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
                <SelectItem value="todos">MARCA</SelectItem>
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
            <Select value={rubroActual || "todos"} onValueChange={(v) => navigate({ rubro: v === "todos" ? "" : v })}>
              <SelectTrigger id="filtro-reposicion-corp-rubro" className={SELECT_TRIGGER_FILTER_CLASS}>
                <SelectValue placeholder="RUBRO" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
                <SelectItem value="todos">RUBRO</SelectItem>
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
            activo={configuradoActual === "si"}
            onLimpiar={() => navigate({ configurado: "" })}
          >
            <Select
              value={configuradoActual || "todos"}
              onValueChange={(v) => navigate({ configurado: v === "si" ? "si" : "" })}
            >
              <SelectTrigger id="filtro-reposicion-corp-configurado" className={SELECT_TRIGGER_FILTER_CLASS}>
                <SelectValue placeholder="CONFIGURADO" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
                <SelectItem value="todos">CONFIGURADO</SelectItem>
                <SelectItem value="si">SÍ</SelectItem>
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>
        </FilaFiltrosDesplegables>
      </FilterRowSelection>
      <div className="flex items-center gap-3">
        <FilterRowSearch className="flex-1">
          <FiltroBusquedaInput
            id="filtro-reposicion-corp-busqueda"
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
