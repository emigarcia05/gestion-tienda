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
  const [archivoTexto, setArchivoTexto] = useState<string | null>(null);

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
    setArchivoTexto(null);
    setEncabezados(null);
    setFilasCrudas([]);
    setMapeo({});
  }

  function handleClose(val: boolean) {
    if (!val) resetForm();
    setOpen(val);
  }

  const aplicarCsv = useCallback((raw: string, conEncabezados: boolean) => {
    try {
      const { encabezados: enc, filas } = parsearCSVCrudo(raw, conEncabezados);
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
      setArchivoTexto(null);
      setEncabezados(null);
      setFilasCrudas([]);
      setMapeo({});
    }
  }, []);

  const loadFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast.error("Solo se aceptan archivos .csv");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const raw = (e.target?.result as string) ?? "";
        setFileName(file.name);
        setArchivoTexto(raw);
        aplicarCsv(raw, tieneEncabezados);
      };
      reader.readAsText(file, "UTF-8");
    },
    [aplicarCsv, tieneEncabezados]
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
        size="xl"
        className="h-[min(52rem,85vh)]"
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

            {proveedorId ? (
              <Button
                type="button"
                variant="default"
                size="default"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {fileName ? "Modificar Archivo" : "Adjuntar Archivo"}
              </Button>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadFile(f);
                e.target.value = "";
              }}
            />

            {proveedorId && !fileName ? (
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
            ) : null}
            {proveedorId && fileName ? (
              <>
                <ModalSiNoChoice
                  label="LOS DATOS TIENEN ENCABEZADOS"
                  value={tieneEncabezados}
                  onChange={(valor) => {
                    setTieneEncabezados(valor);
                    if (archivoTexto) aplicarCsv(archivoTexto, valor);
                  }}
                />
                <ModalSiNoChoice
                  label="HABILITADO"
                  value={habilitado}
                  onChange={setHabilitado}
                />
                <ModalSiNoChoice
                  label="PRECIO EN DÓLARES"
                  value={precioEnDolares}
                  onChange={setPrecioEnDolares}
                />
                {precioEnDolares ? (
                  <p className="text-xs text-muted-foreground">
                    Se aplicará la cotización global vigente:{" "}
                    <strong className="text-foreground tabular-nums">
                      ${" "}
                      {cotizacionUsd.toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      })}
                    </strong>
                    . Editá el valor en <strong className="text-foreground">Cotiz. US$</strong> en
                    la barra de acciones.
                  </p>
                ) : null}
              </>
            ) : null}

            {proveedorId && fileName ? (
              <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/30 px-3 py-2 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">{fileName}</span>
                <span className="text-xs text-muted-foreground shrink-0">({filasCrudas.length} filas)</span>
              </div>
            ) : null}

            {/* Cuando hay archivo: 2 columnas — Valor de la primera fila | Opciones para mapear */}
            {proveedorId && fileName && colLabels.length > 0 && (
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
