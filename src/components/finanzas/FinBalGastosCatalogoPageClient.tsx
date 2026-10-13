"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import CatalogoFinderColumn from "@/components/shared/catalogo-finder/CatalogoFinderColumn";
import CatalogoFinderRow from "@/components/shared/catalogo-finder/CatalogoFinderRow";
import CatalogoFinderEmpty from "@/components/shared/catalogo-finder/CatalogoFinderEmpty";
import CrearEditarFinBalCatalogoItemModal, {
  type NivelCatalogo,
} from "./CrearEditarFinBalCatalogoItemModal";
import CrearEditarFinBalGastoFinalModal from "./CrearEditarFinBalGastoFinalModal";
import EliminarFinBalCatalogoItemModal from "./EliminarFinBalCatalogoItemModal";
import EliminarFinBalGastoFinalModal from "./EliminarFinBalGastoFinalModal";
import ProveedorModal, {
  type ProveedorParaModal,
} from "@/components/proveedores/ProveedorModal";
import type {
  FinBalGastoJerarquiaRubro,
  FinBalGastoJerarquiaTipo,
} from "@/services/finBalGastosCatalogo.service";
import type { ProveedorListItem } from "@/services/proveedor.service";

/**
 * Página del catálogo jerárquico Finanzas → Balance → Gastos.
 *
 * Layout tipo Finder de 4 columnas:
 *   [TIPOS]  →  [RUBROS]  →  [GASTOS]  →  [GASTO FINAL]
 *
 * Las 4 primeras columnas son cascada: tipo → rubro → gasto (`fin_bal_cat_gasto`,
 * sin proveedor) → filas de `fin_bal_gasto_final` (proveedor, sucursal, mensual o no,
 * día devengado y plazo de pago en la UI de columna GASTO FINAL).
 * La gestión de **PROVEEDORES** se resuelve con un botón en el header que
 * abre un modal autónomo (lista + búsqueda + alta/edición), reutilizando
 * `ProveedorModal` de `/administrador/proveedores/proveedores`.
 *
 * Interacción:
 *   - Click en un ítem de las 3 primeras columnas lo selecciona y revela la siguiente.
 *   - Click en un proveedor dentro del modal abre edición.
 *   - Cada columna tiene su propio header con `+ Nuevo` (solo para editor).
 *   - Cada fila expone acciones "Editar" y "Eliminar" al pasar el mouse
 *     (proveedores se gestionan desde su modal dedicado).
 *
 * Vistas de rol:
 *   - `editor`: botonera completa en las columnas mutables.
 *   - `simple`: solo lectura. No se muestran botones de mutación.
 */

interface Props {
  jerarquia: FinBalGastoJerarquiaTipo[];
  /**
   * Lista de proveedores "no-mercadería" (payload del servicio
   * `getProveedoresNoMercaderia`). Se usa en el modal de **PROVEEDORES**
   * (lectura + búsqueda + apertura del modal en edición).
   */
  proveedores: ProveedorListItem[];
  sucursales: { id: string; nombre: string }[];
  esEditor: boolean;
}

type ModalCrearEditarState =
  | { open: false }
  | {
      open: true;
      nivel: NivelCatalogo;
      modo: "crear" | "editar";
      id?: string;
      nombreInicial?: string;
      parentId?: string;
      parentNombre?: string;
    };

type ModalEliminarState =
  | { open: false }
  | {
      open: true;
      nivel: NivelCatalogo;
      id: string;
      nombre: string;
    };

/**
 * Estado del `ProveedorModal` reutilizado.
 * - `proveedor === null` → modo **alta**.
 * - `proveedor !== null` → modo **edición** con datos precargados.
 */
type ProveedorModalState =
  | { open: false }
  | { open: true; proveedor: ProveedorParaModal | null };

type ModalGastoFinalState =
  | { open: false }
  | {
      open: true;
      modo: "crear" | "editar";
      id?: string;
      proveedorIdInicial?: string;
      sucursalIdInicial?: string;
      gastoMensualInicial?: boolean;
      diaDevengadoInicial?: number | null;
      vencimientoInicial?: number | null;
      comentariosInicial?: string | null;
      /** Política IVA persistida del gasto final (precarga en `editar`). */
      ivaInicial?: "SIEMPRE" | "NUNCA" | "PREGUNTA";
    };

