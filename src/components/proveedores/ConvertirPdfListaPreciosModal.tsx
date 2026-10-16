"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Upload, Loader2, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
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
import { TableEmptyState } from "@/components/shared/TableEmptyState";
import { cn } from "@/lib/utils";
import { fmtPrecio } from "@/lib/format";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import type { FilaPdfMatrizNormalizadaDto } from "@/lib/validations/parseListaPreciosPdfMatriz";
import { PAGINA_INICIO_PDF_MATRIZ_DEFAULT } from "@/lib/validations/parseListaPreciosPdfMatriz";
import {
  aplicarImportListaPdfAction,
  previsualizarImportListaPdfAction,
} from "@/actions/prodPreciosRex";
import {
  ETIQUETA_ESTADO_MATCH_PDF,
  type EstadoMatchItemPdf,
  type FilaPreviewImportPdf,
  type ItemListaMatchPdf,
  type PreviewImportListaPdf,
} from "@/lib/importListaPdf";

const SELECT_NONE = "none";
const CHECKBOX_CLASS =
  "h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-60";

type FiltroEstado = "CON_VINCULO" | EstadoMatchItemPdf | "TODOS";

const OPCIONES_FILTRO: { value: FiltroEstado; label: string }[] = [
  { value: "CON_VINCULO", label: "CON VÍNCULO (A ACTUALIZAR)" },
  { value: "VINCULADO", label: "VINCULADOS" },
  { value: "SUGERIDO", label: "SUGERIDOS" },
  { value: "SIN_VINCULO", label: "SIN VÍNCULO" },
  { value: "TODOS", label: "TODOS" },
];

const CLASE_ESTADO: Record<EstadoMatchItemPdf, string> = {
  VINCULADO: "text-foreground",
  SUGERIDO: "text-primary",
  SIN_VINCULO: "text-muted-foreground",
};

interface Proveedor {
  id: string;
  nombre: string;
  prefijo: string;
}

interface Props {
  proveedores: Proveedor[];
}

type Estado = "idle" | "config" | "procesando" | "preview" | "aplicando" | "error";

/** Fila de la vista previa: un ítem PDF × un ítem de lista (o sin ítem si no hay vínculo). */
interface FilaVista {
  key: string;
  fila: FilaPreviewImportPdf;
  item: ItemListaMatchPdf | null;
}

function claveSeleccion(clave: string, codExt: string): string {
  return `${clave}\u0000${codExt}`;
}

function seleccionInicial(preview: PreviewImportListaPdf): Set<string> {
  const out = new Set<string>();
  for (const f of preview.filas) {
    for (const it of f.items) out.add(claveSeleccion(f.clave, it.codExt));
  }
  return out;
}

