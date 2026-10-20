"use client";

import { useMemo, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import LineaLecturaModal from "@/components/shared/LineaLecturaModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import MontoArInput from "@/components/shared/MontoArInput";
import PorcentajeCentInput from "@/components/shared/PorcentajeCentInput";
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
  formasPagoUnicasDescPromo,
  cuotasDeMedioPagoDescPromo,
  esDescPromoEspecial,
  etiquetaAlcanceCondicion,
  etiquetaFormaPagoCuotaDescPromo,
  filtrarPromosDescPromoFactura,
  lineasEtiquetaCuotaDescPromo,
  mediosPagoUnicosDescPromo,
  ordenarPromosPorDescFactura,
  snapshotCobroDescPromo,
  textoDescuentosDescPromo,
  type DescPromoFila,
  type DescPromoFormaPagoRef,
  type DescPromoItemRef,
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
type VistaDescPromo = "descuentos" | "personalizado";
const VISTAS_DESC_PROMO: { id: VistaDescPromo; etiqueta: string }[] = [
  { id: "descuentos", etiqueta: "DESC. POR FORMA PAGO" },
  { id: "personalizado", etiqueta: "PERSONALIZADO" },
];
const VISTA_BTN_CLASS =
  "h-10 min-w-0 flex-1 rounded-none border-0 shadow-none";
const BOTON_FORMA_PAGO_CLASS =
  "h-16 w-[6.5rem] shrink-0 flex-col gap-1 whitespace-normal border border-primary px-2 py-1.5";
const BOTON_CUOTA_CLASS =
  "h-12 w-[5.25rem] shrink-0 flex-col gap-0.5 whitespace-normal border border-primary px-1 py-1";
function CeldaAccionesPromo({
  etiqueta,
  onVer,
  rowSpan,
}: {
  etiqueta: string;
  onVer?: () => void;
  rowSpan?: number;
}) {
  return (
    <TableCell
      rowSpan={rowSpan}
      className="celda-datos celda-datos--accion-relleno-fila p-0"
    >
      <div className={cn(TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS, "justify-center")}>
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
 * Modal de descuento de Factura · Crear: DESC. POR FORMA PAGO / PERSONALIZADO.
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
  const descuentoAlAbrirRef = useRef(descuentoActual);
  const cierreConfirmadoRef = useRef(false);

  const promosCatalogo = useMemo(
    () => promosFormaPago.filter((fila) => !esDescPromoEspecial(fila)),
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
  const promosFiltradas = useMemo(
    () => filtrarPromosDescPromoFactura(promosCatalogo, filtroPago, filtroCuota),
    [promosCatalogo, filtroPago, filtroCuota]
  );

  const promosOrdenadas = useMemo(
    () => ordenarPromosPorDescFactura(promosFiltradas),
    [promosFiltradas]
  );
  const esVistaPersonalizada = vista === "personalizado";

  function cambiarVista(next: VistaDescPromo) {
    setVista(next);
    if (next === "personalizado") {
      setSeleccion(SELECCION_PERSONALIZADO);
      return;
    }
    if (seleccion === SELECCION_PERSONALIZADO) {
      setSeleccion("");
    }
  }

  function seleccionarMedioPago(pagoId: string) {
    setVista("descuentos");
    setFiltroPago(pagoId);
    setFiltroCuota("");
  }

  function seleccionarCuota(cuotaId: string) {
    setFiltroCuota((actual) => (actual === cuotaId ? "" : cuotaId));
  }

  function aplicarMedioPago(pagoId: string, cuotaId?: string) {
    setVista("descuentos");
    setFiltroPago(pagoId);
    setFiltroCuota(cuotaId ?? "");
    const filas = filtrarPromosDescPromoFactura(
      promosCatalogo,
      pagoId,
      cuotaId
    );
    if (filas.length === 0) return;
    const especiales = filtrarPromosDescPromoFactura(
      promosFormaPago.filter(esDescPromoEspecial),
      pagoId,
      cuotaId
    );
    const formas = formasPagoUnicasDescPromo(filas);
    const elegida = cuotaId
      ? formas.find((fp) => fp.pagoId === pagoId && fp.cuotaId === cuotaId)
      : formas.find((fp) => fp.pagoId === pagoId);
    onAplicar({
      fuente: "promo_forma_pago",
      porcentaje: 0,
      totalFacObjetivo: null,
      promoAgrupacion: "forma_pago",
      // Especiales (alcance ITEMS) compiten por prioridad en cada línea; van al final porque
      // `estadoInicial` toma la primera candidata como selección del catálogo.
      promoCandidatas: [...filas, ...especiales].map(aCandidataFactura),
      promoPagoIdSeleccionado: pagoId,
      promoCuotaIdSeleccionado: elegida?.cuotaId ?? cuotaId ?? null,
      ...snapshotCobroDescPromo(formas),
    });
  }

  function handleAplicarFormaPago() {
    if (!filtroPago) return;
    aplicarMedioPago(filtroPago, filtroCuota || undefined);
    cierreConfirmadoRef.current = true;
    onOpenChange(false);
  }

  function handleCancelar() {
    cierreConfirmadoRef.current = true;
    onAplicar(descuentoAlAbrirRef.current);
    onOpenChange(false);
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

  function handleAplicar() {
    const pctVacio = pctNorm.trim() === "";
    const totalVacio = totalNorm.trim() === "";

    if (pctVacio && totalVacio) {
      cierreConfirmadoRef.current = true;
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
        cierreConfirmadoRef.current = true;
        onAplicar(null);
        onOpenChange(false);
        return;
      }
      cierreConfirmadoRef.current = true;
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
      cierreConfirmadoRef.current = true;
      onAplicar(null);
      onOpenChange(false);
      return;
    }
    if (pct > 100) {
      toast.error("El DESC. % no puede superar 100.");
      return;
    }
    cierreConfirmadoRef.current = true;
    onAplicar({
      fuente: "porcentaje",
      porcentaje: pct,
      totalFacObjetivo: null,
    });
    onOpenChange(false);
  }

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          onOpenChange(true);
          return;
        }
        if (verPromo != null || verItems != null) {
          return;
        }
        if (!cierreConfirmadoRef.current) {
          onAplicar(descuentoAlAbrirRef.current);
        }
        cierreConfirmadoRef.current = false;
        onOpenChange(false);
      }}
    >
      <AppModal
        size="xl"
        padding="sm"
        scrollBody={false}
        className="h-[85vh]"
        bodyClassName="flex-1"
        title="DESCUENTO"
        actions={
          <>
            <Button type="button" variant="outline" onClick={handleCancelar}>
              Cancelar
            </Button>
            {esVistaPersonalizada ? (
              <Button type="button" onClick={handleAplicar}>
                Aplicar
              </Button>
            ) : null}
          </>
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-4">
          <div
            className="flex w-full min-w-0 shrink-0 overflow-hidden rounded-md border border-primary"
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

          {esVistaPersonalizada ? null : (
          <div className="grid shrink-0 grid-cols-[minmax(0,9fr)_minmax(0,1fr)] items-stretch gap-2">
            <div className="flex min-w-0 flex-col gap-2">
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
                    onClick={() => seleccionarMedioPago(pago.pagoId)}
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
          <div
            role={opcionesCuota.length > 0 ? "radiogroup" : undefined}
            aria-label={opcionesCuota.length > 0 ? "Cuotas" : undefined}
            aria-hidden={opcionesCuota.length === 0}
            className="flex min-h-12 flex-wrap justify-center gap-2"
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
                  onClick={() => seleccionarCuota(cuota.cuotaId ?? "")}
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
            </div>
            <Button
              type="button"
              className="h-full min-h-0 w-full px-1 whitespace-normal"
              disabled={!filtroPago}
              onClick={handleAplicarFormaPago}
            >
              Aplicar
            </Button>
          </div>
          )}
          {esVistaPersonalizada ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
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
          <div
            className="contenedor-tabla-gestion min-h-0 flex-1 overflow-auto rounded-md border border-primary"
            aria-label="Descuentos"
          >
            <Table
              variant="compact"
              className="tabla-gestion-compacta w-full"
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
                    const formas: DescPromoFormaPagoRef[] =
                      promo.formasPago.length > 0 ? promo.formasPago : [];
                    const nFilas = Math.max(formas.length, 1);
                    return Array.from({ length: nFilas }, (_, i) => {
                      const fp = formas[i] ?? null;
                      const claveFila = `${clave}-${fp ? claveFormaPagoCuotaDescPromo(fp.pagoId, fp.cuotaId) : i}`;
                      return (
                        <TableRow key={claveFila}>
                          {i === 0 ? (
                            <CeldaAccionesPromo
                              etiqueta={promo.nombre}
                              rowSpan={nFilas}
                              onVer={() => setVerPromo(promo)}
                            />
                          ) : null}
                          {i === 0 ? (
                            <TableCell
                              rowSpan={nFilas}
                              className="celda-datos font-bold uppercase"
                            >
                              {fmtCelda(promo.nombre)}
                            </TableCell>
                          ) : null}
                          {i === 0 ? (
                            <TableCell
                              rowSpan={nFilas}
                              className="celda-datos text-center tabular-nums"
                            >
                              {fmtCelda(textoDescuentosDescPromo(promo))}
                            </TableCell>
                          ) : null}
                          <TableCell className="celda-datos uppercase">
                            {fmtCelda(
                              fp ? etiquetaFormaPagoCuotaDescPromo(fp) : ""
                            )}
                          </TableCell>
                          {i === 0 ? (
                            <TableCell
                              rowSpan={nFilas}
                              className="celda-datos uppercase"
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
    </>
  );
}
