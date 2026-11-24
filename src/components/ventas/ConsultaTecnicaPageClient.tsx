"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  eliminarConsultaTecnicaAction,
  guardarConsultaTecnicaAction,
} from "@/actions/consultaTecnica";
import FilterBar, {
  FilaFiltrosDesplegables,
  FilterRowSearch,
  FiltroIndividualContainer,
  FILTER_SELECT_WRAPPER_CLASS,
  LimpiarFiltrosButton,
  SELECT_TRIGGER_FILTER_CLASS,
} from "@/components/FilterBar";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import ModalSiNoChoice from "@/components/shared/ModalSiNoChoice";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import { TableEmptyState } from "@/components/shared/TableEmptyState";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
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
import type {
  ConsultaTecnicaOpcion,
  ConsultaTecnicaRecomendacionItem,
} from "@/lib/consultaTecnica";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import { matchByMultiTerm } from "@/lib/busqueda";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

type Modo = "nuevo" | "editar" | "ver";

type Borrador = {
  id?: string;
  idMarca: string;
  idRubro: string;
  uso: string;
  dilucion: string;
  aplicacion: string;
  rendimiento: string;
  activo: boolean;
};

const BORRADOR_NUEVO: Borrador = {
  idMarca: "",
  idRubro: "",
  uso: "",
  dilucion: "",
  aplicacion: "",
  rendimiento: "",
  activo: true,
};

