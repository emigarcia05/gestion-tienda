"use client";

import { useRef, useEffect } from "react";
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
  FilaFiltrosDesplegables,
  FilterRowSelection,
  FilterRowSearch,
  FILTER_SELECT_WRAPPER_CLASS,
  LimpiarFiltrosButton,
  SELECT_TRIGGER_FILTER_CLASS,
} from "@/components/FilterBar";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
const SUCURSALES = [
  { value: "guaymallen", label: "GUAYMALLÉN" },
  { value: "maipu", label: "MAIPÚ" },
] as const;

export type EstadoFiltroPedido = "ABIERTO" | "RECEPCIONADO" | "ALL";

interface Proveedor {
  id: string;
  nombre: string;
  prefijo: string;
}

interface Props {
  proveedores: Proveedor[];
  proveedorId: string;
  sucursalCodigo: string;
  estado: EstadoFiltroPedido;
  q: string;
}

export default function FiltrosHistorialPedidos({
  proveedores,
  proveedorId,
  sucursalCodigo,
  estado,
  q,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const qLocalRef = useRef(q);

  function applyNavigate(
    updates: Partial<{
      proveedorId: string;
      sucursalCodigo: string;
      estado: EstadoFiltroPedido;
      q: string;
    }>
  ) {
    const nextProveedor =
      updates.proveedorId !== undefined ? updates.proveedorId : proveedorId;
    const nextSucursal =
      updates.sucursalCodigo !== undefined ? updates.sucursalCodigo : sucursalCodigo;
    const nextEstado = updates.estado !== undefined ? updates.estado : estado;
    const nextQ = updates.q !== undefined ? updates.q : qLocalRef.current;

    const search = new URLSearchParams();
    search.set("pagina", "1");
    if (nextProveedor.trim()) search.set("proveedor", nextProveedor.trim());
    if (nextSucursal) search.set("sucursal", nextSucursal);
    search.set("estado", nextEstado);
    if (nextQ.trim()) search.set("q", nextQ.trim());
    router.push(`${pathname}?${search.toString()}`);
  }

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
    focusStorageKey: "filtros-historial-pedidos-focus",
    onDebouncedSearch: (value) => {
      prepareNavigate();
      applyNavigate({ q: value });
    },
  });

  useEffect(() => {
    qLocalRef.current = qLocal;
  }, [qLocal]);

  function limpiarFiltros() {
    setQLocal("");
    applyNavigate({
      proveedorId: "",
      sucursalCodigo: "",
      estado: "ABIERTO",
      q: "",
    });
  }

  return (
    <FilterBar className="filtros-contenedor-tienda bg-card">
      <FilterRowSelection>
        <FilaFiltrosDesplegables>
          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={Boolean(proveedorId.trim())}
            onLimpiar={() => applyNavigate({ proveedorId: "" })}
          >
            <Select
              value={proveedorId ?? ""}
              onValueChange={(v) => applyNavigate({ proveedorId: v })}
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
            activo={Boolean(sucursalCodigo)}
            onLimpiar={() => applyNavigate({ sucursalCodigo: "" })}
          >
            <Select
              value={sucursalCodigo ?? ""}
              onValueChange={(v) => applyNavigate({ sucursalCodigo: v })}
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
                {SUCURSALES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>

          <FiltroIndividualContainer
            className={FILTER_SELECT_WRAPPER_CLASS}
            activo={estado !== "ABIERTO"}
            onLimpiar={() => applyNavigate({ estado: "ABIERTO" })}
          >
            <Select
              value={estado}
              onValueChange={(v) => applyNavigate({ estado: v as EstadoFiltroPedido })}
            >
              <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS}>
                <SelectValue placeholder="ESTADO" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                <SelectItem value="ABIERTO">ABIERTO</SelectItem>
                <SelectItem value="RECEPCIONADO">RECEPCIONADO</SelectItem>
                <SelectItem value="ALL">TODOS</SelectItem>
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>

          <div />
          <div />
        </FilaFiltrosDesplegables>
      </FilterRowSelection>

      <div className="flex items-center gap-3">
        <FilterRowSearch className="flex-1">
          <FiltroBusquedaInput
            id="filtro-historial-pedidos-busqueda"
            placeholder="BUSCAR POR DESCRIPCIÓN DE PRODUCTO EN EL PEDIDO..."
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
