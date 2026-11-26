"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Percent, Plus, Trash2, ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import AppModal from "@/components/shared/AppModal";
import CrearEditarReglaDescuentoListaPrecioModal from "@/components/proveedores/CrearEditarReglaDescuentoListaPrecioModal";
import EliminarReglaDescuentoListaPrecioModal from "@/components/proveedores/EliminarReglaDescuentoListaPrecioModal";
import ReglasDescEspecificasListaPreciosPanel from "@/components/proveedores/ReglasDescEspecificasListaPreciosPanel";
import FilterBar, {
  FiltroIndividualContainer,
  FilterRowSelection,
  FilaFiltrosDesplegables,
  FILTER_SELECT_WRAPPER_CLASS,
} from "@/components/FilterBar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
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
  EmptyTableRow,
} from "@/components/ui/table";
import {
  listarReglasDescuentosListaPrecioAction,
  listarCatalogosReglasDescuentosAction,
  type ReglaDescuentoListaPrecio,
  type CatalogosReglasDescuentosListaPrecio,
} from "@/actions/descuentosListaPrecioReglas";
import {
  CAMPOS_REGLA_DESCUENTO_OPCIONES,
  celdaCondicionReglaDescuento,
  labelCampoReglaDescuento,
  ordenarReglasDescuentoListaPrecio,
  tipoCampoReglaDescuento,
  REGLAS_DESCUENTOS_ACCIONES_CELL_DIVIDER_CLASS,
  REGLAS_DESCUENTOS_ACCIONES_HEAD_DIVIDER_CLASS,
  REGLAS_DESCUENTOS_GENERAL_COL_WIDTHS_PCT,
} from "@/lib/descuentosListaPrecioReglasUi";
import type { CampoReglaDescuentoListaPrecioInput } from "@/lib/validations/descuentosListaPrecioReglas";
import { fmtPorcentajeTabla } from "@/lib/format";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const CATALOGOS_VACIOS: CatalogosReglasDescuentosListaPrecio = {
  proveedores: [],
  marcas: [],
  rubros: [],
};

/** Anchos de columna (suma 100 %): PROV · MARCA · RUBRO · CAMPO · DESC · ACC. */
const COL_WIDTHS_PCT = REGLAS_DESCUENTOS_GENERAL_COL_WIDTHS_PCT;
const COL_COUNT = COL_WIDTHS_PCT.length;

const TH_DIVIDER_CLASS = "tabla-bloque-secundario-head-divider";
const TD_DIVIDER_CLASS = "tabla-bloque-secundario-cell-divider";

/** Alto fijo del área de tabla: mismo tamaño en GENERAL y POR PRODUCTO. El scroll vive en esta caja. */
const REGLAS_DESCUENTOS_TABLA_AREA_CLASS =
  "contenedor-tabla-gestion reglas-descuentos-tabla shrink-0";

interface Props {
  onSuccess?: () => void;
}

type VistaReglas = "dimension" | "especifica";

