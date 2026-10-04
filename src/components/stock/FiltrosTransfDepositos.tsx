"use client";

import { useCallback, useEffect, useState } from "react";
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
  FILTER_COUNT_CLASS,
  LimpiarFiltrosButton,
} from "@/components/FilterBar";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import { parTransfConSucursalUsuario } from "@/lib/transfDepositosControl";
import { cn } from "@/lib/utils";
import type { Sucursal, TransfDepositosData } from "@/actions/stock";
import {
  EVENTO_USUARIO_SESION,
  leerUsuarioSesion,
} from "@/lib/usuarioSesion";

const SUCURSALES: { value: Sucursal; label: string }[] = [
  { value: "guaymallen", label: "GUAYMALLÉN" },
  { value: "maipu", label: "MAIPÚ" },
];

interface Props {
  data: TransfDepositosData;
  origenActual: Sucursal | null;
  destinoActual: Sucursal | null;
  qActual: string;
  marcaActual: string;
  rubroActual: string;
  totalItems: number;
}

/**
 * Filtros de **Trans. Depósitos**:
 * 1) **SUCURSAL ORIGEN** / **SUCURSAL DESTINO** (una punta = sucursal del usuario;
 *    la otra se fija y no se edita)
 * 2) **MARCA** / **RUBRO** + búsqueda (sin desplegable SUCURSAL)
 */
