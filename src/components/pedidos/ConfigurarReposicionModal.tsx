"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { Dialog } from "@/components/ui/dialog";
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
import AppModal from "@/components/shared/AppModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import SelectorProductosReposicionModal from "./SelectorProductosReposicionModal";
import type { ItemReposicion, SucursalReposicion, FormaPedirReposicionOption } from "@/actions/reposicion";
import { upsertReglaReposicion } from "@/actions/reposicion";
import { upsertReglaReposicionCorpAction } from "@/actions/reposicionCorp";
import type { ItemSelectorReposicion } from "@/actions/reposicion";
import { mensajeViolaPisoReposicionCorp } from "@/lib/reposicionCorp";
import { fmtNumero } from "@/lib/format";
import {
  REPOSICION_FORMA_PEDIDO_VENDEDOR_LABELS,
  REPOSICION_FORMA_PEDIDO_VENDEDOR_VALUES,
  reposicionFormaPedidoVendedorSchema,
} from "@/lib/validations/reposicion";

function formaPedirOptions(): {
  value: FormaPedirReposicionOption;
  label: string;
}[] {
  return [
    { value: "", label: "—" },
    ...REPOSICION_FORMA_PEDIDO_VENDEDOR_VALUES.map((value) => ({
      value,
      label: REPOSICION_FORMA_PEDIDO_VENDEDOR_LABELS[value],
    })),
  ];
}

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemReposicion;
  sucursal?: SucursalReposicion;
  modo?: "sucursal" | "corp";
}