export default function ReglasDescuentosListaPrecioModal({ onSuccess }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [vista, setVista] = useState<VistaReglas>("dimension");
  const [loading, setLoading] = useState(false);
  const [reglas, setReglas] = useState<ReglaDescuentoListaPrecio[]>([]);
  const [catalogos, setCatalogos] = useState<CatalogosReglasDescuentosListaPrecio>(CATALOGOS_VACIOS);

  const [crearEditarOpen, setCrearEditarOpen] = useState(false);
  const [modoModal, setModoModal] = useState<"crear" | "editar">("crear");
  const [reglaEdit, setReglaEdit] = useState<ReglaDescuentoListaPrecio | null>(null);

  const [eliminarOpen, setEliminarOpen] = useState(false);
  const [reglaEliminar, setReglaEliminar] = useState<ReglaDescuentoListaPrecio | null>(null);
  const [solicitudCrearEspec, setSolicitudCrearEspec] = useState(0);

  const [filtroCampo, setFiltroCampo] = useState<CampoReglaDescuentoListaPrecioInput | "">("");
  const [filtroProveedorId, setFiltroProveedorId] = useState("");
  const [filtroMarcaId, setFiltroMarcaId] = useState("");
  const [filtroRubroId, setFiltroRubroId] = useState("");

  const limpiarFiltros = useCallback(() => {
    setFiltroCampo("");
    setFiltroProveedorId("");
    setFiltroMarcaId("");
    setFiltroRubroId("");
  }, []);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [resReglas, resCatalogos] = await Promise.all([
        listarReglasDescuentosListaPrecioAction(),
        listarCatalogosReglasDescuentosAction(),
      ]);

      if (!resReglas.ok) {
        toast.error(resReglas.error ?? "No se pudieron cargar las reglas.");
        setReglas([]);
      } else {
        setReglas(resReglas.data);
      }

      if (!resCatalogos.ok) {
        toast.error(resCatalogos.error ?? "No se pudieron cargar los catálogos.");
        setCatalogos(CATALOGOS_VACIOS);
      } else {
        setCatalogos(resCatalogos.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    limpiarFiltros();
    setVista("dimension");
    setSolicitudCrearEspec(0);
    void cargarDatos();
  }, [open, cargarDatos, limpiarFiltros]);

  const reglasFiltradas = useMemo(() => {
    const filtradas = reglas.filter((regla) => {
      if (filtroCampo && regla.campo !== filtroCampo) return false;
      if (filtroProveedorId && regla.idProveedor !== filtroProveedorId) return false;
      if (filtroMarcaId && regla.idMarca !== filtroMarcaId) return false;
      if (filtroRubroId && regla.idRubro !== filtroRubroId) return false;
      return true;
    });
    return ordenarReglasDescuentoListaPrecio(filtradas);
  }, [reglas, filtroCampo, filtroProveedorId, filtroMarcaId, filtroRubroId]);

  const handleSuccess = useCallback(() => {
    void cargarDatos();
    router.refresh();
    onSuccess?.();
  }, [cargarDatos, onSuccess, router]);

  function abrirCrear() {
    setModoModal("crear");
    setReglaEdit(null);
    setCrearEditarOpen(true);
  }

  function abrirNuevaRegla() {
    if (vista === "dimension") {
      abrirCrear();
    } else {
      setSolicitudCrearEspec((n) => n + 1);
    }
  }

  function abrirEditar(regla: ReglaDescuentoListaPrecio) {
    setModoModal("editar");
    setReglaEdit(regla);
    setCrearEditarOpen(true);
  }

  function abrirEliminar(regla: ReglaDescuentoListaPrecio) {
    setReglaEliminar(regla);
    setEliminarOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="default"
            size="default"
            className="btn-primario-gestion gap-2 shrink-0"
          >
            <Percent className="h-4 w-4 shrink-0" aria-hidden />
            Reglas Desc.
          </Button>
        </DialogTrigger>

        <AppModal
          title="Reglas Descuentos"
          size="xl"
          className="max-w-[57.6rem] min-h-[min(62vh,34.5rem)]"
          padding="sm"
          bodyShellClassName="p-3"
          bodyClassName="flex flex-col"
          scrollBody={false}
          hideBodyScrollbars
          actions={
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="flex shrink-0 items-center gap-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={vista === "dimension" ? "default" : "outline"}
                  onClick={() => setVista("dimension")}
                >
                  GENERAL
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={vista === "especifica" ? "default" : "outline"}
                  onClick={() => setVista("especifica")}
                >
                  POR PRODUCTO
                </Button>
              </div>
              <Button
                type="button"
                size="sm"
                variant="default"
                className="ml-auto gap-2"
                onClick={abrirNuevaRegla}
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                NUEVA REGLA
              </Button>
            </div>

            <FilterBar className="filtros-contenedor-tienda shrink-0 bg-card">
              <FilterRowSelection>
                <FilaFiltrosDesplegables columnas={4}>
                  <FiltroIndividualContainer
                    className={FILTER_SELECT_WRAPPER_CLASS}
                    activo={Boolean(filtroCampo)}
                    onLimpiar={() => setFiltroCampo("")}
                  >
                    <Select
                      value={filtroCampo ?? ""}
                      onValueChange={(v) =>
                        setFiltroCampo(v as CampoReglaDescuentoListaPrecioInput)
                      }
                    >
                      <SelectTrigger id="filtro-regla-campo" className="input-filtro-unificado">
                        <SelectValue placeholder="TIPO DESC." />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        align="start"
                        className="select-content-filtro"
                      >
                        {CAMPOS_REGLA_DESCUENTO_OPCIONES.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FiltroIndividualContainer>

                  <FiltroIndividualContainer
                    className={FILTER_SELECT_WRAPPER_CLASS}
                    activo={Boolean(filtroProveedorId)}
                    onLimpiar={() => setFiltroProveedorId("")}
                  >
                    <Select
                      value={filtroProveedorId ?? ""}
                      onValueChange={setFiltroProveedorId}
                    >
                      <SelectTrigger id="filtro-regla-proveedor" className="input-filtro-unificado">
                        <SelectValue placeholder="PROVEEDOR" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        align="start"
                        className="select-content-filtro"
                      >
                        {catalogos.proveedores.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.prefijo ? `[${p.prefijo}] ` : ""}
                            {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FiltroIndividualContainer>

                  <FiltroIndividualContainer
                    className={FILTER_SELECT_WRAPPER_CLASS}
                    activo={Boolean(filtroMarcaId)}
                    onLimpiar={() => setFiltroMarcaId("")}
                  >
                    <Select value={filtroMarcaId ?? ""} onValueChange={setFiltroMarcaId}>
                      <SelectTrigger id="filtro-regla-marca" className="input-filtro-unificado">
                        <SelectValue placeholder="MARCA" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        align="start"
                        className="select-content-filtro"
                      >
                        {catalogos.marcas.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FiltroIndividualContainer>

                  <FiltroIndividualContainer
                    className={FILTER_SELECT_WRAPPER_CLASS}
                    activo={Boolean(filtroRubroId)}
                    onLimpiar={() => setFiltroRubroId("")}
                  >
                    <Select value={filtroRubroId ?? ""} onValueChange={setFiltroRubroId}>
                      <SelectTrigger id="filtro-regla-rubro" className="input-filtro-unificado">
                        <SelectValue placeholder="RUBRO" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        align="start"
                        className="select-content-filtro"
                      >
                        {catalogos.rubros.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FiltroIndividualContainer>
                </FilaFiltrosDesplegables>
              </FilterRowSelection>
            </FilterBar>

            {vista === "especifica" ? (
              <ReglasDescEspecificasListaPreciosPanel
                onSuccess={handleSuccess}
                filtroProveedorId={filtroProveedorId}
                filtroMarcaId={filtroMarcaId}
                filtroRubroId={filtroRubroId}
                solicitudCrear={solicitudCrearEspec}
                tablaClassName={REGLAS_DESCUENTOS_TABLA_AREA_CLASS}
              />
            ) : (
            <div className={REGLAS_DESCUENTOS_TABLA_AREA_CLASS}>
              <Table variant="compact" className="tabla-vinculos-modal w-full min-w-0">
                <colgroup>
                  {COL_WIDTHS_PCT.map((pct, i) => (
                    <col key={i} style={{ width: `${pct}%` }} />
                  ))}
                </colgroup>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>PROVEEDOR</TableHead>
                    <TableHead>MARCA</TableHead>
                    <TableHead>RUBRO</TableHead>
                    <TableHead className={TH_DIVIDER_CLASS}>CAMPO</TableHead>
                    <TableHead className="text-right">DESC</TableHead>
                    <TableHead className={cn("text-center", REGLAS_DESCUENTOS_ACCIONES_HEAD_DIVIDER_CLASS)}>
                      ACCIONES
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={COL_COUNT}
                        className="celda-datos text-center text-sm text-muted-foreground"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Cargando reglas…
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : reglas.length === 0 ? (
                    <EmptyTableRow colSpan={COL_COUNT} message="No hay reglas de descuento configuradas." />
                  ) : reglasFiltradas.length === 0 ? (
                    <EmptyTableRow colSpan={COL_COUNT} message="Ninguna regla coincide con los filtros." />
                  ) : (
                    reglasFiltradas.map((regla) => (
                      <TableRow key={regla.id}>
                        <TableCell className="celda-datos whitespace-normal break-words">
                          {celdaCondicionReglaDescuento(regla, "proveedor")}
                        </TableCell>
                        <TableCell className="celda-datos whitespace-normal break-words">
                          {celdaCondicionReglaDescuento(regla, "marca")}
                        </TableCell>
                        <TableCell className="celda-datos whitespace-normal break-words">
                          {celdaCondicionReglaDescuento(regla, "rubro")}
                        </TableCell>
                        <TableCell className={cn("celda-datos font-medium", TD_DIVIDER_CLASS)}>
                          {labelCampoReglaDescuento(regla.campo)}
                        </TableCell>
                        <TableCell className="celda-datos text-right tabular-nums">
                          <span className="inline-flex items-center justify-end gap-1">
                            {fmtPorcentajeTabla(regla.valor)}
                            {tipoCampoReglaDescuento(regla.campo) === "descuento" ? (
                              <ArrowDown
                                className="h-3.5 w-3.5 shrink-0 opacity-80"
                                aria-hidden
                              />
                            ) : (
                              <ArrowUp
                                className="h-3.5 w-3.5 shrink-0 opacity-80"
                                aria-hidden
                              />
                            )}
                          </span>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "celda-datos celda-datos--accion-relleno-fila p-0",
                            REGLAS_DESCUENTOS_ACCIONES_CELL_DIVIDER_CLASS
                          )}
                        >
                          <div
                            className={cn(
                              TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
                              "justify-center gap-0.5"
                            )}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              aria-label="Editar regla"
                              onClick={() => abrirEditar(regla)}
                            >
                              <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              aria-label="Eliminar regla"
                              onClick={() => abrirEliminar(regla)}
                            >
                              <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            )}
          </div>
        </AppModal>
      </Dialog>

      <CrearEditarReglaDescuentoListaPrecioModal
        open={crearEditarOpen}
        onOpenChange={setCrearEditarOpen}
        modo={modoModal}
        regla={reglaEdit}
        catalogos={catalogos}
        onSuccess={handleSuccess}
      />

      <EliminarReglaDescuentoListaPrecioModal
        open={eliminarOpen}
        onOpenChange={setEliminarOpen}
        regla={reglaEliminar}
        onSuccess={handleSuccess}
      />
    </>
  );
}
