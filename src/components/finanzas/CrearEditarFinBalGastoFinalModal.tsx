"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import {
  crearFinBalGastoFinalAction,
  editarFinBalGastoFinalAction,
} from "@/actions/finBalGastosCatalogo";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { cn } from "@/lib/utils";

/** Trigger de selects en este modal: asegura texto visible (p. ej. plazo **0**) sobre `bg-card`. */
const GASTO_FINAL_SELECT_TRIGGER_CLASS = cn(
  SELECT_TRIGGER_FILTER_CLASS,
  "text-foreground [&_[data-slot=select-value]]:text-foreground"
);

type Modo = "crear" | "editar";

/** Valores cerrados del Select IVA (alineados al enum Postgres `IvaProveedor`). */
type IvaValue = "SIEMPRE" | "NUNCA" | "PREGUNTA";

export interface ProveedorOpcionGastoFinal {
  id: string;
  nombre: string;
}

/** Otras filas `bal_gasto` del mismo gasto de catálogo (para reglas de COMENTARIOS). */
export interface FinBalGastoFinalFilaHermana {
  id: string;
  proveedorId: string;
  sucursalId: string | null;
  comentarios: string | null;
}

function sucursalIdNormalizadoTripla(id: string | null | undefined): string | null {
  if (id == null || id === "") return null;
  return id;
}

function mismaSucursalTripla(a: string | null | undefined, b: string): boolean {
  return sucursalIdNormalizadoTripla(a) === sucursalIdNormalizadoTripla(b);
}

function comentariosNormModal(c: string | null | undefined): string {
  if (c == null || c === "") return "";
  const t = c.trim().toLocaleUpperCase("es-AR");
  return t === "" ? "" : t;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modo: Modo;
  /** Requerido en `editar`. */
  id?: string;
  gastoId: string;
  /** Solo lectura: nombre del gasto de catálogo. */
  gastoNombre: string;
  proveedoresOpciones: ProveedorOpcionGastoFinal[];
  sucursales: { id: string; nombre: string }[];
  /** Filas de gasto final ya cargadas para este mismo gasto de catálogo (ids + proveedor + sucursal + comentarios). */
  filasMismoGastoFinal?: FinBalGastoFinalFilaHermana[];
  proveedorIdInicial?: string;
  sucursalIdInicial?: string;
  gastoMensualInicial?: boolean;
  /** En edición: valor persistido (1–28) para mensual; `null` en eventual. */
  diaDevengadoInicial?: number | null;
  /** En edición: días de vencimiento persistidos. */
  vencimientoInicial?: number | null;
  /** En edición: comentarios persistidos (`bal_gasto.comentarios`). */
  comentariosInicial?: string | null;
  /** En edición: valor persistido de **GENERA IVA CRÉDITO** (`bal_gasto.iva`). En alta no hay valor hasta que el usuario elija. */
  ivaInicial?: IvaValue;
  onSuccess?: () => void;
}

function comentariosNormalizadosParaEstado(raw: string | null | undefined): string {
  return (raw ?? "").toLocaleUpperCase("es-AR");
}