type ModalEliminarGastoFinalState =
  | { open: false }
  | { open: true; id: string; proveedorNombre: string; sucursalNombre: string };

export default function FinBalGastosCatalogoPageClient({
  jerarquia,
  proveedores,
  sucursales,
  esEditor,
}: Props) {
  const router = useRouter();
  const [selectedTipoId, setSelectedTipoId] = useState<string | null>(null);
  const [selectedRubroId, setSelectedRubroId] = useState<string | null>(null);
  const [selectedGastoId, setSelectedGastoId] = useState<string | null>(null);

  const [crearEditar, setCrearEditar] = useState<ModalCrearEditarState>({ open: false });
  const [eliminar, setEliminar] = useState<ModalEliminarState>({ open: false });
  const [proveedorModal, setProveedorModal] = useState<ProveedorModalState>({ open: false });
  const [proveedoresModalOpen, setProveedoresModalOpen] = useState(false);
  const [qProveedor, setQProveedor] = useState("");
  const [gastoFinalModal, setGastoFinalModal] = useState<ModalGastoFinalState>({ open: false });
  const [eliminarGastoFinal, setEliminarGastoFinal] = useState<ModalEliminarGastoFinalState>({
    open: false,
  });

  const tipoSeleccionado = useMemo(
    () => jerarquia.find((t) => t.id === selectedTipoId) ?? null,
    [jerarquia, selectedTipoId]
  );

  const rubroSeleccionado = useMemo<FinBalGastoJerarquiaRubro | null>(
    () => tipoSeleccionado?.rubros.find((r) => r.id === selectedRubroId) ?? null,
    [tipoSeleccionado, selectedRubroId]
  );

  const gastoSeleccionado = useMemo(
    () => rubroSeleccionado?.gastos.find((g) => g.id === selectedGastoId) ?? null,
    [rubroSeleccionado, selectedGastoId]
  );

  const sucursalIdsConGastoActivo = useMemo(() => {
    return new Set(gastoSeleccionado?.asignacionesFinales.map((a) => a.sucursalId) ?? []);
  }, [gastoSeleccionado]);

  const proveedoresConGastoActivo = useMemo(() => {
    if (!gastoSeleccionado) return [];
    const unicos = new Map<string, string>();
    for (const a of gastoSeleccionado.asignacionesFinales) {
      if (!unicos.has(a.proveedorId)) {
        unicos.set(a.proveedorId, a.proveedor.nombre);
      }
    }
    return Array.from(unicos.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [gastoSeleccionado]);

  const sucursalesIndicador = useMemo(() => {
    return [...sucursales].sort((a, b) => {
      const aCorp = a.nombre.toLocaleUpperCase("es") === "CORPORATIVO";
      const bCorp = b.nombre.toLocaleUpperCase("es") === "CORPORATIVO";
      if (aCorp && !bCorp) return 1;
      if (!aCorp && bCorp) return -1;
      return a.nombre.localeCompare(b.nombre, "es");
    });
  }, [sucursales]);

  const proveedoresOpcionesModal = useMemo(
    () =>
      proveedores
        .map((p) => ({ id: p.id, nombre: p.nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [proveedores]
  );

  const proveedoresFiltrados = useMemo(() => {
    const q = qProveedor.trim().toLocaleLowerCase("es");
    if (!q) return proveedores;
    return proveedores.filter((p) => p.nombre.toLocaleLowerCase("es").includes(q));
  }, [proveedores, qProveedor]);

  /** Centros de costo desde servidor; en edición agrega la sucursal actual si ya no está en la lista (legacy). */
  const sucursalesParaModalGastoFinal = useMemo(() => {
    const ids = new Set(sucursales.map((s) => s.id));
    if (
      gastoFinalModal.open &&
      gastoFinalModal.modo === "editar" &&
      gastoFinalModal.id &&
      gastoSeleccionado
    ) {
      const row = gastoSeleccionado.asignacionesFinales.find((a) => a.id === gastoFinalModal.id);
      if (row?.sucursal && !ids.has(row.sucursal.id)) {
        return [...sucursales, { id: row.sucursal.id, nombre: row.sucursal.nombre }].sort((a, b) =>
          a.nombre.localeCompare(b.nombre, "es")
        );
      }
    }
    return sucursales;
  }, [sucursales, gastoFinalModal, gastoSeleccionado]);

  function handleSelectTipo(id: string) {
    setSelectedTipoId(id);
    setSelectedRubroId(null);
    setSelectedGastoId(null);
  }

  function handleSelectRubro(id: string) {
    setSelectedRubroId(id);
    setSelectedGastoId(null);
  }

  function handleSelectGasto(id: string) {
    setSelectedGastoId(id);
  }

  function onSuccessRefresh() {
    router.refresh();
  }

  function openProveedorNuevo() {
    setProveedoresModalOpen(false);
    setProveedorModal({ open: true, proveedor: null });
  }

  function openProveedorEdit(p: ProveedorListItem) {
    setProveedoresModalOpen(false);
    setProveedorModal({
      open: true,
      proveedor: {
        id: p.id,
        nombre: p.nombre,
        prefijo: p.prefijo,
        idProveedorDux: p.idProveedorDux ?? undefined,
        whatsapp: p.whatsapp ?? undefined,
        coeficienteTintometrico: p.coeficienteTintometrico,
        plazoPago1Dias: p.plazoPago1Dias,
        plazoPago2Dias: p.plazoPago2Dias,
        plazoPago3Dias: p.plazoPago3Dias,
        plazoPago4Dias: p.plazoPago4Dias,
        tiempoEntregaEnDias: p.tiempoEntregaEnDias ?? undefined,
        proveedorMercaderia: p.proveedorMercaderia,
        esFabrica: p.esFabrica,
        iva: p.iva,
      },
    });
  }

  return (
    <ClassicFilteredTableLayout
      title="FINANZAS"
      subtitle="Balance · Catálogo Gastos"
      contentWidth="full"
      actions={
        <Button type="button" className="h-10 px-4" onClick={() => setProveedoresModalOpen(true)}>
          PROVEEDORES
        </Button>
      }
    >
      <div className="flex-1 min-h-0 w-full overflow-hidden py-4">
        <div className="grid h-full min-h-0 grid-cols-5 gap-3">
          <CatalogoFinderColumn
            titulo="TIPOS"
            subtitulo={`${jerarquia.length} registro${jerarquia.length === 1 ? "" : "s"}`}
            mostrarNuevo={esEditor}
            onNuevo={() =>
              setCrearEditar({ open: true, nivel: "tipo", modo: "crear" })
            }
          >
            {jerarquia.length === 0 ? (
              <CatalogoFinderEmpty mensaje="No hay tipos cargados." />
            ) : (
              jerarquia.map((tipo) => (
                <CatalogoFinderRow
                  key={tipo.id}
                  nombre={tipo.nombre}
                  meta={`${tipo.rubros.length} rubro${tipo.rubros.length === 1 ? "" : "s"}`}
                  selected={tipo.id === selectedTipoId}
                  onClick={() => handleSelectTipo(tipo.id)}
                  mostrarAcciones={esEditor}
                  onEditar={() =>
                    setCrearEditar({
                      open: true,
                      nivel: "tipo",
                      modo: "editar",
                      id: tipo.id,
                      nombreInicial: tipo.nombre,
                    })
                  }
                  onEliminar={() =>
                    setEliminar({
                      open: true,
                      nivel: "tipo",
                      id: tipo.id,
                      nombre: tipo.nombre,
                    })
                  }
                />
              ))
            )}
          </CatalogoFinderColumn>

          <CatalogoFinderColumn
            titulo="RUBROS"
            subtitulo={
              tipoSeleccionado
                ? `${tipoSeleccionado.rubros.length} en ${tipoSeleccionado.nombre}`
                : "Seleccioná un tipo"
            }
            mostrarNuevo={esEditor && tipoSeleccionado !== null}
            onNuevo={() =>
              tipoSeleccionado &&
              setCrearEditar({
                open: true,
                nivel: "rubro",
                modo: "crear",
                parentId: tipoSeleccionado.id,
                parentNombre: tipoSeleccionado.nombre,
              })
            }
            deshabilitada={tipoSeleccionado === null}
          >
            {!tipoSeleccionado ? (
              <CatalogoFinderEmpty mensaje="Seleccioná un tipo para ver sus rubros." />
            ) : tipoSeleccionado.rubros.length === 0 ? (
              <CatalogoFinderEmpty mensaje="Este tipo aún no tiene rubros." />
            ) : (
              tipoSeleccionado.rubros.map((rubro) => (
                <CatalogoFinderRow
                  key={rubro.id}
                  nombre={rubro.nombre}
                  meta={`${rubro.gastos.length} gasto${rubro.gastos.length === 1 ? "" : "s"}`}
                  selected={rubro.id === selectedRubroId}
                  onClick={() => handleSelectRubro(rubro.id)}
                  mostrarAcciones={esEditor}
                  onEditar={() =>
                    setCrearEditar({
                      open: true,
                      nivel: "rubro",
                      modo: "editar",
                      id: rubro.id,
                      nombreInicial: rubro.nombre,
                      parentId: rubro.tipoId,
                      parentNombre: tipoSeleccionado.nombre,
                    })
                  }
                  onEliminar={() =>
                    setEliminar({
                      open: true,
                      nivel: "rubro",
                      id: rubro.id,
                      nombre: rubro.nombre,
                    })
                  }
                />
              ))
            )}
          </CatalogoFinderColumn>

          <CatalogoFinderColumn
            titulo="GASTOS"
            subtitulo={
              rubroSeleccionado
                ? `${rubroSeleccionado.gastos.length} en ${rubroSeleccionado.nombre}`
                : "Seleccioná un rubro"
            }
            mostrarNuevo={esEditor && rubroSeleccionado !== null}
            onNuevo={() =>
              rubroSeleccionado &&
              setCrearEditar({
                open: true,
                nivel: "gasto",
                modo: "crear",
                parentId: rubroSeleccionado.id,
                parentNombre: rubroSeleccionado.nombre,
              })
            }
            deshabilitada={rubroSeleccionado === null}
          >
            {!rubroSeleccionado ? (
              <CatalogoFinderEmpty mensaje="Seleccioná un rubro para ver sus gastos." />
            ) : rubroSeleccionado.gastos.length === 0 ? (
              <CatalogoFinderEmpty mensaje="Este rubro aún no tiene gastos." />
            ) : (
              rubroSeleccionado.gastos.map((gasto) => (
                <CatalogoFinderRow
                  key={gasto.id}
                  nombre={gasto.nombre}
                  meta={`${gasto.asignacionesFinales.length} final${
                    gasto.asignacionesFinales.length === 1 ? "" : "es"
                  }`}
                  selected={gasto.id === selectedGastoId}
                  onClick={() => handleSelectGasto(gasto.id)}
                  mostrarAcciones={esEditor}
                  onEditar={() =>
                    setCrearEditar({
                      open: true,
                      nivel: "gasto",
                      modo: "editar",
                      id: gasto.id,
                      nombreInicial: gasto.nombre,
                      parentId: gasto.rubroId,
                      parentNombre: rubroSeleccionado.nombre,
                    })
                  }
                  onEliminar={() =>
                    setEliminar({
                      open: true,
                      nivel: "gasto",
                      id: gasto.id,
                      nombre: gasto.nombre,
                    })
                  }
                />
              ))
            )}
          </CatalogoFinderColumn>

          <CatalogoFinderColumn
            titulo="GASTO FINAL"
            subtitulo={
              gastoSeleccionado
                ? `${gastoSeleccionado.asignacionesFinales.length} en ${gastoSeleccionado.nombre}`
                : "Seleccioná un gasto"
            }
            mostrarNuevo={esEditor && gastoSeleccionado !== null}
            onNuevo={() =>
              gastoSeleccionado &&
              setGastoFinalModal({
                open: true,
                modo: "crear",
              })
            }
            deshabilitada={gastoSeleccionado === null}
          >
            {!gastoSeleccionado ? (
              <CatalogoFinderEmpty mensaje="Seleccioná un gasto para ver sus gastos finales." />
            ) : gastoSeleccionado.asignacionesFinales.length === 0 ? (
              <CatalogoFinderEmpty mensaje="Este gasto aún no tiene gastos finales." />
            ) : (
              gastoSeleccionado.asignacionesFinales.map((a) => (
                <CatalogoFinderRow
                  key={a.id}
                  nombre={a.proveedor.nombre}
                  gastoFinalDetalle={{
                    gastoNombre: gastoSeleccionado.nombre,
                    sucursalNombre: a.sucursal?.nombre ?? "—",
                    proveedorNombre: a.proveedor.nombre,
                    gastoMensual: a.gastoMensual,
                    diaDevengado: a.diaDevengado,
                    vencimiento: a.vencimiento,
                    ivaCredito: a.iva,
                    comentarios: a.comentarios,
                  }}
                  selected={false}
                  mostrarAcciones={esEditor}
                  onEditar={() =>
                    setGastoFinalModal({
                      open: true,
                      modo: "editar",
                      id: a.id,
                      proveedorIdInicial: a.proveedorId,
                      sucursalIdInicial: a.sucursalId ?? undefined,
                      gastoMensualInicial: a.gastoMensual,
                      diaDevengadoInicial: a.diaDevengado,
                      vencimientoInicial: a.vencimiento,
                      comentariosInicial: a.comentarios,
                      ivaInicial: a.iva,
                    })
                  }
                  onEliminar={() =>
                    setEliminarGastoFinal({
                      open: true,
                      id: a.id,
                      proveedorNombre: a.proveedor.nombre,
                      sucursalNombre: a.sucursal?.nombre ?? "",
                    })
                  }
                />
              ))
            )}
          </CatalogoFinderColumn>

          <CatalogoFinderColumn
            titulo="INDICADOR"
            subtitulo={gastoSeleccionado ? `Actividad en ${gastoSeleccionado.nombre}` : "Seleccioná un gasto"}
            mostrarNuevo={false}
            deshabilitada={gastoSeleccionado === null}
          >
            {!gastoSeleccionado ? (
              <CatalogoFinderEmpty mensaje="Seleccioná un gasto para ver indicadores." />
            ) : (
              <div className="flex h-full min-h-0 flex-col">
                <section className="flex min-h-0 flex-1 flex-col border-b border-border">
                  <header className="shrink-0 border-b border-border bg-muted/60 px-3 py-2">
                    <h3 className="text-center text-[11px] font-semibold uppercase tracking-wide text-foreground">
                      SUCURSALES
                    </h3>
                  </header>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {sucursalesIndicador.map((s) => {
                      const activa = sucursalIdsConGastoActivo.has(s.id);
                      return (
                        <div
                          key={s.id}
                          className="grid grid-cols-[10%_90%] items-center border-b px-3 py-2 text-[11px] text-foreground"
                        >
                          <div className="flex items-center justify-center">
                            {activa ? <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
                          </div>
                          <span className="truncate text-left">{s.nombre}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
                <section className="flex min-h-0 flex-1 flex-col">
                  <header className="shrink-0 border-b border-border bg-muted/60 px-3 py-2">
                    <h3 className="text-center text-[11px] font-semibold uppercase tracking-wide text-foreground">
                      PROVEEDORES
                    </h3>
                  </header>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {proveedoresConGastoActivo.length === 0 ? (
                      <CatalogoFinderEmpty mensaje="Sin proveedores activos." />
                    ) : (
                      proveedoresConGastoActivo.map((p) => (
                        <div key={p.id} className="truncate border-b px-3 py-2 text-[11px] text-foreground">
                          {p.nombre}
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            )}
          </CatalogoFinderColumn>

        </div>
      </div>

      {/* Modal único de alta/edición para los 3 niveles */}
      {crearEditar.open && (
        <CrearEditarFinBalCatalogoItemModal
          open={crearEditar.open}
          onOpenChange={(next) => !next && setCrearEditar({ open: false })}
          nivel={crearEditar.nivel}
          modo={crearEditar.modo}
          id={crearEditar.id}
          nombreInicial={crearEditar.nombreInicial}
          parentId={crearEditar.parentId}
          parentNombre={crearEditar.parentNombre}
          onSuccess={onSuccessRefresh}
        />
      )}

      {gastoFinalModal.open && gastoSeleccionado && (
        <CrearEditarFinBalGastoFinalModal
          open={gastoFinalModal.open}
          onOpenChange={(next) => !next && setGastoFinalModal({ open: false })}
          modo={gastoFinalModal.modo}
          id={gastoFinalModal.id}
          gastoId={gastoSeleccionado.id}
          gastoNombre={gastoSeleccionado.nombre}
          proveedoresOpciones={proveedoresOpcionesModal}
          sucursales={sucursalesParaModalGastoFinal}
          filasMismoGastoFinal={gastoSeleccionado.asignacionesFinales.map((a) => ({
            id: a.id,
            proveedorId: a.proveedorId,
            sucursalId: a.sucursalId,
            comentarios: a.comentarios,
          }))}
          proveedorIdInicial={gastoFinalModal.proveedorIdInicial}
          sucursalIdInicial={gastoFinalModal.sucursalIdInicial}
          gastoMensualInicial={gastoFinalModal.gastoMensualInicial}
          diaDevengadoInicial={gastoFinalModal.diaDevengadoInicial}
          vencimientoInicial={gastoFinalModal.vencimientoInicial}
          comentariosInicial={
            gastoFinalModal.modo === "editar" ? gastoFinalModal.comentariosInicial : undefined
          }
          ivaInicial={
            gastoFinalModal.modo === "editar" ? gastoFinalModal.ivaInicial : undefined
          }
          onSuccess={onSuccessRefresh}
        />
      )}

      {eliminarGastoFinal.open && (
        <EliminarFinBalGastoFinalModal
          open={eliminarGastoFinal.open}
          onOpenChange={(next) => !next && setEliminarGastoFinal({ open: false })}
          id={eliminarGastoFinal.open ? eliminarGastoFinal.id : null}
          proveedorNombre={eliminarGastoFinal.open ? eliminarGastoFinal.proveedorNombre : null}
          sucursalNombre={eliminarGastoFinal.open ? eliminarGastoFinal.sucursalNombre : null}
          gastoNombre={gastoSeleccionado?.nombre ?? null}
          onSuccess={onSuccessRefresh}
        />
      )}

      {/* Modal único de eliminación para los 3 niveles */}
      {eliminar.open && (
        <EliminarFinBalCatalogoItemModal
          open={eliminar.open}
          onOpenChange={(next) => !next && setEliminar({ open: false })}
          nivel={eliminar.nivel}
          id={eliminar.id}
          nombre={eliminar.nombre}
          onSuccess={onSuccessRefresh}
        />
      )}

      {/* ProveedorModal reutilizado (alta + edición + eliminación interna).
          `proveedor === null` → alta; si no → edición con datos precargados. */}
      <Dialog
        open={proveedoresModalOpen}
        onOpenChange={(next) => {
          setProveedoresModalOpen(next);
          if (!next) setQProveedor("");
        }}
      >
        {proveedoresModalOpen && (
          <AppModal
            title="Proveedores"
            size="lg"
            bodyClassName="p-0"
            actions={
              <>
                <Button type="button" variant="outline" onClick={() => setProveedoresModalOpen(false)}>
                  Cerrar
                </Button>
                {esEditor ? (
                  <Button type="button" onClick={openProveedorNuevo}>
                    Agregar Proveedor
                  </Button>
                ) : null}
              </>
            }
          >
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-border p-3">
                <label className="relative block" aria-label="Buscar proveedor por nombre">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={qProveedor}
                    onChange={(e) => setQProveedor(e.target.value)}
                    placeholder="BUSCAR PROVEEDOR..."
                    className="h-10 pl-9"
                  />
                </label>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {proveedoresFiltrados.length === 0 ? (
                  <CatalogoFinderEmpty mensaje="No hay proveedores para el criterio ingresado." />
                ) : (
                  proveedoresFiltrados.map((p) => (
                    <div
                      key={p.id}
                      className={cn(
                        "flex items-center justify-between gap-3 border-b px-3 py-2 text-sm",
                        esEditor ? "cursor-pointer hover:bg-accent/50" : "cursor-default"
                      )}
                      onClick={esEditor ? () => openProveedorEdit(p) : undefined}
                      role={esEditor ? "button" : undefined}
                      tabIndex={esEditor ? 0 : undefined}
                      onKeyDown={(e) => {
                        if (!esEditor) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openProveedorEdit(p);
                        }
                      }}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{p.nombre}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{p.prefijo || ""}</p>
                      </div>
                      {esEditor ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS, "!h-7 !w-7 !p-1")}
                          title="Editar"
                          aria-label={`Editar ${p.nombre}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openProveedorEdit(p);
                          }}
                        >
                          <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </AppModal>
        )}
      </Dialog>

      <Dialog
        open={proveedorModal.open}
        onOpenChange={(next) => !next && setProveedorModal({ open: false })}
      >
        {proveedorModal.open && (
          <ProveedorModal
            open={proveedorModal.open}
            onOpenChange={(next) => !next && setProveedorModal({ open: false })}
            proveedor={proveedorModal.proveedor}
            onSuccess={() => {
              setProveedorModal({ open: false });
              onSuccessRefresh();
            }}
          />
        )}
      </Dialog>
    </ClassicFilteredTableLayout>
  );
}
