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
const FOCUS_KEY = "filtros-tienda-focus";

type ProveedorFiltro = { id: string; nombre: string; prefijo: string };

interface Props {
  marcas: string[];
  rubros: string[];
  /** Solo si `modoFiltroTercero` = `subRubro` (p. ej. Px Listas). */
  subRubros?: string[];
  proveedores: ProveedorFiltro[];
  qActual: string;
  marcaActual: string;
  rubroActual: string;
  subRubroActual?: string;
  /** Solo si `modoFiltroTercero` = `cxCompra` (Cx Compra). */
  proveedoresCxCompra?: ProveedorFiltro[];
  cxCompraActual?: string;
  proveedorActual: string;
  vinculadoActual: string;
  /** Cx Compra: tercer desplegable = CX COMPRA; por defecto SUB-RUBRO. */
  modoFiltroTercero?: "subRubro" | "cxCompra";
}

export default function FiltrosTienda({
  marcas,
  rubros,
  subRubros = [],
  proveedores,
  qActual,
  marcaActual,
  rubroActual,
  subRubroActual = "",
  proveedoresCxCompra = [],
  cxCompraActual = "",
  proveedorActual,
  vinculadoActual,
  modoFiltroTercero = "subRubro",
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const usaCxCompra = modoFiltroTercero === "cxCompra";

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
    cxCompra?: string;
    proveedor?: string;
    vinculado?: string;
  }) {
    const p = new URLSearchParams();
    const qVal = updates.q !== undefined ? updates.q : q;
    const marcaVal = updates.marca !== undefined ? updates.marca : marcaActual;
    const rubroVal = updates.rubro !== undefined ? updates.rubro : rubroActual;
    const subRubroVal =
      updates.subRubro !== undefined ? updates.subRubro : subRubroActual;
    const cxCompraVal =
      updates.cxCompra !== undefined ? updates.cxCompra : cxCompraActual;
    const proveedorVal =
      updates.proveedor !== undefined ? updates.proveedor : proveedorActual;
    const vincVal =
      updates.vinculado !== undefined ? updates.vinculado : vinculadoActual;
    if (qVal) p.set("q", qVal);
    if (marcaVal) p.set("marca", marcaVal);
    if (rubroVal) p.set("rubro", rubroVal);
    if (usaCxCompra) {
      if (cxCompraVal) p.set("cxCompra", cxCompraVal);
    } else if (subRubroVal) {
      p.set("subRubro", subRubroVal);
    }
    if (proveedorVal) p.set("proveedor", proveedorVal);
    if (vincVal) p.set("vinculado", vincVal);
    const query = p.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function handleMarca(value: string) {
    navigate(
      usaCxCompra
        ? { marca: value, rubro: "", cxCompra: "" }
        : { marca: value, rubro: "", subRubro: "" }
    );
  }
  function handleRubro(value: string) {
    navigate(usaCxCompra ? { rubro: value, cxCompra: "" } : { rubro: value, subRubro: "" });
  }
  function handleSubRubro(value: string) {
    navigate({ subRubro: value });
  }
  function handleCxCompra(value: string) {
    navigate({ cxCompra: value });
  }
  function handleProveedor(value: string) {
    navigate({ proveedor: value });
  }
  function handleVinculado(value: string) {
    navigate({ vinculado: value });
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
                id="filtro-tienda-marca"
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
                id="filtro-tienda-rubro"
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
          {usaCxCompra ? (
            <FiltroIndividualContainer
              className={FILTER_SELECT_WRAPPER_CLASS}
              activo={Boolean(cxCompraActual)}
              onLimpiar={() => handleCxCompra("")}
            >
              <Select
                value={cxCompraActual ?? ""}
                onValueChange={(v) => handleCxCompra(v)}
              >
                <SelectTrigger
                  id="filtro-tienda-cx-compra"
                  className="input-filtro-unificado"
                >
                  <SelectValue placeholder="CX COMPRA" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  {proveedoresCxCompra.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.prefijo ? `[${p.prefijo}] ` : ""}
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FiltroIndividualContainer>
          ) : (
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
                  id="filtro-tienda-subrubro"
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
          )}
          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={Boolean(proveedorActual)}
            onLimpiar={() => handleProveedor("")}
          >
            <Select
              value={proveedorActual ?? ""}
              onValueChange={(v) => handleProveedor(v)}
            >
              <SelectTrigger
                id="filtro-tienda-proveedor"
                className="input-filtro-unificado"
              >
                <SelectValue placeholder="PROV. VINC." />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                {proveedores.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.prefijo ? `[${p.prefijo}] ` : ""}
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>
          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={Boolean(vinculadoActual)}
            onLimpiar={() => handleVinculado("")}
          >
            <Select
              value={vinculadoActual ?? ""}
              onValueChange={(v) => handleVinculado(v)}
            >
              <SelectTrigger
                id="filtro-tienda-vinculado"
                className="input-filtro-unificado"
              >
                <SelectValue placeholder="VINCULADO" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                <SelectItem value="no">NO</SelectItem>
                <SelectItem value="si">SI</SelectItem>
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>
        </FilaFiltrosDesplegables>
      </FilterRowSelection>
      <div className="flex items-center gap-3">
        <FilterRowSearch className="flex-1">
          <FiltroBusquedaInput
            id="filtro-tienda-busqueda"
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
