"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings2 } from "lucide-react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import CrearEditarMktPublicacionModal from "@/components/marketing/CrearEditarMktPublicacionModal";
import EliminarMktPublicacionModal from "@/components/marketing/EliminarMktPublicacionModal";
import GestionarMktCatalogoNombreModal from "@/components/marketing/GestionarMktCatalogoNombreModal";
import MktCalendarioPublicacionesGrid from "@/components/marketing/MktCalendarioPublicacionesGrid";
import MktPublicacionesCuadroMando from "@/components/marketing/MktPublicacionesCuadroMando";
import MktPublicacionesDiaModal from "@/components/marketing/MktPublicacionesDiaModal";
import { Button } from "@/components/ui/button";
import type { MktCatalogoNombreItem } from "@/lib/mktPublicacionesCatalogo";
import type { MktIdeaSeccionItem } from "@/lib/mktPublicacionesIdeas";
import type { MktPublicacionCalendarioItem } from "@/lib/mktPublicaciones";
import {
  evaluarMktPublicacionObjsCliente,
  periodoObjParaSemanaFiltro,
  type MktPublicacionObjItem,
} from "@/lib/mktPublicacionesObj";
import {
  mesAnioActualArgentina,
  type MktCalendarioMesAnio,
} from "@/lib/mktCalendarioPublicaciones";
import {
  calcularCuadroMandoPublicaciones,
  filtrarPublicacionesPorVistaCalendario,
  type MktCuadroMandoSemanaFiltro,
} from "@/lib/mktPublicacionesEstadisticas";

interface Props {
  redesIniciales: MktCatalogoNombreItem[];
  contenidosIniciales: MktCatalogoNombreItem[];
  seccionesIdeas: MktIdeaSeccionItem[];
  objetivosIniciales: MktPublicacionObjItem[];
  publicaciones: MktPublicacionCalendarioItem[];
  esEditor: boolean;
}

type ModalForm =
  | { open: false }
  | {
      open: true;
      modo: "crear" | "editar";
      fechaIso: string;
      item?: MktPublicacionCalendarioItem;
    };

type ModalDia = { open: false } | { open: true; fechaIso: string };

type ModalEliminar =
  | { open: false }
  | { open: true; id: string; label: string };

