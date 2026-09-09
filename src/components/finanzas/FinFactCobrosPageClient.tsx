"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RefreshCw, Store } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FilterBar, {
  FILTER_COUNT_CLASS,
  FILTER_SELECT_WRAPPER_CLASS,
  SELECT_TRIGGER_FILTER_CLASS,
  FiltroIndividualContainer,
  FilaFiltrosDesplegables,
  FilterRowSelection,
} from "@/components/FilterBar";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import TablaFinFactCobros from "@/components/finanzas/TablaFinFactCobros";
import GestionarGlobalPtoVtasModal from "@/components/finanzas/GestionarGlobalPtoVtasModal";
import type { FinFactCobrosPtoVtaFila } from "@/services/finFactCobros.service";
import type { GlobalPtoVtaItem, GlobalPtoVtaSucursalOption } from "@/lib/globalPtoVtas";
import { cn } from "@/lib/utils";

const MESES_CALENDARIO: { valor: number; etiqueta: string }[] = [
  { valor: 1, etiqueta: "ENERO" },
  { valor: 2, etiqueta: "FEBRERO" },
  { valor: 3, etiqueta: "MARZO" },
  { valor: 4, etiqueta: "ABRIL" },
  { valor: 5, etiqueta: "MAYO" },
  { valor: 6, etiqueta: "JUNIO" },
  { valor: 7, etiqueta: "JULIO" },
  { valor: 8, etiqueta: "AGOSTO" },
  { valor: 9, etiqueta: "SEPTIEMBRE" },
  { valor: 10, etiqueta: "OCTUBRE" },
  { valor: 11, etiqueta: "NOVIEMBRE" },
  { valor: 12, etiqueta: "DICIEMBRE" },
];

const ANIO_MIN = 2020;
const ANIO_MAX = 2046;
const ANIOS = Array.from({ length: ANIO_MAX - ANIO_MIN + 1 }, (_, i) => ANIO_MIN + i);

interface Props {
  filas: FinFactCobrosPtoVtaFila[];
  mes: number;
  anio: number;
  mesActual: number;
  anioActual: number;
  esEditor: boolean;
  ptoVtas: GlobalPtoVtaItem[];
  sucursales: GlobalPtoVtaSucursalOption[];
}

export default function FinFactCobrosPageClient({
  filas,
  mes,
  anio,
  mesActual,
  anioActual,
  esEditor,
  ptoVtas,
  sucursales,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [syncing, setSyncing] = useState(false);
  const [openPtoVtas, setOpenPtoVtas] = useState(false);
  const cantPtoVtas = new Set(filas.map((f) => f.ptoVtaId)).size;

  function navigate(next: { mes?: number; anio?: number }) {
    const p = new URLSearchParams();
    p.set("mes", String(next.mes ?? mes));
    p.set("anio", String(next.anio ?? anio));
    router.push(`${pathname}?${p.toString()}`);
  }

  async function sincronizar() {
    setSyncing(true);
    try {
      let continuing = true;
      let first = true;
      while (continuing) {
        const res = await fetch("/api/sync-facturas-ventas-dux", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mes,
            anio,
            continuing: !first,
          }),
        });
        const json: {
          ok?: boolean;
          error?: string;
          continuing?: boolean;
        } = (await res.json()) as {
          ok?: boolean;
          error?: string;
          continuing?: boolean;
        };
        if (!res.ok || !json.ok) {
          toast.error(json.error ?? "No se pudo sincronizar remitos.");
          return;
        }
        first = false;
        continuing = json.continuing === true;
      }
      toast.success("Remitos sincronizados.");
      router.refresh();
    } catch {
      toast.error("No se pudo sincronizar remitos.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="area-page-shell bg-gris">
      <ClassicFilteredTableLayout
        title="VTAS. & COBROS"
        subtitle="Ptos. Vtas"
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilterRowSelection>
              <FilaFiltrosDesplegables>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={mes !== mesActual}
                  onLimpiar={() => navigate({ mes: mesActual })}
                >
                  <Select
                    value={String(mes)}
                    onValueChange={(v) => navigate({ mes: Number(v) })}
                  >
                    <SelectTrigger
                      id="filtro-fact-cobros-mes"
                      className={SELECT_TRIGGER_FILTER_CLASS}
                    >
                      <SelectValue placeholder="MES" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {MESES_CALENDARIO.map((m) => (
                        <SelectItem key={m.valor} value={String(m.valor)}>
                          {m.etiqueta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={anio !== anioActual}
                  onLimpiar={() => navigate({ anio: anioActual })}
                >
                  <Select
                    value={String(anio)}
                    onValueChange={(v) => navigate({ anio: Number(v) })}
                  >
                    <SelectTrigger
                      id="filtro-fact-cobros-anio"
                      className={SELECT_TRIGGER_FILTER_CLASS}
                    >
                      <SelectValue placeholder="AÑO" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {ANIOS.map((a) => (
                        <SelectItem key={a} value={String(a)}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
              </FilaFiltrosDesplegables>
            </FilterRowSelection>
            <span className={cn(FILTER_COUNT_CLASS, "ml-auto")}>
              {cantPtoVtas.toLocaleString("es-AR")} PTO. VTA.
              {cantPtoVtas !== 1 ? "S" : ""}
            </span>
          </FilterBar>
        }
        actions={
          <div className="flex items-center gap-2">
            <ToolbarActionButton
              type="button"
              icon={<Store />}
              label="Ptos. Vta."
              onClick={() => setOpenPtoVtas(true)}
            />
            {esEditor ? (
              <ToolbarActionButton
                type="button"
                icon={<RefreshCw />}
                label="Sincronizar"
                loading={syncing}
                onClick={() => void sincronizar()}
              />
            ) : null}
          </div>
        }
      >
        <TablaFinFactCobros filas={filas} />
      </ClassicFilteredTableLayout>
      <GestionarGlobalPtoVtasModal
        open={openPtoVtas}
        onOpenChange={setOpenPtoVtas}
        itemsIniciales={ptoVtas}
        sucursales={sucursales}
        esEditor={esEditor}
        onCatalogoChanged={() => router.refresh()}
      />
    </div>
  );
}
