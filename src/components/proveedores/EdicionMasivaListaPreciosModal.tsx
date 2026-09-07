"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import MontoArInput from "@/components/shared/MontoArInput";
import PorcentajeCentInput from "@/components/shared/PorcentajeCentInput";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  actualizarListaPreciosMasivoAction,
  aplicarVariacionPxListaMasivaAction,
  contarProductosVariacionPxListaAction,
  type ActualizacionMasivaListaPrecios,
  type FilaListaPrecioParaCliente,
} from "@/actions/listaPrecios";
import {
  montoArNumberToNormalizedString,
  montoArNormalizedStringToPesosNumber,
} from "@/lib/montoArMask";
import { parsePorcentajeCentSignedNormalized } from "@/lib/porcentajeCentMask";
import { roundPrecioListaTienda } from "@/lib/calculos";
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

interface RubroOption {
  id: string;
  nombre: string;
}

const FORM_GRID_CLASS = "grid grid-cols-[1.35fr_minmax(0,1fr)] gap-x-4 gap-y-2 items-center";
const LABEL_CLASS = "text-right font-medium text-sm";
const INPUT_CONTROL_CLASS = "tabular-nums border-primary w-full min-w-0";

function ModalFormDivider() {
  return (
    <div
      className="col-span-2 border-t border-primary/30 my-3"
      role="separator"
      aria-hidden
    />
  );
}

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

interface BaseProps {
  marcas: MarcaOption[];
  rubros: RubroOption[];
  onSuccess?: () => void;
}

interface MasivaProps extends BaseProps {
  mode?: "masiva";
  proveedores: ProveedorOption[];
  disabled?: boolean;
}