const CAMPO_CLASS = cn(
  "min-h-[4.5rem] w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm",
  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

function desdeFila(fila: ConsultaTecnicaRecomendacionItem): Borrador {
  return {
    id: fila.id,
    idMarca: fila.idMarca,
    idRubro: fila.idRubro,
    uso: fila.uso,
    dilucion: fila.dilucion,
    aplicacion: fila.aplicacion,
    rendimiento: fila.rendimiento,
    activo: fila.activo,
  };
}

export default function ConsultaTecnicaPageClient({
  recomendaciones,
  marcas,
  rubros,
  esEditor,
}: {
  recomendaciones: ConsultaTecnicaRecomendacionItem[];
  marcas: ConsultaTecnicaOpcion[];
  rubros: ConsultaTecnicaOpcion[];
  esEditor: boolean;
}) {
  const router = useRouter();
  const [filtroMarca, setFiltroMarca] = useState("");
  const [filtroRubro, setFiltroRubro] = useState("");
  const [qFiltro, setQFiltro] = useState("");
  const { q, setQ, ref, handleQChange, isDebouncing } = useFiltrosConBusqueda({
    qActual: qFiltro,
    debounceMs: 300,
    onDebouncedSearch: setQFiltro,
  });
  const [modo, setModo] = useState<Modo | null>(null);
  const [borrador, setBorrador] = useState<Borrador>(BORRADOR_NUEVO);
  const [guardando, setGuardando] = useState(false);
  const [aBorrar, setABorrar] = useState<ConsultaTecnicaRecomendacionItem | null>(null);
  const [borrando, setBorrando] = useState(false);

  const filas = useMemo(() => {
    return recomendaciones.filter((fila) => {
      if (filtroMarca && fila.idMarca !== filtroMarca) return false;
      if (filtroRubro && fila.idRubro !== filtroRubro) return false;
      return matchByMultiTerm(
        [fila.marca, fila.rubro, fila.uso, fila.dilucion, fila.aplicacion, fila.rendimiento],
        qFiltro
      );
    });
  }, [recomendaciones, filtroMarca, filtroRubro, qFiltro]);

  const soloLectura = modo === "ver";
  const columnas = esEditor ? 8 : 7;

  function limpiarFiltros() {
    setFiltroMarca("");
    setFiltroRubro("");
    setQ("");
    setQFiltro("");
  }

  function abrirNuevo() {
    setBorrador(BORRADOR_NUEVO);
    setModo("nuevo");
  }

  function abrirFila(fila: ConsultaTecnicaRecomendacionItem, siguiente: Modo) {
    setBorrador(desdeFila(fila));
    setModo(siguiente);
  }

  function cerrarFormulario() {
    if (guardando) return;
    setModo(null);
  }

  async function guardar() {
    if (!borrador.idMarca || !borrador.idRubro) {
      toast.error("Elegí la marca y el rubro.");
      return;
    }
    setGuardando(true);
    const out = await guardarConsultaTecnicaAction({
      id: borrador.id,
      idMarca: borrador.idMarca,
      idRubro: borrador.idRubro,
      uso: borrador.uso,
      dilucion: borrador.dilucion,
      aplicacion: borrador.aplicacion,
      rendimiento: borrador.rendimiento,
      activo: borrador.activo,
    });
    setGuardando(false);
    if (!out.ok) {
      toast.error(out.error);
      return;
    }
    toast.success("Recomendación guardada.");
    setModo(null);
    router.refresh();
  }

  async function confirmarBorrado() {
    if (!aBorrar) return;
    setBorrando(true);
    const out = await eliminarConsultaTecnicaAction({ id: aBorrar.id });
    setBorrando(false);
    if (!out.ok) {
      toast.error(out.error);
      return;
    }
    toast.success("Recomendación eliminada.");
    setABorrar(null);
    router.refresh();
  }

  const vacio =
    recomendaciones.length === 0
      ? "No hay recomendaciones técnicas."
      : "Ninguna recomendación coincide con los filtros.";

  return (
    <div className="area-page-shell">
      <ClassicFilteredTableLayout
        title="Herramientas"
        subtitle="Consulta Técnica"
        contentWidth="full"
        actions={
          esEditor ? (
            <ToolbarActionButton
              label="Nueva Recomendación"
              icon={<Plus />}
              onClick={abrirNuevo}
            />
          ) : null
        }
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilaFiltrosDesplegables columnas={4}>
              <FiltroIndividualContainer
                className={FILTER_SELECT_WRAPPER_CLASS}
                activo={filtroMarca !== ""}
                onLimpiar={() => setFiltroMarca("")}
              >
                <Select value={filtroMarca} onValueChange={setFiltroMarca}>
                  <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                    <SelectValue placeholder="MARCA" />
                  </SelectTrigger>
                  <SelectContent className="select-content-filtro" position="popper" side="bottom" align="start">
                    {marcas.map((marca) => (
                      <SelectItem key={marca.id} value={marca.id}>
                        {marca.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
              <FiltroIndividualContainer
                className={FILTER_SELECT_WRAPPER_CLASS}
                activo={filtroRubro !== ""}
                onLimpiar={() => setFiltroRubro("")}
              >
                <Select value={filtroRubro} onValueChange={setFiltroRubro}>
                  <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                    <SelectValue placeholder="RUBRO" />
                  </SelectTrigger>
                  <SelectContent className="select-content-filtro" position="popper" side="bottom" align="start">
                    {rubros.map((rubro) => (
                      <SelectItem key={rubro.id} value={rubro.id}>
                        {rubro.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
            </FilaFiltrosDesplegables>
            <div className="flex items-center gap-3">
              <FilterRowSearch className="flex-1">
                <FiltroBusquedaInput
                  id="consulta-tecnica-busqueda"
                  placeholder="BUSCAR EN MARCA, RUBRO, USO, DILUCIÓN, APLICACIÓN O RENDIMIENTO..."
                  value={q}
                  onChange={handleQChange}
                  isDebouncing={isDebouncing}
                  inputRef={ref}
                />
              </FilterRowSearch>
              <LimpiarFiltrosButton onClick={limpiarFiltros} />
            </div>
          </FilterBar>
        }
      >
        <div className="contenedor-tabla-gestion">
          <Table variant="compact">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[18%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[14%]" />
              {esEditor ? <col className="w-[6%]" /> : null}
              <col className="w-[8%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>MARCA</TableHead>
                <TableHead>RUBRO</TableHead>
                <TableHead>USO</TableHead>
                <TableHead>DILUCIÓN</TableHead>
                <TableHead>APLICACIÓN</TableHead>
                <TableHead>RENDIMIENTO</TableHead>
                {esEditor ? <TableHead>ACTIVA</TableHead> : null}
                <TableHead>ACCIONES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columnas}>
                    <TableEmptyState message={vacio} />
                  </TableCell>
                </TableRow>
              ) : (
                filas.map((fila) => (
                  <TableRow key={fila.id}>
                    <TableCell className="celda-datos">{fila.marca}</TableCell>
                    <TableCell className="celda-datos">{fila.rubro}</TableCell>
                    <TableCell className="celda-datos truncate" title={fila.uso}>
                      {fila.uso}
                    </TableCell>
                    <TableCell className="celda-datos truncate" title={fila.dilucion}>
                      {fila.dilucion}
                    </TableCell>
                    <TableCell className="celda-datos truncate" title={fila.aplicacion}>
                      {fila.aplicacion}
                    </TableCell>
                    <TableCell className="celda-datos truncate" title={fila.rendimiento}>
                      {fila.rendimiento}
                    </TableCell>
                    {esEditor ? (
                      <TableCell className="celda-datos text-center">
                        {fila.activo ? (
                          <Check
                            className={cn(TABLE_ROW_ACTION_ICON_CLASS, "text-[#0072bb]")}
                            aria-label="Activa"
                          />
                        ) : null}
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          aria-label="Ver"
                          title="Ver"
                          onClick={() => abrirFila(fila, "ver")}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {esEditor ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              aria-label="Editar"
                              title="Editar"
                              onClick={() => abrirFila(fila, "editar")}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              aria-label="Eliminar"
                              title="Eliminar"
                              onClick={() => setABorrar(fila)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ClassicFilteredTableLayout>

      <Dialog open={modo !== null} onOpenChange={(abierto) => { if (!abierto) cerrarFormulario(); }}>
        <AppModal
          size="lg"
          title={
            modo === "nuevo"
              ? "NUEVA RECOMENDACIÓN"
              : modo === "editar"
                ? "EDITAR RECOMENDACIÓN"
                : "RECOMENDACIÓN"
          }
          actions={
            soloLectura ? (
              <Button type="button" variant="outline" onClick={cerrarFormulario}>
                Cerrar
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={cerrarFormulario} disabled={guardando}>
                  Cancelar
                </Button>
                <Button type="button" onClick={() => void guardar()} disabled={guardando}>
                  Guardar
                </Button>
              </>
            )
          }
        >
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <ModalMicroLabel>MARCA</ModalMicroLabel>
                <Select
                  value={borrador.idMarca}
                  onValueChange={(idMarca) => setBorrador((prev) => ({ ...prev, idMarca }))}
                  disabled={soloLectura || modo === "editar" || guardando}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="MARCA" />
                  </SelectTrigger>
                  <SelectContent className="select-content-filtro" position="popper">
                    {marcas.map((marca) => (
                      <SelectItem key={marca.id} value={marca.id}>
                        {marca.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="flex flex-col gap-1.5">
                <ModalMicroLabel>RUBRO</ModalMicroLabel>
                <Select
                  value={borrador.idRubro}
                  onValueChange={(idRubro) => setBorrador((prev) => ({ ...prev, idRubro }))}
                  disabled={soloLectura || modo === "editar" || guardando}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="RUBRO" />
                  </SelectTrigger>
                  <SelectContent className="select-content-filtro" position="popper">
                    {rubros.map((rubro) => (
                      <SelectItem key={rubro.id} value={rubro.id}>
                        {rubro.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
            <CampoTexto
              label="USO"
              value={borrador.uso}
              disabled={soloLectura || guardando}
              maxLength={400}
              onChange={(uso) => setBorrador((prev) => ({ ...prev, uso }))}
            />
            <CampoTexto
              label="DILUCIÓN"
              value={borrador.dilucion}
              disabled={soloLectura || guardando}
              maxLength={240}
              onChange={(dilucion) => setBorrador((prev) => ({ ...prev, dilucion }))}
            />
            <CampoTexto
              label="APLICACIÓN"
              value={borrador.aplicacion}
              disabled={soloLectura || guardando}
              maxLength={400}
              onChange={(aplicacion) => setBorrador((prev) => ({ ...prev, aplicacion }))}
            />
            <CampoTexto
              label="RENDIMIENTO"
              value={borrador.rendimiento}
              disabled={soloLectura || guardando}
              maxLength={160}
              onChange={(rendimiento) => setBorrador((prev) => ({ ...prev, rendimiento }))}
            />
            <ModalSiNoChoice
              label="ACTIVA"
              value={borrador.activo}
              disabled={soloLectura || guardando}
              onChange={(activo) => setBorrador((prev) => ({ ...prev, activo }))}
            />
          </div>
        </AppModal>
      </Dialog>

      <Dialog
        open={aBorrar !== null}
        onOpenChange={(abierto) => {
          if (!abierto && !borrando) setABorrar(null);
        }}
      >
        <AppModal
          size="sm"
          title="ELIMINAR RECOMENDACIÓN"
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setABorrar(null)}
                disabled={borrando}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={() => void confirmarBorrado()} disabled={borrando}>
                Eliminar
              </Button>
            </>
          }
        >
          <p className="text-sm text-foreground">
            {aBorrar
              ? `Se borra la ficha de ${aBorrar.marca} · ${aBorrar.rubro}.`
              : ""}
          </p>
        </AppModal>
      </Dialog>
    </div>
  );
}

function CampoTexto({
  label,
  value,
  disabled,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <ModalMicroLabel>{label}</ModalMicroLabel>
      <textarea
        value={value}
        disabled={disabled}
        rows={3}
        maxLength={maxLength}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className={CAMPO_CLASS}
      />
    </label>
  );
}
