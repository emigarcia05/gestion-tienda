"use client";

import { useEffect, useState } from "react";
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
  actualizarUsuarioPersonalAction,
  crearUsuarioPersonalAction,
} from "@/actions/globalPersonal";
import type { GlobalPersonalItem } from "@/services/globalPersonal.service";
import { MODULOS_PERMITIDOS_USUARIO } from "@/lib/usuarios";
import {
  SUCURSALES_PREFERIDAS,
  type SucursalPreferida,
} from "@/lib/sucursalPreferida";
import type { MainAppAreaId } from "@/lib/main-app-areas";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: GlobalPersonalItem | null;
  onSuccess?: () => void;
}

const SUCURSAL_VACIA = "none";

export default function EditarUsuarioModal({
  open,
  onOpenChange,
  item,
  onSuccess,
}: Props) {
  const esAlta = item == null;
  const [idPersonal, setIdPersonal] = useState("");
  const [nombre, setNombre] = useState("");
  const [sucursal, setSucursal] = useState<SucursalPreferida | "">("");
  const [modulos, setModulos] = useState<MainAppAreaId[]>([]);
  const [titularFinanciero, setTitularFinanciero] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setIdPersonal(String(item.idPersonal));
      setNombre(item.nombrePersonal);
      setSucursal(item.sucursalPorDefecto ?? "");
      setModulos(item.modulosPermitidos);
      setTitularFinanciero(item.titularFinanciero);
      return;
    }
    setIdPersonal("");
    setNombre("");
    setSucursal("");
    setModulos([]);
    setTitularFinanciero(false);
  }, [open, item]);

  const puedeGuardar =
    modulos.length > 0 &&
    (esAlta ? idPersonal.trim() !== "" && nombre.trim() !== "" : item != null);

  function toggleModulo(id: MainAppAreaId) {
    setModulos((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    if (saving || !puedeGuardar) return;
    setSaving(true);
    try {
      const sucursalPorDefecto = sucursal === "" ? null : sucursal;
      const res = esAlta
        ? await crearUsuarioPersonalAction({
            idPersonal,
            nombrePersonal: nombre,
            sucursalPorDefecto,
            modulosPermitidos: modulos,
            titularFinanciero,
          })
        : item
          ? await actualizarUsuarioPersonalAction({
              idPersonal: item.idPersonal,
              sucursalPorDefecto,
              modulosPermitidos: modulos,
              titularFinanciero,
            })
          : { ok: false as const, error: "Usuario no encontrado." };
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar.");
        return;
      }
      toast.success(esAlta ? "Usuario creado." : "Usuario actualizado.");
      onOpenChange(false);
      onSuccess?.();
    } finally {
      setSaving(false);
    }
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
        title={esAlta ? "CREAR USUARIO" : "EDITAR USUARIO"}
        size="md"
        scrollBody
        hideBodyScrollbars
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
            <Button
              type="button"
              disabled={saving || !puedeGuardar}
              onClick={() => void handleSubmit()}
            >
              Guardar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {esAlta ? (
            <>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>ID Personal</ModalMicroLabel>
                <Input
                  value={idPersonal}
                  onChange={(e) => setIdPersonal(e.target.value)}
                  placeholder="ID PERSONAL"
                  inputMode="numeric"
                  disabled={saving}
                  aria-label="ID Personal"
                />
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>Nombre</ModalMicroLabel>
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="NOMBRE"
                  disabled={saving}
                  aria-label="Nombre"
                  className="uppercase"
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>Nombre</ModalMicroLabel>
              <p className="text-sm font-medium uppercase text-foreground">
                {item?.nombrePersonal ?? ""}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>Sucursal Por Defecto</ModalMicroLabel>
            <Select
              value={sucursal || SUCURSAL_VACIA}
              onValueChange={(v) =>
                setSucursal(v === SUCURSAL_VACIA ? "" : (v as SucursalPreferida))
              }
              disabled={saving}
            >
              <SelectTrigger
                className="input-filtro-unificado w-full"
                aria-label="Sucursal Por Defecto"
              >
                <SelectValue placeholder="SUCURSAL POR DEFECTO" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="select-content-filtro"
              >
                <SelectItem value={SUCURSAL_VACIA}>SIN SUCURSAL</SelectItem>
                {SUCURSALES_PREFERIDAS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <ModalMicroLabel>Módulos Permitidos</ModalMicroLabel>
            <div className="flex flex-col gap-2">
              {MODULOS_PERMITIDOS_USUARIO.map((m) => {
                const activo = modulos.includes(m.id);
                return (
                  <Button
                    key={m.id}
                    type="button"
                    size="sm"
                    variant={activo ? "default" : "outline"}
                    disabled={saving}
                    className={cn("justify-start", activo && "font-semibold")}
                    onClick={() => toggleModulo(m.id)}
                    aria-pressed={activo}
                  >
                    {m.label}
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>Titular Financiero</ModalMicroLabel>
            <ModalSiNoChoice
              value={titularFinanciero}
              onChange={setTitularFinanciero}
              disabled={saving}
            />
          </div>
        </div>
      </AppModal>
    </Dialog>
  );
}