export default function FiltrosTransfDepositos({
  data,
  origenActual,
  destinoActual,
  qActual,
  marcaActual,
  rubroActual,
  totalItems,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [sucursalUsuario, setSucursalUsuario] = useState<Sucursal | null>(null);

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

  const syncUsuario = useCallback(() => {
    setSucursalUsuario(leerUsuarioSesion()?.sucursalPorDefecto ?? null);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      syncUsuario();
    });
    window.addEventListener(EVENTO_USUARIO_SESION, syncUsuario);
    return () => window.removeEventListener(EVENTO_USUARIO_SESION, syncUsuario);
  }, [syncUsuario]);

  function buildParams(updates: {
    origen?: Sucursal | null;
    destino?: Sucursal | null;
    q?: string;
    marca?: string;
    rubro?: string;
  }): URLSearchParams {
    const p = new URLSearchParams();
    const origen =
      updates.origen !== undefined ? updates.origen : origenActual;
    const destino =
      updates.destino !== undefined ? updates.destino : destinoActual;
    const qVal = updates.q !== undefined ? updates.q : q;
    const marcaVal = updates.marca !== undefined ? updates.marca : marcaActual;
    const rubroVal = updates.rubro !== undefined ? updates.rubro : rubroActual;

    if (origen) p.set("origen", origen);
    if (destino) p.set("destino", destino);
    if (qVal) p.set("q", qVal);
    if (marcaVal) p.set("marca", marcaVal);
    if (rubroVal) p.set("rubro", rubroVal);
    return p;
  }

  function navigate(updates: {
    origen?: Sucursal | null;
    destino?: Sucursal | null;
    q?: string;
    marca?: string;
    rubro?: string;
  }) {
    const p = buildParams(updates);
    const query = p.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function navegarPar(
    origen: Sucursal | null,
    destino: Sucursal | null,
    extras?: { marca?: string; rubro?: string; q?: string }
  ) {
    const par = sucursalUsuario
      ? parTransfConSucursalUsuario(origen, destino, sucursalUsuario)
      : { origen, destino };
    navigate({
      origen: par.origen,
      destino: par.destino,
      ...extras,
    });
  }

  function handleOrigen(value: string) {
    if (!value) {
      navegarPar(null, destinoActual, { marca: "", rubro: "", q: "" });
      setQ("");
      return;
    }
    navegarPar(value as Sucursal, destinoActual, { marca: "", rubro: "" });
  }

  function handleDestino(value: string) {
    if (!value) {
      navegarPar(origenActual, null);
      return;
    }
    navegarPar(origenActual, value as Sucursal);
  }

  function handleMarca(value: string) {
    navigate({ marca: value, rubro: "" });
  }
  function handleRubro(value: string) {
    navigate({ rubro: value });
  }

  function limpiarFiltros() {
    setQ("");
    const p = new URLSearchParams();
    if (origenActual) p.set("origen", origenActual);
    if (destinoActual) p.set("destino", destinoActual);
    const query = p.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const origenSeleccionado = origenActual !== null;
  const parActual = sucursalUsuario
    ? parTransfConSucursalUsuario(origenActual, destinoActual, sucursalUsuario)
    : {
        origen: origenActual,
        destino: destinoActual,
        origenBloqueado: false,
        destinoBloqueado: false,
      };

  useEffect(() => {
    if (!sucursalUsuario) return;
    const par = parTransfConSucursalUsuario(
      origenActual,
      destinoActual,
      sucursalUsuario
    );
    if (par.origen === origenActual && par.destino === destinoActual) {
      return;
    }
    const p = new URLSearchParams();
    if (par.origen) p.set("origen", par.origen);
    if (par.destino) p.set("destino", par.destino);
    if (q) p.set("q", q);
    if (marcaActual) p.set("marca", marcaActual);
    if (rubroActual) p.set("rubro", rubroActual);
    const query = p.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [
    sucursalUsuario,
    origenActual,
    destinoActual,
    q,
    marcaActual,
    rubroActual,
    pathname,
    router,
  ]);

  return (
    <div className="filtros-doble-bloque-compacto">
      <FilterBar className="filtros-contenedor-tienda bg-card">
        <FilterRowSelection>
          <FilaFiltrosDesplegables>
            <FiltroIndividualContainer
              className={FILTER_SELECT_WRAPPER_CLASS}
              activo={origenActual !== null && !parActual.origenBloqueado}
              onLimpiar={() => handleOrigen("")}
            >
              <Select
                value={origenActual ?? ""}
                onValueChange={(v) => handleOrigen(v)}
                disabled={parActual.origenBloqueado}
              >
                <SelectTrigger
                  id="filtro-transf-origen"
                  className="input-filtro-unificado"
                >
                  <SelectValue placeholder="SUCURSAL ORIGEN" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  {SUCURSALES.filter((s) => s.value !== destinoActual).map(
                    (s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </FiltroIndividualContainer>
            <FiltroIndividualContainer
              className={FILTER_SELECT_WRAPPER_CLASS}
              activo={destinoActual !== null && !parActual.destinoBloqueado}
              onLimpiar={() => handleDestino("")}
            >
              <Select
                value={destinoActual ?? ""}
                onValueChange={(v) => handleDestino(v)}
                disabled={parActual.destinoBloqueado}
              >
                <SelectTrigger
                  id="filtro-transf-destino"
                  className="input-filtro-unificado"
                >
                  <SelectValue placeholder="SUCURSAL DESTINO" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  {SUCURSALES.filter((s) => s.value !== origenActual).map(
                    (s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </FiltroIndividualContainer>
          </FilaFiltrosDesplegables>
        </FilterRowSelection>
      </FilterBar>

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
                disabled={!origenSeleccionado}
              >
                <SelectTrigger
                  id="filtro-transf-marca"
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
                disabled={!origenSeleccionado}
              >
                <SelectTrigger
                  id="filtro-transf-rubro"
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
                  {data.rubros.map((r) => (
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
              id="filtro-transf-busqueda"
              placeholder="BUSCAR POR DESCRIPCIÓN O CÓDIGO..."
              value={q}
              onChange={handleQChange}
              isDebouncing={isDebouncing}
              inputRef={inputRef}
              disabled={!origenSeleccionado}
            />
          </FilterRowSearch>
          <LimpiarFiltrosButton onClick={limpiarFiltros} />
          <span className={cn(FILTER_COUNT_CLASS, "ml-auto")}>
            {totalItems.toLocaleString("es-AR")} ÍTEM
            {totalItems !== 1 ? "S" : ""}
          </span>
        </div>
      </FilterBar>
    </div>
  );
}
