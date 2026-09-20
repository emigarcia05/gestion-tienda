"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import ModalSiNoChoice from "@/components/shared/ModalSiNoChoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  crearGlobalPtoVtaAction,
  editarGlobalPtoVtaAction,
} from "@/actions/globalPtoVtas";
import {
  etiquetaCondicionIvaArca,
  opcionesCondicionIvaArca,
  opcionesTitularPtoVta,
  type GlobalPtoVtaItem,
  type GlobalPtoVtaSucursalOption,
  type PtoVentasCodArcaItem,
} from "@/lib/globalPtoVtas";
import type { TesoreriaTitularItem } from "@/lib/cajasTesoreriaTitulares";
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import { TABLE_ROW_ACTION_ICON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const CONDICION_VACIA = "__none__";
const TITULAR_VACIO = "__none__";

function abrirSelectorFechaNativo(el: HTMLInputElement | null) {
  if (!el) return;
  try {
    el.showPicker?.();
  } catch {
    el.click();
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = alta. */
  itemEditar: GlobalPtoVtaItem | null;
  sucursales: GlobalPtoVtaSucursalOption[];
  condicionesArca: PtoVentasCodArcaItem[];
  titulares: TesoreriaTitularItem[];
  esEditor: boolean;
  onCatalogoChanged?: () => void;
}

type FormFiscalState = {
  cuit: string;
  iiBb: string;
  iiBbMultilateral: boolean;
  condicionIva: number | "";
  domicilioComercial: string;
  inicioActividades: string;
};

const FORM_FISCAL_VACIO: FormFiscalState = {
  cuit: "",
  iiBb: "",
  iiBbMultilateral: false,
  condicionIva: "",
  domicilioComercial: "",
  inicioActividades: "",
};

export default function GestionarGlobalPtoVtasModal({
  open,
  onOpenChange,
  itemEditar,
  sucursales,
  condicionesArca,
  titulares,
  esEditor,
  onCatalogoChanged,
}: Props) {
  const hiddenInicioRef = useRef<HTMLInputElement>(null);
  const [formPtoVenta, setFormPtoVenta] = useState("");
  const [formTitular, setFormTitular] = useState("");
  const [formSucursalIds, setFormSucursalIds] = useState<string[]>([]);
  const [formFiscal, setFormFiscal] = useState<FormFiscalState>(FORM_FISCAL_VACIO);
  const [pending, setPending] = useState(false);

  const opcionesCondicionIva = useMemo(
    () =>
      opcionesCondicionIvaArca(
        condicionesArca,
        formFiscal.condicionIva === "" ? null : formFiscal.condicionIva
      ),
    [condicionesArca, formFiscal.condicionIva]
  );

  const opcionesTitular = useMemo(
    () => opcionesTitularPtoVta(titulares, formTitular || null),
    [titulares, formTitular]
  );

  const hydrateFromItem = useCallback(
    (item: GlobalPtoVtaItem | null) => {
      if (!item) {
        setFormPtoVenta("");
        setFormTitular("");
        setFormSucursalIds([]);
        setFormFiscal(FORM_FISCAL_VACIO);
        return;
      }
      setFormPtoVenta(item.ptoVenta);
      setFormTitular(item.titular);
      setFormSucursalIds(
        item.sucursales
          .map((s) => s.id)
          .filter((id) => sucursales.some((opt) => opt.id === id))
      );
      setFormFiscal({
        cuit: item.cuit ?? "",
        iiBb: item.iiBb ?? "",
        iiBbMultilateral: item.iiBbMultilateral,
        condicionIva: item.condicionIva ?? "",
        domicilioComercial: item.domicilioComercial ?? "",
        inicioActividades: item.inicioActividades ?? "",
      });
    },
    [sucursales]
  );

  useEffect(() => {
    if (!open) return;
    hydrateFromItem(itemEditar);
  }, [open, itemEditar, hydrateFromItem]);

  function toggleSucursal(id: string) {
    setFormSucursalIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const formValido =
    formPtoVenta.trim().length > 0 &&
    formTitular.trim().length > 0 &&
    formSucursalIds.length > 0;

  async function handleGuardarForm() {
    if (!esEditor || !formValido || pending) return;
    setPending(true);
    try {
      const payload = {
        ptoVenta: formPtoVenta,
        titular: formTitular,
        sucursalIds: formSucursalIds,
        cuit: formFiscal.cuit,
        iiBb: formFiscal.iiBb,
        iiBbMultilateral: formFiscal.iiBbMultilateral,
        condicionIva: formFiscal.condicionIva === "" ? null : formFiscal.condicionIva,
        domicilioComercial: formFiscal.domicilioComercial,
        inicioActividades: formFiscal.inicioActividades,
      };
      if (itemEditar) {
        const res = await editarGlobalPtoVtaAction({
          id: itemEditar.id,
          ...payload,
        });
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo guardar.");
          return;
        }
        toast.success("Punto de venta actualizado.");
      } else {
        const res = await crearGlobalPtoVtaAction(payload);
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo crear.");
          return;
        }
        toast.success("Punto de venta creado.");
      }
      onOpenChange(false);
      onCatalogoChanged?.();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <AppModal
        title={itemEditar ? "EDITAR PUNTO DE VENTA" : "NUEVO PUNTO DE VENTA"}
        size="lg"
        scrollBody
        actions={
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={pending || !formValido}
              onClick={() => void handleGuardarForm()}
            >
              Guardar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>Pto. Venta</ModalMicroLabel>
            <Input
              value={formPtoVenta}
              onChange={(e) => setFormPtoVenta(e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="NRO."
              disabled={pending}
              inputMode="numeric"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>Titular</ModalMicroLabel>
            {opcionesTitular.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay titulares. Creá uno con Gestionar Titulares.
              </p>
            ) : (
              <Select
                value={formTitular === "" ? TITULAR_VACIO : formTitular}
                onValueChange={(value) =>
                  setFormTitular(value === TITULAR_VACIO ? "" : value)
                }
                disabled={pending}
              >
                <SelectTrigger
                  className="input-filtro-unificado w-full"
                  aria-label="Titular"
                >
                  <SelectValue placeholder="ELEGIR TITULAR" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  <SelectItem value={TITULAR_VACIO}>ELEGIR TITULAR</SelectItem>
                  {opcionesTitular.map((opt) => (
                    <SelectItem key={opt.id} value={opt.nombre}>
                      {opt.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>CUIT</ModalMicroLabel>
            <Input
              value={formFiscal.cuit}
              onChange={(e) =>
                setFormFiscal((prev) => ({
                  ...prev,
                  cuit: e.target.value.replace(/\D/g, "").slice(0, 11),
                }))
              }
              placeholder="11 DÍGITOS SIN GUIONES"
              disabled={pending}
              inputMode="numeric"
              className="tabular-nums"
              aria-label="CUIT"
            />
          </div>
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>IIBB</ModalMicroLabel>
            <Input
              value={formFiscal.iiBb}
              onChange={(e) =>
                setFormFiscal((prev) => ({
                  ...prev,
                  iiBb: e.target.value.toLocaleUpperCase("es-AR"),
                }))
              }
              placeholder="CUENTA / CONVENIO / EXENTO"
              disabled={pending}
              aria-label="IIBB"
            />
          </div>
          <ModalSiNoChoice
            label="IIBB MULTILATERAL"
            value={formFiscal.iiBbMultilateral}
            onChange={(checked) =>
              setFormFiscal((prev) => ({ ...prev, iiBbMultilateral: checked }))
            }
            disabled={pending}
          />
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>Condición IVA</ModalMicroLabel>
            <Select
              value={
                formFiscal.condicionIva === ""
                  ? CONDICION_VACIA
                  : String(formFiscal.condicionIva)
              }
              onValueChange={(value) => {
                const codigo = Number.parseInt(value, 10);
                setFormFiscal((prev) => ({
                  ...prev,
                  condicionIva:
                    value === CONDICION_VACIA || !Number.isFinite(codigo) || codigo <= 0
                      ? ""
                      : codigo,
                }));
              }}
              disabled={pending}
            >
              <SelectTrigger
                className="input-filtro-unificado w-full"
                aria-label="Condición IVA"
              >
                <SelectValue placeholder="ELEGIR CONDICIÓN" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                <SelectItem value={CONDICION_VACIA}>SIN DEFINIR</SelectItem>
                {opcionesCondicionIva.map((opt) => (
                  <SelectItem key={opt.codigo} value={String(opt.codigo)}>
                    {etiquetaCondicionIvaArca(opt.descripcion)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>Domicilio Comercial</ModalMicroLabel>
            <Input
              value={formFiscal.domicilioComercial}
              onChange={(e) =>
                setFormFiscal((prev) => ({
                  ...prev,
                  domicilioComercial: e.target.value.toLocaleUpperCase("es-AR"),
                }))
              }
              placeholder="DOMICILIO COMERCIAL"
              disabled={pending}
              aria-label="Domicilio comercial"
            />
          </div>
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>Inicia Actividad</ModalMicroLabel>
            <div className="relative w-full">
              <Input
                type="text"
                readOnly
                value={
                  formFiscal.inicioActividades
                    ? formatIsoYmdDdMmYyyyArgentina(formFiscal.inicioActividades)
                    : ""
                }
                className={cn("tabular-nums", "pr-10", "cursor-pointer")}
                onClick={() => abrirSelectorFechaNativo(hiddenInicioRef.current)}
                title="Clic para abrir el calendario"
                placeholder="DD/MM/AAAA"
                disabled={pending}
                aria-label="Inicia actividad. Clic para abrir el calendario."
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute right-0 top-0 h-9 w-9 shrink-0 rounded-r-md text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={() => abrirSelectorFechaNativo(hiddenInicioRef.current)}
                disabled={pending}
                aria-label="Abrir calendario"
                title="Abrir calendario"
              >
                <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
              </Button>
            </div>
            <input
              ref={hiddenInicioRef}
              type="date"
              tabIndex={-1}
              aria-hidden
              className="sr-only"
              value={formFiscal.inicioActividades}
              onChange={(e) => {
                const v = e.target.value;
                setFormFiscal((prev) => ({
                  ...prev,
                  inicioActividades: v,
                }));
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <ModalMicroLabel>Suc. Asociadas</ModalMicroLabel>
            {sucursales.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay sucursales cargadas.</p>
            ) : (
              <ul className="flex max-h-[12rem] flex-col gap-1 overflow-y-auto pr-1">
                {sucursales.map((suc) => {
                  const seleccionado = formSucursalIds.includes(suc.id);
                  return (
                    <li key={suc.id}>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => toggleSucursal(suc.id)}
                        aria-pressed={seleccionado}
                        aria-label={
                          seleccionado
                            ? `Quitar ${suc.nombre}`
                            : `Asociar ${suc.nombre}`
                        }
                        className="flex h-auto w-full items-center justify-start gap-2 rounded-md px-2 py-2 text-left font-normal"
                      >
                        <span
                          className={cn(
                            "tabla-check-toggle shrink-0",
                            seleccionado && "border-primary text-primary"
                          )}
                          aria-hidden
                        >
                          {seleccionado ? (
                            <Check className={TABLE_ROW_ACTION_ICON_CLASS} />
                          ) : null}
                        </span>
                        <span className="min-w-0 truncate text-foreground">{suc.nombre}</span>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </AppModal>
    </Dialog>
  );
}
