"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Wallet } from "lucide-react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import GestionarVencimientosProveedorModal from "@/components/finanzas/GestionarVencimientosProveedorModal";
import PagoCuentaCorrienteProveedoresModal from "@/components/finanzas/PagoCuentaCorrienteProveedoresModal";
import TablaControlComprobantes from "@/components/finanzas/TablaControlComprobantes";
import type { ProveedorMercaderiaPlazosFila } from "@/services/proveedor.service";

interface ControlComprobanteRow {
  id: string;
  fechaComp: string;
  proveedorNombre: string;
  proveedorPrefijo: string;
  sucursalNombre: string;
  pedidoHistoriaId: string | null;
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
  const router = useRouter();
  const [openGestionarVenc, setOpenGestionarVenc] = useState(false);
  const [openPagoCc, setOpenPagoCc] = useState(false);

  return (
    <div className="area-page-shell">
      <ClassicFilteredTableLayout
        title="Finanzas"
        subtitle="Comp. Compras"
        actions={
          esEditor ? (
            <>
              <ToolbarActionButton
                label="PAGO CUENTA CORRIENTE"
                icon={<Wallet />}
                className="w-full justify-start"
                onClick={() => setOpenPagoCc(true)}
              />
              <ToolbarActionButton
                label="Gestionar Venc."
                icon={<CalendarClock />}
                className="w-full justify-start"
                onClick={() => setOpenGestionarVenc(true)}
              />
            </>
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
      <PagoCuentaCorrienteProveedoresModal
        open={openPagoCc}
        onOpenChange={setOpenPagoCc}
        onRegistrado={() => router.refresh()}
      />
    </div>
  );
}
