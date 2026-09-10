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
  OPCIONES_DISPONIBILIDAD_CAJA_UI,
  OPCIONES_TIPO_CAJA_TESORERIA_UI,
  OPCIONES_TIPO_VALOR_TESORERIA_UI,
  disponibilidadDesdeTipoCaja,
  tipoValorDesdeTipoCaja,
  cajaTesoreriaUsaSucursal,
} from "@/lib/cajasTesoreriaTipos";
import type { FinTesoreriaEntidadItem } from "@/lib/cajasTesoreriaEntidades";
import type { SucursalTesoreriaOption } from "@/services/cajasTesoreria.service";
import { useTitularesFinancierosTesoreria } from "@/lib/hooks/useTitularesFinancierosTesoreria";
import type { DisponibilidadCajaTesoreria, TipoCajaTesoreria, TipoValorTesoreria } from "@prisma/client";
import CrearEntidadTesoreriaModal from "@/components/finanzas/CrearEntidadTesoreriaModal";
import { Plus } from "lucide-react";

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
  const [disponibilidad, setDisponibilidad] =
    useState<DisponibilidadCajaTesoreria>("INMEDIATA");
  const [saving, setSaving] = useState(false);
  const [openEntidades, setOpenEntidades] = useState(false);
  const titulares = useTitularesFinancierosTesoreria(open);

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

  useEffect(() => {
    if (!open) setOpenEntidades(false);
  }, [open]);

  useEffect(() => {
    setTipoValor(tipoValorDesdeTipoCaja(tipoCaja));
    setDisponibilidad(disponibilidadDesdeTipoCaja(tipoCaja));
    if (!cajaTesoreriaUsaSucursal(tipoCaja)) setSucursalId("");
  }, [tipoCaja]);

  const opcionesTipoValor = useMemo(
    () => OPCIONES_TIPO_VALOR_TESORERIA_UI.filter((o) => o.value === tipoValorDesdeTipoCaja(tipoCaja)),
    [tipoCaja]
  );

  const opcionesDisponibilidad = useMemo(
    () => OPCIONES_DISPONIBILIDAD_CAJA_UI.filter((o) => o.value === disponibilidadDesdeTipoCaja(tipoCaja)),
    [tipoCaja]
  );

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
    setDisponibilidad(disponibilidadDesdeTipoCaja("EFECTIVO"));
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
        disponibilidad,
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
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !saving) resetForm();
          onOpenChange(next);
        }}
      >
        <AppModal
          title="Crear Caja"
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
              <ModalMicroLabel>TIPO CAJA</ModalMicroLabel>
              <Select
                value={tipoCaja}
                onValueChange={(value) => setTipoCaja(value as TipoCajaTesoreria)}
                disabled={saving}
              >
                <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                  <SelectValue placeholder="SELECCIONAR TIPO CAJA" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  {OPCIONES_TIPO_CAJA_TESORERIA_UI.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <div className="flex flex-col gap-1">
              <ModalMicroLabel>ENTIDAD</ModalMicroLabel>
              <div className="flex gap-2">
                <Select
                  value={entidadId || "none"}
                  onValueChange={(value) => setEntidadId(value === "none" ? "" : value)}
                  disabled={saving}
                >
                  <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "min-w-0 flex-1")}>
                    <SelectValue placeholder="SELECCIONAR ENTIDAD" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    align="start"
                    className="select-content-filtro"
                  >
                    <SelectItem value="none">SELECCIONAR ENTIDAD</SelectItem>
                    {entidades.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label="Gestionar entidades"
                  disabled={saving}
                  onClick={() => setOpenEntidades(true)}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>

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
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
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
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  <SelectItem value="none">SELECCIONAR TITULAR</SelectItem>
                  {titulares.map((titularOption) => (
                    <SelectItem key={titularOption} value={titularOption}>
                      {titularOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="flex flex-col gap-1">
              <ModalMicroLabel>TIPO VALOR</ModalMicroLabel>
              <Select
                value={tipoValor}
                onValueChange={(value) => setTipoValor(value as TipoValorTesoreria)}
                disabled={saving}
              >
                <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                  <SelectValue placeholder="SELECCIONAR TIPO VALOR" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  {opcionesTipoValor.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="flex flex-col gap-1">
              <ModalMicroLabel>DISPONIBILIDAD</ModalMicroLabel>
              <Select
                value={disponibilidad}
                onValueChange={(value) => setDisponibilidad(value as DisponibilidadCajaTesoreria)}
                disabled={saving}
              >
                <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                  <SelectValue placeholder="SELECCIONAR DISPONIBILIDAD" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  {opcionesDisponibilidad.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
        </AppModal>
      </Dialog>

      <CrearEntidadTesoreriaModal
        open={openEntidades}
        onOpenChange={setOpenEntidades}
        onCatalogoChanged={() => void cargarCatalogos()}
        onEntidadCreadaSeleccion={(id) => setEntidadId(id)}
      />
    </>
  );
}
