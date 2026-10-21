"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import EnteroStepperInput from "@/components/shared/EnteroStepperInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import SelectorProductosReposicionModal from "./SelectorProductosReposicionModal";
import type {
  FormaPedirReposicionOption,
  ItemReposicion,
  ItemSelectorReposicion,
  SucursalReposicion,
} from "@/actions/reposicion";
import { upsertReglaReposicion } from "@/actions/reposicion";
import { upsertReglaReposicionCorpAction } from "@/actions/reposicionCorp";
import {
  mensajeViolaPisoReposicionCorp,
  unidadesDesdeReglaReposicion,
  type ReglaReposicionValores,
} from "@/lib/reposicionCorp";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { fmtNumero } from "@/lib/format";
import {
  REPOSICION_FORMA_PEDIDO_VENDEDOR_LABELS,
  REPOSICION_FORMA_PEDIDO_VENDEDOR_VALUES,
  reposicionFormaPedidoVendedorSchema,
} from "@/lib/validations/reposicion";

const OPCIONES_FORMA: { value: FormaPedirReposicionOption; label: string }[] = [
  { value: "", label: "—" },
  ...REPOSICION_FORMA_PEDIDO_VENDEDOR_VALUES.map((value) => ({
    value,
    label: REPOSICION_FORMA_PEDIDO_VENDEDOR_LABELS[value],
  })),
];

function hayBultoConfigurado(bulto: number | null | undefined): boolean {
  return bulto != null && bulto >= 1;
}

/** Entero ≥ 0 si el usuario ingresó algo; vacío o inválido → null (no habilita cantidad). */
function parsePuntoReposicionInput(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Entero ≥ 1 para guardar; vacío, 0 o inválido → null. */
function parseCantReposicionInput(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

function valoresIniciales(item: ItemReposicion): {
  formaPedir: FormaPedirReposicionOption;
  punto: string;
  cant: string;
  unidadesBulto: string;
} {
  const guardado = Boolean(item.idReposicion) || Boolean(item.formaPedir);
  return {
    formaPedir: item.formaPedir || "",
    punto: guardado ? String(item.puntoReposicion) : "",
    cant: guardado ? String(item.cant) : "",
    unidadesBulto: hayBultoConfigurado(item.bulto) ? String(item.bulto) : "",
  };
}

function EtiquetaCampoReposicion({ children }: { children?: string }) {
  return (
    <Label className="flex h-12 w-full items-center justify-center px-1 text-xs font-medium text-foreground">
      <span className="line-clamp-3 w-full text-center leading-tight">{children}</span>
    </Label>
  );
}

function ColumnaCampoReposicion({
  oculta = false,
  children,
}: {
  oculta?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-1",
        oculta && "invisible pointer-events-none select-none"
      )}
      aria-hidden={oculta}
    >
      {children}
    </div>
  );
}

interface UseReposicionConfigFormArgs {
  open: boolean;
  item: ItemReposicion;
  sucursal?: SucursalReposicion;
  modo?: "sucursal" | "corp";
}

/**
 * Estado + guardado de la regla de reposición de un producto (y los adicionales de la tabla).
 * Lo comparten `ConfigurarReposicionModal` y el modal **Cant. a Pedir** de Pedir Mercadería.
 */
