"use client";

import { useMemo, useState } from "react";
import { Check, Eye } from "lucide-react";
import { toast } from "sonner";
import FilterBar, {
  FILTER_SELECT_WRAPPER_CLASS,
  FiltroIndividualContainer,
  FilaFiltrosDesplegables,
  SELECT_TRIGGER_FILTER_CLASS,
} from "@/components/FilterBar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
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
  agruparItemsDescPromoEspeciales,
  claveFormaPagoCuotaDescPromo,
  cuotasDeMedioPagoDescPromo,
  esDescPromoEspecial,
  etiquetaAlcanceCondicion,
  etiquetaFormaPagoCuotaDescPromo,
  filtrarItemsDescPromoEspeciales,
  filtrarPromosDescPromoFactura,
  lineasEtiquetaCuotaDescPromo,
  mediosPagoUnicosDescPromo,
  ordenarPromosPorDescFactura,
  snapshotCobroDescPromo,
  textoDescuentosDescPromo,
  type DescPromoFila,
  type DescPromoFormaPagoRef,
  type DescPromoItemRef,
  type ItemDescPromoEspecialFactura,
} from "@/lib/descPromo";
import { fmtCelda } from "@/lib/format";
import {
  descuentoPctDesdeTotalFac,
  FACTURA_DESCUENTO_MAX_CENTS,
  totalFacDesdeDescuentoPct,
  type FacturaDescuentoEstado,
} from "@/lib/factura";
import { iconoFormaPagoDesdeNombre } from "@/lib/finAnaCosFinaPagos";
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
type VistaDescPromo = "descuentos" | "especiales" | "personalizado";
const VISTAS_DESC_PROMO: { id: VistaDescPromo; etiqueta: string }[] = [
  { id: "descuentos", etiqueta: "DESCUENTOS" },
  { id: "especiales", etiqueta: "DESCUENTOS ESPECIALES" },
  { id: "personalizado", etiqueta: "PERSONALIZADO" },
];
const VISTA_BTN_CLASS =
  "h-10 min-w-0 flex-1 rounded-none border-0 shadow-none";
const BOTON_FORMA_PAGO_CLASS =
  "h-16 w-[6.5rem] shrink-0 flex-col gap-1 whitespace-normal border border-primary px-2 py-1.5";
const BOTON_CUOTA_CLASS =
  "h-12 w-[5.25rem] shrink-0 flex-col gap-0.5 whitespace-normal border border-primary px-1 py-1";
const FILA_PROMO_ACTIVA_CLASS = "tabla-desc-factura-fila-activa";
const FILA_PROMO_HOVER_CLASS = "tabla-desc-factura-fila-hover";

