"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  buscarProductosFacturaAvanzadaAction,
  listarCatalogoBusquedaProductosFacturaAction,
} from "@/actions/factura";
import FacturaProductoBusquedaLista from "@/components/facturacion/FacturaProductoBusquedaLista";
import { FiltroIndividualContainer, SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import AppModal from "@/components/shared/AppModal";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FACTURA_BUSQUEDA_PRODUCTOS_MIN_CHARS } from "@/lib/factura";
import type { SucursalPreferida } from "@/lib/sucursalPreferida";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import { leerUsuarioSesion } from "@/lib/usuarioSesion";
import { cn } from "@/lib/utils";
import type { ProductoFacturaBusquedaItem } from "@/services/facturaProductos.service";

const FILTRO_TODOS = "todos";

interface CatalogoBusqueda {
  rubros: string[];
  marcas: string[];
  subRubros: { rubro: string; subRubro: string }[];
}

interface FacturaBusquedaAvanzadaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sucursalCodigo: SucursalPreferida | null;
  onElegir: (item: ProductoFacturaBusquedaItem) => void;
  onVerStock: (item: ProductoFacturaBusquedaItem) => void;
}

export default function FacturaBusquedaAvanzadaModal({
  open,
  onOpenChange,
  sucursalCodigo,
  onElegir,
  onVerStock,
}: FacturaBusquedaAvanzadaModalProps) {
  const [catalogo, setCatalogo] = useState<CatalogoBusqueda | null>(null);
  const [rubro, setRubro] = useState(FILTRO_TODOS);
  const [marca, setMarca] = useState(FILTRO_TODOS);
  const [subRubro, setSubRubro] = useState(FILTRO_TODOS);
  const [items, setItems] = useState<ProductoFacturaBusquedaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activo, setActivo] = useState(0);
  const qRef = useRef("");
  const openRef = useRef(open);
  const reqRef = useRef(0);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const subRubros = useMemo(() => {
    const pares = catalogo?.subRubros ?? [];
    const base =
      rubro === FILTRO_TODOS ? pares : pares.filter((p) => p.rubro === rubro);
    return [...new Set(base.map((p) => p.subRubro))].sort((a, b) =>
      a.localeCompare(b, "es")
    );
  }, [catalogo, rubro]);

  function hayCatalogoElegido(
    rubroActual = rubro,
    marcaActual = marca,
    subRubroActual = subRubro
  ): boolean {
    return (
      rubroActual !== FILTRO_TODOS ||
      marcaActual !== FILTRO_TODOS ||
      subRubroActual !== FILTRO_TODOS
    );
  }

  async function buscar(
    descripcion: string,
    filtros?: { rubro: string; marca: string; subRubro: string }
  ) {
    const rubroActual = filtros?.rubro ?? rubro;
    const marcaActual = filtros?.marca ?? marca;
    const subRubroActual = filtros?.subRubro ?? subRubro;
    if (!openRef.current) return;
    const qTrim = descripcion.trim();
    const catalogoActivo = hayCatalogoElegido(rubroActual, marcaActual, subRubroActual);
    if (qTrim.length < FACTURA_BUSQUEDA_PRODUCTOS_MIN_CHARS && !catalogoActivo) {
      setItems([]);
      setLoading(false);
      return;
    }
    const reqId = ++reqRef.current;
    setLoading(true);
    const sucursal = sucursalCodigo ?? leerUsuarioSesion()?.sucursalPorDefecto;
    const res = await buscarProductosFacturaAvanzadaAction({
      q: qTrim.length >= FACTURA_BUSQUEDA_PRODUCTOS_MIN_CHARS ? qTrim : "",
      rubro: rubroActual === FILTRO_TODOS ? "" : rubroActual,
      marca: marcaActual === FILTRO_TODOS ? "" : marcaActual,
      subRubro: subRubroActual === FILTRO_TODOS ? "" : subRubroActual,
      take: 100,
      ...(sucursal ? { sucursalCodigo: sucursal } : {}),
    });
    if (reqId !== reqRef.current || !openRef.current) return;
    setLoading(false);
    if (!res.ok) {
      setItems([]);
      toast.error(res.error);
      return;
    }
    setItems(res.data.items);
    setActivo(0);
  }

  const { q, ref, handleQChange, isDebouncing } = useFiltrosConBusqueda({
    qActual: "",
    debounceMs: 300,
    onDebouncedSearch: (value) => {
      void buscar(value);
    },
  });

  useEffect(() => {
    qRef.current = q;
  }, [q]);

  useEffect(() => {
    if (!open || catalogo) return;
    let cancelado = false;
    void listarCatalogoBusquedaProductosFacturaAction().then((res) => {
      if (cancelado) return;
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCatalogo(res.data);
    });
    return () => {
      cancelado = true;
    };
  }, [open, catalogo]);

  function cambiarRubro(value: string) {
    setRubro(value);
    const siguientes =
      value === FILTRO_TODOS
        ? subRubros
        : [
            ...new Set(
              (catalogo?.subRubros ?? [])
                .filter((p) => p.rubro === value)
                .map((p) => p.subRubro)
            ),
          ];
    const subRubroSiguiente = siguientes.includes(subRubro) ? subRubro : FILTRO_TODOS;
    if (subRubroSiguiente !== subRubro) setSubRubro(subRubroSiguiente);
    void buscar(qRef.current, {
      rubro: value,
      marca,
      subRubro: subRubroSiguiente,
    });
  }

  function cambiarMarca(value: string) {
    setMarca(value);
    void buscar(qRef.current, { rubro, marca: value, subRubro });
  }

  function cambiarSubRubro(value: string) {
    setSubRubro(value);
    void buscar(qRef.current, { rubro, marca, subRubro: value });
  }

  const esperando = loading || isDebouncing;
  const hayFiltro =
    hayCatalogoElegido() || q.trim().length >= FACTURA_BUSQUEDA_PRODUCTOS_MIN_CHARS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="xl"
        title="BÚSQUEDA AVANZADA"
        scrollBody={false}
        padding="sm"
        className="h-[85vh]"
        bodyClassName="flex h-full min-h-0 flex-col gap-3"
        actions={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        <div className="grid shrink-0 grid-cols-3 gap-3">
          <FiltroIndividualContainer
            activo={rubro !== FILTRO_TODOS}
            onLimpiar={() => cambiarRubro(FILTRO_TODOS)}
            className="w-full flex-none"
          >
            <Select value={rubro} onValueChange={cambiarRubro}>
              <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                <SelectValue placeholder="RUBRO" />
              </SelectTrigger>
              <SelectContent
                className="select-content-filtro"
                position="popper"
                side="bottom"
                align="start"
              >
                <SelectItem value={FILTRO_TODOS}>RUBRO</SelectItem>
                {(catalogo?.rubros ?? []).map((nombre) => (
                  <SelectItem key={nombre} value={nombre}>
                    {nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>
          <FiltroIndividualContainer
            activo={subRubro !== FILTRO_TODOS}
            onLimpiar={() => cambiarSubRubro(FILTRO_TODOS)}
            className="w-full flex-none"
          >
            <Select value={subRubro} onValueChange={cambiarSubRubro}>
              <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                <SelectValue placeholder="SUBRUBRO" />
              </SelectTrigger>
              <SelectContent
                className="select-content-filtro"
                position="popper"
                side="bottom"
                align="start"
              >
                <SelectItem value={FILTRO_TODOS}>SUBRUBRO</SelectItem>
                {subRubros.map((nombre) => (
                  <SelectItem key={nombre} value={nombre}>
                    {nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>
          <FiltroIndividualContainer
            activo={marca !== FILTRO_TODOS}
            onLimpiar={() => cambiarMarca(FILTRO_TODOS)}
            className="w-full flex-none"
          >
            <Select value={marca} onValueChange={cambiarMarca}>
              <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                <SelectValue placeholder="MARCA" />
              </SelectTrigger>
              <SelectContent
                className="select-content-filtro"
                position="popper"
                side="bottom"
                align="start"
              >
                <SelectItem value={FILTRO_TODOS}>MARCA</SelectItem>
                {(catalogo?.marcas ?? []).map((nombre) => (
                  <SelectItem key={nombre} value={nombre}>
                    {nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltroIndividualContainer>
        </div>
        <FiltroBusquedaInput
          id="factura-busqueda-avanzada-descripcion"
          placeholder="DESCRIPCIÓN"
          value={q}
          onChange={handleQChange}
          isDebouncing={isDebouncing}
          inputRef={ref}
        />
        <div
          role="listbox"
          aria-label="Resultados de búsqueda avanzada"
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border"
        >
          {esperando ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Buscando…</p>
          ) : !hayFiltro ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Elegí rubro, marca, subrubro o una descripción.
            </p>
          ) : items.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Sin resultados.</p>
          ) : (
            <FacturaProductoBusquedaLista
              items={items}
              sucursalCodigo={sucursalCodigo}
              activoIndex={activo}
              onActivar={setActivo}
              onElegir={onElegir}
              onVerStock={onVerStock}
              className="min-h-0 flex-1"
            />
          )}
        </div>
      </AppModal>
    </Dialog>
  );
}
