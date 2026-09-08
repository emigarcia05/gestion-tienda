"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Upload,
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Badge } from "@/components/ui/badge";
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
import { type MapeoColumnasListaPrecios } from "@/lib/parsearImport";
import { parsearCSVCrudo } from "@/lib/parsearImport";
import { cn } from "@/lib/utils";
import { BADGE_SUCCESS_TINT_CLASS } from "@/lib/ui-classes";
import ModalSiNoChoice from "@/components/shared/ModalSiNoChoice";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";

const SELECT_NONE = "none";

interface Proveedor {
  id: string;
  nombre: string;
  codigoUnico: string;
  prefijo: string;
}

interface Props {
  proveedores: Proveedor[];
  cotizacionUsd: number;
}

type CampoDestinoListaPrecios =
  | "codigoExterno"
  | "codProdProv"
  | "descripcion"
  | "marca"
  | "precioLista"
  | "precioVentaSugerido"
  | "ignorar";

const CAMPOS: { value: CampoDestinoListaPrecios; label: string; required: boolean }[] = [
  { value: "codProdProv", label: "COD. PROVEEDOR", required: true },          // cod_prod_proveedor
  { value: "descripcion", label: "DESCRIPCIÓN PROVEEDOR", required: false },
  { value: "marca", label: "MARCA", required: false },
  { value: "precioLista", label: "PX. LISTA PROVEEDOR", required: true },
  { value: "precioVentaSugerido", label: "PX. VENTA SUGERIDO", required: false },
  { value: "ignorar", label: "IGNORAR / (SIN ASIGNAR)", required: false },
];

