"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  Loader2,
  ArrowRight,
  RefreshCw,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
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
import { matchByMultiTerm } from "@/lib/busqueda";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import type { FilaPdfMatrizNormalizadaDto } from "@/lib/validations/parseListaPreciosPdfMatriz";
import { PAGINA_INICIO_PDF_MATRIZ_DEFAULT } from "@/lib/validations/parseListaPreciosPdfMatriz";
import {
  aplicarImportListaPdfAction,
  previsualizarImportListaPdfAction,
} from "@/actions/prodPreciosRex";
import type {
  FilaPreviewImportPdf,
  ItemListaMatchPdf,
  PreviewImportListaPdf,
} from "@/lib/importListaPdf";

const SELECT_NONE = "none";
const MAX_RESULTADOS_PDF = 100;

interface Proveedor {
  id: string;
  nombre: string;
  prefijo: string;
}

interface Props {
  proveedores: Proveedor[];
}

type Estado = "idle" | "config" | "procesando" | "preview" | "aplicando" | "error";

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

/** Primera palabra significativa de la descripción de lista: arranque de la búsqueda en el PDF. */
function busquedaInicial(descripcion: string): string {
  return descripcion.split(/\s+/).find((p) => p.length >= 3 && !/\d/.test(p)) ?? "";
}

interface BuscadorItemPdfProps {
  item: ItemListaMatchPdf;
  itemsPdf: FilaPreviewImportPdf[];
  claveAsignada: string | undefined;
  onElegir: (clave: string) => void;
}

