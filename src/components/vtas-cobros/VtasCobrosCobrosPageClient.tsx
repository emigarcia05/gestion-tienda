"use client";

import { usePathname, useRouter } from "next/navigation";
import FilterBar, {
  FILTER_COUNT_CLASS,
  FILTER_SELECT_WRAPPER_CLASS,
  SELECT_TRIGGER_FILTER_CLASS,
  FilaFiltrosDesplegables,
  FiltroIndividualContainer,
  FilterRowSelection,
} from "@/components/FilterBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import TablaFinVtasCobros from "@/components/vtas-cobros/TablaFinVtasCobros";
import type { FinVtasCobroFila } from "@/services/finVtasCobros.service";
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
  filas: FinVtasCobroFila[];
  mes: number;
  anio: number;
  mesActual: number;
  anioActual: number;
}

export default function VtasCobrosCobrosPageClient({
  filas,
  mes,
  anio,
  mesActual,
  anioActual,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function navigate(next: { mes?: number; anio?: number }) {
    const p = new URLSearchParams();
    p.set("mes", String(next.mes ?? mes));
    p.set("anio", String(next.anio ?? anio));
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="area-page-shell bg-gris">
      <ClassicFilteredTableLayout
        title="VTAS. & COBROS"
        subtitle="Cobros"
        contentWidth="full"
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilterRowSelection>
              <FilaFiltrosDesplegables>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={mes !== mesActual}
                  onLimpiar={() => navigate({ mes: mesActual })}
                >
                  <Select value={String(mes)} onValueChange={(v) => navigate({ mes: Number(v) })}>
                    <SelectTrigger id="filtro-cobros-mes" className={SELECT_TRIGGER_FILTER_CLASS}>
                      <SelectValue placeholder="MES" />
                    </SelectTrigger>
                    <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
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
                  <Select value={String(anio)} onValueChange={(v) => navigate({ anio: Number(v) })}>
                    <SelectTrigger id="filtro-cobros-anio" className={SELECT_TRIGGER_FILTER_CLASS}>
                      <SelectValue placeholder="AÑO" />
                    </SelectTrigger>
                    <SelectContent position="popper" side="bottom" align="start" className="select-content-filtro">
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
              {filas.length.toLocaleString("es-AR")} COBRO
              {filas.length !== 1 ? "S" : ""}
            </span>
          </FilterBar>
        }
      >
        <TablaFinVtasCobros filas={filas} />
      </ClassicFilteredTableLayout>
    </div>
  );
}
