"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import ModalSiNoChoice from "@/components/shared/ModalSiNoChoice";
import {
  crearProductoTiendaAction,
  listarMarcasCatalogoAction,
  listarRubrosCatalogoAction,
} from "@/actions/listaProductos";
import type { MarcaCatalogoItem, RubroCatalogoItem } from "@/lib/listaProductos";

const SIN_VALOR = "none";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreado: (codTienda: string) => void;
}

export default function AgregarProductoTiendaModal({ open, onOpenChange, onCreado }: Props) {
  const [rubros, setRubros] = useState<RubroCatalogoItem[]>([]);
  const [marcas, setMarcas] = useState<MarcaCatalogoItem[]>([]);
  const [descripcion, setDescripcion] = useState("");
  const [idRubro, setIdRubro] = useState(SIN_VALOR);
  const [subRubro, setSubRubro] = useState("");
  const [idMarca, setIdMarca] = useState(SIN_VALOR);
  const [bulto, setBulto] = useState("");
  const [esPropio, setEsPropio] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDescripcion("");
    setIdRubro(SIN_VALOR);
    setSubRubro("");
    setIdMarca(SIN_VALOR);
    setBulto("");
    setEsPropio(false);
    void Promise.all([listarRubrosCatalogoAction(), listarMarcasCatalogoAction()]).then(
      ([resRubros, resMarcas]) => {
        if (resRubros.ok) setRubros(resRubros.data);
        else toast.error(resRubros.error);
        if (resMarcas.ok) setMarcas(resMarcas.data);
        else toast.error(resMarcas.error);
      }
    );
  }, [open]);

  const bultoTrim = bulto.trim();
  const bultoNum = bultoTrim ? Number(bultoTrim) : null;
  const bultoInvalido = bultoNum !== null && (!Number.isInteger(bultoNum) || bultoNum < 1);
  const puedeGuardar = descripcion.trim().length > 0 && !bultoInvalido && !pending;

  async function guardar() {
    if (!puedeGuardar) return;
    setPending(true);
    try {
      const res = await crearProductoTiendaAction({
        descripcion,
        idRubro: idRubro === SIN_VALOR ? null : idRubro,
        subRubro: subRubro.trim() || null,
        idMarca: idMarca === SIN_VALOR ? null : idMarca,
        bulto: bultoNum,
        esProductoPropio: esPropio,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Producto creado con código ${res.data.codTienda}.`);
      onOpenChange(false);
      onCreado(res.data.codTienda);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AppModal
        title="AGREGAR ITEM"
        size="md"
        actions={
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={!puedeGuardar} onClick={() => void guardar()}>
              Guardar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            El COD. TIENDA se asigna automáticamente (correlativo).
          </p>
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>DESCRIPCIÓN</ModalMicroLabel>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="DESCRIPCIÓN DEL PRODUCTO"
              disabled={pending}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>RUBRO</ModalMicroLabel>
              <Select value={idRubro} onValueChange={setIdRubro} disabled={pending}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="RUBRO" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_VALOR}>SIN RUBRO</SelectItem>
                  {rubros.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>SUB-RUBRO</ModalMicroLabel>
              <Input
                value={subRubro}
                onChange={(e) => setSubRubro(e.target.value)}
                placeholder="SUB-RUBRO"
                disabled={pending}
              />
            </div>
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>MARCA</ModalMicroLabel>
              <Select value={idMarca} onValueChange={setIdMarca} disabled={pending}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="MARCA" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_VALOR}>SIN MARCA</SelectItem>
                  {marcas.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>BULTO</ModalMicroLabel>
              <Input
                value={bulto}
                onChange={(e) => setBulto(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                placeholder="UNIDADES POR BULTO"
                disabled={pending}
                aria-invalid={bultoInvalido || undefined}
              />
            </div>
          </div>
          <ModalSiNoChoice label="PRODUCTO PROPIO" value={esPropio} onChange={setEsPropio} disabled={pending} />
        </div>
      </AppModal>
    </Dialog>
  );
}
