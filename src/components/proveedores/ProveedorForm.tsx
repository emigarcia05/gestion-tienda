"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ModalSiNoChoice from "@/components/shared/ModalSiNoChoice";
import { crearProveedor, editarProveedor } from "@/actions/proveedores";

type IvaProveedorValue = "SIEMPRE" | "NUNCA" | "PREGUNTA";

interface Props {
  proveedor?: {
    id: string;
    nombre: string;
    prefijo?: string | null;
    idProveedorDux?: string;
    whatsapp?: string | null;
    coeficienteTintometrico?: number;
    plazoPago1Dias?: number | null;
    plazoPago2Dias?: number | null;
    plazoPago3Dias?: number | null;
    plazoPago4Dias?: number | null;
    /** Tiempo de entrega en días; null = no configurado. */
    tiempoEntregaEnDias?: number | null;
    /** Flag "Proveedor Mercadería" (solo edición: precarga SI/NO). */
    proveedorMercaderia?: boolean;
    /** Flag fábrica (solo edición: precarga SI/NO). */
    esFabrica?: boolean;
    /** Política IVA persistida (solo edición: precarga SIEMPRE/NUNCA/PREGUNTA). */
    iva?: IvaProveedorValue;
  };
  onSuccess?: () => void;
  /** Id del form para asociar botón externo con form="id". */
  id?: string;
  /** Si true, no renderiza la fila del botón Guardar (para usar botonera del modal). */
  hideSubmitButton?: boolean;
  /** Callback cuando cambia el estado de envío (para deshabilitar botón externo). */
  onPendingChange?: (pending: boolean) => void;
  /** Desde el modal: al abrirse, reinicia “Proveedor Mercadería” en alta y precarga en edición. */
  modalOpen?: boolean;
  /** Si el usuario ya eligió SI/NO (para deshabilitar Guardar del modal en alta). */
  onProveedorMercaderiaListoChange?: (listo: boolean) => void;
}

function SubmitButton({ isEdit, pending }: { isEdit: boolean; pending: boolean }) {
  return (
    <Button type="submit" disabled={pending} className="gap-2">
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {isEdit ? "Guardar Cambios" : "Guardar"}
    </Button>
  );
}

