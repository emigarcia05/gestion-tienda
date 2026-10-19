"use client";

import { useMemo, useState } from "react";
import { Check, Eye } from "lucide-react";
import { toast } from "sonner";
import FilterBar, {
  FILTER_SELECT_WRAPPER_CLASS,
  FiltroIndividualContainer,
  FilterRowSelection,
  SELECT_TRIGGER_FILTER_CLASS,
} from "@/components/FilterBar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import LineaLecturaModal from "@/components/shared/LineaLecturaModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import MontoArInput from "@/components/shared/MontoArInput";
import PorcentajeCentInput from "@/components/shared/PorcentajeCentInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import {
  aCandidataFactura,
  claveFormaPagoCuotaDescPromo,
  columnasFormaPagoDescPromo,
  etiquetaAlcanceCondicion,
  etiquetaFormaPagoCuotaDescPromo,
  filtrarPromosDescPromoFactura,
  formasPagoUnicasDescPromo,
  gruposPorAlcanceDescPromo,
  gruposPorPctDescPromo,
  snapshotCobroDescPromo,
  textoDescuentosDescPromo,
  type DescPromoFila,
} from "@/lib/descPromo";
import { fmtCelda } from "@/lib/format";
import {
  descuentoPctDesdeTotalFac,
  FACTURA_DESCUENTO_MAX_CENTS,
  totalFacDesdeDescuentoPct,
  type FacturaDescuentoEstado,
} from "@/lib/factura";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import { montoArNormalizedStringToCents } from "@/lib/montoArMask";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const INPUT_CONTROL_CLASS = "tabular-nums border-primary w-full min-w-0";
const SELECCION_PERSONALIZADO = "personalizado";
const FILTRO_TODOS = "todos";
type VistaDescPromo = "forma_pago" | "descuento" | "alcance" | "personalizado";
const VISTA_BTN_CLASS =
  "h-10 min-w-0 flex-1 rounded-none border-0 shadow-none";
const FILA_PROMO_ACTIVA_CLASS =
  "tabla-desc-factura-fila-activa bg-primary text-primary-foreground hover:bg-primary [&_td]:text-primary-foreground";
const FILA_PROMO_HOVER_CLASS = "tabla-desc-factura-fila-hover";

function CeldaAccionesPromo({
  activo,
  etiqueta,
  onSeleccionar,
  onVer,
  hoverHandlers,
}: {
  activo: boolean;
  etiqueta: string;
  onSeleccionar: () => void;
  onVer?: () => void;
  hoverHandlers?: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}) {
  return (
    <TableCell
      className="celda-datos celda-datos--accion-relleno-fila p-0"
      {...hoverHandlers}
    >
      <div className={cn(TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS, "justify-center")}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
          title="Seleccionar"
          aria-label={`Seleccionar ${etiqueta}`}
          aria-pressed={activo}
          onClick={(e) => {
            e.stopPropagation();
            onSeleccionar();
          }}
        >
          <Check className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
        </Button>
        {onVer ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
            title="Ver"
            aria-label={`Ver ${etiqueta}`}
            onClick={(e) => {
              e.stopPropagation();
              onVer();
            }}
          >
            <Eye className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
          </Button>
        ) : null}
      </div>
    </TableCell>
  );
}

function textoAlcanceDetalle(promo: DescPromoFila): string {
  const alcance = etiquetaAlcanceCondicion(promo);
  if (promo.alcance !== "ITEMS" || promo.items.length === 0) return alcance;
  const items = promo.items
    .map((item) => item.descripcion || item.codTienda)
    .join(" · ");
  return `${alcance} · ${items}`;
}

function clavePago(pagoId: string, cuotaId: string | null): string {
  return `pago:${claveFormaPagoCuotaDescPromo(pagoId, cuotaId)}`;
}

function clavePromo(promoId: string): string {
  return `promo:${promoId}`;
}

function textoFormasPago(promo: DescPromoFila): string {
  return promo.formasPago.map(etiquetaFormaPagoCuotaDescPromo).join(" · ");
}

