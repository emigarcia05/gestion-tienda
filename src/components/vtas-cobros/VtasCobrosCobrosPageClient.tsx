"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import FilterBar, {
  FILTER_SELECT_WRAPPER_CLASS,
  SELECT_TRIGGER_FILTER_CLASS,
  FilaFiltrosDesplegables,
  FiltroIndividualContainer,
  FilterRowSelection,
} from "@/components/FilterBar";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EmptyTableRow,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";

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
  mes: number;
  anio: number;
  mesActual: number;
  anioActual: number;
  esEditor: boolean;
}

export default function VtasCobrosCobrosPageClient({
  mes,
  anio,
  mesActual,
  anioActual,
  esEditor,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [consultando, setConsultando] = useState(false);

  function navigate(next: { mes?: number; anio?: number }) {
    const p = new URLSearchParams();
    p.set("mes", String(next.mes ?? mes));
    p.set("anio", String(next.anio ?? anio));
    router.push(`${pathname}?${p.toString()}`);
  }

  async function consultarCobros() {
    setConsultando(true);
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
        const json: { ok?: boolean; error?: string; continuing?: boolean } = (await res.json()) as {
          ok?: boolean;
          error?: string;
          continuing?: boolean;
        };
        if (!res.ok || !json.ok) {
          toast.error(json.error ?? "No se pudo consultar cobros.");
          return;
        }
        first = false;
        continuing = json.continuing === true;
      }

      toast.success("Consulta de cobros finalizada.");
      router.refresh();
    } catch {
      toast.error("No se pudo consultar cobros.");
    } finally {
      setConsultando(false);
    }
  }

  return (
    <div className="area-page-shell bg-gris">
      <ClassicFilteredTableLayout
        title="VTAS. & COBROS"
        subtitle="Cobros"
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
          </FilterBar>
        }
        actions={
          esEditor ? (
            <ToolbarActionButton
              type="button"
              icon={<RefreshCw />}
              label="Consultar"
              loading={consultando}
              onClick={() => void consultarCobros()}
            />
          ) : null
        }
      >
        <div className="contenedor-tabla-gestion flex-1 min-h-0">
          <Table variant="compact">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-left">CONSULTA DE COBROS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <EmptyTableRow
                colSpan={1}
                message="USÁ CONSULTAR PARA TRAER EL PERIODO SELECCIONADO EN CADA SUCURSAL ASOCIADA."
              />
            </TableBody>
          </Table>
        </div>
      </ClassicFilteredTableLayout>
    </div>
  );
}
