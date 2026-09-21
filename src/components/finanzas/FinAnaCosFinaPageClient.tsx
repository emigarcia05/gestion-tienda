"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Settings2 } from "lucide-react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import TablaFinAnaCosFina, { type FinAnaCosFinaFila } from "@/components/finanzas/TablaFinAnaCosFina";
import GestionarMarcasFinAnaCosFinaModal from "@/components/finanzas/GestionarMarcasFinAnaCosFinaModal";
import GestionarPagosFinAnaCosFinaModal from "@/components/finanzas/GestionarPagosFinAnaCosFinaModal";
<<<<<<< HEAD
import GestionarBancosCobrosModal from "@/components/finanzas/GestionarBancosCobrosModal";
=======
import GestionarCuotasFinAnaCosFinaModal from "@/components/finanzas/GestionarCuotasFinAnaCosFinaModal";
>>>>>>> facturacion
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
<<<<<<< HEAD
import type { CobrosBancoItem } from "@/lib/cobrosBancos";
=======
import type { CobrosCuotaItem } from "@/lib/cobrosCuotas";
>>>>>>> facturacion

interface Props {
  filas: FinAnaCosFinaFila[];
  marcas: FinAnaCosFinaTerminalMarcaItem[];
  pagos: FinAnaCosFinaPagoItem[];
<<<<<<< HEAD
  bancos: CobrosBancoItem[];
=======
  cuotas: CobrosCuotaItem[];
>>>>>>> facturacion
  esEditor: boolean;
}

function etiquetaFiltroMayusculas(texto: string): string {
  return texto.toLocaleUpperCase("es");
}

