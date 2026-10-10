"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Wallet } from "lucide-react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import GestionarVencimientosProveedorModal from "@/components/finanzas/GestionarVencimientosProveedorModal";
import PagoCuentaCorrienteProveedoresModal from "@/components/finanzas/PagoCuentaCorrienteProveedoresModal";
import TablaControlComprobantes, {
  type ControlComprobanteRow,
} from "@/components/finanzas/TablaControlComprobantes";
import type { ProveedorMercaderiaPlazosFila } from "@/services/proveedor.service";

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
  const [filtroProveedor, setFiltroProveedor] = useState("");
  const proveedorFiltrado = filtroProveedor
    ? (filas.find((f) => f.idProveedor === filtroProveedor) ?? null)
    : null;

  return (
    <div className="area-page-shell">
      <ClassicFilteredTableLayout
        title="Finanzas"
        subtitle="Comp. Compras"
        actions={
          esEditor ? (
            <>
              <ToolbarActionButton
                label="Pago Cuenta Corriente"
                icon={<Wallet />}
                className="w-full justify-start"
                disabled={!proveedorFiltrado}
                title={proveedorFiltrado ? undefined : "Filtrá un proveedor para registrar el pago."}
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
        <TablaControlComprobantes
          filas={filas}
          esEditor={esEditor}
          filtroProveedor={filtroProveedor}
          onFiltroProveedorChange={setFiltroProveedor}
        />
      </ClassicFilteredTableLayout>

      {openGestionarVenc ? (
        <GestionarVencimientosProveedorModal
          onClose={() => setOpenGestionarVenc(false)}
          proveedores={proveedoresMercaderia}
        />
      ) : null}
      {proveedorFiltrado ? (
        <PagoCuentaCorrienteProveedoresModal
          open={openPagoCc}
          onOpenChange={setOpenPagoCc}
          idProveedorDux={proveedorFiltrado.idProveedor}
          proveedorNombre={proveedorFiltrado.proveedorNombre}
          onRegistrado={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
