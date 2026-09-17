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
import {
  crearEnviosDireccionAction,
  editarEnviosDireccionAction,
} from "@/actions/envios";
import {
  ENVIOS_DEPARTAMENTO_LABELS,
  ENVIOS_DEPARTAMENTO_VALUES,
  capitalizarTextoEnvio,
  capitalizarTextoEnvioInput,
  direccionEnvioTieneDato,
  properTextoEnvio,
  properTextoEnvioInput,
  type EnviosDepartamentoValue,
  type EnviosDireccionItem,
} from "@/lib/envios";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modo: "crear" | "editar";
  personaId: string;
  item?: EnviosDireccionItem | null;
  onSuccess?: (item: EnviosDireccionItem) => void;
}

export default function CrearEditarEnviosDireccionModal({
  open,
  onOpenChange,
  modo,
  personaId,
  item = null,
  onSuccess,
}: Props) {
  const [calleNombre, setCalleNombre] = useState("");
  const [numeracion, setNumeracion] = useState("");
  const [distrito, setDistrito] = useState("");
  const [departamento, setDepartamento] = useState<EnviosDepartamentoValue | "">("");
  const [urlMaps, setUrlMaps] = useState("");
  const [referencia, setReferencia] = useState("");
  const [nombreProyecto, setNombreProyecto] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (modo === "editar" && item) {
      setNombreProyecto(item.nombreProyecto);
      setCalleNombre(properTextoEnvio(item.calleNombre));
      setNumeracion(capitalizarTextoEnvio(item.numeracion));
      setDistrito(properTextoEnvio(item.distrito));
      setDepartamento(item.departamento ?? "");
      setUrlMaps(item.urlMaps);
      setReferencia(item.referencia ? capitalizarTextoEnvio(item.referencia) : "");
      return;
    }
    setNombreProyecto("");
    setCalleNombre("");
    setNumeracion("");
    setDistrito("");
    setDepartamento("");
    setUrlMaps("");
    setReferencia("");
  }, [open, modo, item]);

  const puedeGuardar =
    personaId !== "" &&
    direccionEnvioTieneDato({
      nombreProyecto,
      calleNombre,
      numeracion,
      distrito,
      departamento: departamento === "" ? null : departamento,
      urlMaps,
      referencia,
    });

  async function handleSubmit() {
    if (!puedeGuardar || saving) return;
    setSaving(true);
    try {
      const payload = {
        personaId,
        nombreProyecto,
        calleNombre,
        numeracion,
        distrito,
        departamento: departamento === "" ? null : departamento,
        urlMaps,
        referencia,
      };
      const res =
        modo === "editar" && item
          ? await editarEnviosDireccionAction({ id: item.id, ...payload })
          : await crearEnviosDireccionAction(payload);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar.");
        return;
      }
      toast.success(modo === "editar" ? "Proyecto actualizado." : "Proyecto creado.");
      onOpenChange(false);
      onSuccess?.(res.data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <AppModal
        title={modo === "editar" ? "Editar Proyecto" : "Nuevo Proyecto"}
        size="md"
        actions={
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={saving || !puedeGuardar} onClick={() => void handleSubmit()}>
              Guardar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <ModalMicroLabel>NOMBRE PROYECTO</ModalMicroLabel>
            <Input
              value={nombreProyecto}
              onChange={(e) => setNombreProyecto(e.target.value.toLocaleUpperCase("es-AR"))}
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-1">
            <ModalMicroLabel>CALLE NOMBRE</ModalMicroLabel>
            <Input
              value={calleNombre}
              onChange={(e) => setCalleNombre(properTextoEnvioInput(e.target.value))}
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-1">
            <ModalMicroLabel>NUMERACIÓN</ModalMicroLabel>
            <Input
              value={numeracion}
              onChange={(e) => setNumeracion(capitalizarTextoEnvioInput(e.target.value))}
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-1">
            <ModalMicroLabel>DISTRITO</ModalMicroLabel>
            <Input
              value={distrito}
              onChange={(e) => setDistrito(properTextoEnvioInput(e.target.value))}
              autoComplete="off"
            />
          </label>
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>DEPARTAMENTO</ModalMicroLabel>
            <Select
              value={departamento === "" ? undefined : departamento}
              onValueChange={(v) => setDepartamento(v as EnviosDepartamentoValue)}
            >
              <SelectTrigger className={cn("w-full")}>
                <SelectValue placeholder="ELEGIR DEPARTAMENTO..." />
              </SelectTrigger>
              <SelectContent className="select-content-filtro" position="popper" side="bottom" align="start">
                {ENVIOS_DEPARTAMENTO_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {ENVIOS_DEPARTAMENTO_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex flex-col gap-1">
            <ModalMicroLabel>URL MAPS</ModalMicroLabel>
            <Input
              value={urlMaps}
              onChange={(e) => setUrlMaps(e.target.value)}
              autoComplete="off"
              placeholder="HTTPS://..."
            />
          </label>
          <label className="flex flex-col gap-1">
            <ModalMicroLabel>REFERENCIA</ModalMicroLabel>
            <Input
              value={referencia}
              onChange={(e) => setReferencia(capitalizarTextoEnvioInput(e.target.value))}
              autoComplete="off"
            />
          </label>
        </div>
      </AppModal>
    </Dialog>
  );
}
