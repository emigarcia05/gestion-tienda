"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actualizarSucursalCatalogoAction } from "@/actions/sucursalesCatalogo";
import type { SucursalCatalogoItem } from "@/services/sucursalesCatalogo.service";
import type { HorarioBloque, HorarioSucursal } from "@/lib/validations/sucursalCatalogo";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: SucursalCatalogoItem | null;
  onSuccess?: () => void;
}

const SECCION_TITULO_CLASS =
  "text-center text-xs font-bold uppercase tracking-wide text-foreground";

const BLOQUES: { clave: keyof HorarioSucursal; etiqueta: string }[] = [
  { clave: "lunVie", etiqueta: "LUN A VIE" },
  { clave: "sabado", etiqueta: "SÁBADO" },
  { clave: "domingo", etiqueta: "DOMINGO" },
];

type ModoHorario = HorarioBloque["modo"];

function bloqueConModo(actual: HorarioBloque, modo: ModoHorario): HorarioBloque {
  if (modo === "cerrado") return { modo: "cerrado" };
  if (modo === "corrido") {
    return {
      modo: "corrido",
      desde: actual.modo === "corrido" ? actual.desde : actual.modo === "cortado" ? actual.mananaDesde : "",
      hasta: actual.modo === "corrido" ? actual.hasta : actual.modo === "cortado" ? actual.tardeHasta : "",
    };
  }
  return {
    modo: "cortado",
    mananaDesde: actual.modo === "cortado" ? actual.mananaDesde : actual.modo === "corrido" ? actual.desde : "",
    mananaHasta: actual.modo === "cortado" ? actual.mananaHasta : "",
    tardeDesde: actual.modo === "cortado" ? actual.tardeDesde : "",
    tardeHasta: actual.modo === "cortado" ? actual.tardeHasta : actual.modo === "corrido" ? actual.hasta : "",
  };
}

function horaCorrido(bloque: HorarioBloque, campo: "desde" | "hasta"): string {
  return bloque.modo === "corrido" ? bloque[campo] : "";
}

function horaCortado(
  bloque: HorarioBloque,
  campo: "mananaDesde" | "mananaHasta" | "tardeDesde" | "tardeHasta"
): string {
  return bloque.modo === "cortado" ? bloque[campo] : "";
}

