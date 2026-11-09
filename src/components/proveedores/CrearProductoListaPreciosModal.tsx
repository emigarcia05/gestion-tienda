"use client";

import { useCallback, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AppModal from "@/components/shared/AppModal";
import MontoArInput from "@/components/shared/MontoArInput";
import { crearProductoListaPrecioAction } from "@/actions/listaPrecios";
import { montoArNormalizedStringToPesosNumber } from "@/lib/montoArMask";
import { cn } from "@/lib/utils";

interface ProveedorOption {
  id: string;
  nombre: string;
  prefijo: string;
}

interface MarcaOption {
  id: string;
  nombre: string;
}

interface Props {
  proveedores: ProveedorOption[];
  marcas: MarcaOption[];
  onSuccess?: () => void;
}

const FORM_GRID_CLASS = "grid grid-cols-[20%_80%] gap-x-4 gap-y-2 items-center w-full";
const LABEL_CLASS = "text-right font-medium text-sm";
const INPUT_CONTROL_CLASS = "tabular-nums border-primary w-full min-w-0";

function ModalFormRow({
  id,
  label,
  labelClassName,
  children,
}: {
  id: string;
  label: string;
  labelClassName?: string;
  children: ReactNode;
}) {
  return (
    <>
      <Label htmlFor={id} className={cn(LABEL_CLASS, labelClassName)}>
        {label}
      </Label>
      <div className="min-w-0">{children}</div>
    </>
  );
}

export default function CrearProductoListaPreciosModal({
  proveedores,
  marcas,
  onSuccess,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [proveedorId, setProveedorId] = useState("");
  const [marcaNombre, setMarcaNombre] = useState("");
  const [codProdProveedor, setCodProdProveedor] = useState("");
  const [descripcionProveedor, setDescripcionProveedor] = useState("");
  const [pxListaNorm, setPxListaNorm] = useState("");

  const resetForm = useCallback(() => {
    setProveedorId("");
    setMarcaNombre("");
    setCodProdProveedor("");
    setDescripcionProveedor("");
    setPxListaNorm("");
    setPending(false);
  }, []);

  const handleClose = useCallback(
    (next: boolean) => {
      if (!next) resetForm();
      setOpen(next);
    },
    [resetForm]
  );

  async function handleGuardar() {
    if (!proveedorId.trim()) {
      toast.error("Seleccioná un proveedor.");
      return;
    }
    if (!codProdProveedor.trim()) {
      toast.error("El código de proveedor es obligatorio.");
      return;
    }
    if (!descripcionProveedor.trim()) {
      toast.error("La descripción es obligatoria.");
      return;
    }
    if (!pxListaNorm.trim()) {
      toast.error("El precio de lista es obligatorio.");
      return;
    }
    const pxListaProveedor = montoArNormalizedStringToPesosNumber(pxListaNorm);
    if (!Number.isFinite(pxListaProveedor) || pxListaProveedor < 0) {
      toast.error("Ingresá un precio de lista válido.");
      return;
    }

    setPending(true);
    try {
      const result = await crearProductoListaPrecioAction({
        idProveedor: proveedorId,
        codProdProveedor: codProdProveedor.trim(),
        descripcionProveedor: descripcionProveedor.trim(),
        pxListaProveedor,
        marca: marcaNombre.trim() || undefined,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        result.data.creado
          ? `Producto ${result.data.codExt} creado.`
          : `Producto ${result.data.codExt} actualizado.`
      );
      handleClose(false);
      onSuccess?.();
    } finally {
      setPending(false);
    }
  }

  const formulario = (
    <div className={cn(FORM_GRID_CLASS, "py-1")}>
      <ModalFormRow id="crear-prod-proveedor" label="PROVEEDOR">
        <Select value={proveedorId ?? ""} onValueChange={setProveedorId}>
          <SelectTrigger
            id="crear-prod-proveedor"
            className={cn("input-filtro-unificado", INPUT_CONTROL_CLASS)}
          >
            <SelectValue placeholder="SELECCIONAR PROVEEDOR" />
          </SelectTrigger>
          <SelectContent>
            {proveedores.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                [{p.prefijo}] {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ModalFormRow>

      <ModalFormRow id="crear-prod-marca" label="MARCA">
        <Select
          value={marcaNombre || "none"}
          onValueChange={(v) => setMarcaNombre(v === "none" ? "" : v)}
        >
          <SelectTrigger
            id="crear-prod-marca"
            className={cn("input-filtro-unificado", INPUT_CONTROL_CLASS)}
          >
            <SelectValue placeholder="SELECCIONAR MARCA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            {marcas.map((m) => (
              <SelectItem key={m.id} value={m.nombre}>
                {m.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ModalFormRow>

      <ModalFormRow id="crear-prod-cod" label="CÓD. PROVEEDOR">
        <Input
          id="crear-prod-cod"
          value={codProdProveedor}
          onChange={(e) => setCodProdProveedor(e.target.value)}
          placeholder="CÓDIGO DEL PROVEEDOR"
          className={INPUT_CONTROL_CLASS}
          autoComplete="off"
        />
      </ModalFormRow>

      <ModalFormRow
        id="crear-prod-desc"
        label="DESCRIPCIÓN PROV."
        labelClassName="text-left"
      >
        <Input
          id="crear-prod-desc"
          value={descripcionProveedor}
          onChange={(e) => setDescripcionProveedor(e.target.value)}
          placeholder="DESCRIPCIÓN DEL PRODUCTO"
          className={INPUT_CONTROL_CLASS}
          autoComplete="off"
        />
      </ModalFormRow>

      <ModalFormRow id="crear-prod-px" label="PX. LISTA">
        <MontoArInput
          id="crear-prod-px"
          placeholder="—"
          valueNormalized={pxListaNorm}
          onValueNormalizedChange={setPxListaNorm}
          treatEmptyNormalizedAsBlank
          className={INPUT_CONTROL_CLASS}
        />
      </ModalFormRow>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="default" size="default" className="btn-primario-gestion gap-2 shrink-0">
          <Plus className="h-4 w-4 shrink-0" />
          Nuevo Producto
        </Button>
      </DialogTrigger>

      <AppModal
        className="max-w-3xl"
        title="Crear Producto"
        actions={
          <>
            <Button variant="outline" onClick={() => handleClose(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={() => void handleGuardar()} disabled={pending} className="gap-2 min-w-[7.5rem]">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </>
        }
      >
        {formulario}
      </AppModal>
    </Dialog>
  );
}