export default function FinAnaCosFinaPageClient({
  filas,
  marcas,
  pagos,
<<<<<<< HEAD
  bancos,
=======
  cuotas,
>>>>>>> facturacion
  esEditor,
}: Props) {
  const router = useRouter();
  const pagosCostos = useMemo(() => filtrarPagosCostosFinancieros(pagos), [pagos]);
  const [filasOverrides, setFilasOverrides] = useState<Record<string, FinAnaCosFinaFila>>({});
  const [filtroHabilitado, setFiltroHabilitado] = useState("");
  const [filtroPago, setFiltroPago] = useState("");
  const [filtroTerminalId, setFiltroTerminalId] = useState("");
  const [filtroCuotaId, setFiltroCuotaId] = useState("");
  const [filtroImpCheque, setFiltroImpCheque] = useState("");
  const [openGestionarMarcas, setOpenGestionarMarcas] = useState(false);
  const [openGestionarPagos, setOpenGestionarPagos] = useState(false);
<<<<<<< HEAD
  const [openGestionarBancos, setOpenGestionarBancos] = useState(false);
=======
  const [openGestionarCuotas, setOpenGestionarCuotas] = useState(false);
>>>>>>> facturacion
  const [openCalculoCxTotal, setOpenCalculoCxTotal] = useState(false);

  const filasState = useMemo(
    () => filas.map((fila) => filasOverrides[fila.id] ?? fila),
    [filas, filasOverrides]
  );

  const filasFiltradas = useMemo(
    () =>
      filasState.filter((fila) => {
        if (filtroHabilitado === "si" && !fila.habilitado) return false;
        if (filtroHabilitado === "no" && fila.habilitado) return false;
        if (filtroPago && fila.pagoId !== filtroPago) return false;
        if (filtroTerminalId && fila.terminalId !== filtroTerminalId) return false;
        if (filtroCuotaId && fila.cuotaId !== filtroCuotaId) return false;
        if (filtroImpCheque === "si" && !fila.impCheque) return false;
        if (filtroImpCheque === "no" && fila.impCheque) return false;
        return true;
      }),
    [filasState, filtroHabilitado, filtroPago, filtroTerminalId, filtroCuotaId, filtroImpCheque]
  );

  function limpiarFiltros() {
    setFiltroHabilitado("");
    setFiltroPago("");
    setFiltroTerminalId("");
    setFiltroCuotaId("");
    setFiltroImpCheque("");
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

<<<<<<< HEAD
  function handleCatalogoBancosChanged() {
=======
  function handleCatalogoCuotasChanged() {
    setFilasOverrides({});
>>>>>>> facturacion
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
              Gestionar Formas Pago
            </Button>
            <Button
              type="button"
              onClick={() => setOpenGestionarBancos(true)}
              className="h-10 gap-2 px-4"
            >
              <Settings2 className="size-4 shrink-0" aria-hidden />
              Gestionar Bancos
            </Button>
            <Button
              type="button"
              onClick={() => setOpenGestionarMarcas(true)}
              className="h-10 gap-2 px-4"
            >
              <Settings2 className="size-4 shrink-0" aria-hidden />
              Gestionar Entidades
            </Button>
            <Button
              type="button"
              onClick={() => setOpenGestionarCuotas(true)}
              className="h-10 gap-2 px-4"
            >
              <Settings2 className="size-4 shrink-0" aria-hidden />
              Gestionar Cuotas
            </Button>
          </div>
        }
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilterRowSelection className="flex-nowrap">
              <div className="min-w-0 flex-1">
                <FilaFiltrosDesplegables>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={filtroHabilitado === "si" || filtroHabilitado === "no"}
                  onLimpiar={() => setFiltroHabilitado("")}
                >
                  <Select
                    value={filtroHabilitado ?? ""}
                    onValueChange={(value) => setFiltroHabilitado(value)}
                  >
                    <SelectTrigger className="input-filtro-unificado" aria-label="Habilitado">
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
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtroPago)}
                  onLimpiar={() => setFiltroPago("")}
                >
                  <Select value={filtroPago ?? ""} onValueChange={(value) => setFiltroPago(value)}>
                    <SelectTrigger className="input-filtro-unificado" aria-label="Forma de pago">
                      <SelectValue placeholder="FORMA DE PAGO" />
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
                  activo={Boolean(filtroTerminalId)}
                  onLimpiar={() => setFiltroTerminalId("")}
                >
                  <Select
                    value={filtroTerminalId ?? ""}
                    onValueChange={(value) => setFiltroTerminalId(value)}
                  >
                    <SelectTrigger className="input-filtro-unificado" aria-label="Entidad">
                      <SelectValue placeholder="ENTIDAD" />
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
                  activo={Boolean(filtroCuotaId)}
                  onLimpiar={() => setFiltroCuotaId("")}
                >
                  <Select
                    value={filtroCuotaId ?? ""}
                    onValueChange={(value) => setFiltroCuotaId(value)}
                  >
                    <SelectTrigger className="input-filtro-unificado" aria-label="Cuotas">
                      <SelectValue placeholder="CUOTAS" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {cuotas.map((cuota) => (
                        <SelectItem key={cuota.id} value={cuota.id}>
                          {etiquetaFiltroMayusculas(cuota.cuotas)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={filtroImpCheque === "si" || filtroImpCheque === "no"}
                  onLimpiar={() => setFiltroImpCheque("")}
                >
                  <Select
                    value={filtroImpCheque ?? ""}
                    onValueChange={(value) => setFiltroImpCheque(value)}
                  >
                    <SelectTrigger className="input-filtro-unificado" aria-label="Imp. cheque">
                      <SelectValue placeholder="IMP. CHEQUE" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      <SelectItem value="si">SI</SelectItem>
                      <SelectItem value="no">NO</SelectItem>
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                </FilaFiltrosDesplegables>
              </div>
              <div className={cn(FILTER_INLINE_ACTION_SLOT_CLASS, "shrink-0 gap-2")}>
                <span className={FILTER_COUNT_CLASS}>
                  {filasFiltradas.length.toLocaleString("es-AR")} COMBINACIÓN
                  {filasFiltradas.length === 1 ? "" : "ES"}
                </span>
                <LimpiarFiltrosButton onClick={limpiarFiltros} />
              </div>
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
        entidadesIniciales={marcas}
        esEditor={esEditor}
        onCatalogoChanged={handleCatalogoPagosChanged}
      />

      <GestionarBancosCobrosModal
        open={openGestionarBancos}
        onOpenChange={setOpenGestionarBancos}
        bancosIniciales={bancos}
        esEditor={esEditor}
        onCatalogoChanged={handleCatalogoBancosChanged}
      />

      <GestionarMarcasFinAnaCosFinaModal
        open={openGestionarMarcas}
        onOpenChange={setOpenGestionarMarcas}
        marcasIniciales={marcas}
        esEditor={esEditor}
        onCatalogoChanged={handleCatalogoMarcasChanged}
      />

      <GestionarCuotasFinAnaCosFinaModal
        open={openGestionarCuotas}
        onOpenChange={setOpenGestionarCuotas}
        cuotasIniciales={cuotas}
        esEditor={esEditor}
        onCatalogoChanged={handleCatalogoCuotasChanged}
      />

      <CalculoCxTotalFinAnaCosFinaModal open={openCalculoCxTotal} onOpenChange={setOpenCalculoCxTotal} />
    </>
  );
}
