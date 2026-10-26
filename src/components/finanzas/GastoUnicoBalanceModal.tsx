"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FILTER_SELECT_WRAPPER_CLASS, FiltroIndividualContainer } from "@/components/FilterBar";
import MontoArInput from "@/components/shared/MontoArInput";
import {
  crearFinBalImputacionGastoUnicoAction,
  listarFinBalGastosFinalesNoMensualesAction,
} from "@/actions/finBalGastoMensualBalance";
import type { FinBalGastoFinalNoMensualListItem } from "@/services/finBalGastoMensualBalance.service";
import { montoArNormalizedStringToPesosIntRounded } from "@/lib/montoArMask";
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mes: number;
  anio: number;
  sucursalesCentroCosto: { id: string; nombre: string }[];
  onSuccess?: () => void;
}

type Vista = "lista" | "formulario";

export default function GastoUnicoBalanceModal({
  open,
  onOpenChange,
  mes,
  anio,
  sucursalesCentroCosto,
  onSuccess,
}: Props) {
  const [vista, setVista] = useState<Vista>("lista");
  const [items, setItems] = useState<FinBalGastoFinalNoMensualListItem[]>([]);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [seleccion, setSeleccion] = useState<FinBalGastoFinalNoMensualListItem | null>(null);
  const [montoNorm, setMontoNorm] = useState("");
  const [pagadoNorm, setPagadoNorm] = useState("");
  const [fechaGasto, setFechaGasto] = useState("");
  const [plazoPago, setPlazoPago] = useState<string>("");
  const [guardando, setGuardando] = useState(false);
  /** Opcional; acota por rubro. */
  const [filtRubro, setFiltRubro] = useState("");
  /** Opcional; acota a un gasto eventual del catálogo (`gasto_final_id`). */
  const [filtGastoFinalId, setFiltGastoFinalId] = useState("");
  /** Paso «Cargar»: sucursal de imputación obligatoria antes del resto de campos. */
  const [imputacionSucursalId, setImputacionSucursalId] = useState("");
  /** Solo si `bal_gasto.iva === PREGUNTA`: SI / NO discrimina IVA. */
  const [discriminaIvaRespuesta, setDiscriminaIvaRespuesta] = useState<"none" | "si" | "no">("none");

  const cargarLista = useCallback(async () => {
    setCargandoLista(true);
    try {
      const r = await listarFinBalGastosFinalesNoMensualesAction({ mes, anio });
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo cargar el listado.");
        setItems([]);
        return;
      }
      setItems(r.data);
    } finally {
      setCargandoLista(false);
    }
  }, [mes, anio]);

  useEffect(() => {
    if (!open) return;
    setVista("lista");
    setSeleccion(null);
    setMontoNorm("");
    setPagadoNorm("");
    setFechaGasto("");
    setPlazoPago("");
    setFiltRubro("");
    setFiltGastoFinalId("");
    setImputacionSucursalId("");
    setDiscriminaIvaRespuesta("none");
    void cargarLista();
  }, [open, mes, anio, cargarLista]);

  const rubrosOpciones = useMemo(() => {
    const u = [...new Set(items.map((i) => i.rubroNombre))];
    u.sort((a, b) => a.localeCompare(b, "es"));
    return u;
  }, [items]);

  useEffect(() => {
    if (!filtRubro) return;
    if (!rubrosOpciones.includes(filtRubro)) setFiltRubro("");
  }, [filtRubro, rubrosOpciones]);

  /** Ítems eventuales para poblar el desplegable GASTO (respetando rubro si hay). */
  const itemsParaSelectGasto = useMemo(() => {
    let out = items;
    if (filtRubro) out = out.filter((i) => i.rubroNombre === filtRubro);
    return [...out].sort((a, b) => {
      const c = a.gastoNombre.localeCompare(b.gastoNombre, "es");
      if (c !== 0) return c;
      return a.proveedorNombre.localeCompare(b.proveedorNombre, "es");
    });
  }, [items, filtRubro]);

  useEffect(() => {
    if (!filtGastoFinalId) return;
    if (!itemsParaSelectGasto.some((i) => i.gastoFinalId === filtGastoFinalId)) {
      setFiltGastoFinalId("");
    }
  }, [filtGastoFinalId, itemsParaSelectGasto]);

  const etiquetaOpcionGasto = useCallback((it: FinBalGastoFinalNoMensualListItem) => {
    const dupNombre = itemsParaSelectGasto.filter((x) => x.gastoNombre === it.gastoNombre).length > 1;
    return dupNombre ? `${it.gastoNombre} · ${it.proveedorNombre}` : it.gastoNombre;
  }, [itemsParaSelectGasto]);

  const itemsFiltrados = useMemo(() => {
    let out = items;
    if (filtRubro) out = out.filter((i) => i.rubroNombre === filtRubro);
    if (filtGastoFinalId) out = out.filter((i) => i.gastoFinalId === filtGastoFinalId);
    return out;
  }, [items, filtRubro, filtGastoFinalId]);

  const montoPesosInt = useMemo(() => montoArNormalizedStringToPesosIntRounded(montoNorm), [montoNorm]);
  const pagadoPesosInt = useMemo(() => montoArNormalizedStringToPesosIntRounded(pagadoNorm), [pagadoNorm]);
  const pagoTotal = montoPesosInt > 0 && pagadoPesosInt === montoPesosInt;
  const plazoRequerido = montoPesosInt > 0 && !pagoTotal;
  const plazoPagoInt = useMemo(
    () => (plazoPago === "" ? null : Number.parseInt(plazoPago, 10)),
    [plazoPago]
  );
  const fechaMin = useMemo(
    () => `${anio}-${String(mes).padStart(2, "0")}-01`,
    [anio, mes]
  );
  const fechaMax = useMemo(() => {
    const maxD = new Date(anio, mes, 0).getDate();
    return `${anio}-${String(mes).padStart(2, "0")}-${String(maxD).padStart(2, "0")}`;
  }, [anio, mes]);

  const disabledGuardar = useMemo(() => {
    if (guardando || !seleccion) return true;
    if (imputacionSucursalId === "") return true;
    if (montoPesosInt < 1) return true;
    if (pagadoPesosInt < 0 || pagadoPesosInt > montoPesosInt) return true;
    if (!fechaGasto) return true;
    if (fechaGasto < fechaMin || fechaGasto > fechaMax) return true;
    if (plazoRequerido) {
      if (
        typeof plazoPagoInt !== "number" ||
        !Number.isInteger(plazoPagoInt) ||
        plazoPagoInt < 0 ||
        plazoPagoInt > 30
      ) {
        return true;
      }
    }
    if (
      seleccion.ivaPolitica === "PREGUNTA" &&
      discriminaIvaRespuesta !== "si" &&
      discriminaIvaRespuesta !== "no"
    ) {
      return true;
    }
    return false;
  }, [
    guardando,
    seleccion,
    imputacionSucursalId,
    montoPesosInt,
    pagadoPesosInt,
    fechaGasto,
    fechaMin,
    fechaMax,
    plazoRequerido,
    plazoPagoInt,
    discriminaIvaRespuesta,
  ]);

  async function handleGuardarImputacion() {
    if (!seleccion || disabledGuardar) return;
    setGuardando(true);
    try {
      const r = await crearFinBalImputacionGastoUnicoAction({
        gastoFinalId: seleccion.gastoFinalId,
        sucursalId: imputacionSucursalId,
        mes,
        anio,
        monto: montoPesosInt,
        pagado: pagadoPesosInt,
        fechaGasto,
        plazoPago: pagoTotal ? undefined : (plazoPagoInt ?? undefined),
        ...(seleccion.ivaPolitica === "PREGUNTA"
          ? { discriminaIva: discriminaIvaRespuesta === "si" }
          : {}),
      });
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo guardar.");
        return;
      }
      toast.success("Imputación de gasto eventual registrada.");
      onOpenChange(false);
      onSuccess?.();
    } finally {
      setGuardando(false);
    }
  }

  function irACargar(it: FinBalGastoFinalNoMensualListItem) {
    setSeleccion(it);
    setMontoNorm("");
    setPagadoNorm("");
    setFechaGasto("");
    setPlazoPago("");
    setImputacionSucursalId("");
    setDiscriminaIvaRespuesta("none");
    setVista("formulario");
  }

  function volverALista() {
    setSeleccion(null);
    setMontoNorm("");
    setPagadoNorm("");
    setFechaGasto("");
    setPlazoPago("");
    setImputacionSucursalId("");
    setDiscriminaIvaRespuesta("none");
    setVista("lista");
    void cargarLista();
  }

  const tituloModal = vista === "lista" ? "Nuevo Gasto Eventual" : "Cargar Gasto Eventual";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (guardando && !next) return;
        onOpenChange(next);
      }}
    >
      <AppModal
        title={tituloModal}
        size="lg"
        className="max-w-xl"
        padding="sm"
        actions={
          vista === "lista" ? (
            <div className="flex w-full flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </div>
          ) : (
            <div className="flex w-full flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" disabled={guardando} onClick={volverALista}>
                Volver
              </Button>
              <Button type="button" disabled={disabledGuardar} onClick={() => void handleGuardarImputacion()}>
                Guardar
              </Button>
            </div>
          )
        }
      >
        <div className="grid min-h-0 gap-3 text-sm">
          {vista === "lista" ? (
            <>
              {!cargandoLista && items.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  <FiltroIndividualContainer
                    className={FILTER_SELECT_WRAPPER_CLASS}
                    activo={!!filtRubro}
                    onLimpiar={() => setFiltRubro("")}
                  >
                    <Select
                      value={filtRubro || "none"}
                      onValueChange={(v) => setFiltRubro(v === "none" ? "" : v)}
                    >
                      <SelectTrigger className="input-filtro-unificado w-full" aria-label="Rubro (opcional)">
                        <SelectValue placeholder="RUBRO" />
                      </SelectTrigger>
                      <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
                        <SelectItem value="none">RUBRO (opcional)</SelectItem>
                        {rubrosOpciones.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FiltroIndividualContainer>
                  <FiltroIndividualContainer
                    className={FILTER_SELECT_WRAPPER_CLASS}
                    activo={Boolean(filtGastoFinalId)}
                    onLimpiar={() => setFiltGastoFinalId("")}
                  >
                    <Select
                      value={filtGastoFinalId || "none"}
                      onValueChange={(v) => setFiltGastoFinalId(v === "none" ? "" : v)}
                    >
                      <SelectTrigger className="input-filtro-unificado w-full" aria-label="Gasto (opcional)">
                        <SelectValue placeholder="GASTO" />
                      </SelectTrigger>
                      <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
                        <SelectItem value="none">GASTO</SelectItem>
                        {itemsParaSelectGasto.map((it) => (
                          <SelectItem key={it.gastoFinalId} value={it.gastoFinalId}>
                            {etiquetaOpcionGasto(it)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FiltroIndividualContainer>
                </div>
              ) : null}
              <div className="max-h-[min(60vh,28rem)] overflow-y-auto rounded-md border border-border">
                {cargandoLista ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin shrink-0" aria-hidden />
                    Cargando…
                  </div>
                ) : items.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No hay gastos eventuales en el catálogo.
                  </p>
                ) : itemsFiltrados.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No hay gastos eventuales que coincidan con los filtros.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {itemsFiltrados.map((it) => (
                      <li
                        key={it.gastoFinalId}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-foreground">{it.gastoNombre}</div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {it.tipoGastoNombre} · {it.proveedorNombre} · {it.sucursalNombre}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {it.rubroNombre} · Día {it.diaDevengado ?? "-"} · Vencimiento{" "}
                            {it.vencimiento == null ? "-" : `${it.vencimiento} días`}
                          </div>
                          {it.gastoFinalComentarios ? (
                            <div
                              className="mt-0.5 line-clamp-2 break-words text-[11px] leading-snug text-muted-foreground"
                              title={it.gastoFinalComentarios}
                            >
                              ({it.gastoFinalComentarios})
                            </div>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="shrink-0"
                          title="Cargar monto y pagado"
                          onClick={() => irACargar(it)}
                        >
                          Cargar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : seleccion ? (
            <div className="grid gap-4 px-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-fit gap-1 px-2 text-muted-foreground hover:text-foreground"
                disabled={guardando}
                onClick={volverALista}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Lista
              </Button>
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground">
                <div className="font-medium text-foreground">{seleccion.gastoNombre}</div>
                <div className="text-xs">
                  {seleccion.proveedorNombre} · {seleccion.sucursalNombre}
                </div>
                <div className="text-xs">
                  {seleccion.tipoGastoNombre} · {seleccion.rubroNombre} · Día {seleccion.diaDevengado ?? "-"} ·
                  Vencimiento {seleccion.vencimiento == null ? "-" : `${seleccion.vencimiento} días`}
                </div>
              </div>
              {seleccion.ivaPolitica === "PREGUNTA" ? (
                <label className="flex w-full flex-col gap-1">
                  <ModalMicroLabel>
                    ¿El gasto discrimina IVA? <span className="text-destructive">*</span>
                  </ModalMicroLabel>
                  <Select
                    value={discriminaIvaRespuesta}
                    onValueChange={(v) => setDiscriminaIvaRespuesta(v as "none" | "si" | "no")}
                    disabled={guardando}
                  >
                    <SelectTrigger className="input-filtro-unificado w-full" aria-label="¿El gasto discrimina IVA?">
                      <SelectValue placeholder="SELECCIONAR" />
                    </SelectTrigger>
                    <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
                      <SelectItem value="none">SELECCIONAR</SelectItem>
                      <SelectItem value="si">SI</SelectItem>
                      <SelectItem value="no">NO</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              ) : null}
              <label className="flex w-full flex-col gap-1">
                <ModalMicroLabel>
                  Sucursal <span className="text-destructive">*</span>
                </ModalMicroLabel>
                <Select
                  value={imputacionSucursalId || "none"}
                  onValueChange={(v) => setImputacionSucursalId(v === "none" ? "" : v)}
                  disabled={guardando || sucursalesCentroCosto.length === 0}
                >
                  <SelectTrigger className="input-filtro-unificado w-full" autoFocus aria-label="Sucursal de imputación">
                    <SelectValue placeholder="SELECCIONAR SUCURSAL" />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
                    <SelectItem value="none">SELECCIONAR SUCURSAL</SelectItem>
                    {sucursalesCentroCosto.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {sucursalesCentroCosto.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    No hay sucursales con centro de costo para imputar.
                  </span>
                ) : null}
              </label>
              <label className="flex w-full flex-col gap-1">
                <ModalMicroLabel>
                  Monto <span className="text-destructive">*</span>
                </ModalMicroLabel>
                <MontoArInput
                  valueNormalized={montoNorm}
                  onValueNormalizedChange={setMontoNorm}
                  disabled={guardando || imputacionSucursalId === ""}
                  aria-label="Monto en pesos"
                />
              </label>
              <label className="flex w-full flex-col gap-1">
                <ModalMicroLabel>Pagado</ModalMicroLabel>
                <div className="relative w-full">
                  <MontoArInput
                    valueNormalized={pagadoNorm}
                    onValueNormalizedChange={setPagadoNorm}
                    disabled={guardando || imputacionSucursalId === ""}
                    aria-label="Importe ya pagado"
                    className="w-full min-w-0 pr-12"
                  />
                  <Button
                    type="button"
                    variant="primaryIcon"
                    size="icon"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-md"
                    disabled={guardando || imputacionSucursalId === "" || montoPesosInt < 1}
                    onClick={() => setPagadoNorm(montoNorm)}
                    aria-label="Marcar gasto eventual como pagado (pago total)"
                    title="Marcar pago total"
                  >
                    <Check className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </label>
              <label className="flex w-full flex-col gap-1">
                <ModalMicroLabel>
                  Fecha De Gasto <span className="text-destructive">*</span>
                </ModalMicroLabel>
                <input
                  type="date"
                  value={fechaGasto}
                  min={fechaMin}
                  max={fechaMax}
                  onChange={(e) => setFechaGasto(e.target.value)}
                  disabled={guardando || imputacionSucursalId === ""}
                  className="input-filtro-unificado"
                  aria-label="Fecha de gasto"
                />
              </label>
              <label className="flex w-full flex-col gap-1">
                <ModalMicroLabel>
                  Plazo De Pago {plazoRequerido ? <span className="text-destructive">*</span> : null}
                </ModalMicroLabel>
                <Select
                  value={pagoTotal ? undefined : plazoPago ?? ""}
                  onValueChange={setPlazoPago}
                  disabled={guardando || pagoTotal || imputacionSucursalId === ""}
                >
                  <SelectTrigger className="input-filtro-unificado">
                    <SelectValue
                      placeholder={
                        pagoTotal ? "BLOQUEADO (PAGO TOTAL)" : "SELECCIONAR PLAZO"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    align="start"
                    className="select-content-filtro max-h-60"
                  >
                    {Array.from({ length: 31 }, (_, i) => i).map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
          ) : null}
        </div>
      </AppModal>
    </Dialog>
  );
}