function Variacion({ precio, pxActual }: { precio: number; pxActual: number }) {
  if (pxActual <= 0) return <span className="variacion-costo--neutra text-xs">—</span>;
  const pct = ((precio - pxActual) / pxActual) * 100;
  const redondeado = Math.round(pct * 10) / 10;
  const clase =
    redondeado > 0
      ? "variacion-costo--positiva"
      : redondeado < 0
        ? "variacion-costo--negativa"
        : "variacion-costo--neutra";
  const texto = `${redondeado > 0 ? "+" : ""}${redondeado.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
  return <span className={cn(clase, "text-xs")}>{texto}</span>;
}

export default function ConvertirPdfListaPreciosModal({ proveedores }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [estado, setEstado] = useState<Estado>("idle");
  const [archivoPendiente, setArchivoPendiente] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [paginaInicio, setPaginaInicio] = useState(String(PAGINA_INICIO_PDF_MATRIZ_DEFAULT));
  const [filasIgnorar, setFilasIgnorar] = useState("0");
  const [proveedorId, setProveedorId] = useState("");
  const [filasPdf, setFilasPdf] = useState<FilaPdfMatrizNormalizadaDto[]>([]);
  const [preview, setPreview] = useState<PreviewImportListaPdf | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("CON_VINCULO");
  const [advertencias, setAdvertencias] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const limpiarResultado = useCallback(() => {
    setFilasPdf([]);
    setPreview(null);
    setSeleccion(new Set());
    setFiltroEstado("CON_VINCULO");
    setAdvertencias([]);
    setErrorMsg(null);
  }, []);

  const resetForm = useCallback(() => {
    setEstado("idle");
    setArchivoPendiente(null);
    setFileName(null);
    limpiarResultado();
    setPaginaInicio(String(PAGINA_INICIO_PDF_MATRIZ_DEFAULT));
    setFilasIgnorar("0");
  }, [limpiarResultado]);

  const ocupado = estado === "procesando" || estado === "aplicando";

  const handleClose = useCallback(
    (next: boolean) => {
      if (!next && ocupado) return;
      if (!next) resetForm();
      setOpen(next);
    },
    [resetForm, ocupado]
  );

  const seleccionarArchivo = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        toast.error("Solo se aceptan archivos PDF.");
        return;
      }
      setArchivoPendiente(file);
      setFileName(file.name);
      limpiarResultado();
      setEstado("config");
    },
    [limpiarResultado]
  );

  function cambiarProveedor(id: string) {
    setProveedorId(id);
    if (preview || filasPdf.length > 0) {
      limpiarResultado();
      setEstado(archivoPendiente ? "config" : "idle");
    }
  }

  async function procesarPdf() {
    if (!archivoPendiente) return;
    if (!proveedorId.trim()) {
      toast.error("Seleccioná el proveedor de la lista.");
      return;
    }
    const pagina = Number.parseInt(paginaInicio, 10);
    if (!Number.isFinite(pagina) || pagina < 1) {
      toast.error("Ingresá una página de inicio válida (≥ 1).");
      return;
    }
    const ignorar = Number.parseInt(filasIgnorar, 10);
    if (!Number.isFinite(ignorar) || ignorar < 0) {
      toast.error("Ingresá cuántas filas ignorar (número ≥ 0).");
      return;
    }

    setEstado("procesando");
    limpiarResultado();

    const formData = new FormData();
    formData.append("file", archivoPendiente);
    formData.append("paginaInicio", String(pagina));
    formData.append("filasIgnorar", String(ignorar));

    try {
      const res = await fetch("/api/parse-lista-precios-pdf", { method: "POST", body: formData });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        filas?: FilaPdfMatrizNormalizadaDto[];
        meta?: { advertencias?: string[] };
      };
      if (!res.ok || !data.ok) {
        const msg = data.error ?? "No se pudo procesar el PDF.";
        setErrorMsg(msg);
        setEstado("error");
        toast.error(msg);
        return;
      }
      const filas = data.filas ?? [];
      setAdvertencias(data.meta?.advertencias ?? []);
      if (filas.length === 0) {
        setEstado("config");
        toast.warning("El PDF no produjo ítems con precio. Revisá página y filas a ignorar.");
        return;
      }

      const prev = await previsualizarImportListaPdfAction({ proveedorId, filas });
      if (!prev.ok) {
        setErrorMsg(prev.error);
        setEstado("error");
        toast.error(prev.error);
        return;
      }
      setFilasPdf(filas);
      setPreview(prev.data);
      setSeleccion(seleccionInicial(prev.data));
      setEstado("preview");
    } catch {
      const msg = "Error de conexión al procesar el PDF.";
      setErrorMsg(msg);
      setEstado("error");
      toast.error(msg);
    }
  }

  async function aplicar() {
    if (!preview || seleccion.size === 0) return;
    const vinculos = preview.filas.flatMap((f) =>
      f.items
        .filter((it) => seleccion.has(claveSeleccion(f.clave, it.codExt)))
        .map((it) => ({ clave: f.clave, codExt: it.codExt }))
    );
    setEstado("aplicando");
    try {
      const res = await aplicarImportListaPdfAction({ proveedorId, filas: filasPdf, vinculos });
      if (!res.ok) {
        toast.error(res.error);
        setEstado("preview");
        return;
      }
      const { itemsActualizados, vinculosNuevos } = res.data;
      toast.success(
        `${itemsActualizados} ítem(s) con PX. LISTA actualizado` +
          (vinculosNuevos > 0 ? ` (${vinculosNuevos} vínculo(s) nuevo(s)).` : ".")
      );
      router.refresh();
      resetForm();
      setOpen(false);
    } catch {
      toast.error("Error de conexión al actualizar precios.");
      setEstado("preview");
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) seleccionarArchivo(file);
    },
    [seleccionarArchivo]
  );

  const conteos = useMemo(() => {
    const c: Record<EstadoMatchItemPdf, number> = { VINCULADO: 0, SUGERIDO: 0, SIN_VINCULO: 0 };
    for (const f of preview?.filas ?? []) c[f.estado]++;
    return c;
  }, [preview]);

  const filasVista = useMemo<FilaVista[]>(() => {
    if (!preview) return [];
    const out: FilaVista[] = [];
    for (const fila of preview.filas) {
      const visible =
        filtroEstado === "TODOS" ||
        (filtroEstado === "CON_VINCULO" ? fila.estado !== "SIN_VINCULO" : fila.estado === filtroEstado);
      if (!visible) continue;
      if (fila.items.length === 0) {
        out.push({ key: fila.clave, fila, item: null });
        continue;
      }
      for (const item of fila.items) {
        out.push({ key: claveSeleccion(fila.clave, item.codExt), fila, item });
      }
    }
    return out;
  }, [preview, filtroEstado]);

  const seleccionablesVisibles = filasVista.filter((f) => f.item !== null).map((f) => f.key);
  const todosVisiblesSeleccionados =
    seleccionablesVisibles.length > 0 && seleccionablesVisibles.every((k) => seleccion.has(k));

  function alternar(key: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function alternarTodosVisibles() {
    setSeleccion((prev) => {
      const next = new Set(prev);
      for (const k of seleccionablesVisibles) {
        if (todosVisiblesSeleccionados) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  }

  const enConfig = (estado === "config" || estado === "error") && !!archivoPendiente;
  const mostrarBotonConversion =
    !!archivoPendiente && (estado === "config" || estado === "procesando" || estado === "error");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="default" size="default" className="btn-primario-gestion gap-2 shrink-0">
          <FileText className="h-4 w-4 shrink-0" />
          Imp. Lista PDF
        </Button>
      </DialogTrigger>

      <AppModal
        className={preview ? "max-w-5xl" : "max-w-3xl"}
        bodyClassName="max-w-full min-w-0"
        title="Importar Lista PDF"
        actions={
          <>
            <Button variant="outline" onClick={() => handleClose(false)} disabled={ocupado}>
              Cancelar
            </Button>
            {mostrarBotonConversion && (
              <Button onClick={() => void procesarPdf()} className="gap-2 min-w-[150px]" disabled={ocupado}>
                {estado === "procesando" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Iniciar Conversión
              </Button>
            )}
            {preview && (
              <Button
                onClick={() => void aplicar()}
                className="gap-2 min-w-[150px]"
                disabled={ocupado || seleccion.size === 0}
              >
                {estado === "aplicando" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Actualizar Precios ({seleccion.size})
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-3 pt-2 min-w-0 overflow-hidden" aria-busy={ocupado}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">PROVEEDOR</label>
            <Select
              value={proveedorId || SELECT_NONE}
              onValueChange={(v) => cambiarProveedor(v === SELECT_NONE ? "" : v)}
              disabled={ocupado}
            >
              <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                <SelectValue placeholder="SELECCIONAR PROVEEDOR…" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
                <SelectItem value={SELECT_NONE}>SELECCIONAR PROVEEDOR…</SelectItem>
                {proveedores.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    [{p.prefijo}] {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Los ítems del PDF se buscan en la lista de este proveedor para actualizar su PX. LISTA.
            </p>
          </div>

          {enConfig && (
            <div className="rounded-lg border border-primary/30 bg-muted/30 p-3 space-y-3">
              <p className="text-sm font-medium text-foreground">Antes de convertir, indicá qué omitir del PDF</p>
              <p className="text-xs text-muted-foreground">
                Filas a ignorar: líneas del extracto (títulos, encabezados repetidos) al inicio de cada página
                procesada. Desde página: salta el índice al comienzo del documento.
              </p>
              <div className="grid grid-cols-[1fr_8rem] gap-x-4 gap-y-3 items-center">
                <span className="text-sm font-medium text-foreground">FILAS A IGNORAR</span>
                <input
                  type="number"
                  min={0}
                  value={filasIgnorar}
                  onChange={(e) => setFilasIgnorar(e.target.value)}
                  disabled={ocupado}
                  className="input-filtro-unificado w-full text-sm focus:outline-none focus:ring-2 focus:ring-ring border-primary tabular-nums"
                  aria-label="Cantidad de filas a ignorar al inicio del extracto"
                />
                <span className="text-sm font-medium text-foreground">DESDE PÁGINA</span>
                <input
                  type="number"
                  min={1}
                  value={paginaInicio}
                  onChange={(e) => setPaginaInicio(e.target.value)}
                  disabled={ocupado}
                  className="input-filtro-unificado w-full text-sm focus:outline-none focus:ring-2 focus:ring-ring border-primary tabular-nums"
                  aria-label="Página desde la que se procesa el PDF"
                />
              </div>
              {fileName && <p className="text-xs text-muted-foreground truncate">Archivo: {fileName}</p>}
            </div>
          )}

          <div className="grid grid-cols-[1fr_10rem] gap-x-4 gap-y-3 items-center">
            <span className="text-sm font-medium text-foreground min-w-0 truncate">
              {fileName ? "CAMBIAR PDF" : "ADJUNTAR PDF"}
            </span>
            <div className="flex w-full min-w-0">
              <Button
                type="button"
                variant="default"
                size="default"
                disabled={ocupado}
                className="min-w-0 flex-1"
                onClick={() => {
                  if (fileName) resetForm();
                  else fileInputRef.current?.click();
                }}
              >
                <Upload className="h-4 w-4" />
                {fileName ? "Cambiar PDF" : "Adjuntar PDF"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) seleccionarArchivo(f);
                }}
              />
            </div>
          </div>

          {!fileName && (
            <div
              className={cn(
                "rounded-lg border-2 border-dashed transition-colors flex items-center justify-center gap-2 py-4 px-3",
                isDragging ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <Upload className="h-5 w-5 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">Arrastrá un PDF; luego indicá las filas a ignorar</span>
            </div>
          )}

          {estado === "procesando" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2" role="status">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              Leyendo el PDF y buscando los ítems en la lista del proveedor…
            </div>
          )}

          {errorMsg && (
            <p className="text-sm text-destructive" role="alert">
              {errorMsg}
            </p>
          )}

          {advertencias.length > 0 && (
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              {advertencias.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}

          {preview && (
            <div className="space-y-2 min-h-0">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium uppercase text-foreground">
                <span>ÍTEMS PDF: {preview.filas.length}</span>
                <span>VINCULADOS: {conteos.VINCULADO}</span>
                <span className="text-primary">SUGERIDOS: {conteos.SUGERIDO}</span>
                <span className="text-muted-foreground">SIN VÍNCULO: {conteos.SIN_VINCULO}</span>
                <span className="text-muted-foreground">
                  ÍTEMS DE LISTA SIN PRECIO EN EL PDF: {preview.listaSinPrecioEnPdf}
                </span>
              </div>
              <div className="grid grid-cols-[1fr_16rem] items-center gap-3">
                <p className="text-xs text-muted-foreground">
                  SUGERIDO = la descripción de la lista coincide con descripción + presentación del PDF; al
                  actualizar queda vinculado. Los SIN VÍNCULO se vinculan a mano desde la lista.
                </p>
                <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as FiltroEstado)}>
                  <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")} aria-label="Filtrar por estado">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="end" className="select-content-filtro">
                    {OPCIONES_FILTRO.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="contenedor-tabla-gestion max-h-[min(28rem,55vh)] overflow-y-auto overflow-x-hidden border border-border rounded-lg">
                <Table variant="compact" scrollX={false} className="table-fixed w-full">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10 text-center">
                        <input
                          type="checkbox"
                          className={CHECKBOX_CLASS}
                          checked={todosVisiblesSeleccionados}
                          onChange={alternarTodosVisibles}
                          disabled={ocupado || seleccionablesVisibles.length === 0}
                          aria-label="Seleccionar todos los visibles"
                        />
                      </TableHead>
                      <TableHead>DESCRIPCIÓN PDF</TableHead>
                      <TableHead className="w-24 text-center">PX. PDF</TableHead>
                      <TableHead className="w-24 text-center">ESTADO</TableHead>
                      <TableHead>ÍTEM LISTA</TableHead>
                      <TableHead className="w-24 text-center">PX. ACTUAL</TableHead>
                      <TableHead className="w-20 text-center">VAR.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filasVista.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7}>
                          <TableEmptyState message="NINGÚN ÍTEM CON ESTE FILTRO." placement="panel" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      filasVista.map(({ key, fila, item }) => (
                        <TableRow key={key}>
                          <TableCell className="text-center">
                            {item ? (
                              <input
                                type="checkbox"
                                className={CHECKBOX_CLASS}
                                checked={seleccion.has(key)}
                                onChange={() => alternar(key)}
                                disabled={ocupado}
                                aria-label={`Actualizar ${item.codProdProveedor}`}
                              />
                            ) : null}
                          </TableCell>
                          <TableCell className="celda-datos min-w-0">
                            <span className="block truncate text-xs" title={fila.clave}>
                              {fila.clave}
                            </span>
                          </TableCell>
                          <TableCell className="celda-datos celda-numero tabular-nums text-center">
                            ${fmtPrecio(fila.precio)}
                          </TableCell>
                          <TableCell className={cn("celda-datos text-center text-xs font-semibold", CLASE_ESTADO[fila.estado])}>
                            {ETIQUETA_ESTADO_MATCH_PDF[fila.estado]}
                          </TableCell>
                          <TableCell className="celda-datos min-w-0">
                            {item ? (
                              <span className="block truncate text-xs" title={item.descripcionProveedor}>
                                <span className="celda-mono">{item.codProdProveedor}</span> · {item.descripcionProveedor}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="celda-datos celda-numero tabular-nums text-center">
                            {item ? `$${fmtPrecio(item.pxActual)}` : ""}
                          </TableCell>
                          <TableCell className="celda-datos text-center">
                            {item ? <Variacion precio={fila.precio} pxActual={item.pxActual} /> : null}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </AppModal>
    </Dialog>
  );
}