export default function CrearEditarFinBalGastoFinalModal({
  open,
  onOpenChange,
  modo,
  id,
  gastoId,
  gastoNombre,
  proveedoresOpciones,
  sucursales,
  filasMismoGastoFinal = [],
  proveedorIdInicial = "",
  sucursalIdInicial = "",
  gastoMensualInicial = false,
  diaDevengadoInicial = null,
  vencimientoInicial = null,
  comentariosInicial = null,
  ivaInicial,
  onSuccess,
}: Props) {
  const diasOpciones = useMemo(() => Array.from({ length: 28 }, (_, i) => i + 1), []);
  const plazoPagoOpciones = useMemo(() => Array.from({ length: 31 }, (_, i) => i), []);
  const normalizarPlazoPago = (value: number) => Math.max(0, Math.min(30, Math.trunc(value)));

  const [sucursalId, setSucursalId] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  /** `null` en alta = el usuario aún no eligió tipo; en edición siempre `boolean` tras hidratar. */
  const [gastoMensual, setGastoMensual] = useState<boolean | null>(null);
  const [diaDevengado, setDiaDevengado] = useState<number | null>(null);
  const [comentarios, setComentarios] = useState("");
  const [vencimiento, setVencimiento] = useState<number | null>(null);
  /** En alta: `""` hasta elegir opción; en edición siempre `IvaValue` tras hidratar. */
  const [iva, setIva] = useState<IvaValue | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const esEdicion = modo === "editar";
    setSucursalId(esEdicion ? (sucursalIdInicial ?? "") : "");
    setProveedorId(esEdicion ? proveedorIdInicial : "");
    if (esEdicion) {
      setGastoMensual(gastoMensualInicial);
      setDiaDevengado(
        gastoMensualInicial && diaDevengadoInicial != null ? diaDevengadoInicial : null
      );
      setVencimiento(
        gastoMensualInicial && vencimientoInicial != null
          ? normalizarPlazoPago(vencimientoInicial)
          : null
      );
      setIva(ivaInicial ?? "PREGUNTA");
    } else {
      setGastoMensual(null);
      setDiaDevengado(null);
      setVencimiento(null);
      setIva("");
    }
    setComentarios(
      esEdicion ? comentariosNormalizadosParaEstado(comentariosInicial) : ""
    );
  }, [
    open,
    modo,
    sucursalIdInicial,
    proveedorIdInicial,
    gastoMensualInicial,
    diaDevengadoInicial,
    vencimientoInicial,
    comentariosInicial,
    ivaInicial,
  ]);

  const hermanosMismaProveedorSucursal = useMemo(() => {
    if (!proveedorId) return [];
    if (gastoMensual === null) return [];
    if (gastoMensual && !sucursalId) return [];
    return filasMismoGastoFinal.filter(
      (f) =>
        f.proveedorId === proveedorId &&
        mismaSucursalTripla(f.sucursalId, sucursalId) &&
        (modo === "crear" || !id || f.id !== id)
    );
  }, [filasMismoGastoFinal, proveedorId, sucursalId, modo, id, gastoMensual]);

  const comentariosNorm = useMemo(() => comentariosNormModal(comentarios), [comentarios]);

  const hayOtraFilaMismaProveedorSucursal = hermanosMismaProveedorSucursal.length > 0;
  const comentarioChocaConOtro = useMemo(() => {
    if (comentariosNorm === "") return false;
    return hermanosMismaProveedorSucursal.some(
      (f) => comentariosNormModal(f.comentarios) === comentariosNorm
    );
  }, [hermanosMismaProveedorSucursal, comentariosNorm]);

  const hasChanges = useMemo(() => {
    if (modo !== "editar") return true;
    const comIni = comentariosNormalizadosParaEstado(comentariosInicial);
    const diaIni =
      gastoMensualInicial && diaDevengadoInicial != null ? diaDevengadoInicial : null;
    const venIni =
      gastoMensualInicial && vencimientoInicial != null
        ? normalizarPlazoPago(vencimientoInicial)
        : null;
    const ivaRef = ivaInicial ?? "PREGUNTA";
    /** Gasto eventual: día y plazo bloqueados en UI y siempre `null` al persistir — no entran al cómputo de cambios salvo transición de/ hacia mensual. */
    const cambioDiaOPlazo =
      gastoMensual === true && gastoMensualInicial === true
        ? diaDevengado !== diaIni || vencimiento !== venIni
        : false;
    return (
      proveedorId !== proveedorIdInicial ||
      sucursalId !== (sucursalIdInicial ?? "") ||
      gastoMensual !== gastoMensualInicial ||
      cambioDiaOPlazo ||
      comentarios !== comIni ||
      iva !== ivaRef
    );
  }, [
    modo,
    proveedorId,
    proveedorIdInicial,
    sucursalId,
    sucursalIdInicial,
    gastoMensual,
    gastoMensualInicial,
    diaDevengado,
    diaDevengadoInicial,
    vencimiento,
    vencimientoInicial,
    comentarios,
    comentariosInicial,
    iva,
    ivaInicial,
  ]);

  const disabledSubmit = useMemo(() => {
    if (saving) return true;
    if (!proveedorId) return true;
    if (iva === "") return true;
    if (gastoMensual === null) return true;
    if (gastoMensual === true) {
      if (!sucursalId) return true;
      if (diaDevengado == null || vencimiento == null) return true;
      if (!Number.isInteger(vencimiento) || vencimiento < 0 || vencimiento > 30) return true;
    }
    if (modo === "editar" && (!id || !hasChanges)) return true;
    if (comentarioChocaConOtro) return true;
    return false;
  }, [
    saving,
    sucursalId,
    proveedorId,
    gastoMensual,
    modo,
    id,
    hasChanges,
    comentarioChocaConOtro,
    diaDevengado,
    vencimiento,
    iva,
  ]);

  useEffect(() => {
    if (!open) return;
    if (proveedorId && !proveedoresOpciones.some((p) => p.id === proveedorId)) {
      setProveedorId("");
    }
  }, [open, proveedorId, proveedoresOpciones]);

  function comentariosParaPersistir(): string | null {
    const t = comentarios.trim().toLocaleUpperCase("es-AR");
    return t === "" ? null : t;
  }

  async function handleSubmit() {
    if (disabledSubmit) return;
    setSaving(true);
    try {
      if (modo === "crear") {
        const r = await crearFinBalGastoFinalAction({
          gastoId,
          proveedorId,
          sucursalId: gastoMensual === true ? sucursalId : null,
          gastoMensual: gastoMensual as boolean,
          diaDevengado: gastoMensual === true ? diaDevengado : null,
          vencimiento: gastoMensual === true ? vencimiento : null,
          comentarios: comentariosParaPersistir(),
          iva: iva as IvaValue,
        });
        if (!r.ok) {
          toast.error(r.error ?? "No se pudo guardar.");
          return;
        }
        toast.success("Gasto final creado correctamente.");
      } else {
        const r = await editarFinBalGastoFinalAction({
          id: id!,
          proveedorId,
          sucursalId: gastoMensual === true ? sucursalId : null,
          gastoMensual: gastoMensual as boolean,
          diaDevengado: gastoMensual === true ? diaDevengado : null,
          vencimiento: gastoMensual === true ? vencimiento : null,
          comentarios: comentariosParaPersistir(),
          iva: iva as IvaValue,
        });
        if (!r.ok) {
          toast.error(r.error ?? "No se pudo guardar.");
          return;
        }
        toast.success("Gasto final actualizado correctamente.");
      }
      onOpenChange(false);
      onSuccess?.();
    } finally {
      setSaving(false);
    }
  }

  const titulo = modo === "crear" ? "Nuevo Gasto Final" : "Editar Gasto Final";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving && !next) return;
        onOpenChange(next);
      }}
    >
      <AppModal
        title={titulo}
        size="lg"
        actions={
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={disabledSubmit} onClick={handleSubmit}>
              Guardar
            </Button>
          </div>
        }
      >
        <div className="grid min-h-0 grid-cols-1 gap-3">
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>GASTO</ModalMicroLabel>
            <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm font-medium">
              {gastoNombre}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <ModalMicroLabel>TIPO DE GASTO</ModalMicroLabel>
            <Select
              value={
                gastoMensual === null ? undefined : gastoMensual ? "mensual" : "eventual"
              }
              onValueChange={(v) => {
                const mensual = v === "mensual";
                setGastoMensual(mensual);
                setDiaDevengado(null);
                setVencimiento(null);
                if (!mensual) setSucursalId("");
              }}
              disabled={saving}
            >
              <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS}>
                <SelectValue placeholder="SELECCIONAR TIPO DE GASTO" />
              </SelectTrigger>
              <SelectContent className="select-content-filtro" position="popper" side="bottom" align="start">
                <SelectItem value="mensual">MENSUAL</SelectItem>
                <SelectItem value="eventual">EVENTUAL</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-1">
            <ModalMicroLabel>SUCURSAL</ModalMicroLabel>
            {gastoMensual === true ? (
              <Select
                value={sucursalId ?? ""}
                onValueChange={setSucursalId}
                disabled={saving || sucursales.length === 0}
              >
                <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS}>
                  <SelectValue placeholder="SELECCIONAR SUCURSAL" />
                </SelectTrigger>
                <SelectContent className="select-content-filtro" position="popper" side="bottom" align="start">
                  {sucursales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : gastoMensual === false ? (
              <>
                <div
                  className={cn(
                    SELECT_TRIGGER_FILTER_CLASS,
                    "flex items-center text-muted-foreground",
                    "cursor-not-allowed select-none opacity-80"
                  )}
                  aria-disabled="true"
                >
                  NO APLICA (GASTO EVENTUAL)
                </div>
                <p className="text-xs text-muted-foreground">
                  En gasto eventual la sucursal no se guarda (valor vacío en base de datos).
                </p>
              </>
            ) : (
              <div
                className={cn(
                  SELECT_TRIGGER_FILTER_CLASS,
                  "flex items-center text-muted-foreground",
                  "cursor-not-allowed select-none"
                )}
                aria-disabled="true"
              >
                SELECCIONÁ TIPO DE GASTO PRIMERO
              </div>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <ModalMicroLabel>PROVEEDOR</ModalMicroLabel>
            <Select
              value={proveedorId ?? ""}
              onValueChange={setProveedorId}
              disabled={
                saving ||
                proveedoresOpciones.length === 0 ||
                (gastoMensual === true && !sucursalId)
              }
            >
              <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS}>
                <SelectValue placeholder="SELECCIONAR PROVEEDOR" />
              </SelectTrigger>
              <SelectContent className="select-content-filtro" position="popper" side="bottom" align="start">
                {proveedoresOpciones.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-1">
            <ModalMicroLabel>DÍA DEVENGADO</ModalMicroLabel>
            <Select
              value={
                gastoMensual === true && diaDevengado != null ? String(diaDevengado) : undefined
              }
              onValueChange={(v) => setDiaDevengado(Number(v))}
              disabled={saving || gastoMensual !== true}
            >
              <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS}>
                <SelectValue
                  placeholder={
                    gastoMensual === true
                      ? "SELECCIONAR DÍA"
                      : gastoMensual === false
                        ? "NO APLICA (EVENTUAL)"
                        : "SELECCIONAR TIPO DE GASTO PRIMERO"
                  }
                />
              </SelectTrigger>
              <SelectContent className="select-content-filtro max-h-60" position="popper" side="bottom" align="start">
                {diasOpciones.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-1">
            <ModalMicroLabel>PLAZO DE PAGO</ModalMicroLabel>
            <Select
              value={
                gastoMensual === true && typeof vencimiento === "number"
                  ? String(vencimiento)
                  : undefined
              }
              onValueChange={(v) => setVencimiento(normalizarPlazoPago(Number(v)))}
              disabled={saving || gastoMensual !== true}
            >
              <SelectTrigger className={GASTO_FINAL_SELECT_TRIGGER_CLASS}>
                <SelectValue
                  placeholder={
                    gastoMensual === true
                      ? "SELECCIONAR PLAZO (DÍAS)"
                      : gastoMensual === false
                        ? "NO APLICA (EVENTUAL)"
                        : "SELECCIONAR TIPO DE GASTO PRIMERO"
                  }
                >
                  {gastoMensual === true && typeof vencimiento === "number"
                    ? String(vencimiento)
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="select-content-filtro max-h-60" position="popper" side="bottom" align="start">
                {plazoPagoOpciones.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          {gastoMensual === false ? (
            <p className="text-xs text-muted-foreground -mt-1">
              Gasto eventual: DÍA DEVENGADO y PLAZO DE PAGO quedan exceptuados (sin carga obligatoria; se persisten
              vacíos).
            </p>
          ) : null}

          <label className="flex flex-col gap-1">
            <ModalMicroLabel>GENERA IVA CRÉDITO</ModalMicroLabel>
            <Select
              value={iva === "" ? undefined : iva}
              onValueChange={(v) => setIva(v as IvaValue)}
              disabled={saving}
            >
              <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS}>
                <SelectValue placeholder="SELECCIONAR IVA CRÉDITO" />
              </SelectTrigger>
              <SelectContent
                className="select-content-filtro"
                position="popper"
                side="bottom"
                align="start"
              >
                <SelectItem value="SIEMPRE">SIEMPRE</SelectItem>
                <SelectItem value="NUNCA">NUNCA</SelectItem>
                <SelectItem value="PREGUNTA">PREGUNTA</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-1">
            <ModalMicroLabel>COMENTARIOS</ModalMicroLabel>
            <textarea
              value={comentarios}
              onChange={(e) =>
                setComentarios(e.target.value.toLocaleUpperCase("es-AR"))
              }
              disabled={saving}
              rows={1}
              maxLength={10000}
              placeholder="TEXTO LIBRE (OPCIONAL)"
              spellCheck={false}
              autoComplete="off"
              className={cn(
                SELECT_TRIGGER_FILTER_CLASS,
                "resize-none overflow-y-auto leading-snug",
                "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
              )}
            />
            <span className="text-xs text-muted-foreground">{comentarios.length} / 10000</span>
            {hayOtraFilaMismaProveedorSucursal ? (
              <p className="text-xs text-muted-foreground">
                {gastoMensual
                  ? "Ya hay otra fila con el mismo proveedor y sucursal para este gasto. Podés usar COMENTARIOS para distinguirlas (obligatorio si el texto coincide con otra fila)."
                  : "Ya hay otra fila eventual con el mismo proveedor para este gasto. Podés usar COMENTARIOS para distinguirlas (obligatorio si el texto coincide con otra fila)."}
              </p>
            ) : null}
            {comentarioChocaConOtro ? (
              <p className="text-xs text-destructive">
                {gastoMensual
                  ? "Ese texto en COMENTARIOS coincide con otra fila del mismo proveedor y sucursal. Cambie el texto."
                  : "Ese texto en COMENTARIOS coincide con otra fila eventual del mismo proveedor. Cambie el texto."}
              </p>
            ) : null}
          </label>
        </div>
      </AppModal>
    </Dialog>
  );
}