function parseClaveFiltroPago(valor: string): {
  pagoId: string;
  cuotaId: string | null;
} {
  if (!valor || valor === FILTRO_TODOS) return { pagoId: "", cuotaId: null };
  const sep = valor.indexOf(":");
  if (sep < 0) return { pagoId: valor, cuotaId: null };
  const cuota = valor.slice(sep + 1);
  return { pagoId: valor.slice(0, sep), cuotaId: cuota === "" ? null : cuota };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalLista: number;
  descuentoActual: FacturaDescuentoEstado | null;
  promosFormaPago: DescPromoFila[];
  onAplicar: (descuento: FacturaDescuentoEstado | null) => void;
}

function pctToNorm(pct: number): string {
  if (pct <= 0) return "";
  return (Math.round(pct * 100) / 100).toFixed(2);
}

function pesosToNorm(pesos: number): string {
  if (!Number.isFinite(pesos) || pesos < 0) return "";
  return Math.round(pesos).toFixed(2);
}

function parsePctNorm(norm: string): number {
  const t = norm.trim();
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function parsePesosNorm(norm: string): number | null {
  const t = norm.trim();
  if (t === "") return null;
  return Math.round(montoArNormalizedStringToCents(t) / 100);
}

function estadoInicial(
  totalLista: number,
  descuentoActual: FacturaDescuentoEstado | null
): {
  pctNorm: string;
  totalNorm: string;
  lastEdited: "pct" | "total" | null;
  seleccion: string;
  vista: VistaDescPromo;
} {
  const vacioLista = {
    pctNorm: "",
    totalNorm: totalLista > 0 ? pesosToNorm(totalLista) : "",
    lastEdited: null as "pct" | "total" | null,
  };
  if (descuentoActual?.fuente === "promo_forma_pago") {
    const agrupacion = descuentoActual.promoAgrupacion ?? "forma_pago";
    const promoId = descuentoActual.promoCandidatas?.[0]?.id;
    const pagoId =
      descuentoActual.promoPagoIdSeleccionado ??
      descuentoActual.promoPagoIds?.[0];
    const cuotaId = descuentoActual.promoCuotaIdSeleccionado ?? null;
    if (agrupacion === "descuento" && promoId) {
      return {
        ...vacioLista,
        seleccion: clavePromo(promoId),
        vista: "descuento",
      };
    }
    if (agrupacion === "alcance" && promoId) {
      return {
        ...vacioLista,
        seleccion: clavePromo(promoId),
        vista: "alcance",
      };
    }
    if (pagoId) {
      return {
        ...vacioLista,
        seleccion: clavePago(pagoId, cuotaId),
        vista: "forma_pago",
      };
    }
  }
  if (descuentoActual == null || descuentoActual.porcentaje <= 0) {
    return {
      ...vacioLista,
      seleccion: SELECCION_PERSONALIZADO,
      vista: "forma_pago",
    };
  }
  const pct = descuentoActual.porcentaje;
  if (
    descuentoActual.fuente === "total_fac" &&
    descuentoActual.totalFacObjetivo != null
  ) {
    return {
      pctNorm: pctToNorm(pct),
      totalNorm: pesosToNorm(descuentoActual.totalFacObjetivo),
      lastEdited: "total",
      seleccion: SELECCION_PERSONALIZADO,
      vista: "personalizado",
    };
  }
  return {
    pctNorm: pctToNorm(pct),
    totalNorm: pesosToNorm(totalFacDesdeDescuentoPct(totalLista, pct)),
    lastEdited: "pct",
    seleccion: SELECCION_PERSONALIZADO,
    vista: "personalizado",
  };
}

/**
 * Modal de descuento de Factura · Crear: cuatro vistas (incluye PERSONALIZADA).
 * El padre remonta con `key` al abrir.
 */
export default function FacturaDescuentoModal({
  open,
  onOpenChange,
  totalLista,
  descuentoActual,
  promosFormaPago,
  onAplicar,
}: Props) {
  const inicial = estadoInicial(totalLista, descuentoActual);
  const [pctNorm, setPctNorm] = useState(inicial.pctNorm);
  const [totalNorm, setTotalNorm] = useState(inicial.totalNorm);
  const [lastEdited, setLastEdited] = useState<"pct" | "total" | null>(
    inicial.lastEdited
  );
  const [seleccion, setSeleccion] = useState(inicial.seleccion);
  const [vista, setVista] = useState<VistaDescPromo>(inicial.vista);
  const [verPromo, setVerPromo] = useState<DescPromoFila | null>(null);
  const [hoverGrupo, setHoverGrupo] = useState<string | null>(null);
  const [hoverFila, setHoverFila] = useState<string | null>(null);
  const [filtroPago, setFiltroPago] = useState(FILTRO_TODOS);
  const [filtroRubro, setFiltroRubro] = useState(FILTRO_TODOS);
  const [qDebounced, setQDebounced] = useState("");
  const { q, handleQChange, isDebouncing, ref: searchRef } = useFiltrosConBusqueda({
    qActual: "",
    debounceMs: 300,
    onDebouncedSearch: setQDebounced,
  });

  const opcionesPago = useMemo(
    () => formasPagoUnicasDescPromo(promosFormaPago),
    [promosFormaPago]
  );
  const opcionesRubro = useMemo(() => {
    const map = new Map<string, string>();
    for (const fila of promosFormaPago) {
      if (fila.idRubro && fila.rubroNombre) {
        map.set(fila.idRubro, fila.rubroNombre);
      }
      for (const item of fila.items) {
        if (item.idRubro && item.rubroNombre && !map.has(item.idRubro)) {
          map.set(item.idRubro, item.rubroNombre);
        }
      }
    }
    return [...map.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [promosFormaPago]);

  const filtroPagoParsed = parseClaveFiltroPago(filtroPago);
  const promosFiltradas = useMemo(
    () =>
      filtrarPromosDescPromoFactura(promosFormaPago, {
        pagoId: filtroPagoParsed.pagoId,
        cuotaId: filtroPagoParsed.cuotaId,
        idRubro: filtroRubro === FILTRO_TODOS ? "" : filtroRubro,
        qDescripcion: qDebounced,
      }),
    [
      promosFormaPago,
      filtroPagoParsed.pagoId,
      filtroPagoParsed.cuotaId,
      filtroRubro,
      qDebounced,
    ]
  );

  const columnasPago = useMemo(
    () => columnasFormaPagoDescPromo(promosFiltradas),
    [promosFiltradas]
  );
  const gruposPct = useMemo(
    () => gruposPorPctDescPromo(promosFiltradas),
    [promosFiltradas]
  );
  const gruposAlcance = useMemo(
    () => gruposPorAlcanceDescPromo(promosFiltradas),
    [promosFiltradas]
  );
  const esVistaPersonalizada = vista === "personalizado";

  function cambiarVista(next: VistaDescPromo) {
    setVista(next);
    setHoverGrupo(null);
    setHoverFila(null);
    if (next === "personalizado") {
      setSeleccion(SELECCION_PERSONALIZADO);
      return;
    }
    if (seleccion === SELECCION_PERSONALIZADO) {
      setSeleccion("");
    }
  }

  function classFilaPromo(opts: {
    activo: boolean;
    hoverGrupoActivo: boolean;
    hoverFilaActiva: boolean;
    esFinGrupo: boolean;
  }): string {
    return cn(
      opts.activo && FILA_PROMO_ACTIVA_CLASS,
      !opts.activo &&
        (opts.hoverGrupoActivo || opts.hoverFilaActiva) &&
        FILA_PROMO_HOVER_CLASS,
      opts.esFinGrupo && "tabla-desc-factura-grupo-fin"
    );
  }

  function handlersHoverGrupo(clave: string) {
    return {
      onMouseEnter: () => {
        setHoverFila(null);
        setHoverGrupo(clave);
      },
      onMouseLeave: () => {
        setHoverGrupo((actual) => (actual === clave ? null : actual));
      },
    };
  }

  function handlersHoverFila(claveFila: string) {
    return {
      onMouseEnter: () => {
        setHoverGrupo(null);
        setHoverFila(claveFila);
      },
      onMouseLeave: () => {
        setHoverFila((actual) => (actual === claveFila ? null : actual));
      },
    };
  }

  function handlePctChange(next: string) {
    setPctNorm(next);
    setLastEdited("pct");
    const pct = parsePctNorm(next);
    if (next.trim() === "") {
      setTotalNorm(totalLista > 0 ? pesosToNorm(totalLista) : "");
      return;
    }
    setTotalNorm(pesosToNorm(totalFacDesdeDescuentoPct(totalLista, pct)));
  }

  function handleTotalChange(next: string) {
    setTotalNorm(next);
    setLastEdited("total");
    const pesos = parsePesosNorm(next);
    if (pesos == null) {
      setPctNorm("");
      return;
    }
    setPctNorm(pctToNorm(descuentoPctDesdeTotalFac(totalLista, pesos)));
  }

  function aplicarPromoUnica(
    promo: DescPromoFila,
    agrupacion: "descuento" | "alcance"
  ) {
    onAplicar({
      fuente: "promo_forma_pago",
      porcentaje: 0,
      totalFacObjetivo: null,
      promoAgrupacion: agrupacion,
      promoCandidatas: [aCandidataFactura(promo)],
      ...snapshotCobroDescPromo(promo.formasPago),
    });
    onOpenChange(false);
  }

  function handleAplicar() {
    if (totalLista <= 0) {
      toast.error("Agregá ítems antes de aplicar un descuento.");
      return;
    }

    if (!esVistaPersonalizada) {
      if (vista === "descuento" || vista === "alcance") {
        const promo = promosFormaPago.find((p) => clavePromo(p.id) === seleccion);
        if (!promo) {
          toast.error("Elegí un descuento.");
          return;
        }
        aplicarPromoUnica(promo, vista);
        return;
      }
      const col = columnasPago.find(
        (c) => clavePago(c.pagoId, c.cuotaId) === seleccion
      );
      if (!col) {
        toast.error("Elegí una forma de pago.");
        return;
      }
      const formasCobro = formasPagoUnicasDescPromo(col.promos);
      onAplicar({
        fuente: "promo_forma_pago",
        porcentaje: 0,
        totalFacObjetivo: null,
        promoAgrupacion: "forma_pago",
        promoCandidatas: col.promos.map(aCandidataFactura),
        promoPagoIdSeleccionado: col.pagoId,
        promoCuotaIdSeleccionado: col.cuotaId,
        ...snapshotCobroDescPromo(formasCobro),
      });
      onOpenChange(false);
      return;
    }

    const pctVacio = pctNorm.trim() === "";
    const totalVacio = totalNorm.trim() === "";

    if (pctVacio && totalVacio) {
      onAplicar(null);
      onOpenChange(false);
      return;
    }

    const usarTotalFac =
      lastEdited === "total" ||
      (lastEdited !== "pct" && !totalVacio && pctVacio);

    if (usarTotalFac) {
      const pesos = parsePesosNorm(totalNorm);
      if (pesos == null) {
        toast.error("Ingresá un DESC. TOTAL válido.");
        return;
      }
      if (pesos > totalLista) {
        toast.error("El DESC. TOTAL no puede superar el TOTAL $.");
        return;
      }
      if (pesos >= totalLista) {
        onAplicar(null);
        onOpenChange(false);
        return;
      }
      onAplicar({
        fuente: "total_fac",
        porcentaje: descuentoPctDesdeTotalFac(totalLista, pesos),
        totalFacObjetivo: pesos,
      });
      onOpenChange(false);
      return;
    }

    const pct = parsePctNorm(pctNorm);
    if (pct <= 0) {
      onAplicar(null);
      onOpenChange(false);
      return;
    }
    if (pct > 100) {
      toast.error("El DESC. % no puede superar 100.");
      return;
    }
    onAplicar({
      fuente: "porcentaje",
      porcentaje: pct,
      totalFacObjetivo: null,
    });
    onOpenChange(false);
  }

  function handleQuitar() {
    onAplicar(null);
    onOpenChange(false);
  }

  const ariaTabla =
    vista === "descuento"
      ? "Descuento por porcentaje"
      : vista === "alcance"
        ? "Descuento por rubro o ítem"
        : "Descuento por forma de pago";

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && verPromo != null) return;
        onOpenChange(next);
      }}
    >
      <AppModal
        size="xl"
        padding="sm"
        title="DESCUENTO"
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="ghost" onClick={handleQuitar}>
              Quitar
            </Button>
            <Button type="button" onClick={handleAplicar}>
              Aplicar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div
            className="flex w-full min-w-0 overflow-hidden rounded-md border border-primary"
            role="radiogroup"
            aria-label="Vista del descuento"
          >
            <Button
              type="button"
              role="radio"
              aria-checked={vista === "forma_pago"}
              variant={vista === "forma_pago" ? "default" : "outline"}
              className={VISTA_BTN_CLASS}
              onClick={() => cambiarVista("forma_pago")}
            >
              Por Forma Pago
            </Button>
            <div className="w-px shrink-0 self-stretch bg-primary" aria-hidden />
            <Button
              type="button"
              role="radio"
              aria-checked={vista === "descuento"}
              variant={vista === "descuento" ? "default" : "outline"}
              className={VISTA_BTN_CLASS}
              onClick={() => cambiarVista("descuento")}
            >
              Por % Desc.
            </Button>
            <div className="w-px shrink-0 self-stretch bg-primary" aria-hidden />
            <Button
              type="button"
              role="radio"
              aria-checked={vista === "alcance"}
              variant={vista === "alcance" ? "default" : "outline"}
              className={VISTA_BTN_CLASS}
              onClick={() => cambiarVista("alcance")}
            >
              Por Rubro/Item
            </Button>
            <div className="w-px shrink-0 self-stretch bg-primary" aria-hidden />
            <Button
              type="button"
              role="radio"
              aria-checked={vista === "personalizado"}
              variant={vista === "personalizado" ? "default" : "outline"}
              className={VISTA_BTN_CLASS}
              onClick={() => cambiarVista("personalizado")}
            >
              Personalizada
            </Button>
          </div>

          {esVistaPersonalizada ? (
            <div className="flex flex-col gap-4">
              <label className="grid grid-cols-[7rem_1fr] items-center gap-3">
                <ModalMicroLabel>DESC. %</ModalMicroLabel>
                <PorcentajeCentInput
                  id="factura-desc-pct"
                  valueNormalized={pctNorm}
                  onValueNormalizedChange={handlePctChange}
                  maxCents={FACTURA_DESCUENTO_MAX_CENTS}
                  treatEmptyNormalizedAsBlank
                  pctSuffixAlwaysVisible
                  className={cn(INPUT_CONTROL_CLASS, "h-9")}
                  aria-label="Descuento porcentaje"
                />
              </label>
              <label className="grid grid-cols-[7rem_1fr] items-center gap-3">
                <ModalMicroLabel>DESC. TOTAL</ModalMicroLabel>
                <MontoArInput
                  id="factura-desc-total"
                  valueNormalized={totalNorm}
                  onValueNormalizedChange={handleTotalChange}
                  treatEmptyNormalizedAsBlank
                  className={cn(INPUT_CONTROL_CLASS, "h-9")}
                  aria-label="Descuento total factura"
                />
              </label>
            </div>
          ) : (
            <>
          <FilterBar className="filtros-contenedor-tienda shrink-0 bg-card">
            <FilterRowSelection>
              <FiltroIndividualContainer
                className={FILTER_SELECT_WRAPPER_CLASS}
                activo={filtroPago !== FILTRO_TODOS}
                onLimpiar={() => setFiltroPago(FILTRO_TODOS)}
              >
                <Select value={filtroPago} onValueChange={setFiltroPago}>
                  <SelectTrigger
                    className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                    aria-label="Forma pago"
                  >
                    <SelectValue placeholder="FORMA PAGO" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    align="start"
                    className="select-content-filtro"
                  >
                    <SelectItem value={FILTRO_TODOS}>FORMA PAGO</SelectItem>
                    {opcionesPago.map((fp) => (
                      <SelectItem
                        key={claveFormaPagoCuotaDescPromo(fp.pagoId, fp.cuotaId)}
                        value={claveFormaPagoCuotaDescPromo(fp.pagoId, fp.cuotaId)}
                      >
                        {etiquetaFormaPagoCuotaDescPromo(fp)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
              <FiltroIndividualContainer
                className={FILTER_SELECT_WRAPPER_CLASS}
                activo={filtroRubro !== FILTRO_TODOS}
                onLimpiar={() => setFiltroRubro(FILTRO_TODOS)}
              >
                <Select value={filtroRubro} onValueChange={setFiltroRubro}>
                  <SelectTrigger
                    className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                    aria-label="Rubro"
                  >
                    <SelectValue placeholder="RUBRO" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    align="start"
                    className="select-content-filtro"
                  >
                    <SelectItem value={FILTRO_TODOS}>RUBRO</SelectItem>
                    {opcionesRubro.map((rubro) => (
                      <SelectItem key={rubro.id} value={rubro.id}>
                        {rubro.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
              <div className={FILTER_SELECT_WRAPPER_CLASS}>
                <FiltroBusquedaInput
                  id="factura-desc-filtro-descripcion"
                  placeholder="DESCRIPCIÓN"
                  value={q}
                  onChange={(value) => {
                    handleQChange(value);
                    if (value.trim() === "") setQDebounced("");
                  }}
                  isDebouncing={isDebouncing}
                  inputRef={searchRef}
                />
              </div>
            </FilterRowSelection>
          </FilterBar>

          <div
            className="contenedor-tabla-gestion min-h-0 max-h-[min(28rem,50vh)] overflow-auto rounded-md border border-primary"
            aria-label={ariaTabla}
          >
            <Table
              variant="compact"
              className="tabla-gestion-compacta tabla-desc-factura w-full"
            >
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[28%]" />
                <col className="w-[24%]" />
                <col className="w-[20%]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  {vista === "descuento" ? (
                    <>
                      <TableHead className="text-center">DESC.</TableHead>
                      <TableHead>FORMA PAGO</TableHead>
                      <TableHead>ALCANCE</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>FORMA PAGO</TableHead>
                      <TableHead>ALCANCE</TableHead>
                      <TableHead className="text-center">DESC.</TableHead>
                    </>
                  )}
                  <TableHead className="text-center">ACCIONES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vista === "descuento"
                  ? gruposPct.length === 0
                    ? (
                      <EmptyTableRow colSpan={4} message="NO HAY DESCUENTOS." />
                    )
                    : gruposPct.flatMap((grupo) => {
                        const claveGrupo = `pct:${grupo.descuento}`;
                        const filas = grupo.promos.map((promo, i) => {
                          const activo = seleccion === clavePromo(promo.id);
                          const claveFila = `${claveGrupo}-${promo.id}`;
                          const hoverFilaH = handlersHoverFila(claveFila);
                          return (
                            <TableRow
                              key={promo.id}
                              className={classFilaPromo({
                                activo,
                                hoverGrupoActivo: hoverGrupo === claveGrupo,
                                hoverFilaActiva: hoverFila === claveFila,
                                esFinGrupo: i === grupo.promos.length - 1,
                              })}
                            >
                              {i === 0 ? (
                                <TableCell
                                  rowSpan={grupo.promos.length}
                                  className="celda-datos text-center font-bold tabular-nums"
                                  {...handlersHoverGrupo(claveGrupo)}
                                >
                                  {fmtCelda(textoDescuentosDescPromo(promo))}
                                </TableCell>
                              ) : null}
                              <TableCell
                                className="celda-datos uppercase"
                                {...hoverFilaH}
                              >
                                {fmtCelda(textoFormasPago(promo))}
                              </TableCell>
                              <TableCell
                                className="celda-datos uppercase"
                                {...hoverFilaH}
                              >
                                {fmtCelda(etiquetaAlcanceCondicion(promo))}
                              </TableCell>
                              <CeldaAccionesPromo
                                activo={activo}
                                etiqueta={promo.nombre}
                                hoverHandlers={hoverFilaH}
                                onSeleccionar={() =>
                                  setSeleccion(clavePromo(promo.id))
                                }
                                onVer={() => setVerPromo(promo)}
                              />
                            </TableRow>
                          );
                        });
                        return filas;
                      })
                  : vista === "alcance"
                    ? gruposAlcance.length === 0
                      ? (
                        <EmptyTableRow colSpan={4} message="NO HAY DESCUENTOS." />
                      )
                      : gruposAlcance.flatMap((grupo) => {
                          const filas = grupo.promos.map((promo, i) => {
                            const activo = seleccion === clavePromo(promo.id);
                            const claveFila = `${grupo.clave}-${promo.id}`;
                            const hoverFilaH = handlersHoverFila(claveFila);
                            return (
                              <TableRow
                                key={promo.id}
                                className={classFilaPromo({
                                  activo,
                                  hoverGrupoActivo: hoverGrupo === grupo.clave,
                                  hoverFilaActiva: hoverFila === claveFila,
                                  esFinGrupo: i === grupo.promos.length - 1,
                                })}
                              >
                                <TableCell
                                  className="celda-datos uppercase"
                                  {...hoverFilaH}
                                >
                                  {fmtCelda(textoFormasPago(promo))}
                                </TableCell>
                                {i === 0 ? (
                                  <TableCell
                                    rowSpan={grupo.promos.length}
                                    className="celda-datos font-bold uppercase"
                                    {...handlersHoverGrupo(grupo.clave)}
                                  >
                                    {fmtCelda(grupo.etiqueta)}
                                  </TableCell>
                                ) : null}
                                <TableCell
                                  className="celda-datos text-center tabular-nums"
                                  {...hoverFilaH}
                                >
                                  {fmtCelda(textoDescuentosDescPromo(promo))}
                                </TableCell>
                                <CeldaAccionesPromo
                                  activo={activo}
                                  etiqueta={promo.nombre}
                                  hoverHandlers={hoverFilaH}
                                  onSeleccionar={() =>
                                    setSeleccion(clavePromo(promo.id))
                                  }
                                  onVer={() => setVerPromo(promo)}
                                />
                              </TableRow>
                            );
                          });
                          return filas;
                        })
                    : columnasPago.length === 0
                      ? (
                        <EmptyTableRow colSpan={4} message="NO HAY DESCUENTOS." />
                      )
                      : columnasPago.flatMap((col) => {
                          const clave = clavePago(col.pagoId, col.cuotaId);
                          const grupoActivo = seleccion === clave;
                          const filas = col.promos.map((promo, i) => {
                            const claveFila = `${clave}-${promo.id}`;
                            const hoverFilaH = handlersHoverFila(claveFila);
                            return (
                            <TableRow
                              key={claveFila}
                              className={classFilaPromo({
                                activo: grupoActivo,
                                hoverGrupoActivo: hoverGrupo === clave,
                                hoverFilaActiva: hoverFila === claveFila,
                                esFinGrupo: i === col.promos.length - 1,
                              })}
                            >
                              {i === 0 ? (
                                <TableCell
                                  rowSpan={col.promos.length}
                                  className="celda-datos font-bold uppercase"
                                  {...handlersHoverGrupo(clave)}
                                >
                                  {fmtCelda(col.etiqueta)}
                                </TableCell>
                              ) : null}
                              <TableCell
                                className="celda-datos uppercase"
                                {...hoverFilaH}
                              >
                                {fmtCelda(etiquetaAlcanceCondicion(promo))}
                              </TableCell>
                              <TableCell
                                className="celda-datos text-center tabular-nums"
                                {...hoverFilaH}
                              >
                                {fmtCelda(textoDescuentosDescPromo(promo))}
                              </TableCell>
                              <CeldaAccionesPromo
                                activo={grupoActivo}
                                etiqueta={promo.nombre}
                                hoverHandlers={hoverFilaH}
                                onSeleccionar={() => setSeleccion(clave)}
                                onVer={() => setVerPromo(promo)}
                              />
                            </TableRow>
                            );
                          });
                          return filas;
                        })}
              </TableBody>
            </Table>
          </div>
            </>
          )}
        </div>
      </AppModal>
    </Dialog>
    <Dialog
      open={verPromo != null}
      onOpenChange={(next) => {
        if (!next) setVerPromo(null);
      }}
    >
      <AppModal
        title="VER DESCUENTO"
        size="md"
        actions={
          <Button type="button" variant="outline" onClick={() => setVerPromo(null)}>
            Cerrar
          </Button>
        }
      >
        {verPromo ? (
          <div className="flex flex-col gap-2">
            <LineaLecturaModal etiqueta="NOMBRE" valor={fmtCelda(verPromo.nombre)} />
            <LineaLecturaModal
              etiqueta="FORMA DE PAGO"
              valor={fmtCelda(textoFormasPago(verPromo))}
            />
            <LineaLecturaModal
              etiqueta="DESCUENTO"
              valor={fmtCelda(textoDescuentosDescPromo(verPromo))}
              tabular
            />
            <LineaLecturaModal
              etiqueta="ALCANCE"
              valor={fmtCelda(textoAlcanceDetalle(verPromo))}
            />
          </div>
        ) : null}
      </AppModal>
    </Dialog>
    </>
  );
}
