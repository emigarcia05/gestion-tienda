"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ProveedorModal, { type ProveedorParaModal } from "./ProveedorModal";
import { eliminarProveedor } from "@/actions/proveedores";
import { fmtCantidad, fmtCelda } from "@/lib/format";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import type { ProveedorListItem } from "@/services/proveedor.service";

interface Props {
  proveedores: ProveedorListItem[];
}

export default function TablaProveedoresLista({ proveedores }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalProveedor, setModalProveedor] = useState<ProveedorParaModal | null>(null);
  const [borrar, setBorrar] = useState<ProveedorListItem | null>(null);
  const [borrando, setBorrando] = useState(false);

  function openEdit(prov: ProveedorListItem) {
    setBorrar(null);
    setModalProveedor({
      id: prov.id,
      nombre: prov.nombre,
      prefijo: prov.prefijo,
      idProveedorDux: prov.idProveedorDux ?? undefined,
      whatsapp: prov.whatsapp ?? undefined,
      coeficienteTintometrico: prov.coeficienteTintometrico,
      plazoPago1Dias: prov.plazoPago1Dias,
      plazoPago2Dias: prov.plazoPago2Dias,
      plazoPago3Dias: prov.plazoPago3Dias,
      plazoPago4Dias: prov.plazoPago4Dias,
      tiempoEntregaEnDias: prov.tiempoEntregaEnDias ?? undefined,
      proveedorMercaderia: prov.proveedorMercaderia,
      esFabrica: prov.esFabrica,
      iva: prov.iva,
    });
    setModalOpen(true);
  }

  function handleSuccess() {
    setModalOpen(false);
    setModalProveedor(null);
    router.refresh();
  }

  async function confirmarBorrar() {
    if (!borrar) return;
    setBorrando(true);
    try {
      const result = await eliminarProveedor(borrar.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Proveedor "${borrar.nombre}" eliminado.`);
      setBorrar(null);
      router.refresh();
    } finally {
      setBorrando(false);
    }
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col gap-0.5">
        <div className="contenedor-tabla-gestion no-scroll-x min-h-0 flex-1">
          <Table variant="compact" scrollX={false}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-0">PROVEEDOR</TableHead>
                <TableHead className="w-24">PREFIJO</TableHead>
                <TableHead className="w-28">CANT. PRODUCTOS</TableHead>
                <TableHead className="w-36">CANT. VINCULADOS</TableHead>
                <TableHead className="w-[10%]">ACCIONES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proveedores.map((prov) => (
                <TableRow key={prov.id}>
                  <TableCell className="celda-datos min-w-0">{fmtCelda(prov.nombre)}</TableCell>
                  <TableCell className="celda-datos celda-mono whitespace-nowrap">
                    {fmtCelda(prov.prefijo)}
                  </TableCell>
                  <TableCell className="celda-datos celda-numero">
                    {fmtCantidad(prov.cantProductos)}
                  </TableCell>
                  <TableCell className="celda-datos celda-numero">
                    {fmtCantidad(prov.cantVinculados)}
                  </TableCell>
                  <TableCell className="celda-datos celda-datos--accion-relleno-fila tabla-bloque-secundario-cell-divider">
                    <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                        title="Editar"
                        aria-label={`Editar ${prov.nombre}`}
                        onClick={() => openEdit(prov)}
                      >
                        <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                        title="Borrar"
                        aria-label={`Borrar ${prov.nombre}`}
                        onClick={() => {
                          setModalOpen(false);
                          setBorrar(prov);
                        }}
                      >
                        <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <ProveedorModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          proveedor={modalProveedor}
          onSuccess={handleSuccess}
        />
      </Dialog>

      <Dialog
        open={borrar != null}
        onOpenChange={(next) => {
          if (borrando && !next) return;
          if (!next) setBorrar(null);
        }}
      >
        <AppModal
          title="Borrar Proveedor"
          size="sm"
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={borrando}
                onClick={() => setBorrar(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={borrando}
                onClick={() => void confirmarBorrar()}
              >
                Sí, Borrar
              </Button>
            </div>
          }
        >
          <p className="text-sm text-muted-foreground">
            ¿Confirmás borrar{" "}
            <span className="font-medium text-foreground">{borrar?.nombre ?? ""}</span>? No se
            puede deshacer.
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