export default function ImportarListaPreciosModal({ proveedores, cotizacionUsd }: Props) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [proveedorId, setProveedorId] = useState("");
  const [tieneEncabezados, setTieneEncabezados] = useState(true);
  const [habilitado, setHabilitado] = useState(true);
  const [precioEnDolares, setPrecioEnDolares] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const [encabezados, setEncabezados] = useState<string[] | null>(null);
  const [filasCrudas, setFilasCrudas] = useState<string[][]>([]);
  const [mapeo, setMapeo] = useState<MapeoColumnasListaPrecios>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setSending(false);
    setProveedorId("");
    setTieneEncabezados(true);
    setHabilitado(true);
    setPrecioEnDolares(false);
    setIsDragging(false);
    setFileName(null);
    setEncabezados(null);
    setFilasCrudas([]);
    setMapeo({});
  }

  function handleClose(val: boolean) {
    if (!val) resetForm();
    setOpen(val);
  }

  const loadFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast.error("Solo se aceptan archivos .csv");
        return;
      }
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const raw = (e.target?.result as string) ?? "";
        try {
          const { encabezados: enc, filas } = parsearCSVCrudo(raw, tieneEncabezados);
          setEncabezados(enc);
          setFilasCrudas(filas);
          const inicialMapeo: MapeoColumnasListaPrecios = {};
          const cols = enc ?? (filas[0] ? filas[0].map((_, i) => String(i)) : []);
          cols.forEach((_, i) => {
            inicialMapeo[i] = "ignorar";
          });
          setMapeo(inicialMapeo);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Error al leer el archivo.");
          setFileName(null);
        }
      };
      reader.readAsText(file, "UTF-8");
    },
    [tieneEncabezados]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) loadFile(file);
    },
    [loadFile]
  );

  const camposRequeridosMapeados = CAMPOS.filter((c) => c.required).every((c) =>
    Object.values(mapeo).includes(c.value)
  );

  async function handleImport() {
    if (!proveedorId) {
      toast.error("Selecciona un proveedor.");
      return;
    }
    if (!camposRequeridosMapeados) {
      toast.error("Asigná todos los campos requeridos.");
      return;
    }
    if (sending) return;

    setSending(true);
    fetch("/api/import-lista-precios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proveedorId,
        filasCrudas,
        mapeo,
        precioEnDolares,
        habilitado,
      }),
    }).catch(() => {});

    setOpen(false);
    resetForm();
  }

  const colLabels = encabezados ?? filasCrudas[0]?.map((_, i) => `Columna ${i + 1}`) ?? [];
  const filaEjemplo = filasCrudas[0] ?? [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="default" size="default" className="btn-primario-gestion">
          <Download className="h-4 w-4" />
          Imp. Lista
        </Button>
      </DialogTrigger>

      <AppModal
        className="max-w-3xl"
        bodyClassName="max-w-full min-w-0"
        title="Importar Lista De Precios"
        actions={
          <>
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
            {filasCrudas.length > 0 && (
              <Button
                onClick={handleImport}
                disabled={!camposRequeridosMapeados || !proveedorId || sending}
                className="gap-2 min-w-[130px]"
              >
                <ArrowRight className="h-4 w-4" /> Importar {filasCrudas.length} Filas
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-3 pt-2 min-w-0 overflow-hidden">
            {/* Fila 0: Proveedor */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">PROVEEDOR</label>
              <Select
                value={proveedorId || SELECT_NONE}
                onValueChange={(v) => setProveedorId(v === SELECT_NONE ? "" : v)}
              >
                <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                  <SelectValue placeholder="SELECCIONAR PROVEEDOR..." />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  <SelectItem value={SELECT_NONE}>SELECCIONAR PROVEEDOR...</SelectItem>
                  {proveedores.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      [{p.prefijo}] {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tres filas: mismo tipo/tamaño/color de texto; botones en la misma columna alineados */}
            <div className="grid grid-cols-[1fr_10rem] gap-x-4 gap-y-3 items-center">
              {/* Fila 1: Adjuntar / Modificar archivo */}
              <span className="text-sm font-medium text-foreground min-w-0 truncate">
                {fileName ? "MODIFICAR ARCHIVO" : "ADJUNTAR UN ARCHIVO"}
              </span>
              <div className="flex w-full min-w-0">
                <Button
                  type="button"
                  variant="default"
                  size="default"
                  className="min-w-0 flex-1"
                  onClick={() => {
                    if (fileName) {
                      setFileName(null);
                      setEncabezados(null);
                      setFilasCrudas([]);
                      setMapeo({});
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <Upload className="h-4 w-4" />
                  {fileName ? "Modificar Archivo" : "Adjuntar Archivo"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) loadFile(f);
                  }}
                />
              </div>

              {/* Fila 2: Los datos tienen encabezados — SÍ / NO */}
              <span className="text-sm font-medium text-foreground min-w-0 truncate">LOS DATOS TIENEN ENCABEZADOS</span>
              <ModalSiNoChoice value={tieneEncabezados} onChange={setTieneEncabezados} />

              {/* Fila 3: Habilitado — SÍ / NO */}
              <span className="text-sm font-medium text-foreground min-w-0 truncate">HABILITADO</span>
              <ModalSiNoChoice value={habilitado} onChange={setHabilitado} />

              {/* Fila 4: Precio en dólares — SÍ / NO */}
              <span className="text-sm font-medium text-foreground min-w-0 truncate">PRECIO EN DÓLARES</span>
              <ModalSiNoChoice value={precioEnDolares} onChange={setPrecioEnDolares} />
              {precioEnDolares && (
                <p className="col-span-2 text-xs text-muted-foreground">
                  Se aplicará la cotización global vigente:{" "}
                  <strong className="text-foreground tabular-nums">
                    $ {cotizacionUsd.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </strong>
                  . Editá el valor en <strong className="text-foreground">Cotiz. US$</strong> en la barra de acciones.
                </p>
              )}
            </div>

            {/* Zona de arrastre cuando no hay archivo (opcional, para drag & drop) */}
            {!fileName && (
              <div
                className={cn(
                  "rounded-lg border-2 border-dashed transition-colors flex items-center justify-center gap-2 py-4 px-3",
                  isDragging ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
              >
                <span className="text-sm text-muted-foreground">O arrastrá un archivo .csv aquí</span>
              </div>
            )}
            {fileName && (
              <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/30 px-3 py-2 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">{fileName}</span>
                <span className="text-xs text-muted-foreground shrink-0">({filasCrudas.length} filas)</span>
              </div>
            )}

            {/* Cuando hay archivo: 2 columnas — Valor de la primera fila | Opciones para mapear */}
            {fileName && colLabels.length > 0 && (
              <>
                <div className="rounded-lg border border-border/50 overflow-hidden bg-card max-h-[220px] overflow-y-auto w-full min-w-0">
                  <Table variant="compact" className="table-fixed w-full">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[45%]">PRIMERA FILA</TableHead>
                        <TableHead className="w-[55%]">MAPEAR A</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {colLabels.map((_, i) => (
                        <TableRow key={i}>
                          <TableCell className="celda-datos celda-mono truncate">
                            {(encabezados ?? filaEjemplo)?.[i] ?? <span className="text-muted-foreground italic">—</span>}
                          </TableCell>
                          <TableCell className="celda-datos">
                            <Select
                              value={mapeo[i] ?? "ignorar"}
                              onValueChange={(v) =>
                                setMapeo((prev) => ({
                                  ...prev,
                                  [i]: v as CampoDestinoListaPrecios,
                                }))
                              }
                            >
                              <SelectTrigger className={cn("h-8 w-full text-xs")}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent
                                position="popper"
                                side="bottom"
                                align="start"
                                className="select-content-filtro"
                              >
                                {CAMPOS.map((c) => (
                                  <SelectItem key={c.value} value={c.value}>
                                    {c.required ? `${c.label} *` : c.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-wrap gap-2">
                  {CAMPOS.filter((c) => c.required).map((c) => {
                    const asignado = Object.values(mapeo).includes(c.value);
                    return (
                      <Badge
                        key={c.value}
                        className={
                          asignado
                            ? BADGE_SUCCESS_TINT_CLASS
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        }
                      >
                        {asignado ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                        {c.label}
                      </Badge>
                    );
                  })}
                </div>
              </>
            )}
          </div>
      </AppModal>
    </Dialog>
  );
}
