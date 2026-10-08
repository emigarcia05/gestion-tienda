"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppModal from "@/components/shared/AppModal";
import ProveedorForm from "./ProveedorForm";

const FORM_ID = "proveedor-form";

export interface ProveedorParaModal {
  id: string;
  nombre: string;
  prefijo: string;
  idProveedorDux?: string;
  whatsapp?: string | null;
  coeficienteTintometrico?: number;
  plazoPago1Dias?: number | null;
  plazoPago2Dias?: number | null;
  plazoPago3Dias?: number | null;
  plazoPago4Dias?: number | null;
  /** Tiempo de entrega en días; null = no configurado. */
  tiempoEntregaEnDias?: number | null;
  /** Flag "Proveedor Mercadería" (edición). */
  proveedorMercaderia?: boolean;
  /** Flag fábrica (edición). */
  esFabrica?: boolean;
  /** Política IVA persistida (edición). */
  iva?: "SIEMPRE" | "NUNCA" | "PREGUNTA";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si no se pasa, modo crear. Si se pasa, modo editar. El borrado es por fila en Lista Prov. */
  proveedor?: ProveedorParaModal | null;
  /** Llamado tras guardar o eliminar para que el padre refresque. */
  onSuccess?: () => void;
}

export default function ProveedorModal({ open, onOpenChange, proveedor, onSuccess }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [mercaderiaListo, setMercaderiaListo] = useState(false);
  const isEdit = !!proveedor;

  useEffect(() => {
    if (!open) return;
    setMercaderiaListo(isEdit);
  }, [open, isEdit, proveedor?.id]);

  function handleSuccess() {
    onOpenChange(false);
    onSuccess?.();
    router.refresh();
  }

  return (
    <AppModal
      title={isEdit ? "Editar Proveedor" : "Nuevo Proveedor"}
      actions={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            disabled={pending || (!isEdit && !mercaderiaListo)}
            className="gap-2"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Guardar Cambios" : "Guardar"}
          </Button>
        </>
      }
    >
      <ProveedorForm
        id={FORM_ID}
        proveedor={proveedor ?? undefined}
        hideSubmitButton
        modalOpen={open}
        onProveedorMercaderiaListoChange={setMercaderiaListo}
        onSuccess={handleSuccess}
        onPendingChange={setPending}
      />
    </AppModal>
  );
}
