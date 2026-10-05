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
import type { OpcionFiltroPxVinculado } from "@/lib/pxListasCompetenciaRef";
const FOCUS_KEY = "filtros-px-listas-precios-focus";

interface Props {
  marcas: string[];
  rubros: string[];
  subRubros: string[];
  opcionesPxVinculado: OpcionFiltroPxVinculado[];
  qActual: string;
  marcaActual: string;
  rubroActual: string;
  subRubroActual: string;
  actualizarActual: string;
  pxVinculadoActual: string;
}

export default function FiltrosPxListasPrecios({
  marcas,
  rubros,
  subRubros,
  opcionesPxVinculado,
  qActual,
  marcaActual,
  rubroActual,
  subRubroActual,
  actualizarActual,
  pxVinculadoActual,
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
    subRubro?: string;
    actualizar?: string;
    pxVinculado?: string;
  }) {
    const p = new URLSearchParams();
    const qVal = updates.q !== undefined ? updates.q : q;
    const marcaVal = updates.marca !== undefined ? updates.marca : marcaActual;
    const rubroVal = updates.rubro !== undefined ? updates.rubro : rubroActual;
    const subRubroVal =
      updates.subRubro !== undefined ? updates.subRubro : subRubroActual;
    const actualizarVal =
      updates.actualizar !== undefined ? updates.actualizar : actualizarActual;
    const pxVinculadoVal =
      updates.pxVinculado !== undefined
        ? updates.pxVinculado
        : pxVinculadoActual;
    if (qVal) p.set("q", qVal);
    if (marcaVal) p.set("marca", marcaVal);
    if (rubroVal) p.set("rubro", rubroVal);
    if (subRubroVal) p.set("subRubro", subRubroVal);
    if (actualizarVal) p.set("actualizar", actualizarVal);
    if (pxVinculadoVal) p.set("pxVinculado", pxVinculadoVal);
    const query = p.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function handleMarca(value: string) {
    navigate({ marca: value, rubro: "", subRubro: "" });
  }

  function handleRubro(value: string) {
    navigate({ rubro: value, subRubro: "" });
  }

  function handleSubRubro(value: string) {
    navigate({ subRubro: value });
  }

  function handlePxVinculado(value: string) {
    navigate({ pxVinculado: value });
  }

  function handleActualizar(value: string) {
    navigate({ actualizar: value });
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
            onLimpiar={() => handleMarca("")}
          >
            <Select
              value={marcaActual ?? ""}
              onValueChange={(v) => handleMarca(v)}
            >
              <SelectTrigger
                id="filtro-px-listas-precios-marca"
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
            onLimpiar={() => handleRubro("")}
          >
            <Select
              value={rubroActual ?? ""}
              onValueChange={(v) => handleRubro(v)}
            >
              <SelectTrigger
                id="filtro-px-listas-precios-rubro"
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
            activo={Boolean(subRubroActual)}
            onLimpiar={() => handleSubRubro("")}
          >
            <Select
              value={subRubroActual ?? ""}
              onValueChange={(v) => handleSubRubro(v)}
            >
              <SelectTrigger
                id="filtro-px-listas-precios-subrubro"
                className="input-filtro-unificado"
              >
                <SelectValue placeholder="SUB-RUBRO" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                {subRubros.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>

          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={Boolean(pxVinculadoActual)}
            onLimpiar={() => handlePxVinculado("")}
          >
            <Select
              value={pxVinculadoActual ?? ""}
              onValueChange={(v) => handlePxVinculado(v)}
            >
              <SelectTrigger
                id="filtro-px-listas-precios-px-vinculado"
                className="input-filtro-unificado"
              >
                <SelectValue placeholder="PX VINCULADO" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                {opcionesPxVinculado.map((op) => (
                  <SelectItem
                    key={op.competenciaId}
                    value={op.competenciaId}
                    title={op.nombre}
                  >
                    {op.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>

          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={Boolean(actualizarActual)}
            onLimpiar={() => handleActualizar("")}
          >
            <Select
              value={actualizarActual ?? ""}
              onValueChange={(v) => handleActualizar(v)}
            >
              <SelectTrigger
                id="filtro-px-listas-precios-actualizar"
                className="input-filtro-unificado"
              >
                <SelectValue placeholder="ACTUALIZAR" />
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
            id="filtro-px-listas-precios-busqueda"
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