function BuscadorItemPdf({ item, itemsPdf, claveAsignada, onElegir }: BuscadorItemPdfProps) {
  const [busqueda, setBusqueda] = useState(() => busquedaInicial(item.descripcionProveedor));
  const inputRef = useRef<HTMLInputElement>(null);

  const resultados = useMemo(
    () => itemsPdf.filter((f) => matchByMultiTerm([f.descripcionBase, f.presentacion], busqueda)),
    [itemsPdf, busqueda]
  );
  const visibles = resultados.slice(0, MAX_RESULTADOS_PDF);

  return (
    <div className="space-y-2 min-w-0">
      <FiltroBusquedaInput
        id="buscar-item-pdf"
        placeholder="BUSCAR EN EL PDF (DESCRIPCIÓN O PRESENTACIÓN)…"
        value={busqueda}
        onChange={setBusqueda}
        isDebouncing={false}
        inputRef={inputRef}
      />
      <p className="text-xs text-muted-foreground">
        {resultados.length > MAX_RESULTADOS_PDF
          ? `Mostrando ${MAX_RESULTADOS_PDF} de ${resultados.length} ítems; refiná la búsqueda.`
          : `${resultados.length} ítem(s) del PDF. Hacé clic en el que corresponde.`}
      </p>
      <div className="contenedor-tabla-gestion max-h-[min(24rem,50vh)] overflow-y-auto overflow-x-hidden border border-border rounded-lg">
        <Table variant="compact" scrollX={false} className="table-fixed w-full">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>DESCRIPCIÓN PDF</TableHead>
              <TableHead className="w-32 text-center">PRESENTACIÓN</TableHead>
              <TableHead className="w-24 text-center">PX. PDF</TableHead>
              <TableHead className="w-20 text-center">VAR.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4}>
                  <TableEmptyState message="NINGÚN ÍTEM DEL PDF COINCIDE CON LA BÚSQUEDA." placement="panel" />
                </TableCell>
              </TableRow>
            ) : (
              visibles.map((f) => (
                <TableRow
                  key={f.clave}
                  className={cn("cursor-pointer", f.clave === claveAsignada && "bg-primary/10")}
                  onClick={() => onElegir(f.clave)}
                  aria-selected={f.clave === claveAsignada}
                >
                  <TableCell className="celda-datos min-w-0">
                    <span className="block truncate text-xs" title={f.descripcionBase}>
                      {f.descripcionBase}
                    </span>
                  </TableCell>
                  <TableCell className="celda-datos text-center text-xs">{f.presentacion}</TableCell>
                  <TableCell className="celda-datos celda-numero tabular-nums text-center">
                    ${fmtPrecio(f.precio)}
                  </TableCell>
                  <TableCell className="celda-datos text-center">
                    <Variacion precio={f.precio} pxActual={item.pxActual} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface VincularItemPdfModalProps {
  itemsLista: ItemListaMatchPdf[];
  itemsPdf: FilaPreviewImportPdf[];
  indice: number | null;
  manuales: Map<string, string>;
  onIndice: (indice: number | null) => void;
  onAsignar: (codExt: string, clave: string | null) => void;
}

/** Recorre los ítems de lista sin precio y permite elegir, para cada uno, el ítem del PDF. */
function VincularItemPdfModal({
  itemsLista,
  itemsPdf,
  indice,
  manuales,
  onIndice,
  onAsignar,
}: VincularItemPdfModalProps) {
  const item = indice !== null ? itemsLista[indice] : undefined;
  const claveAsignada = item ? manuales.get(item.codExt) : undefined;
  const ultimo = itemsLista.length - 1;

  function elegir(clave: string) {
    if (!item || indice === null) return;
    onAsignar(item.codExt, clave);
    onIndice(indice < ultimo ? indice + 1 : null);
  }

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onIndice(null)}>
      {item && indice !== null && (
        <AppModal
          className="max-w-4xl"
          bodyClassName="max-w-full min-w-0"
          title="Vincular con ítem del PDF"
          actions={
            <>
              <Button variant="outline" onClick={() => onIndice(indice - 1)} disabled={indice === 0} className="gap-1">
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                onClick={() => onIndice(indice + 1)}
                disabled={indice >= ultimo}
                className="gap-1"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
              {claveAsignada && (
                <Button variant="outline" onClick={() => onAsignar(item.codExt, null)}>
                  Quitar vínculo
                </Button>
              )}
              <Button onClick={() => onIndice(null)}>Listo</Button>
            </>
          }
        >
          <div className="space-y-3 pt-2 min-w-0">
            <div className="rounded-lg border border-primary/30 bg-muted/30 p-3 space-y-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                ÍTEM DE LISTA {indice + 1} DE {itemsLista.length}
              </p>
              <p className="text-sm font-medium text-foreground truncate" title={item.descripcionProveedor}>
                <span className="celda-mono">{item.codProdProveedor}</span> · {item.descripcionProveedor}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                PX. ACTUAL: ${fmtPrecio(item.pxActual)}
                {claveAsignada && <> · VINCULADO A: {claveAsignada}</>}
              </p>
            </div>
            <BuscadorItemPdf
              key={item.codExt}
              item={item}
              itemsPdf={itemsPdf}
              claveAsignada={claveAsignada}
              onElegir={elegir}
            />
          </div>
        </AppModal>
      )}
    </Dialog>
  );
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
  /** Vínculos elegidos a mano: `cod_ext` del ítem de lista → clave del ítem PDF. */
  const [manuales, setManuales] = useState<Map<string, string>>(new Map());
  const [indiceVincular, setIndiceVincular] = useState<number | null>(null);
  const [advertencias, setAdvertencias] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const limpiarResultado = useCallback(() => {
    setFilasPdf([]);
    setPreview(null);
    setManuales(new Map());
    setIndiceVincular(null);
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
      setEstado("preview");
    } catch {
      const msg = "Error de conexión al procesar el PDF.";
      setErrorMsg(msg);
      setEstado("error");
      toast.error(msg);
    }
  }

  const vinculosAuto = useMemo(
    () => (preview?.filas ?? []).flatMap((f) => f.items.map((it) => ({ clave: f.clave, codExt: it.codExt }))),
    [preview]
  );

  const pdfPorClave = useMemo(
    () => new Map((preview?.filas ?? []).map((f) => [f.clave, f])),
    [preview]
  );

  const totalVinculos = vinculosAuto.length + manuales.size;

  function asignarManual(codExt: string, clave: string | null) {
    setManuales((prev) => {
      const next = new Map(prev);
      if (clave) next.set(codExt, clave);
      else next.delete(codExt);
      return next;
    });
  }

  async function aplicar() {
    if (!preview || totalVinculos === 0) return;
    const vinculos = [
      ...vinculosAuto,
      ...[...manuales].map(([codExt, clave]) => ({ clave, codExt })),
    ];
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

  const enConfig = (estado === "config" || estado === "error") && !!archivoPendiente;
  const mostrarBotonConversion =
    !!archivoPendiente && (estado === "config" || estado === "procesando" || estado === "error");
  const sinPrecio = preview?.listaSinPrecio ?? [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="default" size="default" className="btn-primario-gestion gap-2 shrink-0">
          <FileText className="h-4 w-4 shrink-0" />
          Imp. Lista PDF
        </Button>
      </DialogTrigger>

      <AppModal
        className={sinPrecio.length > 0 ? "max-w-5xl" : "max-w-3xl"}
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
                disabled={ocupado || totalVinculos === 0}
              >
                {estado === "aplicando" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Actualizar Precios ({totalVinculos})
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
                <span>SE ACTUALIZAN SOLOS: {vinculosAuto.length}</span>
                <span className={cn(sinPrecio.length > 0 ? "text-primary" : "text-muted-foreground")}>
                  SIN PRECIO EN EL PDF: {sinPrecio.length}
                </span>
                {manuales.size > 0 && <span>VINCULADOS A MANO: {manuales.size}</span>}
              </div>

              {sinPrecio.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todos los ítems de la lista encontraron su precio en el PDF.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Estos ítems de la lista no encontraron su precio en el PDF. Elegí el ítem del PDF que corresponde
                    (queda vinculado para las próximas importaciones); los que dejes sin elegir conservan su precio.
                  </p>
                  <div className="contenedor-tabla-gestion max-h-[min(28rem,55vh)] overflow-y-auto overflow-x-hidden border border-border rounded-lg">
                    <Table variant="compact" scrollX={false} className="table-fixed w-full">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>ÍTEM LISTA</TableHead>
                          <TableHead className="w-24 text-center">PX. ACTUAL</TableHead>
                          <TableHead className="w-[34%]">ÍTEM PDF</TableHead>
                          <TableHead className="w-24 text-center">PX. PDF</TableHead>
                          <TableHead className="w-20 text-center">VAR.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sinPrecio.map((item, i) => {
                          const clave = manuales.get(item.codExt);
                          const pdf = clave ? pdfPorClave.get(clave) : undefined;
                          return (
                            <TableRow key={item.codExt}>
                              <TableCell className="celda-datos min-w-0">
                                <span className="block truncate text-xs" title={item.descripcionProveedor}>
                                  <span className="celda-mono">{item.codProdProveedor}</span> ·{" "}
                                  {item.descripcionProveedor}
                                </span>
                              </TableCell>
                              <TableCell className="celda-datos celda-numero tabular-nums text-center">
                                ${fmtPrecio(item.pxActual)}
                              </TableCell>
                              <TableCell className="celda-datos min-w-0">
                                <div className="flex items-center gap-1 min-w-0">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className={cn(
                                      "h-8 min-w-0 flex-1 justify-start gap-1.5 px-2 text-xs font-normal",
                                      !pdf && "text-muted-foreground"
                                    )}
                                    onClick={() => setIndiceVincular(i)}
                                    disabled={ocupado}
                                    title={pdf?.clave}
                                  >
                                    <Search className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{pdf ? pdf.clave : "ELEGIR ÍTEM DEL PDF…"}</span>
                                  </Button>
                                  {pdf && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() => asignarManual(item.codExt, null)}
                                      disabled={ocupado}
                                      aria-label={`Quitar vínculo de ${item.codProdProveedor}`}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="celda-datos celda-numero tabular-nums text-center">
                                {pdf ? `$${fmtPrecio(pdf.precio)}` : ""}
                              </TableCell>
                              <TableCell className="celda-datos text-center">
                                {pdf ? <Variacion precio={pdf.precio} pxActual={item.pxActual} /> : null}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}

              <VincularItemPdfModal
                itemsLista={sinPrecio}
                itemsPdf={preview.filas}
                indice={indiceVincular}
                manuales={manuales}
                onIndice={setIndiceVincular}
                onAsignar={asignarManual}
              />
            </div>
          )}
        </div>
      </AppModal>
    </Dialog>
  );
}
