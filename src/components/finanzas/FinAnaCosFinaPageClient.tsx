"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Settings2 } from "lucide-react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import TablaFinAnaCosFina, { type FinAnaCosFinaFila } from "@/components/finanzas/TablaFinAnaCosFina";
import GestionarMarcasFinAnaCosFinaModal from "@/components/finanzas/GestionarMarcasFinAnaCosFinaModal";
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
import type { FinAnaCosFinaTerminalMarcaItem } from "@/lib/finAnaCosFinaTerminalesMarcas";

interface Props {
  filas: FinAnaCosFinaFila[];
  marcas: FinAnaCosFinaTerminalMarcaItem[];
  pagos: FinAnaCosFinaPagoItem[];
  esEditor: boolean;
}

function etiquetaFiltroMayusculas(texto: string): string {
  return texto.toLocaleUpperCase("es");
}

export default function FinAnaCosFinaPageClient({
  filas,
  marcas,
  pagos,
  esEditor,
}: Props) {
  const router = useRouter();
  const pagosCostos = useMemo(() => filtrarPagosCostosFinancieros(pagos), [pagos]);
  const [filasOverrides, setFilasOverrides] = useState<Record<string, FinAnaCosFinaFila>>({});
  const [filtroTerminalId, setFiltroTerminalId] = useState("");
  const [filtroPago, setFiltroPago] = useState("");
  const [filtroHabilitado, setFiltroHabilitado] = useState("");
  const [openGestionarMarcas, setOpenGestionarMarcas] = useState(false);
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

  function handleCatalogoMarcasChanged() {
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
              onClick={() => setOpenGestionarMarcas(true)}
              className="h-10 gap-2 px-4"
            >
              <Settings2 className="size-4 shrink-0" aria-hidden />
              Gestionar Marcas
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
                      <SelectValue placeholder="MARCA" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {marcas.map((marca) => (
                        <SelectItem key={marca.id} value={marca.id}>
                          {etiquetaFiltroMayusculas(marca.nombre)}
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

      <GestionarMarcasFinAnaCosFinaModal
        open={openGestionarMarcas}
        onOpenChange={setOpenGestionarMarcas}
        marcasIniciales={marcas}
        esEditor={esEditor}
        onCatalogoChanged={handleCatalogoMarcasChanged}
      />

      <CalculoCxTotalFinAnaCosFinaModal open={openCalculoCxTotal} onOpenChange={setOpenCalculoCxTotal} />
    </>
  );
}