interface FilaProps extends BaseProps {
  mode: "fila";
  fila: FilaListaPrecioParaCliente | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Props = MasivaProps | FilaProps;

function isFilaMode(props: Props): props is FilaProps {
  return props.mode === "fila";
}

function porcentajeFromVariacionNorm(norm: string): number | null {
  const n = parsePorcentajeCentSignedNormalized(norm);
  if (n == null || n === 0) return null;
  return n;
}

export default function EdicionMasivaListaPreciosModal(props: Props) {
  const { marcas, rubros, onSuccess } = props;
  const filaMode = isFilaMode(props);

  const [openMasiva, setOpenMasiva] = useState(false);
  const open = filaMode ? props.open : openMasiva;
  const setOpen = filaMode ? props.onOpenChange : setOpenMasiva;

  const [pending, setPending] = useState(false);
  const [proveedorId, setProveedorId] = useState("");
  const [marcaNombre, setMarcaNombre] = useState("");
  const [rubroNombre, setRubroNombre] = useState("");
  const [pxListaProveedorNorm, setPxListaProveedorNorm] = useState("");
  const [variacionNorm, setVariacionNorm] = useState("");
  const [cantidadAfectados, setCantidadAfectados] = useState(0);
  const [conteoPendiente, setConteoPendiente] = useState(false);
  const filaActual = filaMode ? props.fila : null;

  const filteredIds = filaMode ? (filaActual ? [filaActual.id] : []) : [];

  useEffect(() => {
    if (!filaMode || !open || !filaActual) return;
    setMarcaNombre(filaActual.marca ?? "");
    setRubroNombre(filaActual.rubro ?? "");
    setPxListaProveedorNorm(montoArNumberToNormalizedString(Number(filaActual.pxListaProveedor) || 0));
  }, [filaMode, open, filaActual]);

  useEffect(() => {
    if (filaMode || !open) return;
    setProveedorId("");
    setMarcaNombre("");
    setRubroNombre("");
    setVariacionNorm("");
    setCantidadAfectados(0);
    setConteoPendiente(false);
  }, [filaMode, open]);

  useEffect(() => {
    if (filaMode || !open || !proveedorId) {
      if (!filaMode) {
        setCantidadAfectados(0);
        setConteoPendiente(false);
      }
      return;
    }

    let cancelled = false;
    setConteoPendiente(true);
    void (async () => {
      const result = await contarProductosVariacionPxListaAction({
        proveedorId,
        marcaNombre: marcaNombre || undefined,
        rubroNombre: rubroNombre || undefined,
      });
      if (cancelled) return;
      setCantidadAfectados(result.ok ? result.data.total : 0);
      setConteoPendiente(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [filaMode, open, proveedorId, marcaNombre, rubroNombre]);

  function resetForm() {
    setProveedorId("");
    setMarcaNombre("");
    setRubroNombre("");
    setPxListaProveedorNorm("");
    setVariacionNorm("");
    setCantidadAfectados(0);
  }

  function buildPayloadFila(): ActualizacionMasivaListaPrecios {
    const data: ActualizacionMasivaListaPrecios = {};
    if (marcaNombre) data.marca = marcaNombre;
    if (rubroNombre) data.rubro = rubroNombre;
    const norm = pxListaProveedorNorm.trim();
    if (norm !== "") {
      data.pxListaProveedor = roundPrecioListaTienda(montoArNormalizedStringToPesosNumber(norm));
    }
    return data;
  }

  async function handleGuardarFila() {
    const data = buildPayloadFila();
    if (Object.keys(data).length === 0) {
      toast.error("Ingresá al menos un valor para actualizar.");
      return;
    }
    if (filteredIds.length === 0) {
      toast.error("No hay producto seleccionado.");
      return;
    }
    setPending(true);
    try {
      const result = await actualizarListaPreciosMasivoAction({ ids: filteredIds, data });
      if (!result.ok) {
        toast.error(result.error ?? "Error al actualizar.");
        return;
      }
      toast.success("Producto actualizado.");
      setOpen(false);
      resetForm();
      onSuccess?.();
    } finally {
      setPending(false);
    }
  }

  async function handleConfirmarMasiva() {
    if (!proveedorId) {
      toast.error("Seleccioná un proveedor.");
      return;
    }
    const variacion = porcentajeFromVariacionNorm(variacionNorm);
    if (variacion == null) {
      toast.error("Ingresá un porcentaje de variación distinto de 0.");
      return;
    }
    if (rubroNombre && !marcaNombre) {
      toast.error("Elegí una marca antes de filtrar por rubro.");
      return;
    }
    if (cantidadAfectados === 0) {
      toast.error("Ningún producto coincide con los filtros.");
      return;
    }

    setPending(true);
    try {
      const result = await aplicarVariacionPxListaMasivaAction({
        proveedorId,
        marcaNombre: marcaNombre || undefined,
        rubroNombre: rubroNombre || undefined,
        variacion,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Error al aplicar la variación.");
        return;
      }
      const n = result.data?.actualizados ?? 0;
      toast.success(`Se actualizaron ${n} producto${n !== 1 ? "s" : ""}.`);
      setOpen(false);
      resetForm();
      onSuccess?.();
    } finally {
      setPending(false);
    }
  }

  const titulo = filaMode ? "Editar producto" : "Edición Masiva";
  const variacionLista = porcentajeFromVariacionNorm(variacionNorm) != null;
  const confirmarMasivaHabilitado =
    !!proveedorId &&
    variacionLista &&
    cantidadAfectados > 0 &&
    !conteoPendiente &&
    !pending &&
    !(rubroNombre && !marcaNombre);

  const formularioFila = (
    <div className="flex flex-col gap-4">
      {filaMode && props.fila && (
        <p className="text-sm">
          <strong>{props.fila.codExt}</strong>
          {" — "}
          {props.fila.descripcionProveedor}
        </p>
      )}

      <div className={cn(FORM_GRID_CLASS, "py-1")}>
        <ModalFormRow id="pxListaProveedor" label="PX. LISTA PROVEEDOR">
          <MontoArInput
            id="pxListaProveedor"
            placeholder="—"
            valueNormalized={pxListaProveedorNorm}
            onValueNormalizedChange={setPxListaProveedorNorm}
            treatEmptyNormalizedAsBlank
            className={INPUT_CONTROL_CLASS}
          />
        </ModalFormRow>
        <ModalFormDivider />

        <ModalFormRow id="marca" label="MARCA">
          <Select value={marcaNombre || "none"} onValueChange={(v) => setMarcaNombre(v === "none" ? "" : v)}>
            <SelectTrigger id="marca" className={cn("input-filtro-unificado", INPUT_CONTROL_CLASS)}>
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

        <ModalFormRow id="rubro" label="RUBRO">
          <Select value={rubroNombre || "none"} onValueChange={(v) => setRubroNombre(v === "none" ? "" : v)}>
            <SelectTrigger id="rubro" className={cn("input-filtro-unificado", INPUT_CONTROL_CLASS)}>
              <SelectValue placeholder="SELECCIONAR RUBRO" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {rubros.map((r) => (
                <SelectItem key={r.id} value={r.nombre}>
                  {r.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ModalFormRow>
      </div>
    </div>
  );

  const formularioMasiva = !filaMode ? (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        {!proveedorId
          ? "Seleccioná un proveedor para ver el alcance."
          : conteoPendiente
            ? "Contando productos…"
            : cantidadAfectados === 0
              ? "Ningún producto coincide con los filtros."
              : `Se aplicará a ${cantidadAfectados.toLocaleString("es-AR")} producto${cantidadAfectados !== 1 ? "s" : ""}. Los precios no bajan de 0.`}
      </p>

      <div className={cn(FORM_GRID_CLASS, "py-1")}>
        <ModalFormRow id="edicion-masiva-proveedor" label="PROVEEDOR">
          <Select
            value={proveedorId}
            onValueChange={(v) => {
              setProveedorId(v);
              setMarcaNombre("");
              setRubroNombre("");
            }}
          >
            <SelectTrigger
              id="edicion-masiva-proveedor"
              className={cn("input-filtro-unificado", INPUT_CONTROL_CLASS)}
            >
              <SelectValue placeholder="SELECCIONAR PROVEEDOR" />
            </SelectTrigger>
            <SelectContent>
              {props.proveedores.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.prefijo ? `[${p.prefijo}] ${p.nombre}` : p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ModalFormRow>

        <ModalFormRow id="edicion-masiva-marca" label="MARCA">
          <Select
            value={marcaNombre || "none"}
            onValueChange={(v) => {
              setMarcaNombre(v === "none" ? "" : v);
              setRubroNombre("");
            }}
          >
            <SelectTrigger
              id="edicion-masiva-marca"
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

        <ModalFormRow id="edicion-masiva-rubro" label="RUBRO">
          <Select
            value={rubroNombre || "none"}
            onValueChange={(v) => setRubroNombre(v === "none" ? "" : v)}
            disabled={!marcaNombre}
          >
            <SelectTrigger
              id="edicion-masiva-rubro"
              className={cn("input-filtro-unificado", INPUT_CONTROL_CLASS)}
              disabled={!marcaNombre}
            >
              <SelectValue placeholder="SELECCIONAR RUBRO" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {rubros.map((r) => (
                <SelectItem key={r.id} value={r.nombre}>
                  {r.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ModalFormRow>

        <ModalFormRow id="edicion-masiva-variacion" label="VARIACIÓN">
          <PorcentajeCentInput
            id="edicion-masiva-variacion"
            placeholder="—"
            valueNormalized={variacionNorm}
            onValueNormalizedChange={setVariacionNorm}
            allowNegative
            pctSuffixAlwaysVisible
            treatEmptyNormalizedAsBlank
            className={cn(INPUT_CONTROL_CLASS, "h-9")}
          />
        </ModalFormRow>
      </div>
    </div>
  ) : null;

  if (filaMode) {
    if (!props.fila) return null;
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <AppModal
          title={titulo}
          actions={
            <>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleGuardarFila()} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
              </Button>
            </>
          }
        >
          {formularioFila}
        </AppModal>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="default"
          size="default"
          className="btn-primario-gestion gap-2 shrink-0"
          disabled={props.disabled}
        >
          <Pencil className="h-4 w-4 shrink-0" />
          Edición Masiva
        </Button>
      </DialogTrigger>
      <AppModal
        title={titulo}
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirmarMasiva()}
              disabled={!confirmarMasivaHabilitado}
              className="gap-2 min-w-[7.5rem]"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </Button>
          </>
        }
      >
        {formularioMasiva}
      </AppModal>
    </Dialog>
  );
}
