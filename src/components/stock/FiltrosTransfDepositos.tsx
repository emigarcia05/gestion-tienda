"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
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
import { parTransfConSucursalUsuario } from "@/lib/transfDepositosControl";
import type { SucursalTransf as Sucursal, TransfDepositosData } from "@/lib/transfDepositosTypes";
import {
  EVENTO_USUARIO_SESION,
  leerUsuarioSesion,
} from "@/lib/usuarioSesion";

const SUCURSALES: { value: Sucursal; label: string }[] = [
  { value: "guaymallen", label: "GUAYMALLÉN" },
  { value: "maipu", label: "MAIPÚ" },
];

export type FiltrosTransfDepositosCambio = {
  origen: Sucursal | null;
  destino: Sucursal | null;
  q: string;
  marca: string;
  rubro: string;
};

interface Props {
  data: TransfDepositosData;
  origenActual: Sucursal | null;
  destinoActual: Sucursal | null;
  qActual: string;
  marcaActual: string;
  rubroActual: string;
  /** Si está, no navega por URL (modal Crear Transferencia). */
  onCambiar?: (next: FiltrosTransfDepositosCambio) => void;
  /** Editar: origen/destino de la versión no se cambian. */
  parFijo?: boolean;
}

/**
 * Filtros de **Trans. Depósitos**:
 * 1) **SUC. ORIGEN** → **SUC. DESTINO** (centrados; una punta = sucursal del usuario;
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
  onCambiar,
  parFijo = false,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [sucursalUsuario, setSucursalUsuario] = useState<Sucursal | null>(null);
  const onCambiarRef = useRef(onCambiar);

  useEffect(() => {
    onCambiarRef.current = onCambiar;
  }, [onCambiar]);

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
    if (onCambiar) {
      const origen = updates.origen !== undefined ? updates.origen : origenActual;
      const destino = updates.destino !== undefined ? updates.destino : destinoActual;
      const qVal = updates.q !== undefined ? updates.q : q;
      const marcaVal = updates.marca !== undefined ? updates.marca : marcaActual;
      const rubroVal = updates.rubro !== undefined ? updates.rubro : rubroActual;
      const par = sucursalUsuario
        ? parTransfConSucursalUsuario(origen, destino, sucursalUsuario)
        : { origen, destino };
      onCambiar({
        origen: par.origen,
        destino: par.destino,
        q: qVal,
        marca: marcaVal,
        rubro: rubroVal,
      });
      return;
    }
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
    navigate({ q: "", marca: "", rubro: "" });
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
    if (!sucursalUsuario || parFijo) return;
    const par = parTransfConSucursalUsuario(
      origenActual,
      destinoActual,
      sucursalUsuario
    );
    if (par.origen === origenActual && par.destino === destinoActual) {
      return;
    }
    if (onCambiarRef.current) {
      onCambiarRef.current({
        origen: par.origen,
        destino: par.destino,
        q,
        marca: marcaActual,
        rubro: rubroActual,
      });
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
    parFijo,
  ]);

  return (
    <div className="filtros-doble-bloque-compacto">
      <FilterBar className="filtros-contenedor-tienda bg-card">
        <FilterRowSelection className="justify-center">
          <div
            className="mx-auto grid w-full max-w-2xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3"
            aria-label="Sucursal origen hacia sucursal destino"
          >
            <FiltroIndividualContainer
              className={FILTER_SELECT_WRAPPER_CLASS}
              activo={origenActual !== null && !parActual.origenBloqueado && !parFijo}
              onLimpiar={() => handleOrigen("")}
            >
              <Select
                value={origenActual ?? ""}
                onValueChange={(v) => handleOrigen(v)}
                disabled={parActual.origenBloqueado || parFijo}
              >
                <SelectTrigger
                  id="filtro-transf-origen"
                  className="input-filtro-unificado w-full"
                >
                  <SelectValue placeholder="SUC. ORIGEN" />
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
            <ArrowRight
              className="h-5 w-5 shrink-0 text-primary"
              aria-hidden
            />
            <FiltroIndividualContainer
              className={FILTER_SELECT_WRAPPER_CLASS}
              activo={destinoActual !== null && !parActual.destinoBloqueado && !parFijo}
              onLimpiar={() => handleDestino("")}
            >
              <Select
                value={destinoActual ?? ""}
                onValueChange={(v) => handleDestino(v)}
                disabled={parActual.destinoBloqueado || parFijo}
              >
                <SelectTrigger
                  id="filtro-transf-destino"
                  className="input-filtro-unificado w-full"
                >
                  <SelectValue placeholder="SUC. DESTINO" />
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
          </div>
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
        </div>
      </FilterBar>
    </div>
  );
}
