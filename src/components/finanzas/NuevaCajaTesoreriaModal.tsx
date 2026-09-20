"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { crearCajaTesoreriaAction, listarEntidadesFinTesoreriaAction, listarSucursalesTesoreriaAction } from "@/actions/cajasTesoreria";
import { cn } from "@/lib/utils";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import {
  OPCIONES_TIPO_CAJA_TESORERIA_UI,
  OPCIONES_TIPO_VALOR_CAJA_MODAL_UI,
  tipoValorDesdeTipoCaja,
  cajaTesoreriaUsaSucursal,
  siguienteTipoValorAlCambiarTipoCaja,
} from "@/lib/cajasTesoreriaTipos";
import type { FinTesoreriaEntidadItem } from "@/lib/cajasTesoreriaEntidades";
import type { SucursalTesoreriaOption } from "@/services/cajasTesoreria.service";
import { useTitularesFinancierosTesoreria } from "@/lib/hooks/useTitularesFinancierosTesoreria";
import type { TipoCajaTesoreria, TipoValorTesoreria } from "@prisma/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export default function NuevaCajaTesoreriaModal({ open, onOpenChange, onCreated }: Props) {
  const [entidades, setEntidades] = useState<FinTesoreriaEntidadItem[]>([]);
  const [sucursales, setSucursales] = useState<SucursalTesoreriaOption[]>([]);
  const [entidadId, setEntidadId] = useState("");
  const [titular, setTitular] = useState("");
  const [sucursalId, setSucursalId] = useState("");
  const [tipoCaja, setTipoCaja] = useState<TipoCajaTesoreria>("EFECTIVO");
  const [tipoValor, setTipoValor] = useState<TipoValorTesoreria>("EFECTIVO");
  const [saving, setSaving] = useState(false);
  const titulares = useTitularesFinancierosTesoreria(open);
  const muestraTipoValor = cajaTesoreriaUsaSucursal(tipoCaja);

  const cargarCatalogos = useCallback(async () => {
    const [resEntidades, resSucursales] = await Promise.all([
      listarEntidadesFinTesoreriaAction(),
      listarSucursalesTesoreriaAction(),
    ]);
    if (!resEntidades.ok) {
      toast.error(resEntidades.error ?? "No se pudieron cargar las entidades.");
      setEntidades([]);
    } else {
      setEntidades(resEntidades.data);
    }
    if (!resSucursales.ok) {
      toast.error(resSucursales.error ?? "No se pudieron cargar las sucursales.");
      setSucursales([]);
    } else {
      setSucursales(resSucursales.data);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void cargarCatalogos();
  }, [open, cargarCatalogos]);

  const disabledSubmit = useMemo(
    () =>
      saving ||
      entidadId.trim().length === 0 ||
      (cajaTesoreriaUsaSucursal(tipoCaja) && sucursalId.trim().length === 0) ||
      titular.trim().length === 0 ||
      tipoCaja.trim().length === 0,
    [saving, entidadId, sucursalId, titular, tipoCaja]
  );

  function resetForm() {
    setEntidadId("");
    setTitular("");
    setSucursalId("");
    setTipoCaja("EFECTIVO");
    setTipoValor(tipoValorDesdeTipoCaja("EFECTIVO"));
  }

  function handleTipoCajaChange(value: string) {
    const next = value as TipoCajaTesoreria;
    setTipoCaja(next);
    if (!cajaTesoreriaUsaSucursal(next)) setSucursalId("");
    setTipoValor((actual) => siguienteTipoValorAlCambiarTipoCaja(next, actual));
  }

  async function handleSubmit() {
    if (disabledSubmit) return;
    setSaving(true);
    try {
      const res = await crearCajaTesoreriaAction({
        entidadId,
        titular,
        sucursalId: cajaTesoreriaUsaSucursal(tipoCaja) ? sucursalId : null,
        tipoCaja,
        tipoValor,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo crear la caja.");
        return;
      }

      toast.success("Caja creada correctamente.");
      onOpenChange(false);
      resetForm();
      onCreated?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) resetForm();
        onOpenChange(next);
      }}
    >
      <AppModal
        title="CREAR CAJA"
        size="md"
        className="max-w-xl"
        actions={
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                if (saving) return;
                resetForm();
                onOpenChange(false);
              }}
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
          <label className="flex flex-col gap-1">
            <ModalMicroLabel>TIPO DE CAJA</ModalMicroLabel>
            <Select value={tipoCaja} onValueChange={handleTipoCajaChange} disabled={saving}>
              <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                <SelectValue placeholder="SELECCIONAR TIPO DE CAJA" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
                {OPCIONES_TIPO_CAJA_TESORERIA_UI.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-1">
            <ModalMicroLabel>ENTIDAD</ModalMicroLabel>
            <Select
              value={entidadId || "none"}
              onValueChange={(value) => setEntidadId(value === "none" ? "" : value)}
              disabled={saving}
            >
              <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                <SelectValue placeholder="SELECCIONAR ENTIDAD" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
                <SelectItem value="none">SELECCIONAR ENTIDAD</SelectItem>
                {entidades.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          {cajaTesoreriaUsaSucursal(tipoCaja) ? (
            <label className="flex flex-col gap-1">
              <ModalMicroLabel>SUCURSAL</ModalMicroLabel>
              <Select
                value={sucursalId || "none"}
                onValueChange={(value) => setSucursalId(value === "none" ? "" : value)}
                disabled={saving}
              >
                <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                  <SelectValue placeholder="SELECCIONAR SUCURSAL" />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
                  <SelectItem value="none">SELECCIONAR SUCURSAL</SelectItem>
                  {sucursales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ) : null}

          <label className="flex flex-col gap-1">
            <ModalMicroLabel>TITULAR</ModalMicroLabel>
            <Select
              value={titular || "none"}
              onValueChange={(value) => setTitular(value === "none" ? "" : value)}
              disabled={saving}
            >
              <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                <SelectValue placeholder="SELECCIONAR TITULAR" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
                <SelectItem value="none">SELECCIONAR TITULAR</SelectItem>
                {titulares.map((titularOption) => (
                  <SelectItem key={titularOption} value={titularOption}>
                    {titularOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          {muestraTipoValor ? (
            <label className="flex flex-col gap-1">
              <ModalMicroLabel>TIPO DE VALOR</ModalMicroLabel>
              <Select
                value={tipoValor}
                onValueChange={(value) => setTipoValor(value as TipoValorTesoreria)}
                disabled={saving}
              >
                <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                  <SelectValue placeholder="SELECCIONAR TIPO DE VALOR" />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
                  {OPCIONES_TIPO_VALOR_CAJA_MODAL_UI.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ) : null}
        </div>
      </AppModal>
    </Dialog>
  );
}