function CeldaAccionesPromo({
  activo,
  etiqueta,
  onAplicar,
  onVer,
  rowSpan,
  hoverHandlers,
}: {
  activo: boolean;
  etiqueta: string;
  onAplicar?: () => void;
  onVer?: () => void;
  rowSpan?: number;
  hoverHandlers?: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}) {
  return (
    <TableCell
      rowSpan={rowSpan}
      className="celda-datos celda-datos--accion-relleno-fila p-0"
      {...hoverHandlers}
    >
      <div className={cn(TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS, "justify-center")}>
        {onAplicar ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
            title="Aplicar"
            aria-label={`Aplicar ${etiqueta}`}
            aria-pressed={activo}
            onClick={(e) => {
              e.stopPropagation();
              onAplicar();
            }}
          >
            <Check className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
          </Button>
        ) : null}
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

function promoTieneItems(promo: DescPromoFila): boolean {
  return esDescPromoEspecial(promo) && promo.items.length > 0;
}

function clavePromo(promoId: string): string {
  return `promo:${promoId}`;
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
    const promoId = descuentoActual.promoCandidatas?.[0]?.id;
    if (promoId) {
      return {
        ...vacioLista,
        seleccion: clavePromo(promoId),
        vista: "descuentos",
      };
    }
  }
  if (descuentoActual == null || descuentoActual.porcentaje <= 0) {
    return {
      ...vacioLista,
      seleccion: SELECCION_PERSONALIZADO,
      vista: "descuentos",
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
 * Modal de descuento de Factura · Crear: DESCUENTOS / DESC. ESPECIALES / PERSONALIZADO.
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
  const [verItems, setVerItems] = useState<DescPromoItemRef[] | null>(null);
  const [verItemEspecial, setVerItemEspecial] =
    useState<ItemDescPromoEspecialFactura | null>(null);
  const [hoverGrupo, setHoverGrupo] = useState<string | null>(null);
  const [hoverFila, setHoverFila] = useState<string | null>(null);
  const [filtroPago, setFiltroPago] = useState(
    descuentoActual?.fuente === "promo_forma_pago"
      ? descuentoActual.promoPagoIdSeleccionado ?? ""
      : ""
  );
  const [filtroCuota, setFiltroCuota] = useState(
    descuentoActual?.fuente === "promo_forma_pago"
      ? descuentoActual.promoCuotaIdSeleccionado ?? ""
      : ""
  );
  const [filtroMarcaEspecial, setFiltroMarcaEspecial] = useState(FILTRO_TODOS);
  const [filtroRubroEspecial, setFiltroRubroEspecial] = useState(FILTRO_TODOS);
  const [filtroDescEspecial, setFiltroDescEspecial] = useState(FILTRO_TODOS);

  const promosCatalogo = useMemo(
    () => promosFormaPago.filter((fila) => !esDescPromoEspecial(fila)),
    [promosFormaPago]
  );
  const itemsEspeciales = useMemo(
    () => agruparItemsDescPromoEspeciales(promosFormaPago),
    [promosFormaPago]
  );

  const opcionesPago = useMemo(
    () => mediosPagoUnicosDescPromo(promosCatalogo),
    [promosCatalogo]
  );
  const opcionesCuota = useMemo(
    () => cuotasDeMedioPagoDescPromo(promosCatalogo, filtroPago),
    [promosCatalogo, filtroPago]
  );
  const opcionesMarcaEspecial = useMemo(() => {
    const map = new Map<string, string>();
    for (const fila of itemsEspeciales) {
      if (fila.item.idMarca && fila.item.marcaNombre) {
        map.set(fila.item.idMarca, fila.item.marcaNombre);
      }
    }
    return [...map.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [itemsEspeciales]);
  const opcionesRubroEspecial = useMemo(() => {
    const map = new Map<string, string>();
    for (const fila of itemsEspeciales) {
      if (fila.item.idRubro && fila.item.rubroNombre) {
        map.set(fila.item.idRubro, fila.item.rubroNombre);
      }
    }
    return [...map.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [itemsEspeciales]);
  const opcionesDescripcionEspecial = useMemo(
    () =>
      itemsEspeciales
        .map((fila) => ({
          id: fila.item.codTienda,
          nombre: fila.item.descripcion || fila.item.codTienda,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [itemsEspeciales]
  );

  const promosFiltradas = useMemo(
    () => filtrarPromosDescPromoFactura(promosCatalogo, filtroPago, filtroCuota),
    [promosCatalogo, filtroPago, filtroCuota]
  );

  const promosOrdenadas = useMemo(
    () => ordenarPromosPorDescFactura(promosFiltradas),
    [promosFiltradas]
  );
  const itemsEspecialesFiltrados = useMemo(
    () =>
      filtrarItemsDescPromoEspeciales(itemsEspeciales, {
        idMarca: filtroMarcaEspecial === FILTRO_TODOS ? "" : filtroMarcaEspecial,
        idRubro: filtroRubroEspecial === FILTRO_TODOS ? "" : filtroRubroEspecial,
        codTienda: filtroDescEspecial === FILTRO_TODOS ? "" : filtroDescEspecial,
      }),
    [itemsEspeciales, filtroMarcaEspecial, filtroRubroEspecial, filtroDescEspecial]
  );
  const esVistaPersonalizada = vista === "personalizado";
  const esVistaEspeciales = vista === "especiales";

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
    esInicioGrupo: boolean;
    esFinGrupo: boolean;
  }): string {
    return cn(
      opts.activo && FILA_PROMO_ACTIVA_CLASS,
      !opts.activo &&
        (opts.hoverGrupoActivo || opts.hoverFilaActiva) &&
        FILA_PROMO_HOVER_CLASS,
      opts.esInicioGrupo && "tabla-desc-factura-grupo-inicio",
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

  function aplicarPromo(promo: DescPromoFila) {
    const elegida =
      promo.formasPago.find(
        (fp) =>
          fp.pagoId === filtroPago &&
          (!filtroCuota || fp.cuotaId === filtroCuota)
      ) ??
      promo.formasPago.find((fp) => fp.pagoId === filtroPago) ??
      promo.formasPago[0] ??
      null;
    onAplicar({
      fuente: "promo_forma_pago",
      porcentaje: 0,
      totalFacObjetivo: null,
      promoAgrupacion: "forma_pago",
      promoCandidatas: [aCandidataFactura(promo)],
      promoPagoIdSeleccionado: elegida?.pagoId ?? null,
      promoCuotaIdSeleccionado: elegida?.cuotaId ?? null,
      ...snapshotCobroDescPromo(promo.formasPago),
    });
    onOpenChange(false);
  }

  function handleAplicar() {
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

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && (verPromo != null || verItems != null || verItemEspecial != null))
          return;
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
            {esVistaPersonalizada ? (
              <Button type="button" onClick={handleAplicar}>
                Aplicar
              </Button>
            ) : null}
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div
            role="radiogroup"
            aria-label="Forma de pago"
            className="flex flex-wrap justify-center gap-2"
          >
            {opcionesPago.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                No hay formas de pago en los descuentos.
              </p>
            ) : (
              opcionesPago.map((pago) => {
                const Icono = iconoFormaPagoDesdeNombre(pago.nombre);
                const seleccionado = pago.pagoId === filtroPago;
                return (
                  <Button
                    key={pago.pagoId}
                    type="button"
                    role="radio"
                    aria-checked={seleccionado}
                    variant={seleccionado ? "default" : "outline"}
                    className={BOTON_FORMA_PAGO_CLASS}
                    onClick={() => {
                      setFiltroPago(pago.pagoId);
                      setFiltroCuota("");
                    }}
                  >
                    <Icono className="size-5 shrink-0" aria-hidden />
                    <span className="line-clamp-2 text-center text-[0.65rem] font-semibold uppercase leading-tight tracking-wide">
                      {pago.nombre}
                    </span>
                  </Button>
                );
              })
            )}
          </div>
          {opcionesCuota.length > 0 ? (
            <div
              role="radiogroup"
              aria-label="Cuotas"
              className="flex flex-wrap justify-center gap-2"
            >
              {opcionesCuota.map((cuota) => {
                const lineas = lineasEtiquetaCuotaDescPromo(cuota.cuotaEtiqueta);
                const seleccionado = cuota.cuotaId === filtroCuota;
                const etiqueta = cuota.cuotaEtiqueta ?? "";
                return (
                  <Button
                    key={cuota.cuotaId ?? etiqueta}
                    type="button"
                    role="radio"
                    aria-checked={seleccionado}
                    variant={seleccionado ? "default" : "outline"}
                    className={BOTON_CUOTA_CLASS}
                    onClick={() =>
                      setFiltroCuota((actual) =>
                        actual === cuota.cuotaId ? "" : (cuota.cuotaId ?? "")
                      )
                    }
                  >
                    <span className="text-center text-sm font-semibold tabular-nums leading-none">
                      {lineas.linea1}
                    </span>
                    {lineas.linea2 ? (
                      <span className="line-clamp-1 text-center text-[0.6rem] font-semibold uppercase leading-tight tracking-wide">
                        {lineas.linea2}
                      </span>
                    ) : null}
                  </Button>
                );
              })}
            </div>
          ) : null}
          <div
            className="flex w-full min-w-0 overflow-hidden rounded-md border border-primary"
            role="radiogroup"
            aria-label="Vista del descuento"
          >
            {VISTAS_DESC_PROMO.map((opcion, i) => (
              <div key={opcion.id} className="flex min-w-0 flex-1">
                {i > 0 ? (
                  <div
                    className="w-px shrink-0 self-stretch bg-primary"
                    aria-hidden
                  />
                ) : null}
                <Button
                  type="button"
                  role="radio"
                  aria-checked={vista === opcion.id}
                  variant={vista === opcion.id ? "default" : "outline"}
                  className={VISTA_BTN_CLASS}
                  onClick={() => cambiarVista(opcion.id)}
                >
                  {opcion.etiqueta}
                </Button>
              </div>
            ))}
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
          ) : esVistaEspeciales ? (
            <>
          <FilterBar className="filtros-contenedor-tienda shrink-0 bg-card">
            <FilaFiltrosDesplegables columnas={4}>
              <FiltroIndividualContainer
                className={FILTER_SELECT_WRAPPER_CLASS}
                activo={filtroMarcaEspecial !== FILTRO_TODOS}
                onLimpiar={() => setFiltroMarcaEspecial(FILTRO_TODOS)}
              >
                <Select
                  value={filtroMarcaEspecial}
                  onValueChange={setFiltroMarcaEspecial}
                >
                  <SelectTrigger
                    className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                    aria-label="Marca"
                  >
                    <SelectValue placeholder="MARCA" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    align="start"
                    className="select-content-filtro"
                  >
                    <SelectItem value={FILTRO_TODOS}>MARCA</SelectItem>
                    {opcionesMarcaEspecial.map((marca) => (
                      <SelectItem key={marca.id} value={marca.id}>
                        {marca.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
              <FiltroIndividualContainer
                className={FILTER_SELECT_WRAPPER_CLASS}
                activo={filtroRubroEspecial !== FILTRO_TODOS}
                onLimpiar={() => setFiltroRubroEspecial(FILTRO_TODOS)}
              >
                <Select
                  value={filtroRubroEspecial}
                  onValueChange={setFiltroRubroEspecial}
                >
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
                    {opcionesRubroEspecial.map((rubro) => (
                      <SelectItem key={rubro.id} value={rubro.id}>
                        {rubro.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
              <FiltroIndividualContainer
                className={FILTER_SELECT_WRAPPER_CLASS}
                activo={filtroDescEspecial !== FILTRO_TODOS}
                onLimpiar={() => setFiltroDescEspecial(FILTRO_TODOS)}
              >
                <Select
                  value={filtroDescEspecial}
                  onValueChange={setFiltroDescEspecial}
                >
                  <SelectTrigger
                    className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                    aria-label="Descripción"
                  >
                    <SelectValue placeholder="DESCRIPCIÓN" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    align="start"
                    className="select-content-filtro"
                  >
                    <SelectItem value={FILTRO_TODOS}>DESCRIPCIÓN</SelectItem>
                    {opcionesDescripcionEspecial.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
            </FilaFiltrosDesplegables>
          </FilterBar>

          <div
            className="contenedor-tabla-gestion min-h-0 max-h-[min(28rem,50vh)] overflow-auto rounded-md border border-primary"
            aria-label="Descuentos especiales"
          >
            <Table
              variant="compact"
              className="tabla-gestion-compacta tabla-desc-factura w-full"
            >
              <colgroup>
                <col className="w-[10%]" />
                <col className="w-[30%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[18%]" />
                <col className="w-[10%]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">ACCIONES</TableHead>
                  <TableHead>DESCRIPCIÓN</TableHead>
                  <TableHead>MARCA</TableHead>
                  <TableHead>RUBRO</TableHead>
                  <TableHead>NOMBRE DEL DESC.</TableHead>
                  <TableHead className="text-center">DESC.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsEspecialesFiltrados.length === 0 ? (
                  <EmptyTableRow
                    colSpan={6}
                    message="NO HAY DESCUENTOS ESPECIALES."
                  />
                ) : (
                  itemsEspecialesFiltrados.flatMap((fila) => {
                    const nFilas = Math.max(fila.promos.length, 1);
                    const clave = `esp:${fila.item.codTienda}`;
                    const hoverGrupoH = handlersHoverGrupo(clave);
                    return Array.from({ length: nFilas }, (_, i) => {
                      const promo = fila.promos[i] ?? null;
                      const claveFila = `${clave}-${promo?.id ?? i}`;
                      return (
                        <TableRow
                          key={claveFila}
                          className={classFilaPromo({
                            activo: false,
                            hoverGrupoActivo: hoverGrupo === clave,
                            hoverFilaActiva: false,
                            esInicioGrupo: i === 0,
                            esFinGrupo: i === nFilas - 1,
                          })}
                        >
                          {i === 0 ? (
                            <CeldaAccionesPromo
                              activo={false}
                              etiqueta={
                                fila.item.descripcion || fila.item.codTienda
                              }
                              rowSpan={nFilas}
                              hoverHandlers={hoverGrupoH}
                              onVer={() => setVerItemEspecial(fila)}
                            />
                          ) : null}
                          {i === 0 ? (
                            <TableCell
                              rowSpan={nFilas}
                              className="celda-datos uppercase"
                              {...hoverGrupoH}
                            >
                              {fmtCelda(
                                fila.item.descripcion || fila.item.codTienda
                              )}
                            </TableCell>
                          ) : null}
                          {i === 0 ? (
                            <TableCell
                              rowSpan={nFilas}
                              className="celda-datos uppercase"
                              {...hoverGrupoH}
                            >
                              {fmtCelda(fila.item.marcaNombre)}
                            </TableCell>
                          ) : null}
                          {i === 0 ? (
                            <TableCell
                              rowSpan={nFilas}
                              className="celda-datos uppercase"
                              {...hoverGrupoH}
                            >
                              {fmtCelda(fila.item.rubroNombre)}
                            </TableCell>
                          ) : null}
                          <TableCell
                            className="celda-datos font-bold uppercase"
                            {...hoverGrupoH}
                          >
                            {fmtCelda(promo?.nombre)}
                          </TableCell>
                          <TableCell
                            className="celda-datos text-center tabular-nums"
                            {...hoverGrupoH}
                          >
                            {fmtCelda(
                              promo ? textoDescuentosDescPromo(promo) : ""
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })
                )}
              </TableBody>
            </Table>
          </div>
            </>
          ) : (
            <>
          <div
            className="contenedor-tabla-gestion min-h-0 max-h-[min(28rem,50vh)] overflow-auto rounded-md border border-primary"
            aria-label="Descuentos"
          >
            <Table
              variant="compact"
              className="tabla-gestion-compacta tabla-desc-factura w-full"
            >
              <colgroup>
                <col className="w-[12%]" />
                <col className="w-[28%]" />
                <col className="w-[12%]" />
                <col className="w-[28%]" />
                <col className="w-[20%]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">ACCIONES</TableHead>
                  <TableHead>NOMBRE DEL DESC.</TableHead>
                  <TableHead className="text-center">DESC.</TableHead>
                  <TableHead>FORMA PAGO</TableHead>
                  <TableHead>ALCANCE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promosOrdenadas.length === 0 ? (
                  <EmptyTableRow
                    colSpan={5}
                    message={
                      filtroPago
                        ? "NO HAY DESCUENTOS."
                        : "ELEGÍ UNA FORMA DE PAGO."
                    }
                  />
                ) : (
                  promosOrdenadas.flatMap((promo) => {
                    const clave = clavePromo(promo.id);
                    const grupoActivo = seleccion === clave;
                    const hoverGrupoH = handlersHoverGrupo(clave);
                    const formas: DescPromoFormaPagoRef[] =
                      promo.formasPago.filter(
                        (fp) =>
                          fp.pagoId === filtroPago &&
                          (!filtroCuota || fp.cuotaId === filtroCuota)
                      );
                    const nFilas = Math.max(formas.length, 1);
                    return Array.from({ length: nFilas }, (_, i) => {
                      const fp = formas[i] ?? null;
                      const claveFila = `${clave}-${fp ? claveFormaPagoCuotaDescPromo(fp.pagoId, fp.cuotaId) : i}`;
                      const hoverFilaH = handlersHoverFila(claveFila);
                      return (
                        <TableRow
                          key={claveFila}
                          className={classFilaPromo({
                            activo: grupoActivo,
                            hoverGrupoActivo: hoverGrupo === clave,
                            hoverFilaActiva: hoverFila === claveFila,
                            esInicioGrupo: i === 0,
                            esFinGrupo: i === nFilas - 1,
                          })}
                        >
                          {i === 0 ? (
                            <CeldaAccionesPromo
                              activo={grupoActivo}
                              etiqueta={promo.nombre}
                              rowSpan={nFilas}
                              hoverHandlers={hoverGrupoH}
                              onAplicar={() => aplicarPromo(promo)}
                              onVer={() => setVerPromo(promo)}
                            />
                          ) : null}
                          {i === 0 ? (
                            <TableCell
                              rowSpan={nFilas}
                              className="celda-datos font-bold uppercase"
                              {...hoverGrupoH}
                            >
                              {fmtCelda(promo.nombre)}
                            </TableCell>
                          ) : null}
                          {i === 0 ? (
                            <TableCell
                              rowSpan={nFilas}
                              className="celda-datos text-center tabular-nums"
                              {...hoverGrupoH}
                            >
                              {fmtCelda(textoDescuentosDescPromo(promo))}
                            </TableCell>
                          ) : null}
                          <TableCell
                            className="celda-datos uppercase"
                            {...hoverFilaH}
                          >
                            {fmtCelda(
                              fp ? etiquetaFormaPagoCuotaDescPromo(fp) : ""
                            )}
                          </TableCell>
                          {i === 0 ? (
                            <TableCell
                              rowSpan={nFilas}
                              className="celda-datos uppercase"
                              {...hoverGrupoH}
                            >
                              {fmtCelda(etiquetaAlcanceCondicion(promo))}
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    });
                  })
                )}
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
        if (!next && verItems != null) return;
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
          <div className="flex flex-col gap-3">
            <LineaLecturaModal
              etiqueta="NOMBRE"
              valor={fmtCelda(verPromo.nombre)}
            />
            <LineaLecturaModal
              etiqueta="DESC."
              valor={fmtCelda(textoDescuentosDescPromo(verPromo))}
              tabular
            />
            <div className="contenedor-tabla-gestion min-h-0 overflow-auto rounded-md border border-primary">
              <Table variant="compact" className="tabla-gestion-compacta w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">ACCIONES</TableHead>
                    <TableHead>ALCANCE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="celda-datos celda-datos--accion-relleno-fila p-0">
                      {promoTieneItems(verPromo) ? (
                        <div
                          className={cn(
                            TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
                            "justify-center"
                          )}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                            title="Ver"
                            aria-label="Ver ítems"
                            onClick={() => setVerItems(verPromo.items)}
                          >
                            <Eye className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="celda-datos uppercase">
                      {fmtCelda(etiquetaAlcanceCondicion(verPromo))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div className="contenedor-tabla-gestion min-h-0 max-h-[min(20rem,40vh)] overflow-auto rounded-md border border-primary">
              <Table variant="compact" className="tabla-gestion-compacta w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>FORMA PAGO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verPromo.formasPago.length === 0 ? (
                    <EmptyTableRow colSpan={1} message="NO HAY FORMAS DE PAGO." />
                  ) : (
                    verPromo.formasPago.map((fp) => (
                      <TableRow
                        key={claveFormaPagoCuotaDescPromo(fp.pagoId, fp.cuotaId)}
                      >
                        <TableCell className="celda-datos uppercase">
                          {fmtCelda(etiquetaFormaPagoCuotaDescPromo(fp))}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </AppModal>
    </Dialog>
    <Dialog
      open={verItems != null}
      onOpenChange={(next) => {
        if (!next) setVerItems(null);
      }}
    >
      <AppModal
        title="VER ÍTEMS"
        size="md"
        actions={
          <Button type="button" variant="outline" onClick={() => setVerItems(null)}>
            Cerrar
          </Button>
        }
      >
        <div className="contenedor-tabla-gestion min-h-0 max-h-[min(20rem,40vh)] overflow-auto rounded-md border border-primary">
          <Table variant="compact" className="tabla-gestion-compacta w-full">
            <TableHeader>
              <TableRow>
                <TableHead>DESCRIPCIÓN</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(verItems ?? []).length === 0 ? (
                <EmptyTableRow colSpan={1} message="NO HAY ÍTEMS." />
              ) : (
                (verItems ?? []).map((item) => (
                  <TableRow key={item.codTienda}>
                    <TableCell className="celda-datos uppercase">
                      {fmtCelda(item.descripcion || item.codTienda)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </AppModal>
    </Dialog>
    <Dialog
      open={verItemEspecial != null}
      onOpenChange={(next) => {
        if (!next) setVerItemEspecial(null);
      }}
    >
      <AppModal
        title="VER DESC. ESPECIAL"
        size="md"
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => setVerItemEspecial(null)}
          >
            Cerrar
          </Button>
        }
      >
        {verItemEspecial ? (
          <div className="flex flex-col gap-3">
            <LineaLecturaModal
              etiqueta="DESCRIPCIÓN"
              valor={fmtCelda(
                verItemEspecial.item.descripcion || verItemEspecial.item.codTienda
              )}
            />
            <LineaLecturaModal
              etiqueta="MARCA"
              valor={fmtCelda(verItemEspecial.item.marcaNombre)}
            />
            <LineaLecturaModal
              etiqueta="RUBRO"
              valor={fmtCelda(verItemEspecial.item.rubroNombre)}
            />
            <div className="contenedor-tabla-gestion min-h-0 max-h-[min(20rem,40vh)] overflow-auto rounded-md border border-primary">
              <Table variant="compact" className="tabla-gestion-compacta w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>NOMBRE DEL DESC.</TableHead>
                    <TableHead className="text-center">DESC.</TableHead>
                    <TableHead>FORMA PAGO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verItemEspecial.promos.length === 0 ? (
                    <EmptyTableRow
                      colSpan={3}
                      message="NO HAY DESCUENTOS ESPECIALES."
                    />
                  ) : (
                    verItemEspecial.promos.map((promo) => (
                      <TableRow key={promo.id}>
                        <TableCell className="celda-datos uppercase">
                          {fmtCelda(promo.nombre)}
                        </TableCell>
                        <TableCell className="celda-datos text-center tabular-nums">
                          {fmtCelda(textoDescuentosDescPromo(promo))}
                        </TableCell>
                        <TableCell className="celda-datos uppercase">
                          {fmtCelda(
                            promo.formasPago
                              .map(etiquetaFormaPagoCuotaDescPromo)
                              .join(" · ")
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </AppModal>
    </Dialog>
    </>
  );
}
