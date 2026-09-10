"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Settings2 } from "lucide-react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import TablaFinAnaCosFina, { type FinAnaCosFinaFila } from "@/components/finanzas/TablaFinAnaCosFina";
import GestionarTerminalesFinAnaCosFinaModal from "@/components/finanzas/GestionarTerminalesFinAnaCosFinaModal";
import GestionarPagosFinAnaCosFinaModal from "@/components/finanzas/GestionarPagosFinAnaCosFinaModal";
import CalculoCxTotalFinAnaCosFinaModal from "@/components/finanzas/CalculoCxTotalFinAnaCosFinaModal";
import FilterBar, {
  FILTER_COUNT_CLASS,
  FILTER_INLINE_ACTION_SLOT_CLASS,
  FILTER_SELECT_WRAPPER_CLASS,
  FiltroIndividualContainer,
  FilaFiltrosDesplegables,
  FilterRowSelection,
  LimpiarFiltrosButton,
} from "@/components/FilterBar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { filtrarPagosCostosFinancieros, type FinAnaCosFinaPagoItem } from "@/lib/finAnaCosFinaPagos";
import type { FinAnaCosFinaTerminalItem } from "@/lib/finAnaCosFinaTerminales";

interface Props {
  filas: FinAnaCosFinaFila[];
  terminales: FinAnaCosFinaTerminalItem[];
  pagos: FinAnaCosFinaPagoItem[];
  esEditor: boolean;
}

function etiquetaFiltroMayusculas(texto: string): string {
  return texto.toLocaleUpperCase("es");
}

export default function FinAnaCosFinaPageClient({ filas, terminales, pagos, esEditor }: Props) {
  const router = useRouter();
  const pagosCostos = useMemo(() => filtrarPagosCostosFinancieros(pagos), [pagos]);
  const [filasOverrides, setFilasOverrides] = useState<Record<string, FinAnaCosFinaFila>>({});
  const [filtroTerminalId, setFiltroTerminalId] = useState("");
  const [filtroPago, setFiltroPago] = useState("");
  const [filtroHabilitado, setFiltroHabilitado] = useState("");
  const [openGestionarTerminales, setOpenGestionarTerminales] = useState(false);
  const [openGestionarPagos, setOpenGestionarPagos] = useState(false);
  const [openCalculoCxTotal, setOpenCalculoCxTotal] = useState(false);

  const filasState = useMemo(
    () => filas.map((fila) => filasOverrides[fila.id] ?? fila),
    [filas, filasOverrides]
  );

  const filasFiltradas = useMemo(
    () =>
      filasState.filter((fila) => {
        if (filtroTerminalId && fila.terminalId !== filtroTerminalId) return false;
        if (filtroPago && fila.pagoId !== filtroPago) return false;
        if (filtroHabilitado === "si" && !fila.habilitado) return false;
        if (filtroHabilitado === "no" && fila.habilitado) return false;
        return true;
      }),
    [filasState, filtroTerminalId, filtroPago, filtroHabilitado]
  );

  function limpiarFiltros() {
    setFiltroTerminalId("");
    setFiltroPago("");
    setFiltroHabilitado("");
  }

  function handleFilaActualizada(fila: FinAnaCosFinaFila) {
    setFilasOverrides((prev) => ({ ...prev, [fila.id]: fila }));
  }

  function handleCatalogoTerminalesChanged() {
    setFilasOverrides({});
    router.refresh();
  }

  function handleCatalogoPagosChanged() {
    setFilasOverrides({});
    router.refresh();
  }

  return (
    <>
      <ClassicFilteredTableLayout
        title="VTAS. & COBROS"
        subtitle="Cx. Fin. Cobros"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              onClick={() => setOpenCalculoCxTotal(true)}
              className="h-10 gap-2 px-4"
            >
              <Calculator className="size-4 shrink-0" aria-hidden />
              Cálculo Cx. Total
            </Button>
            <Button
              type="button"
              onClick={() => setOpenGestionarPagos(true)}
              className="h-10 gap-2 px-4"
            >
              <Settings2 className="size-4 shrink-0" aria-hidden />
              Gestionar Pagos
            </Button>
            <Button
              type="button"
              onClick={() => setOpenGestionarTerminales(true)}
              className="h-10 gap-2 px-4"
            >
              <Settings2 className="size-4 shrink-0" aria-hidden />
              Gestionar Terminales
            </Button>
          </div>
        }
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilterRowSelection>
              <FilaFiltrosDesplegables>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtroTerminalId)}
                  onLimpiar={() => setFiltroTerminalId("")}
                >
                  <Select
                    value={filtroTerminalId ?? ""}
                    onValueChange={(value) => setFiltroTerminalId(value)}
                  >
                    <SelectTrigger className="input-filtro-unificado">
                      <SelectValue placeholder="TERMINAL" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {terminales.map((terminal) => (
                        <SelectItem key={terminal.id} value={terminal.id}>
                          {etiquetaFiltroMayusculas(terminal.nombre)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtroPago)}
                  onLimpiar={() => setFiltroPago("")}
                >
                  <Select value={filtroPago ?? ""} onValueChange={(value) => setFiltroPago(value)}>
                    <SelectTrigger className="input-filtro-unificado">
                      <SelectValue placeholder="PAGO" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {pagosCostos.map((pago) => (
                        <SelectItem key={pago.id} value={pago.id}>
                          {etiquetaFiltroMayusculas(pago.nombre)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={filtroHabilitado === "si" || filtroHabilitado === "no"}
                  onLimpiar={() => setFiltroHabilitado("")}
                >
                  <Select
                    value={filtroHabilitado ?? ""}
                    onValueChange={(value) => setFiltroHabilitado(value)}
                  >
                    <SelectTrigger className="input-filtro-unificado">
                      <SelectValue placeholder="HABILITADO" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      <SelectItem value="si">HABILITADO</SelectItem>
                      <SelectItem value="no">NO HABILITADO</SelectItem>
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                <div className={cn(FILTER_INLINE_ACTION_SLOT_CLASS, "col-span-2")}>
                  <span className={cn(FILTER_COUNT_CLASS, "ml-auto")}>
                    {filasFiltradas.length} COMBINACIÓN(ES)
                  </span>
                  <LimpiarFiltrosButton onClick={limpiarFiltros} />
                </div>
              </FilaFiltrosDesplegables>
            </FilterRowSelection>
          </FilterBar>
        }
        filtersAriaLabel="Filtros de costos financieros"
      >
        <TablaFinAnaCosFina
          filas={filasFiltradas}
          esEditor={esEditor}
          onFilaActualizada={handleFilaActualizada}
        />
      </ClassicFilteredTableLayout>

      <GestionarPagosFinAnaCosFinaModal
        open={openGestionarPagos}
        onOpenChange={setOpenGestionarPagos}
        pagosIniciales={pagos}
        esEditor={esEditor}
        onCatalogoChanged={handleCatalogoPagosChanged}
      />

      <GestionarTerminalesFinAnaCosFinaModal
        open={openGestionarTerminales}
        onOpenChange={setOpenGestionarTerminales}
        terminalesIniciales={terminales}
        esEditor={esEditor}
        onCatalogoChanged={handleCatalogoTerminalesChanged}
      />

      <CalculoCxTotalFinAnaCosFinaModal open={openCalculoCxTotal} onOpenChange={setOpenCalculoCxTotal} />
    </>
  );
}