export default function ProveedorForm({
  proveedor,
  onSuccess,
  id,
  hideSubmitButton = false,
  onPendingChange,
  modalOpen = true,
  onProveedorMercaderiaListoChange,
}: Props) {
  const [pending, startTransition] = useTransition();
  const isEdit = !!proveedor;

  type ProveedorMercaderiaSel = "si" | "no" | "";
  type EsFabricaSel = "si" | "no";

  /**
   * SI/NO de `proveedorMercaderia`. Controlled + hidden `name="proveedorMercaderia"`.
   * Alta: sin valor por defecto (el usuario debe elegir).
   * Edición: precarga el valor persistido.
   */
  const [proveedorMercaderia, setProveedorMercaderia] = useState<ProveedorMercaderiaSel>(() => {
    if (!proveedor) return "";
    return proveedor.proveedorMercaderia === false ? "no" : "si";
  });

  /**
   * SI/NO de `esFabrica`. Controlled + hidden `name="esFabrica"`.
   * Alta: default `no` (mismo default DB `false`).
   * Edición: precarga el valor persistido.
   */
  const [esFabrica, setEsFabrica] = useState<EsFabricaSel>(() =>
    proveedor?.esFabrica === true ? "si" : "no"
  );

  /**
   * Política IVA. Controlled + hidden `name="iva"`.
   * Alta: default `PREGUNTA` (mismo default que la columna `global_proveedores.iva`).
   * Edición: precarga el valor persistido.
   */
  const [iva, setIva] = useState<IvaProveedorValue>(
    () => proveedor?.iva ?? "PREGUNTA",
  );

  const PLAZO_OPTS = ["30", "60", "90", "120", "150"] as const;
  const [plazo1, setPlazo1] = useState(() =>
    proveedor?.plazoPago1Dias != null ? String(proveedor.plazoPago1Dias) : "30"
  );
  const [plazo2, setPlazo2] = useState(() =>
    proveedor?.plazoPago2Dias != null ? String(proveedor.plazoPago2Dias) : ""
  );
  const [plazo3, setPlazo3] = useState(() =>
    proveedor?.plazoPago3Dias != null ? String(proveedor.plazoPago3Dias) : ""
  );
  const [plazo4, setPlazo4] = useState(() =>
    proveedor?.plazoPago4Dias != null ? String(proveedor.plazoPago4Dias) : ""
  );

  useEffect(() => {
    if (!modalOpen) return;
    if (!proveedor) {
      setProveedorMercaderia("");
      setEsFabrica("no");
    } else {
      setProveedorMercaderia(proveedor.proveedorMercaderia === false ? "no" : "si");
      setEsFabrica(proveedor.esFabrica === true ? "si" : "no");
    }
  }, [modalOpen, proveedor]);

  useEffect(() => {
    if (!modalOpen) return;
    setIva(proveedor?.iva ?? "PREGUNTA");
    setPlazo1(proveedor?.plazoPago1Dias != null ? String(proveedor.plazoPago1Dias) : "30");
    setPlazo2(proveedor?.plazoPago2Dias != null ? String(proveedor.plazoPago2Dias) : "");
    setPlazo3(proveedor?.plazoPago3Dias != null ? String(proveedor.plazoPago3Dias) : "");
    setPlazo4(proveedor?.plazoPago4Dias != null ? String(proveedor.plazoPago4Dias) : "");
  }, [modalOpen, proveedor]);

  useEffect(() => {
    onProveedorMercaderiaListoChange?.(proveedorMercaderia !== "");
  }, [proveedorMercaderia, onProveedorMercaderiaListoChange]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (proveedorMercaderia === "") {
      toast.error("Seleccioná SI o NO en Proveedor Mercadería.");
      return;
    }
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      onPendingChange?.(true);
      try {
        const result = isEdit
          ? await editarProveedor(proveedor.id, formData)
          : await crearProveedor(formData);

        if (result.ok) {
          toast.success(isEdit ? "Proveedor actualizado." : "Proveedor guardado con éxito.");
          if (!isEdit) form.reset();
          onSuccess?.();
        } else {
          toast.error(result.error);
        }
      } finally {
        onPendingChange?.(false);
      }
    });
  }

  return (
    <form id={id} onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="nombre">NOMBRE DEL PROVEEDOR</Label>
        <Input
          id="nombre"
          name="nombre"
          placeholder="EJ: DISTRIBUIDORA NORTE S.A."
          defaultValue={proveedor?.nombre ?? ""}
          required
          minLength={2}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prefijo">PREFIJO</Label>
        <Input
          id="prefijo"
          name="prefijo"
          placeholder="EJ: PIN"
          defaultValue={proveedor?.prefijo ?? ""}
          maxLength={3}
          disabled={pending}
          className="uppercase tracking-widest"
          onChange={(e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="proveedorMercaderia">
          PROVEEDOR MERCADERÍA{" "}
          <span className="text-destructive" aria-hidden>
            *
          </span>
        </Label>
        <Select
          value={proveedorMercaderia === "" ? undefined : proveedorMercaderia}
          onValueChange={(v) => setProveedorMercaderia(v as "si" | "no")}
          disabled={pending}
          required
        >
          <SelectTrigger id="proveedorMercaderia" className="w-full" aria-required>
            <SelectValue placeholder="SELECCIONAR SI O NO" />
          </SelectTrigger>
          <SelectContent position="popper" side="bottom" align="start">
            <SelectItem value="si">SI</SelectItem>
            <SelectItem value="no">NO</SelectItem>
          </SelectContent>
        </Select>
        <input type="hidden" name="proveedorMercaderia" value={proveedorMercaderia} />
      </div>

      <div className="space-y-1.5">
        <ModalSiNoChoice
          label="ES FÁBRICA"
          value={esFabrica === "si"}
          onChange={(checked) => setEsFabrica(checked ? "si" : "no")}
          disabled={pending}
        />
        <input type="hidden" name="esFabrica" value={esFabrica} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="iva">IVA</Label>
        <Select
          value={iva}
          onValueChange={(v) => setIva(v as IvaProveedorValue)}
          disabled={pending}
        >
          <SelectTrigger id="iva" className="w-full">
            <SelectValue placeholder="SELECCIONAR IVA" />
          </SelectTrigger>
          <SelectContent position="popper" side="bottom" align="start">
            <SelectItem value="SIEMPRE">SIEMPRE</SelectItem>
            <SelectItem value="NUNCA">NUNCA</SelectItem>
            <SelectItem value="PREGUNTA">PREGUNTA</SelectItem>
          </SelectContent>
        </Select>
        <input type="hidden" name="iva" value={iva} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="idProveedorDux">ID PROVEEDOR EN DUX</Label>
        <Input
          id="idProveedorDux"
          name="idProveedorDux"
          placeholder="EJ: 1234"
          defaultValue={proveedor?.idProveedorDux ?? ""}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="whatsapp">WHATSAPP</Label>
        <Input
          id="whatsapp"
          name="whatsapp"
          placeholder="EJ: 5491112345678 (SIN +)"
          defaultValue={proveedor?.whatsapp ?? ""}
          disabled={pending}
          inputMode="numeric"
        />
      </div>

      <div className="space-y-1.5">
        <Label>PLAZOS PAGO (DÍAS)</Label>
        <input type="hidden" name="plazoPago1Dias" value={plazo1} />
        <input type="hidden" name="plazoPago2Dias" value={plazo2} />
        <input type="hidden" name="plazoPago3Dias" value={plazo3} />
        <input type="hidden" name="plazoPago4Dias" value={plazo4} />
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              { label: "1.º", value: plazo1, set: setPlazo1, required: true },
              { label: "2.º", value: plazo2, set: setPlazo2, required: false },
              { label: "3.º", value: plazo3, set: setPlazo3, required: false },
              { label: "4.º", value: plazo4, set: setPlazo4, required: false },
            ] as const
          ).map((slot) => (
            <div key={slot.label} className="space-y-1">
              <span className="text-xs text-muted-foreground">{slot.label}</span>
              <Select
                value={slot.value || "none"}
                onValueChange={(v) => slot.set(v === "none" ? "" : v)}
                disabled={pending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={slot.required ? "Oblig." : "—"} />
                </SelectTrigger>
                <SelectContent>
                  {!slot.required ? <SelectItem value="none">—</SelectItem> : null}
                  {PLAZO_OPTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tiempoEntregaEnDias">
          TIEMPO ENTREGA MERCADERÍA EN DÍAS
        </Label>
        <Input
          id="tiempoEntregaEnDias"
          name="tiempoEntregaEnDias"
          placeholder="EJ: 7"
          defaultValue={
            proveedor?.tiempoEntregaEnDias != null
              ? String(proveedor.tiempoEntregaEnDias)
              : ""
          }
          disabled={pending}
          inputMode="numeric"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="coeficienteTintometrico">COEF. TINTOMÉTRICO</Label>
        <Input
          id="coeficienteTintometrico"
          name="coeficienteTintometrico"
          placeholder="EJ: 1,250000"
          defaultValue={String(proveedor?.coeficienteTintometrico ?? 1)}
          disabled={pending}
          inputMode="decimal"
        />
      </div>

      {!hideSubmitButton && (
        <div className="flex justify-end gap-2 pt-2">
          <SubmitButton isEdit={isEdit} pending={pending} />
        </div>
      )}
    </form>
  );
}
