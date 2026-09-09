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
  SELECT_TRIGGER_FILTER_CLASS,
  FILTER_COUNT_CLASS,
  LimpiarFiltrosButton,
} from "@/components/FilterBar";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import { cn } from "@/lib/utils";
import type { ReposicionData, SucursalReposicion } from "@/actions/reposicion";
import { useAplicarSucursalPreferidaSiVacia } from "@/lib/hooks/useAplicarSucursalPreferidaSiVacia";

type SucursalFiltroOption = { value: SucursalReposicion; label: string };

interface Props {
  data: ReposicionData;
  sucursalActual: SucursalReposicion | null;
  qActual: string;
  marcaActual: string;
  rubroActual: string;
  configuradoActual: "" | "si";
  totalItems: number;
  proveedorActual: string;
  sucursales: SucursalFiltroOption[];
}

export default function FiltrosReposicion({
  data,
  sucursalActual,
  qActual,
  marcaActual,
  rubroActual,
  configuradoActual,
  totalItems,
  proveedorActual,
  sucursales,
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

  useAplicarSucursalPreferidaSiVacia(sucursalActual, (codigo) => {
    if (!sucursales.some((s) => s.value === codigo)) return;
    const p = new URLSearchParams();
    p.set("sucursal", codigo);
    if (q) p.set("q", q);
    if (marcaActual) p.set("marca", marcaActual);
    if (rubroActual) p.set("rubro", rubroActual);
    if (configuradoActual) p.set("configurado", configuradoActual);
    if (proveedorActual) p.set("proveedor", proveedorActual);
    router.replace(`${pathname}?${p.toString()}`);
  });

  function buildParams(updates: {
    sucursal?: SucursalReposicion | null;
    q?: string;
    marca?: string;
    rubro?: string;
    configurado?: "" | "si";
    proveedor?: string;
    pagina?: string;
  }): URLSearchParams {
    const p = new URLSearchParams();
    const sucursal =
      updates.sucursal !== undefined ? updates.sucursal : sucursalActual;
    const qVal = updates.q !== undefined ? updates.q : q;
    const marcaVal = updates.marca !== undefined ? updates.marca : marcaActual;
    const rubroVal = updates.rubro !== undefined ? updates.rubro : rubroActual;
    const configuradoVal =
      updates.configurado !== undefined ? updates.configurado : configuradoActual;
    const proveedorVal = updates.proveedor !== undefined ? updates.proveedor : proveedorActual;

    if (sucursal) p.set("sucursal", sucursal);
    if (qVal) p.set("q", qVal);
    if (marcaVal) p.set("marca", marcaVal);
    if (rubroVal) p.set("rubro", rubroVal);
    if (configuradoVal) p.set("configurado", configuradoVal);
    if (proveedorVal) p.set("proveedor", proveedorVal);
    if (updates.pagina) p.set("pagina", updates.pagina);
    return p;
  }

  function navigate(updates: {
    sucursal?: SucursalReposicion | null;
    q?: string;
    marca?: string;
    rubro?: string;
    configurado?: "" | "si";
    proveedor?: string;
    pagina?: string;
  }) {
    const p = buildParams(updates);
    const query = p.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function handleSucursal(value: string) {
    if (!value) {
      router.push(pathname);
      return;
    }
    navigate({
      sucursal: value as SucursalReposicion,
      marca: "",
      rubro: "",
      proveedor: "",
      pagina: "1",
    });
  }

  function handleMarca(value: string) {
    navigate({ marca: value, rubro: "", pagina: "1" });
  }
  function handleRubro(value: string) {
    navigate({ rubro: value, pagina: "1" });
  }

  function handleConfigurado(value: string) {
    navigate({ configurado: value === "si" ? "si" : "", pagina: "1" });
  }

  function limpiarFiltros() {
    setQ("");
    if (sucursalActual) {
      router.push(`${pathname}?sucursal=${sucursalActual}`);
    } else {
      router.push(pathname);
    }
  }

  const sucursalValue = sucursalActual ?? "";
  const sucursalSeleccionada = sucursalActual !== null;
  const configuradoValue = configuradoActual || "";

  return (
    <FilterBar className="filtros-contenedor-tienda bg-card">
      <FilterRowSelection>
        <FilaFiltrosDesplegables>
          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={Boolean(sucursalActual)}
            onLimpiar={() => handleSucursal("")}
          >
            <Select
              value={sucursalValue}
              onValueChange={(v) => handleSucursal(v)}
            >
              <SelectTrigger
                id="filtro-reposicion-sucursal"
                className={SELECT_TRIGGER_FILTER_CLASS}
              >
                <SelectValue placeholder="SUCURSAL" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                {sucursales.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>
          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={Boolean(proveedorActual)}
            onLimpiar={() => {
              navigate({ proveedor: "", pagina: "1" });
            }}
          >
            <Select
              value={proveedorActual ?? ""}
              onValueChange={(v) => {
                navigate({ proveedor: v, pagina: "1" });
              }}
              disabled={!sucursalSeleccionada}
            >
              <SelectTrigger
                id="filtro-reposicion-proveedor"
                className={SELECT_TRIGGER_FILTER_CLASS}
              >
                <SelectValue placeholder="PROVEEDOR" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                {data.proveedores.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.prefijo
                      ? `[${p.prefijo}] ${p.nombre}`.toUpperCase()
                      : p.nombre.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>
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
                id="filtro-reposicion-marca"
                className={SELECT_TRIGGER_FILTER_CLASS}
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
                id="filtro-reposicion-rubro"
                className={SELECT_TRIGGER_FILTER_CLASS}
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
            activo={configuradoActual === "si"}
            onLimpiar={() => handleConfigurado("")}
          >
            <Select
              value={configuradoValue}
              onValueChange={(v) => handleConfigurado(v)}
              disabled={!sucursalSeleccionada}
            >
              <SelectTrigger
                id="filtro-reposicion-configurado"
                className={SELECT_TRIGGER_FILTER_CLASS}
              >
                <SelectValue placeholder="CONFIGURADO" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                <SelectItem value="si">SÍ</SelectItem>
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>
        </FilaFiltrosDesplegables>
      </FilterRowSelection>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <FilterRowSearch className="flex-1 w-auto max-w-none">
            <FiltroBusquedaInput
              id="filtro-reposicion-busqueda"
              placeholder="BUSCAR POR DESCRIPCIÓN..."
              value={q}
              onChange={handleQChange}
              isDebouncing={isDebouncing}
              inputRef={inputRef}
              disabled={!sucursalSeleccionada}
            />
          </FilterRowSearch>
          <LimpiarFiltrosButton onClick={limpiarFiltros} />
        </div>
        <span className={cn(FILTER_COUNT_CLASS, "ml-auto")}>
          {totalItems.toLocaleString("es-AR")} ÍTEM
          {totalItems !== 1 ? "S" : ""}
        </span>
      </div>
    </FilterBar>
  );
}