export default function EditarSucursalModal({
  open,
  onOpenChange,
  item,
  onSuccess,
}: Props) {
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [maps, setMaps] = useState("");
  const [horario, setHorario] = useState<HorarioSucursal | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setNombre(item.nombre);
    setDireccion(item.direccion ?? "");
    setTelefono(item.telefono ?? "");
    setMaps(item.maps ?? "");
    setHorario(item.horario);
  }, [open, item]);

  async function handleSubmit() {
    if (!item || !horario || saving) return;
    setSaving(true);
    try {
      const res = await actualizarSucursalCatalogoAction({
        id: item.id,
        nombre,
        direccion,
        telefono,
        maps,
        horario,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar.");
        return;
      }
      toast.success("Sucursal actualizada.");
      onOpenChange(false);
      onSuccess?.();
    } finally {
      setSaving(false);
    }
  }

  function cambiarModo(clave: keyof HorarioSucursal, modo: ModoHorario) {
    setHorario((prev) => {
      if (!prev) return prev;
      return { ...prev, [clave]: bloqueConModo(prev[clave], modo) };
    });
  }

  function cambiarHora(
    clave: keyof HorarioSucursal,
    campo: "desde" | "hasta" | "mananaDesde" | "mananaHasta" | "tardeDesde" | "tardeHasta",
    valor: string
  ) {
    setHorario((prev) => {
      if (!prev) return prev;
      const bloque = prev[clave];
      if (bloque.modo === "cerrado") return prev;
      if (bloque.modo === "corrido" && (campo === "desde" || campo === "hasta")) {
        return {
          ...prev,
          [clave]: {
            modo: "corrido",
            desde: campo === "desde" ? valor : bloque.desde,
            hasta: campo === "hasta" ? valor : bloque.hasta,
          },
        };
      }
      if (bloque.modo === "cortado" && campo !== "desde" && campo !== "hasta") {
        return {
          ...prev,
          [clave]: {
            modo: "cortado",
            mananaDesde: campo === "mananaDesde" ? valor : bloque.mananaDesde,
            mananaHasta: campo === "mananaHasta" ? valor : bloque.mananaHasta,
            tardeDesde: campo === "tardeDesde" ? valor : bloque.tardeDesde,
            tardeHasta: campo === "tardeHasta" ? valor : bloque.tardeHasta,
          },
        };
      }
      return prev;
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving && !next) return;
        onOpenChange(next);
      }}
    >
      <AppModal
        title="EDITAR SUCURSAL"
        size="lg"
        scrollBody
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
            <Button type="button" disabled={saving || !item || !horario} onClick={() => void handleSubmit()}>
              Guardar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>Nombre</ModalMicroLabel>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={saving}
              aria-label="Nombre"
            />
          </div>
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>Dirección</ModalMicroLabel>
            <Input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              disabled={saving}
              aria-label="Dirección"
            />
          </div>
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>Maps</ModalMicroLabel>
            <Input
              value={maps}
              onChange={(e) => setMaps(e.target.value)}
              disabled={saving}
              aria-label="Maps"
              placeholder="HTTPS://..."
            />
          </div>
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>Teléfono</ModalMicroLabel>
            <Input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              disabled={saving}
              aria-label="Teléfono"
            />
          </div>
          {horario ? (
            <section className="modal-seccion-formulario flex flex-col gap-3">
              <h3 className={SECCION_TITULO_CLASS}>Horarios</h3>
              {BLOQUES.map((bloque) => {
                const valor = horario[bloque.clave];
                return (
                  <div key={bloque.clave} className="flex flex-col gap-2">
                    <ModalMicroLabel>{bloque.etiqueta}</ModalMicroLabel>
                    <Select
                      value={valor.modo}
                      onValueChange={(modo) => {
                        if (modo === "cerrado" || modo === "corrido" || modo === "cortado") {
                          cambiarModo(bloque.clave, modo);
                        }
                      }}
                      disabled={saving}
                    >
                      <SelectTrigger
                        className="input-filtro-unificado w-full"
                        aria-label={bloque.etiqueta}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        align="start"
                        className="select-content-filtro"
                      >
                        <SelectItem value="cerrado">CERRADO</SelectItem>
                        <SelectItem value="corrido">CORRIDO</SelectItem>
                        <SelectItem value="cortado">CORTADO</SelectItem>
                      </SelectContent>
                    </Select>
                    {valor.modo === "corrido" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <CampoHora
                          etiqueta="DESDE"
                          valor={horaCorrido(valor, "desde")}
                          disabled={saving}
                          onChange={(hora) => cambiarHora(bloque.clave, "desde", hora)}
                        />
                        <CampoHora
                          etiqueta="HASTA"
                          valor={horaCorrido(valor, "hasta")}
                          disabled={saving}
                          onChange={(hora) => cambiarHora(bloque.clave, "hasta", hora)}
                        />
                      </div>
                    ) : null}
                    {valor.modo === "cortado" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <CampoHora
                          etiqueta="MAÑANA DESDE"
                          valor={horaCortado(valor, "mananaDesde")}
                          disabled={saving}
                          onChange={(hora) => cambiarHora(bloque.clave, "mananaDesde", hora)}
                        />
                        <CampoHora
                          etiqueta="MAÑANA HASTA"
                          valor={horaCortado(valor, "mananaHasta")}
                          disabled={saving}
                          onChange={(hora) => cambiarHora(bloque.clave, "mananaHasta", hora)}
                        />
                        <CampoHora
                          etiqueta="TARDE DESDE"
                          valor={horaCortado(valor, "tardeDesde")}
                          disabled={saving}
                          onChange={(hora) => cambiarHora(bloque.clave, "tardeDesde", hora)}
                        />
                        <CampoHora
                          etiqueta="TARDE HASTA"
                          valor={horaCortado(valor, "tardeHasta")}
                          disabled={saving}
                          onChange={(hora) => cambiarHora(bloque.clave, "tardeHasta", hora)}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ) : null}
        </div>
      </AppModal>
    </Dialog>
  );
}

function CampoHora({
  etiqueta,
  valor,
  disabled,
  onChange,
}: {
  etiqueta: string;
  valor: string;
  disabled: boolean;
  onChange: (valor: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <ModalMicroLabel>{etiqueta}</ModalMicroLabel>
      <Input
        type="time"
        step={60}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={etiqueta}
      />
    </div>
  );
}
