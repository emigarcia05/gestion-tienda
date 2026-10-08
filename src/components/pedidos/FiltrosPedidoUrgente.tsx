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
  LimpiarFiltrosButton,
} from "@/components/FilterBar";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import { useAplicarSucursalPreferidaSiVacia } from "@/lib/hooks/useAplicarSucursalPreferidaSiVacia";
import {
  FILTRO_PEDIDO_OPCIONES,
  type FiltroPedidoValor,
} from "@/lib/pedidos";

export type SucursalPedido = "guaymallen" | "maipu";
type SucursalFiltroOption = { value: SucursalPedido; label: string };

interface Proveedor {
  id: string;
  nombre: string;
  prefijo: string;
}

export type { FiltroPedidoValor };

interface Props {
  q: string;
  sucursal: SucursalPedido | "";
  proveedor: string;
  pedido: FiltroPedidoValor;
  proveedores: Proveedor[];
  sucursales: SucursalFiltroOption[];
}

export default function FiltrosPedidoUrgente({
  q,
  sucursal,
  proveedor,
  pedido,
  proveedores,
  sucursales,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  function updateUrl(updates: {
    q?: string;
    sucursal?: string;
    proveedor?: string;
    pedido?: FiltroPedidoValor;
  }) {
    const next = {
      q,
      sucursal: sucursal || "",
      proveedor: proveedor || "",
      pedido: pedido || "",
    };
    if (updates.q !== undefined) next.q = updates.q;
    if (updates.sucursal !== undefined) next.sucursal = updates.sucursal;
    if (updates.proveedor !== undefined) next.proveedor = updates.proveedor;
    if (updates.pedido !== undefined) next.pedido = updates.pedido;
    const search = new URLSearchParams();
    if (next.q) search.set("q", next.q);
    if (next.sucursal) search.set("sucursal", next.sucursal);
    if (next.proveedor) search.set("proveedor", next.proveedor);
    if (next.pedido) search.set("pedido", next.pedido);
    const query = search.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  useAplicarSucursalPreferidaSiVacia(sucursal || null, (codigo) => {
    if (!sucursales.some((s) => s.value === codigo)) return;
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    search.set("sucursal", codigo);
    if (proveedor) search.set("proveedor", proveedor);
    if (pedido) search.set("pedido", pedido);
    router.replace(`${pathname}?${search.toString()}`);
  });

  const {
    q: qLocal,
    setQ: setQLocal,
    ref: inputRef,
    handleQChange,
    isDebouncing,
    prepareNavigate,
  } = useFiltrosConBusqueda({
    qActual: q,
    debounceMs: 700,
    focusStorageKey: "filtros-pedido-urgente-focus",
    onDebouncedSearch: (value) => {
      prepareNavigate();
      updateUrl({ q: value });
    },
  });

  function limpiarFiltros() {
    setQLocal("");
    if (sucursal) {
      updateUrl({ q: "", proveedor: "", pedido: "" });
      return;
    }
    updateUrl({ q: "", sucursal: "", proveedor: "", pedido: "" });
  }

  return (
    <FilterBar className="filtros-contenedor-tienda bg-card">
      <FilterRowSelection>
        <FilaFiltrosDesplegables>
          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={Boolean(sucursal)}
            onLimpiar={() => updateUrl({ sucursal: "" })}
          >
            <Select
              value={sucursal ?? ""}
              onValueChange={(v) => updateUrl({ sucursal: v as SucursalPedido })}
            >
              <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS}>
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
            activo={Boolean(proveedor)}
            onLimpiar={() => updateUrl({ proveedor: "" })}
          >
            <Select
              value={proveedor ?? ""}
              onValueChange={(v) => updateUrl({ proveedor: v })}
            >
              <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS}>
                <SelectValue placeholder="PROVEEDOR" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                {proveedores.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    [{p.prefijo}] {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>
          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={Boolean(pedido)}
            onLimpiar={() => updateUrl({ pedido: "" })}
          >
            <Select
              value={pedido ?? ""}
              onValueChange={(v) => updateUrl({ pedido: v as FiltroPedidoValor })}
            >
              <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS}>
                <SelectValue placeholder="PEDIDO" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                {FILTRO_PEDIDO_OPCIONES.map((op) => (
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
            id="filtro-pedidos-busqueda"
            placeholder="BUSCAR POR DESCRIPCIÓN O CÓDIGO..."
            value={qLocal}
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
