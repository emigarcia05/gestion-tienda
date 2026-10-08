"use client";

import { useState } from "react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import GestionarVencimientosProveedorModal from "@/components/finanzas/GestionarVencimientosProveedorModal";
import TablaControlComprobantes from "@/components/finanzas/TablaControlComprobantes";
import { Button } from "@/components/ui/button";
import type { ProveedorMercaderiaPlazosFila } from "@/services/proveedor.service";

interface ControlComprobanteRow {
  id: string;
  fechaComp: string;
  proveedorNombre: string;
  proveedorPrefijo: string;
  sucursalNombre: string;
  comprobante: string;
  total: string;
  montoAplicado: string;
  vencimientoSaldo: string;
  controlado: boolean;
  plazoPago1Dias: number | null;
  plazoPago2Dias: number | null;
  plazoPago3Dias: number | null;
  plazoPago4Dias: number | null;
  proveedorPlazo1Dias: number | null;
  proveedorPlazo2Dias: number | null;
  proveedorPlazo3Dias: number | null;
  proveedorPlazo4Dias: number | null;
  planPlazosLabel: string;
  fechaVenc: string;
}

export default function ControlComprobantesPageClient({
  filas,
  proveedoresMercaderia,
  esEditor,
}: {
  filas: ControlComprobanteRow[];
  proveedoresMercaderia: ProveedorMercaderiaPlazosFila[];
  esEditor: boolean;
}) {
  const [openGestionarVenc, setOpenGestionarVenc] = useState(false);

  return (
    <div className="area-page-shell">
      <ClassicFilteredTableLayout
        title="Finanzas"
        subtitle="Comp. Compras"
        actions={
          esEditor ? (
            <Button type="button" onClick={() => setOpenGestionarVenc(true)}>
              Gestionar Venc.
            </Button>
          ) : null
        }
      >
        <TablaControlComprobantes filas={filas} esEditor={esEditor} />
      </ClassicFilteredTableLayout>

      {openGestionarVenc ? (
        <GestionarVencimientosProveedorModal
          onClose={() => setOpenGestionarVenc(false)}
          proveedores={proveedoresMercaderia}
        />
      ) : null}
    </div>
  );
}