export function useReposicionConfigForm({
  open,
  item,
  sucursal,
  modo = "sucursal",
}: UseReposicionConfigFormArgs) {
  const [formaPedir, setFormaPedir] = useState<FormaPedirReposicionOption>(item.formaPedir || "");
  const [puntoInput, setPuntoInput] = useState("");
  const [cantInput, setCantInput] = useState("");
  const [unidadesBultoInput, setUnidadesBultoInput] = useState("");
  const [productosAdicionales, setProductosAdicionales] = useState<ItemSelectorReposicion[]>([]);

  useEffect(() => {
    if (!open) return;
    const inicial = valoresIniciales(item);
    queueMicrotask(() => {
      setFormaPedir(inicial.formaPedir);
      setPuntoInput(inicial.punto);
      setCantInput(inicial.cant);
      setUnidadesBultoInput(inicial.unidadesBulto);
      setProductosAdicionales([]);
    });
    // Solo al abrir o al cambiar de producto / regla: no pisar lo que se está tipeando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    item.idListaTienda,
    item.codTienda,
    item.idReposicion,
    item.formaPedir,
    item.puntoReposicion,
    item.cant,
    item.bulto,
  ]);

  const inicial = valoresIniciales(item);
  const hayCambios =
    formaPedir !== inicial.formaPedir ||
    puntoInput !== inicial.punto ||
    cantInput !== inicial.cant ||
    (formaPedir === "POR_BULTO" && unidadesBultoInput !== inicial.unidadesBulto) ||
    productosAdicionales.length > 0;

  function cambiarFormaPedir(valor: FormaPedirReposicionOption) {
    setFormaPedir(valor);
    if (valor === "") {
      setPuntoInput("");
      setCantInput("");
    }
  }

  function agregarProductos(seleccionados: ItemSelectorReposicion[]) {
    setProductosAdicionales((prev) => {
      const keys = new Set(prev.map((p) => p.idListaTienda));
      return [...prev, ...seleccionados.filter((p) => !keys.has(p.idListaTienda))];
    });
  }

  function quitarProducto(producto: ItemSelectorReposicion) {
    setProductosAdicionales((prev) =>
      prev.filter(
        (p) => !(p.idListaTienda === producto.idListaTienda && p.codTienda === producto.codTienda)
      )
    );
  }

  /** Valida y guarda la regla en todos los productos. Devuelve cuántos guardó o `null` si falló (con toast). */
  async function guardar(): Promise<number | null> {
    const formaParsed = reposicionFormaPedidoVendedorSchema.safeParse(formaPedir);
    if (!formaParsed.success) {
      toast.error("Seleccioná Forma Pedir.");
      return null;
    }
    const unidadesPorBulto = parseCantReposicionInput(unidadesBultoInput);
    if (formaParsed.data === "POR_BULTO" && unidadesPorBulto === null) {
      toast.error("Completá Un. por bulto.");
      return null;
    }
    const punto = parsePuntoReposicionInput(puntoInput);
    if (punto === null) {
      toast.error("Completá Punto Reposición.");
      return null;
    }
    const cantNum = parseCantReposicionInput(cantInput);
    if (cantNum === null) {
      toast.error(
        formaParsed.data === "POR_BULTO"
          ? "Completá Bultos Reposición (mín. 1)."
          : "Completá Cant. Reposición (mín. 1)."
      );
      return null;
    }
    if (modo === "sucursal" && !sucursal) {
      toast.error("Seleccioná un usuario en el slidenav.");
      return null;
    }
    if (modo === "sucursal" && item.pisoCorp) {
      const viola = mensajeViolaPisoReposicionCorp(
        item.pisoCorp,
        { forma: formaParsed.data, punto, cantConf: cantNum },
        formaParsed.data === "POR_BULTO" ? unidadesPorBulto : item.bulto
      );
      if (viola) {
        toast.error(viola);
        return null;
      }
    }

    const codigos = [item.codTienda, ...productosAdicionales.map((p) => p.codTienda)];
    for (const codTienda of codigos) {
      const payload = {
        codTienda,
        formaPedir: formaParsed.data,
        puntoReposicion: punto,
        cant: cantNum,
        ...(formaParsed.data === "POR_BULTO" && unidadesPorBulto !== null ? { unidadesPorBulto } : {}),
      };
      const res =
        modo === "corp"
          ? await upsertReglaReposicionCorpAction(payload)
          : await upsertReglaReposicion({ sucursalCodigo: sucursal!, ...payload });
      if (!res.ok) {
        toast.error(res.error ?? "Error al guardar.");
        return null;
      }
    }
    return codigos.length;
  }

  return {
    formaPedir,
    cambiarFormaPedir,
    puntoInput,
    setPuntoInput,
    cantInput,
    setCantInput,
    unidadesBultoInput,
    setUnidadesBultoInput,
    productosAdicionales,
    agregarProductos,
    quitarProducto,
    hayCambios,
    guardar,
  };
}

export type ReposicionConfigFormState = ReturnType<typeof useReposicionConfigForm>;

interface CamposProps {
  form: ReposicionConfigFormState;
  item: ItemReposicion;
  sucursal?: SucursalReposicion;
  disabled?: boolean;
  /** Muestra debajo, en solo lectura, la regla corporativa (`item.pisoCorp`) si existe. */
  mostrarPisoCorp?: boolean;
}

function CampoSoloLecturaReposicion({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string;
}) {
  return (
    <ColumnaCampoReposicion>
      <EtiquetaCampoReposicion>{etiqueta}</EtiquetaCampoReposicion>
      <Input
        type="text"
        value={valor}
        readOnly
        aria-readonly="true"
        tabIndex={-1}
        className="min-w-0 bg-muted text-center tabular-nums"
        aria-label={`${etiqueta} corporativo`}
      />
    </ColumnaCampoReposicion>
  );
}

