"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import TablaTesoreriaCajas, { type TesoreriaCajaFila } from "@/components/finanzas/TablaTesoreriaCajas";
import NuevaCajaTesoreriaModal from "@/components/finanzas/NuevaCajaTesoreriaModal";
import ActualizarMontoCajaTesoreriaModal from "@/components/finanzas/ActualizarMontoCajaTesoreriaModal";
import EditarCajaTesoreriaModal from "@/components/finanzas/EditarCajaTesoreriaModal";
import ChequesCajaTesoreriaModal from "@/components/finanzas/ChequesCajaTesoreriaModal";
import FilterBar, {
  FILTER_INLINE_ACTION_SLOT_CLASS,
  FILTER_SELECT_WRAPPER_CLASS,
  FiltroIndividualContainer,
  FilaFiltrosDesplegables,
  FilterRowSelection,
  LimpiarFiltrosButton,
} from "@/components/FilterBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TipoCajaTesoreria } from "@prisma/client";
import { etiquetaTipoCajaEnPantalla } from "@/lib/cajasTesoreriaTipos";

interface Props {
  filas: TesoreriaCajaFila[];
  esEditor: boolean;
}

export default function FinanzasTesoreriaPageClient({
  filas,
  esEditor,
}: Props) {
  const router = useRouter();
  const [openNuevaCaja, setOpenNuevaCaja] = useState(false);
  const [cajaParaEditarMonto, setCajaParaEditarMonto] = useState<TesoreriaCajaFila | null>(null);
  const [cajaParaEditarDatos, setCajaParaEditarDatos] = useState<TesoreriaCajaFila | null>(null);
  const [cajaChequeSeleccionada, setCajaChequeSeleccionada] = useState<TesoreriaCajaFila | null>(null);
  const [filtroEntidad, setFiltroEntidad] = useState("");
  const [filtroSucursal, setFiltroSucursal] = useState("");
  const [filtroTitular, setFiltroTitular] = useState("");
  const [filtroTipoCaja, setFiltroTipoCaja] = useState("");
  const [filtroTipoValor, setFiltroTipoValor] = useState("");

  const entidadesOptions = useMemo(
    () => [...new Set(filas.map((f) => f.entidadNombre))].sort((a, b) => a.localeCompare(b, "es")),
    [filas]
  );
  const sucursalesOptions = useMemo(
    () =>
      [...new Set(filas.map((f) => f.sucursalNombre).filter((n) => n.trim() !== ""))].sort((a, b) =>
        a.localeCompare(b, "es")
      ),
    [filas]
  );
  const titularesOptions = useMemo(
    () => [...new Set(filas.map((f) => f.titular))].sort((a, b) => a.localeCompare(b, "es")),
    [filas]
  );
  const tiposCajaOptions = useMemo(
    () => [...new Set(filas.map((f) => f.tipoCaja))].sort((a, b) => a.localeCompare(b, "es")),
    [filas]
  );
  const tiposValorOptions = useMemo(
    () => [...new Set(filas.map((f) => f.tipoValor))].sort((a, b) => a.localeCompare(b, "es")),
    [filas]
  );

  const filasFiltradas = useMemo(
    () =>
      filas
        .filter((fila) => {
          if (filtroEntidad && fila.entidadNombre !== filtroEntidad) return false;
          if (filtroSucursal && fila.sucursalNombre !== filtroSucursal) return false;
          if (filtroTitular && fila.titular !== filtroTitular) return false;
          if (filtroTipoCaja && fila.tipoCaja !== filtroTipoCaja) return false;
          if (filtroTipoValor && fila.tipoValor !== filtroTipoValor) return false;
          return true;
        })
        .sort((a, b) => {
          const ta = Date.parse(a.ultActualizacionIso);
          const tb = Date.parse(b.ultActualizacionIso);
          const aOk = !Number.isNaN(ta);
          const bOk = !Number.isNaN(tb);
          if (!aOk && !bOk) return 0;
          if (!aOk) return 1;
          if (!bOk) return -1;
          return ta - tb;
        }),
    [filas, filtroEntidad, filtroSucursal, filtroTitular, filtroTipoCaja, filtroTipoValor]
  );

  function limpiarFiltros() {
    setFiltroEntidad("");
    setFiltroSucursal("");
    setFiltroTitular("");
    setFiltroTipoCaja("");
    setFiltroTipoValor("");
  }

  return (
    <div className="area-page-shell">
      <ClassicFilteredTableLayout
        title="Finanzas"
        subtitle="Tesorería"
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilterRowSelection>
              <FilaFiltrosDesplegables columnas={5}>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtroEntidad)}
                  onLimpiar={() => setFiltroEntidad("")}
                >
                  <Select value={filtroEntidad ?? ""} onValueChange={(v) => setFiltroEntidad(v)}>
                    <SelectTrigger className="input-filtro-unificado">
                      <SelectValue placeholder="ENTIDAD" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {entidadesOptions.map((nombre) => (
                        <SelectItem key={nombre} value={nombre}>
                          {nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtroSucursal)}
                  onLimpiar={() => setFiltroSucursal("")}
                >
                  <Select
                    value={filtroSucursal ?? ""}
                    onValueChange={(v) => setFiltroSucursal(v)}
                  >
                    <SelectTrigger className="input-filtro-unificado">
                      <SelectValue placeholder="SUCURSAL" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {sucursalesOptions.map((nombre) => (
                        <SelectItem key={nombre} value={nombre}>
                          {nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtroTitular)}
                  onLimpiar={() => setFiltroTitular("")}
                >
                  <Select
                    value={filtroTitular ?? ""}
                    onValueChange={(v) => setFiltroTitular(v)}
                  >
                    <SelectTrigger className="input-filtro-unificado">
                      <SelectValue placeholder="TITULAR" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {titularesOptions.map((titular) => (
                        <SelectItem key={titular} value={titular}>
                          {titular}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtroTipoCaja)}
                  onLimpiar={() => setFiltroTipoCaja("")}
                >
                  <Select
                    value={filtroTipoCaja ?? ""}
                    onValueChange={(v) => setFiltroTipoCaja(v)}
                  >
                    <SelectTrigger className="input-filtro-unificado">
                      <SelectValue placeholder="TIPO CAJA" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {tiposCajaOptions.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {etiquetaTipoCajaEnPantalla(tipo as TipoCajaTesoreria)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtroTipoValor)}
                  onLimpiar={() => setFiltroTipoValor("")}
                >
                  <Select
                    value={filtroTipoValor ?? ""}
                    onValueChange={(v) => setFiltroTipoValor(v)}
                  >
                    <SelectTrigger className="input-filtro-unificado">
                      <SelectValue placeholder="TIPO DE VALOR" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      {tiposValorOptions.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {tipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                <div className={FILTER_INLINE_ACTION_SLOT_CLASS}>
                  <LimpiarFiltrosButton onClick={limpiarFiltros} />
                </div>
              </FilaFiltrosDesplegables>
            </FilterRowSelection>
          </FilterBar>
        }
        actions={
          esEditor ? (
            <Button
              type="button"
              onClick={() => setOpenNuevaCaja(true)}
              className="h-10 px-4 gap-2"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              Nueva Caja
            </Button>
          ) : undefined
        }
      >
        <TablaTesoreriaCajas
          filas={filasFiltradas}
          esEditor={esEditor}
          onEditMontoClick={esEditor ? (fila) => setCajaParaEditarMonto(fila) : undefined}
          onChequeRowClick={(fila) => setCajaChequeSeleccionada(fila)}
          onEditDataClick={esEditor ? (fila) => setCajaParaEditarDatos(fila) : undefined}
        />
        <NuevaCajaTesoreriaModal
          open={openNuevaCaja}
          onOpenChange={setOpenNuevaCaja}
          onCreated={() => router.refresh()}
        />
        <ActualizarMontoCajaTesoreriaModal
          open={cajaParaEditarMonto != null}
          onOpenChange={(open) => {
            if (!open) setCajaParaEditarMonto(null);
          }}
          caja={cajaParaEditarMonto}
          onUpdated={() => router.refresh()}
        />
        <EditarCajaTesoreriaModal
          open={cajaParaEditarDatos != null}
          onOpenChange={(open) => {
            if (!open) setCajaParaEditarDatos(null);
          }}
          caja={cajaParaEditarDatos}
          onUpdated={() => router.refresh()}
        />
        <ChequesCajaTesoreriaModal
          open={cajaChequeSeleccionada != null}
          onOpenChange={(open) => {
            if (!open) setCajaChequeSeleccionada(null);
          }}
          caja={cajaChequeSeleccionada}
          esEditor={esEditor}
          onChequesChanged={() => router.refresh()}
        />
      </ClassicFilteredTableLayout>
    </div>
  );
}
