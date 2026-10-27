"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  crearMktPublicacionObjAction,
  editarMktPublicacionObjAction,
  eliminarMktPublicacionObjAction,
  listarMktPublicacionObjsAction,
} from "@/actions/mktPublicacionesObj";
import type { MktCatalogoNombreItem } from "@/lib/mktPublicacionesCatalogo";
import {
  etiquetaMktPubliObjEje,
  etiquetaMktPubliObjPeriodo,
  MKT_PUBLI_OBJ_EJES,
  MKT_PUBLI_OBJ_PERIODOS,
  type MktPubliObjEje,
  type MktPubliObjPeriodo,
  type MktPublicacionObjItem,
} from "@/lib/mktPublicacionesObj";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

interface Props {
  objetivosIniciales: MktPublicacionObjItem[];
  redes: MktCatalogoNombreItem[];
  contenidos: MktCatalogoNombreItem[];
  secciones: MktCatalogoNombreItem[];
  esEditor: boolean;
}

const BOTON_ACCION_CLASS = cn(
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  "!size-8 max-h-8 min-h-8 min-w-8 shrink-0 !p-0"
);

type ModalForm =
  | { open: false }
  | {
      open: true;
      modo: "crear";
      eje: MktPubliObjEje;
      periodo: MktPubliObjPeriodo;
    }
  | {
      open: true;
      modo: "editar";
      item: MktPublicacionObjItem;
    };

function parseCantidad(raw: string): number | null {
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n < 1 || n > 9999) return null;
  return n;
}

function catalogoPorEje(
  eje: MktPubliObjEje,
  redes: MktCatalogoNombreItem[],
  contenidos: MktCatalogoNombreItem[],
  secciones: MktCatalogoNombreItem[]
): MktCatalogoNombreItem[] {
  if (eje === "RED") return redes;
  if (eje === "CONTENIDO") return contenidos;
  return secciones;
}