export default function ConfigurarReposicionModal({
  open,
  onOpenChange,
  item,
  sucursal,
  modo = "sucursal",
}: Props) {
  const router = useRouter();
  const [formaPedir, setFormaPedir] = useState<FormaPedirReposicionOption>(item.formaPedir || "");
  const [puntoInput, setPuntoInput] = useState("");
  const [cantInput, setCantInput] = useState("");
  const [unidadesBultoInput, setUnidadesBultoInput] = useState("");
  const [productosAdicionales, setProductosAdicionales] = useState<ItemSelectorReposicion[]>([]);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const opcionesForma = formaPedirOptions();

  useEffect(() => {
    if (open) {
      setFormaPedir(item.formaPedir || "");
      const guardado = Boolean(item.idReposicion) || Boolean(item.formaPedir);
      if (guardado) {
        setPuntoInput(String(item.puntoReposicion));
        setCantInput(String(item.cant));
      } else {
        setPuntoInput("");
        setCantInput("");
      }
      setUnidadesBultoInput(
        hayBultoConfigurado(item.bulto) ? String(item.bulto) : ""
      );
      setProductosAdicionales([]);
    }
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

  const nombreProducto = item.descripcionTienda ?? "—";
  const esFormaBulto = formaPedir === "POR_BULTO";
  const tieneConfigInicial = Boolean(item.idReposicion) || Boolean(item.formaPedir);
  const puntoResuelto = parsePuntoReposicionInput(puntoInput) !== null;
  const unidadesPorBulto = parseCantReposicionInput(unidadesBultoInput);
  const hayUnPorBulto = unidadesPorBulto !== null;
  const mostrarPuntoUnMax = tieneConfigInicial || Boolean(formaPedir);
  const mostrarCantUnMax =
    tieneConfigInicial || (Boolean(formaPedir) && puntoResuelto);
  const ocultarPuntoBulto = !hayUnPorBulto;
  const ocultarBultosTotales = !hayUnPorBulto || !puntoResuelto;
  const bultosReposicion = parseCantReposicionInput(cantInput);
  const unTotales =
    esFormaBulto && bultosReposicion !== null && unidadesPorBulto !== null
      ? bultosReposicion * unidadesPorBulto
      : null;

  const handleAgregarProductos = (seleccionados: ItemSelectorReposicion[]) => {
    setProductosAdicionales((prev) => {
      const keys = new Set(prev.map((p) => p.idListaTienda));
      const nuevos = seleccionados.filter((p) => !keys.has(p.idListaTienda));
      return [...prev, ...nuevos];
    });
  };

  const handleEliminarProductoAdicional = (producto: ItemSelectorReposicion) => {
    setProductosAdicionales((prev) =>
      prev.filter(
        (p) =>
          !(
            p.idListaTienda === producto.idListaTienda &&
            p.codTienda === producto.codTienda
          )
      )
    );
  };

  const handleGuardar = async () => {
    const formaParsed = reposicionFormaPedidoVendedorSchema.safeParse(formaPedir);
    if (!formaParsed.success) {
      toast.error("Seleccioná Forma Pedir.");
      return;
    }
    if (formaParsed.data === "POR_BULTO") {
      if (unidadesPorBulto === null) {
        toast.error("Completá Un. por bulto.");
        return;
      }
    }
    const punto = parsePuntoReposicionInput(puntoInput);
    if (punto === null) {
      toast.error("Completá Punto Reposición.");
      return;
    }
    const cantNum = parseCantReposicionInput(cantInput);
    if (cantNum === null) {
      toast.error(
        formaParsed.data === "POR_BULTO"
          ? "Completá Bultos Reposición (mín. 1)."
          : "Completá Cant. Reposición (mín. 1)."
      );
      return;
    }

    if (modo === "sucursal" && !sucursal) {
      toast.error("Seleccioná un usuario en el slidenav.");
      return;
    }
    if (modo === "sucursal" && item.pisoCorp) {
      const viola = mensajeViolaPisoReposicionCorp(
        item.pisoCorp,
        { forma: formaParsed.data, punto, cantConf: cantNum },
        formaParsed.data === "POR_BULTO" ? unidadesPorBulto : item.bulto
      );
      if (viola) {
        toast.error(viola);
        return;
      }
    }

    setGuardando(true);
    try {
      const todos: { codTienda: string }[] = [
        { codTienda: item.codTienda },
        ...productosAdicionales.map((p) => ({
          codTienda: p.codTienda,
        })),
      ];
      for (const t of todos) {
        const payload = {
          codTienda: t.codTienda,
          formaPedir: formaParsed.data,
          puntoReposicion: punto,
          cant: cantNum,
          ...(formaParsed.data === "POR_BULTO" && unidadesPorBulto !== null
            ? { unidadesPorBulto }
            : {}),
        };
        const res =
          modo === "corp"
            ? await upsertReglaReposicionCorpAction(payload)
            : await upsertReglaReposicion({
                sucursalCodigo: sucursal!,
                ...payload,
              });
        if (!res.ok) {
          toast.error(res.error ?? "Error al guardar.");
          return;
        }
      }
      toast.success(
        productosAdicionales.length > 0
          ? `Configuración guardada para ${todos.length} producto(s).`
          : "Configuración guardada."
      );
      onOpenChange(false);
      router.refresh();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <AppModal
          title={modo === "corp" ? "CONFIGURAR REPOSICIÓN CORP." : "Configurar Reposición"}
          className="max-w-[56rem] max-h-[100vh]"
          actions={
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
              <Button type="button" onClick={handleGuardar} disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-6 items-stretch text-center">
            <div className="flex flex-col items-center gap-2 w-full">
              <p className="text-sm text-foreground font-medium">{nombreProducto}</p>
              <div className="w-full h-px bg-[#0072BB]" />
            </div>

            <div className="flex flex-col gap-3">
              <div className="grid w-full grid-cols-5 items-start gap-4">
              <ColumnaCampoReposicion>
                <EtiquetaCampoReposicion>FORMA PEDIR</EtiquetaCampoReposicion>
                <Select
                  value={formaPedir || "none"}
                  onValueChange={(v) =>
                    {
                      if (v === "none") {
                        setFormaPedir("");
                        setPuntoInput("");
                        setCantInput("");
                        return;
                      }
                      setFormaPedir(v as FormaPedirReposicionOption);
                    }
                  }
                >
                  <SelectTrigger className="w-full min-w-0 text-center">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start">
                    {opcionesForma.map((opt) => (
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
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={unidadesBultoInput}
                      onChange={(e) => setUnidadesBultoInput(e.target.value)}
                      className="min-w-0 tabular-nums text-center"
                      aria-label="Unidades por bulto"
                    />
                  </ColumnaCampoReposicion>
                  <ColumnaCampoReposicion oculta={ocultarPuntoBulto}>
                    <EtiquetaCampoReposicion>
                      PUNTO REPOSICIÓN (EN UN.)
                    </EtiquetaCampoReposicion>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={puntoInput}
                      onChange={(e) => setPuntoInput(e.target.value)}
                      className="min-w-0 tabular-nums text-center"
                      aria-label="Punto reposición"
                      tabIndex={ocultarPuntoBulto ? -1 : 0}
                    />
                  </ColumnaCampoReposicion>
                  <ColumnaCampoReposicion oculta={ocultarBultosTotales}>
                    <EtiquetaCampoReposicion>BULTOS REPOSICIÓN</EtiquetaCampoReposicion>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={cantInput}
                      onChange={(e) => setCantInput(e.target.value)}
                      className="min-w-0 tabular-nums text-center"
                      aria-label="Bultos reposición"
                      tabIndex={ocultarBultosTotales ? -1 : 0}
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
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={puntoInput}
                      onChange={(e) => setPuntoInput(e.target.value)}
                      className="min-w-0 tabular-nums text-center"
                      aria-label="Punto reposición"
                      tabIndex={!mostrarPuntoUnMax ? -1 : 0}
                    />
                  </ColumnaCampoReposicion>
                  <ColumnaCampoReposicion oculta={!mostrarCantUnMax}>
                    <EtiquetaCampoReposicion>UN. MÁXIMAS</EtiquetaCampoReposicion>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={cantInput}
                      onChange={(e) => setCantInput(e.target.value)}
                      className="min-w-0 tabular-nums text-center"
                      aria-label="Cantidad reposición"
                      tabIndex={!mostrarCantUnMax ? -1 : 0}
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
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setSelectorOpen(true)}
                  disabled={esFormaBulto && unidadesPorBulto === null}
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
                      <TableCell className="text-xs py-2 text-left">
                        {item.descripcionTienda ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs py-2 text-center text-muted-foreground">
                        —
                      </TableCell>
                    </TableRow>
                    {productosAdicionales.map((p) => (
                      <TableRow key={p.idListaTienda}>
                        <TableCell className="text-xs py-2 text-left">
                          {p.descripcionTienda ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs py-0 text-center">
                          <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              aria-label="Quitar producto de la configuración"
                              onClick={() => handleEliminarProductoAdicional(p)}
                            >
                              <Plus className="hidden" aria-hidden="true" />
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                className="w-4 h-4"
                                aria-hidden="true"
                              >
                                <path
                                  d="M9 3h6a1 1 0 0 1 .993.883L16 4v1h4a1 1 0 1 1 0 2h-1.07l-.845 11.037A2 2 0 0 1 16.093 20H7.907a2 2 0 0 1-1.992-1.963L5.07 7H4a1 1 0 1 1 0-2h4V4a1 1 0 0 1 .883-.993L9 3Zm6 4H9l-.8 10.4a0 0 0 0 0 0 0h7.6a0 0 0 0 0 0 0L15 7Zm-3 2a1 1 0 0 1 .993.883L13 10v6a1 1 0 0 1-1.993.117L11 16v-6a1 1 0 0 1 1-1Z"
                                  fill="currentColor"
                                />
                              </svg>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </AppModal>
      </Dialog>

      <SelectorProductosReposicionModal
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        sucursal={sucursal ?? "guaymallen"}
        bultoReferencia={esFormaBulto ? unidadesPorBulto : item.bulto ?? null}
        onConfirmar={handleAgregarProductos}
        excludeIds={[item.idListaTienda]}
      />
    </>
  );
}
