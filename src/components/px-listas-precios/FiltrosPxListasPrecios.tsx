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
import type { FinAnaMcCategoriaItem } from "@/lib/finAnaMcCategorias";
import {
  PX_LISTAS_PX_VINCULADO_SIN_VINCULAR,
  type OpcionFiltroPxVinculado,
} from "@/lib/pxListasCompetenciaRef";
const FOCUS_KEY = "filtros-px-listas-precios-focus";

interface Props {
  marcas: string[];
  rubros: string[];
  subRubros: string[];
  opcionesPxVinculado: OpcionFiltroPxVinculado[];
  categoriasMc: FinAnaMcCategoriaItem[];
  qActual: string;
  marcaActual: string;
  rubroActual: string;
  subRubroActual: string;
  catMcActual: string;
  pxVinculadoActual: string;
}

export default function FiltrosPxListasPrecios({
  marcas,
  rubros,
  subRubros,
  opcionesPxVinculado,
  categoriasMc,
  qActual,
  marcaActual,
  rubroActual,
  subRubroActual,
  catMcActual,
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
    catMc?: string;
    pxVinculado?: string;
  }) {
    const p = new URLSearchParams();
    const qVal = updates.q !== undefined ? updates.q : q;
    const marcaVal = updates.marca !== undefined ? updates.marca : marcaActual;
    const rubroVal = updates.rubro !== undefined ? updates.rubro : rubroActual;
    const subRubroVal =
      updates.subRubro !== undefined ? updates.subRubro : subRubroActual;
    const catMcVal = updates.catMc !== undefined ? updates.catMc : catMcActual;
    const pxVinculadoVal =
      updates.pxVinculado !== undefined
        ? updates.pxVinculado
        : pxVinculadoActual;
    if (qVal) p.set("q", qVal);
    if (marcaVal) p.set("marca", marcaVal);
    if (rubroVal) p.set("rubro", rubroVal);
    if (subRubroVal) p.set("subRubro", subRubroVal);
    if (catMcVal) p.set("catMc", catMcVal);
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

  function handleCatMc(value: string) {
    navigate({ catMc: value });
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
            activo={Boolean(catMcActual)}
            onLimpiar={() => handleCatMc("")}
          >
            <Select
              value={catMcActual ?? ""}
              onValueChange={(v) => handleCatMc(v)}
            >
              <SelectTrigger
                id="filtro-px-listas-precios-categoria-mc"
                className="input-filtro-unificado"
              >
                <SelectValue placeholder="CATEGORÍA M.C" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                {[...categoriasMc]
                  .sort((a, b) => a.orden - b.orden || a.desdePct - b.desdePct)
                  .map((cat) => (
                    <SelectItem key={cat.id} value={cat.id} title={cat.categoria}>
                      {cat.categoria}
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
                <SelectItem value={PX_LISTAS_PX_VINCULADO_SIN_VINCULAR}>
                  SIN VINCULAR
                </SelectItem>
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