export default function MarketingObjetivosPageClient({
  objetivosIniciales,
  redes,
  contenidos,
  secciones,
  esEditor,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState<MktPublicacionObjItem[]>(objetivosIniciales);
  const [modalForm, setModalForm] = useState<ModalForm>({ open: false });
  const [destinoId, setDestinoId] = useState("");
  const [cantidadNorm, setCantidadNorm] = useState("1");
  const [pending, setPending] = useState(false);
  const [borrarTarget, setBorrarTarget] = useState<MktPublicacionObjItem | null>(null);
  const [borrando, setBorrando] = useState(false);

  const itemsPorEje = useMemo(() => {
    const map: Record<MktPubliObjEje, MktPublicacionObjItem[]> = {
      RED: [],
      CONTENIDO: [],
      SECCION: [],
    };
    for (const item of items) {
      map[item.eje].push(item);
    }
    for (const eje of MKT_PUBLI_OBJ_EJES) {
      map[eje].sort((a, b) =>
        a.destinoNombre.localeCompare(b.destinoNombre, "es", { sensitivity: "base" })
      );
    }
    return map;
  }, [items]);

  const ejeModal = modalForm.open
    ? modalForm.modo === "crear"
      ? modalForm.eje
      : modalForm.item.eje
    : null;
  const periodoModal = modalForm.open
    ? modalForm.modo === "crear"
      ? modalForm.periodo
      : modalForm.item.periodo
    : null;
  const esEdicion = modalForm.open && modalForm.modo === "editar";

  const opcionesDestino = useMemo(() => {
    if (!ejeModal) return [];
    return catalogoPorEje(ejeModal, redes, contenidos, secciones);
  }, [ejeModal, redes, contenidos, secciones]);

  const destinosConObjetivo = useMemo(() => {
    if (!ejeModal) return new Set<string>();
    return new Set(items.filter((i) => i.eje === ejeModal).map((i) => i.destinoId));
  }, [items, ejeModal]);

  const opcionesDestinoDisponibles = useMemo(
    () => opcionesDestino.filter((o) => !destinosConObjetivo.has(o.id)),
    [opcionesDestino, destinosConObjetivo]
  );

  const cargar = useCallback(async () => {
    const res = await listarMktPublicacionObjsAction();
    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron cargar los objetivos.");
      setItems([]);
      return;
    }
    setItems(res.data);
  }, []);

  useEffect(() => {
    setItems(objetivosIniciales);
  }, [objetivosIniciales]);

  function abrirCrear(eje: MktPubliObjEje, periodoAlta: MktPubliObjPeriodo) {
    if (!esEditor || pending || borrando) return;
    setDestinoId("");
    setCantidadNorm("1");
    setModalForm({ open: true, modo: "crear", eje, periodo: periodoAlta });
  }

  function abrirEditar(item: MktPublicacionObjItem) {
    if (!esEditor || pending || borrando) return;
    setDestinoId(item.destinoId);
    setCantidadNorm(String(item.cantidad));
    setModalForm({ open: true, modo: "editar", item });
  }

  function cerrarModalForm() {
    setModalForm({ open: false });
    setDestinoId("");
    setCantidadNorm("1");
  }

  function refresh() {
    router.refresh();
  }

  async function handleGuardar() {
    if (!esEditor || pending || !modalForm.open || !ejeModal || !periodoModal) return;
    const cantidad = parseCantidad(cantidadNorm);
    if (cantidad == null) {
      toast.error("Ingresá una cantidad válida (1–9999).");
      return;
    }
    setPending(true);
    try {
      if (modalForm.modo === "crear") {
        if (!destinoId) {
          toast.error("Seleccioná un destino.");
          return;
        }
        const res = await crearMktPublicacionObjAction({
          periodo: periodoModal,
          eje: ejeModal,
          destinoId,
          cantidad,
        });
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo crear el objetivo.");
          return;
        }
        toast.success("Objetivo creado.");
      } else {
        const res = await editarMktPublicacionObjAction({
          id: modalForm.item.id,
          periodo: modalForm.item.periodo,
          cantidad,
        });
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo guardar.");
          return;
        }
        toast.success("Objetivo actualizado.");
      }
      cerrarModalForm();
      await cargar();
      refresh();
    } finally {
      setPending(false);
    }
  }

  async function confirmarBorrar() {
    if (!borrarTarget || borrando) return;
    setBorrando(true);
    try {
      const res = await eliminarMktPublicacionObjAction({ id: borrarTarget.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success("Objetivo eliminado.");
      setBorrarTarget(null);
      await cargar();
      refresh();
    } finally {
      setBorrando(false);
    }
  }

  const bloqueado = pending || borrando;
  const cantidadActual = parseCantidad(cantidadNorm) ?? 1;
  const puedeGuardar =
    cantidadNorm.trim().length > 0 &&
    (esEdicion || Boolean(destinoId));

  const tituloModal =
    ejeModal && periodoModal
      ? `${esEdicion ? "Editar Objetivo" : "Nuevo Objetivo"} · ${etiquetaMktPubliObjEje(ejeModal)} · ${etiquetaMktPubliObjPeriodo(periodoModal)}`
      : esEdicion
        ? "Editar Objetivo"
        : "Nuevo Objetivo";

  function renderFila(obj: MktPublicacionObjItem) {
    return (
      <li
        key={obj.id}
        className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0"
      >
        <Target className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{obj.destinoNombre}</p>
        </div>
        {esEditor ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={BOTON_ACCION_CLASS}
              aria-label={`Editar ${obj.destinoNombre}`}
              disabled={bloqueado}
              onClick={() => abrirEditar(obj)}
            >
              <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={BOTON_ACCION_CLASS}
              aria-label={`Eliminar ${obj.destinoNombre}`}
              disabled={bloqueado}
              onClick={() => setBorrarTarget(obj)}
            >
              <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
            </Button>
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <>
      <ClassicFilteredTableLayout
        title="Marketing"
        subtitle="Objetivos"
        contentWidth="full"
      >
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-3 overflow-hidden">
          {MKT_PUBLI_OBJ_EJES.map((eje) => {
            const filas = itemsPorEje[eje];
            const titulo = etiquetaMktPubliObjEje(eje);
            return (
              <section
                key={eje}
                className="flex min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card"
                aria-label={titulo}
              >
                <header className="flex shrink-0 items-center justify-center border-b border-border bg-primary px-3 py-2 text-center">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-primary-foreground">
                    {titulo}
                  </h3>
                </header>
                <div className="grid min-h-0 flex-1 grid-rows-2 divide-y divide-border">
                  {MKT_PUBLI_OBJ_PERIODOS.map((periodoObjetivo) => {
                    const filasPeriodo = filas.filter(
                      (obj) => obj.periodo === periodoObjetivo
                    );
                    const etiquetaPeriodo =
                      periodoObjetivo === "SEMANAL" ? "SEMANALES" : "MENSUALES";
                    return (
                      <section
                        key={periodoObjetivo}
                        className="flex min-h-0 flex-col"
                        aria-label={`${titulo} ${etiquetaPeriodo}`}
                      >
                        <div className="relative flex shrink-0 items-center justify-center border-b border-primary/30 bg-primary/15 px-10 py-1.5">
                          <h4 className="text-xs font-bold uppercase tracking-wide text-primary">
                            {etiquetaPeriodo}
                          </h4>
                          {esEditor ? (
                            <Button
                              type="button"
                              variant="default"
                              size="icon"
                              className={cn(
                                "absolute inset-y-1 right-2 !h-auto !min-h-0 !w-6 rounded-sm",
                                "border border-primary-foreground/40 bg-primary !p-0.5 text-primary-foreground shadow-none",
                                "hover:bg-primary hover:text-primary-foreground hover:brightness-100"
                              )}
                              aria-label={`Agregar objetivo ${titulo} ${etiquetaPeriodo}`}
                              disabled={bloqueado}
                              onClick={() => abrirCrear(eje, periodoObjetivo)}
                            >
                              <Plus className="size-3.5" aria-hidden />
                            </Button>
                          ) : null}
                        </div>
                        <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                          {filasPeriodo.length === 0 ? (
                            <li className="px-3 py-5 text-center text-xs text-muted-foreground">
                              Sin objetivos
                            </li>
                          ) : (
                            filasPeriodo.map((obj) => renderFila(obj))
                          )}
                        </ul>
                      </section>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </ClassicFilteredTableLayout>

      <Dialog
        open={modalForm.open}
        onOpenChange={(next) => {
          if (pending) return;
          if (!next) cerrarModalForm();
        }}
      >
        <AppModal
          title={tituloModal}
          size="md"
          scrollBody
          hideBodyScrollbars
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={cerrarModalForm}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={pending || !puedeGuardar}
                onClick={() => void handleGuardar()}
              >
                {esEdicion ? "Guardar" : "Crear"}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            <ModalMicroLabel>
              {esEdicion ? "Editar Objetivo" : "Nuevo Objetivo"}
            </ModalMicroLabel>
            {esEdicion && modalForm.open && modalForm.modo === "editar" ? (
              <Input
                value={modalForm.item.destinoNombre}
                readOnly
                disabled
                aria-label="Destino"
                className="w-full"
              />
            ) : (
              <Select
                value={destinoId ?? ""}
                onValueChange={setDestinoId}
                disabled={pending || opcionesDestinoDisponibles.length === 0}
              >
                <SelectTrigger className="w-full" aria-label="Destino">
                  <SelectValue
                    placeholder={
                      opcionesDestino.length === 0
                        ? "SIN OPCIONES"
                        : opcionesDestinoDisponibles.length === 0
                          ? "TODOS CON OBJETIVO"
                          : "DESTINO"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {opcionesDestinoDisponibles.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className={cn("flex w-full items-center justify-center gap-2")}>
              <Button
                type="button"
                variant="default"
                size="icon"
                className={cn("shrink-0")}
                disabled={pending || cantidadActual <= 1}
                aria-label="Disminuir cantidad"
                onClick={() => setCantidadNorm(String(Math.max(1, cantidadActual - 1)))}
              >
                <Minus className="size-4" aria-hidden />
              </Button>
              <Input
                value={cantidadNorm}
                onChange={(e) => setCantidadNorm(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                placeholder="CANTIDAD"
                disabled={pending}
                className={cn("w-1/4 min-w-0 flex-none text-center tabular-nums")}
                aria-label="Cantidad de publicaciones"
              />
              <Button
                type="button"
                variant="default"
                size="icon"
                className={cn("shrink-0")}
                disabled={pending || cantidadActual >= 9999}
                aria-label="Aumentar cantidad"
                onClick={() =>
                  setCantidadNorm(String(Math.min(9999, cantidadActual + 1)))
                }
              >
                <Plus className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        </AppModal>
      </Dialog>

      <Dialog
        open={Boolean(borrarTarget)}
        onOpenChange={(o) => !o && !borrando && setBorrarTarget(null)}
      >
        <AppModal
          title="Eliminar Objetivo"
          size="sm"
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={borrando}
                onClick={() => setBorrarTarget(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={borrando}
                onClick={() => void confirmarBorrar()}
              >
                Eliminar
              </Button>
            </div>
          }
        >
          <p className="text-sm text-muted-foreground">
            ¿Eliminar el objetivo de{" "}
            <span className="font-semibold text-foreground">{borrarTarget?.destinoNombre}</span>?
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
