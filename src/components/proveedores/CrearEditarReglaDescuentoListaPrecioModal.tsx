"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import PorcentajeCentInput from "@/components/shared/PorcentajeCentInput";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  crearReglaDescuentosListaPrecioAction,
  actualizarReglaDescuentosListaPrecioAction,
  type ReglaDescuentoListaPrecio,
  type CatalogosReglasDescuentosListaPrecio,
} from "@/actions/descuentosListaPrecioReglas";
import type { CampoReglaDescuentoListaPrecioInput } from "@/lib/validations/descuentosListaPrecioReglas";
import {
  CAMPOS_REGLA_DESCUENTO_OPCIONES,
} from "@/lib/descuentosListaPrecioReglasUi";
import {
  parsePorcentajeCentNormalized,
  porcentajeCentFromNumber,
} from "@/lib/porcentajeCentMask";
import { cn } from "@/lib/utils";

type Modo = "crear" | "editar";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modo: Modo;
  regla?: ReglaDescuentoListaPrecio | null;
  catalogos: CatalogosReglasDescuentosListaPrecio;
  onSuccess?: () => void;
}

const FORM_GRID_CLASS = "grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 gap-y-2 items-center";
const LABEL_CLASS = "text-right font-medium text-sm";
const SELECT_CLASS = "input-filtro-unificado w-full min-w-0";

function ModalFormRow({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <>
      <Label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </Label>
      <div className="min-w-0">{children}</div>
    </>
  );
}

export default function CrearEditarReglaDescuentoListaPrecioModal({
  open,
  onOpenChange,
  modo,
  regla,
  catalogos,
  onSuccess,
}: Props) {
  const [pending, setPending] = useState(false);
  const [campo, setCampo] = useState<CampoReglaDescuentoListaPrecioInput>("dto_marca");
  const [valorNorm, setValorNorm] = useState("");
  const [idProveedor, setIdProveedor] = useState("");
  const [idMarca, setIdMarca] = useState("");
  const [idRubro, setIdRubro] = useState("");

  useEffect(() => {
    if (!open) return;
    if (modo === "editar" && regla) {
      setCampo(regla.campo);
      setValorNorm(porcentajeCentFromNumber(regla.valor));
      setIdProveedor(regla.idProveedor ?? "");
      setIdMarca(regla.idMarca ?? "");
      setIdRubro(regla.idRubro ?? "");
      return;
    }
    setCampo("dto_marca");
    setValorNorm("");
    setIdProveedor("");
    setIdMarca("");
    setIdRubro("");
  }, [open, modo, regla]);

  const titulo = modo === "crear" ? "Nueva Regla De Descuento" : "Editar Regla De Descuento";

  const especificidadPreview = useMemo(() => {
    let n = 0;
    if (idProveedor) n += 1;
    if (idMarca) n += 1;
    if (idRubro) n += 1;
    return n;
  }, [idProveedor, idMarca, idRubro]);

  async function handleGuardar() {
    if (!idProveedor && !idMarca && !idRubro) {
      toast.error("Seleccioná al menos una condición (proveedor, marca o rubro).");
      return;
    }

    const valor = parsePorcentajeCentNormalized(valorNorm);
    if (valor === undefined) {
      toast.error("Ingresá un porcentaje válido (0–100).");
      return;
    }

    const payload = {
      campo,
      valor,
      idProveedor: idProveedor || null,
      idMarca: idMarca || null,
      idRubro: idRubro || null,
    };

    setPending(true);
    try {
      const result =
        modo === "editar" && regla
          ? await actualizarReglaDescuentosListaPrecioAction({ id: regla.id, ...payload })
          : await crearReglaDescuentosListaPrecioAction(payload);

      if (!result.ok) {
        toast.error(result.error ?? "No se pudo guardar la regla.");
        return;
      }

      toast.success(
        modo === "crear"
          ? "Regla creada. Se recalculó la lista de precios."
          : "Regla actualizada. Se recalculó la lista de precios."
      );
      onOpenChange(false);
      onSuccess?.();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AppModal
        title={titulo}
        size="md"
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleGuardar} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </>
        }
      >
          <div className="flex flex-col gap-4">
            <div className={cn(FORM_GRID_CLASS, "py-1")}>
            <ModalFormRow id="campo-regla" label="CAMPO">
              <Select
                value={campo}
                onValueChange={(v) => setCampo(v as CampoReglaDescuentoListaPrecioInput)}
              >
                <SelectTrigger id="campo-regla" className={SELECT_CLASS}>
                  <SelectValue placeholder="SELECCIONAR CAMPO" />
                </SelectTrigger>
                <SelectContent>
                  {CAMPOS_REGLA_DESCUENTO_OPCIONES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ModalFormRow>

            <ModalFormRow id="proveedor-regla" label="PROVEEDOR">
              <Select
                value={idProveedor || "none"}
                onValueChange={(v) => setIdProveedor(v === "none" ? "" : v)}
              >
                <SelectTrigger id="proveedor-regla" className={SELECT_CLASS}>
                  <SelectValue placeholder="TODOS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">TODOS</SelectItem>
                  {catalogos.proveedores.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.prefijo ? `[${p.prefijo}] ` : ""}
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ModalFormRow>

            <ModalFormRow id="marca-regla" label="MARCA">
              <Select value={idMarca || "none"} onValueChange={(v) => setIdMarca(v === "none" ? "" : v)}>
                <SelectTrigger id="marca-regla" className={SELECT_CLASS}>
                  <SelectValue placeholder="TODAS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">TODAS</SelectItem>
                  {catalogos.marcas.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ModalFormRow>

            <ModalFormRow id="rubro-regla" label="RUBRO">
              <Select value={idRubro || "none"} onValueChange={(v) => setIdRubro(v === "none" ? "" : v)}>
                <SelectTrigger id="rubro-regla" className={SELECT_CLASS}>
                  <SelectValue placeholder="TODOS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">TODOS</SelectItem>
                  {catalogos.rubros.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ModalFormRow>

            <ModalFormRow id="valor-regla" label="VALOR">
              <PorcentajeCentInput
                id="valor-regla"
                valueNormalized={valorNorm}
                onValueNormalizedChange={setValorNorm}
                placeholder="0,00%"
                className="h-9"
              />
            </ModalFormRow>
          </div>

          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <ModalMicroLabel>ESPECIFICIDAD</ModalMicroLabel>
            <p className="text-sm tabular-nums">
              {especificidadPreview} condición{especificidadPreview !== 1 ? "es" : ""} activa
              {especificidadPreview > 0 ? ` (prioridad ${especificidadPreview})` : ""}
            </p>
          </div>
        </div>
      </AppModal>
    </Dialog>
  );
}