/** Regla corporativa en solo lectura, con las mismas columnas que los campos editables. */
function PisoCorpReposicionSoloLectura({
  piso,
  bulto,
}: {
  piso: ReglaReposicionValores;
  bulto: number | null;
}) {
  const esBulto = piso.forma === "POR_BULTO";
  const unTotales = esBulto ? unidadesDesdeReglaReposicion(piso, bulto) : null;
  return (
    <div className="flex w-full flex-col gap-1">
      <ModalMicroLabel align="center">REPOSICIÓN CORPORATIVA</ModalMicroLabel>
      <div className="grid w-full grid-cols-5 items-start gap-4">
        <CampoSoloLecturaReposicion
          etiqueta="FORMA PEDIR"
          valor={REPOSICION_FORMA_PEDIDO_VENDEDOR_LABELS[piso.forma]}
        />
        {esBulto ? (
          <>
            <CampoSoloLecturaReposicion
              etiqueta="UN. POR BULTO"
              valor={bulto != null && bulto >= 1 ? fmtNumero(bulto) : "—"}
            />
            <CampoSoloLecturaReposicion
              etiqueta="PUNTO REPOSICIÓN (EN UN.)"
              valor={fmtNumero(piso.punto)}
            />
            <CampoSoloLecturaReposicion
              etiqueta="BULTOS REPOSICIÓN"
              valor={fmtNumero(piso.cantConf)}
            />
            <CampoSoloLecturaReposicion
              etiqueta="UN. TOTALES"
              valor={unTotales ? fmtNumero(unTotales) : "—"}
            />
          </>
        ) : (
          <>
            <CampoSoloLecturaReposicion
              etiqueta="PUNTO REPOSICIÓN"
              valor={fmtNumero(piso.punto)}
            />
            <CampoSoloLecturaReposicion
              etiqueta="UN. MÁXIMAS"
              valor={fmtNumero(piso.cantConf)}
            />
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Campos de la regla (`grid-cols-5`: FORMA PEDIR · … según forma) + botón `Plus` para sumar
 * productos con la misma configuración + tabla DESCRIPCIÓN (principal + adicionales).
 */
export default function ReposicionConfigCampos({
  form,
  item,
  sucursal,
  disabled = false,
  mostrarPisoCorp = false,
}: CamposProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const {
    formaPedir,
    puntoInput,
    cantInput,
    unidadesBultoInput,
    productosAdicionales,
  } = form;

  const esFormaBulto = formaPedir === "POR_BULTO";
  const tieneConfigInicial = Boolean(item.idReposicion) || Boolean(item.formaPedir);
  const puntoResuelto = parsePuntoReposicionInput(puntoInput) !== null;
  const unidadesPorBulto = parseCantReposicionInput(unidadesBultoInput);
  const hayUnPorBulto = unidadesPorBulto !== null;
  const mostrarPuntoUnMax = tieneConfigInicial || Boolean(formaPedir);
  const mostrarCantUnMax = tieneConfigInicial || (Boolean(formaPedir) && puntoResuelto);
  const ocultarPuntoBulto = !hayUnPorBulto;
  const ocultarBultosTotales = !hayUnPorBulto || !puntoResuelto;
  const bultosReposicion = parseCantReposicionInput(cantInput);
  const unTotales =
    esFormaBulto && bultosReposicion !== null && unidadesPorBulto !== null
      ? bultosReposicion * unidadesPorBulto
      : null;

  return (
    <>
      <div className="grid w-full grid-cols-5 items-start gap-4">
        <ColumnaCampoReposicion>
          <EtiquetaCampoReposicion>FORMA PEDIR</EtiquetaCampoReposicion>
          <Select
            value={formaPedir || "none"}
            onValueChange={(v) => form.cambiarFormaPedir(v === "none" ? "" : (v as FormaPedirReposicionOption))}
            disabled={disabled}
          >
            <SelectTrigger className="w-full min-w-0 text-center">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" align="start">
              {OPCIONES_FORMA.map((opt) => (
                <SelectItem key={opt.value || "none"} value={opt.value || "none"}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ColumnaCampoReposicion>

        {esFormaBulto ? (
          <>
            <ColumnaCampoReposicion>
              <EtiquetaCampoReposicion>UN. POR BULTO</EtiquetaCampoReposicion>
              <EnteroStepperInput
                variante="formulario"
                min={1}
                value={unidadesBultoInput}
                onChange={form.setUnidadesBultoInput}
                ariaLabel="unidades por bulto"
                disabled={disabled}
              />
            </ColumnaCampoReposicion>
            <ColumnaCampoReposicion oculta={ocultarPuntoBulto}>
              <EtiquetaCampoReposicion>PUNTO REPOSICIÓN (EN UN.)</EtiquetaCampoReposicion>
              <EnteroStepperInput
                variante="formulario"
                min={0}
                value={puntoInput}
                onChange={form.setPuntoInput}
                ariaLabel="punto reposición"
                tabIndex={ocultarPuntoBulto ? -1 : 0}
                disabled={disabled}
              />
            </ColumnaCampoReposicion>
            <ColumnaCampoReposicion oculta={ocultarBultosTotales}>
              <EtiquetaCampoReposicion>BULTOS REPOSICIÓN</EtiquetaCampoReposicion>
              <EnteroStepperInput
                variante="formulario"
                min={1}
                value={cantInput}
                onChange={form.setCantInput}
                ariaLabel="bultos reposición"
                tabIndex={ocultarBultosTotales ? -1 : 0}
                disabled={disabled}
              />
            </ColumnaCampoReposicion>
            <ColumnaCampoReposicion oculta={ocultarBultosTotales}>
              <EtiquetaCampoReposicion>UN. TOTALES</EtiquetaCampoReposicion>
              <Input
                type="text"
                value={unTotales === null ? "" : fmtNumero(unTotales)}
                readOnly
                aria-readonly="true"
                className="min-w-0 tabular-nums text-center"
                aria-label="Unidades totales"
                tabIndex={ocultarBultosTotales ? -1 : 0}
              />
            </ColumnaCampoReposicion>
          </>
        ) : (
          <>
            <ColumnaCampoReposicion oculta={!mostrarPuntoUnMax}>
              <EtiquetaCampoReposicion>PUNTO REPOSICIÓN</EtiquetaCampoReposicion>
              <EnteroStepperInput
                variante="formulario"
                min={0}
                value={puntoInput}
                onChange={form.setPuntoInput}
                ariaLabel="punto reposición"
                tabIndex={!mostrarPuntoUnMax ? -1 : 0}
                disabled={disabled}
              />
            </ColumnaCampoReposicion>
            <ColumnaCampoReposicion oculta={!mostrarCantUnMax}>
              <EtiquetaCampoReposicion>UN. MÁXIMAS</EtiquetaCampoReposicion>
              <EnteroStepperInput
                variante="formulario"
                min={1}
                value={cantInput}
                onChange={form.setCantInput}
                ariaLabel="cantidad reposición"
                tabIndex={!mostrarCantUnMax ? -1 : 0}
                disabled={disabled}
              />
            </ColumnaCampoReposicion>
            <ColumnaCampoReposicion oculta>
              <EtiquetaCampoReposicion />
              <Input type="text" readOnly tabIndex={-1} className="min-w-0" aria-hidden />
            </ColumnaCampoReposicion>
            <ColumnaCampoReposicion oculta>
              <EtiquetaCampoReposicion />
              <Input type="text" readOnly tabIndex={-1} className="min-w-0" aria-hidden />
            </ColumnaCampoReposicion>
          </>
        )}
      </div>

      {mostrarPisoCorp && item.pisoCorp ? (
        <PisoCorpReposicionSoloLectura piso={item.pisoCorp} bulto={item.bulto} />
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex justify-center">
          <Button
            type="button"
            variant="default"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setSelectorOpen(true)}
            disabled={disabled || (esFormaBulto && unidadesPorBulto === null)}
            aria-label="Agregar productos con esta configuración"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="border border-border rounded-lg overflow-auto max-h-64">
          <Table variant="compact" scrollX={false} className="w-full tabla-gestion-compacta">
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-muted/50">
                <TableHead className="text-xs text-center">DESCRIPCIÓN</TableHead>
                <TableHead className="w-10 text-xs text-center" aria-label="Acciones" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow aria-label="Producto principal de la configuración">
                <TableCell className="text-xs py-2 text-left">{item.descripcionTienda ?? "—"}</TableCell>
                <TableCell className="text-xs py-2 text-center text-muted-foreground">—</TableCell>
              </TableRow>
              {productosAdicionales.map((p) => (
                <TableRow key={p.idListaTienda}>
                  <TableCell className="text-xs py-2 text-left">{p.descripcionTienda ?? "—"}</TableCell>
                  <TableCell className="text-xs py-0 text-center">
                    <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                        aria-label="Quitar producto de la configuración"
                        onClick={() => form.quitarProducto(p)}
                        disabled={disabled}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <SelectorProductosReposicionModal
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        sucursal={sucursal ?? "guaymallen"}
        bultoReferencia={esFormaBulto ? unidadesPorBulto : item.bulto ?? null}
        onConfirmar={form.agregarProductos}
        excludeIds={[item.idListaTienda]}
      />
    </>
  );
}