export default function MarketingCalendarioPageClient({
  redesIniciales,
  contenidosIniciales,
  seccionesIdeas,
  objetivosIniciales,
  publicaciones,
  esEditor,
}: Props) {
  const router = useRouter();
  const [openRedes, setOpenRedes] = useState(false);
  const [openContenidos, setOpenContenidos] = useState(false);

  const [mesVista, setMesVista] = useState<MktCalendarioMesAnio>(() =>
    mesAnioActualArgentina()
  );
  const [semanaFiltro, setSemanaFiltro] =
    useState<MktCuadroMandoSemanaFiltro>("TODAS");
  const [modalDia, setModalDia] = useState<ModalDia>({ open: false });
  const [modalForm, setModalForm] = useState<ModalForm>({ open: false });
  const [modalEliminar, setModalEliminar] = useState<ModalEliminar>({ open: false });

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const publicacionesPeriodo = useMemo(
    () => filtrarPublicacionesPorVistaCalendario(publicaciones, mesVista, semanaFiltro),
    [publicaciones, mesVista, semanaFiltro]
  );

  const stats = useMemo(
    () => calcularCuadroMandoPublicaciones(publicacionesPeriodo, redesIniciales),
    [publicacionesPeriodo, redesIniciales]
  );

  const evaluacionesObjetivos = useMemo(
    () =>
      evaluarMktPublicacionObjsCliente(
        objetivosIniciales,
        publicacionesPeriodo,
        periodoObjParaSemanaFiltro(semanaFiltro)
      ),
    [objetivosIniciales, publicacionesPeriodo, semanaFiltro]
  );

  const publicacionesDelDia = useMemo(() => {
    if (!modalDia.open) return [];
    return publicaciones.filter((p) => p.fechaIso === modalDia.fechaIso);
  }, [modalDia, publicaciones]);

  function handleSeleccionarDia(fechaIso: string) {
    const hay = publicaciones.some((p) => p.fechaIso === fechaIso);
    if (!hay) {
      if (!esEditor) return;
      setModalForm({ open: true, modo: "crear", fechaIso });
      return;
    }
    setModalDia({ open: true, fechaIso });
  }

  return (
    <>
      <ClassicFilteredTableLayout
        title="Marketing"
        subtitle="Calendario"
        contentWidth="full"
        actions={
          esEditor ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="default"
                className="h-10 gap-2 px-4"
                onClick={() => setOpenRedes(true)}
              >
                <Settings2 className="size-4 shrink-0" aria-hidden />
                Gestionar Redes
              </Button>
              <Button
                type="button"
                variant="default"
                className="h-10 gap-2 px-4"
                onClick={() => setOpenContenidos(true)}
              >
                <Settings2 className="size-4 shrink-0" aria-hidden />
                Gestionar Tipo Contenido
              </Button>
            </div>
          ) : null
        }
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <MktPublicacionesCuadroMando
            stats={stats}
            evaluacionesObjetivos={evaluacionesObjetivos}
            mesVista={mesVista}
            onMesVistaChange={(next) => {
              setMesVista(next);
              setSemanaFiltro("TODAS");
            }}
            semana={semanaFiltro}
            onSemanaChange={setSemanaFiltro}
          />
          <MktCalendarioPublicacionesGrid
            publicaciones={publicaciones}
            objetivos={objetivosIniciales}
            onSeleccionarDia={handleSeleccionarDia}
            mesVista={mesVista}
            semanaSeleccionada={semanaFiltro}
          />
        </div>
      </ClassicFilteredTableLayout>

      <MktPublicacionesDiaModal
        open={modalDia.open}
        onOpenChange={(o) => !o && setModalDia({ open: false })}
        fechaIso={modalDia.open ? modalDia.fechaIso : ""}
        publicaciones={publicacionesDelDia}
        esEditor={esEditor}
        onCrearNueva={() => {
          if (!modalDia.open) return;
          setModalForm({ open: true, modo: "crear", fechaIso: modalDia.fechaIso });
        }}
        onEditar={(item) => {
          setModalForm({
            open: true,
            modo: "editar",
            fechaIso: item.fechaIso,
            item,
          });
        }}
        onEliminar={(item) => {
          setModalEliminar({
            open: true,
            id: item.id,
            label: item.publicacion,
          });
        }}
      />

      <CrearEditarMktPublicacionModal
        open={modalForm.open}
        onOpenChange={(o) => !o && setModalForm({ open: false })}
        modo={modalForm.open ? modalForm.modo : "crear"}
        fechaIso={modalForm.open ? modalForm.fechaIso : ""}
        redes={redesIniciales}
        contenidos={contenidosIniciales}
        seccionesIdeas={seccionesIdeas}
        onIdeasChange={refresh}
        item={modalForm.open ? (modalForm.item ?? null) : null}
        onSuccess={refresh}
      />

      <EliminarMktPublicacionModal
        open={modalEliminar.open}
        onOpenChange={(o) => !o && setModalEliminar({ open: false })}
        id={modalEliminar.open ? modalEliminar.id : null}
        label={modalEliminar.open ? modalEliminar.label : null}
        onSuccess={() => {
          const eliminadoId = modalEliminar.open ? modalEliminar.id : null;
          const diaIso = modalDia.open ? modalDia.fechaIso : null;
          refresh();
          if (diaIso && eliminadoId) {
            const restantes = publicaciones.filter(
              (p) => p.fechaIso === diaIso && p.id !== eliminadoId
            );
            if (restantes.length === 0) {
              setModalDia({ open: false });
            }
          }
        }}
      />

      <GestionarMktCatalogoNombreModal
        open={openRedes}
        onOpenChange={setOpenRedes}
        kind="red"
        itemsIniciales={redesIniciales}
        esEditor={esEditor}
        onCatalogoChanged={refresh}
      />
      <GestionarMktCatalogoNombreModal
        open={openContenidos}
        onOpenChange={setOpenContenidos}
        kind="contenido"
        itemsIniciales={contenidosIniciales}
        esEditor={esEditor}
        onCatalogoChanged={refresh}
      />
    </>
  );
}
