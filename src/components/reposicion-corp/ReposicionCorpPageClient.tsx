"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import PaginacionTabla from "@/components/shared/PaginacionTabla";
import FiltrosReposicionCorp from "@/components/reposicion-corp/FiltrosReposicionCorp";
import ConfigurarReposicionModal from "@/components/pedidos/ConfigurarReposicionModal";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import { deleteReglaReposicionCorpAction } from "@/actions/reposicionCorp";
import type { ItemReposicion } from "@/actions/reposicion";
import type { ItemReposicionCorp } from "@/services/reposicionCorp.service";
import { APP_ROUTES } from "@/lib/appRoutes";
import { fmtCelda, fmtNumero } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/pagination";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { labelReposicionFormaPedidoVendedor } from "@/lib/validations/reposicion";

interface Props {
  items: ItemReposicionCorp[];
  total: number;
  totalPaginas: number;
  marcas: string[];
  rubros: string[];
  filtros: {
    q: string;
    marca: string;
    rubro: string;
    configurado: "" | "si";
  };
  paginaNum: number;
}

function itemDesdeCorp(row: ItemReposicionCorp): ItemReposicion {
  return {
    idListaTienda: row.codTienda,
    codExt: "",
    codTienda: row.codTienda,
    descripcionTienda: row.descripcionTienda,
    stock: 0,
    idProveedor: null,
    nombreProveedor: null,
    idReposicion: null,
    formaPedir: row.formaPedir,
    puntoReposicion: row.puntoReposicion,
    cant: row.cant,
    cantPedidaReposicion: 0,
    cantPedir: 0,
    bulto: row.bulto,
    tienePisoCorp: row.configurado,
    pisoCorp:
      row.configurado && row.formaPedir
        ? {
            forma: row.formaPedir,
            punto: row.puntoReposicion,
            cantConf: row.cant,
          }
        : null,
  };
}

export default function ReposicionCorpPageClient({
  items,
  total,
  totalPaginas,
  marcas,
  rubros,
  filtros,
  paginaNum,
}: Props) {
  const router = useRouter();
  const [itemModal, setItemModal] = useState<ItemReposicion | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [borrando, setBorrando] = useState<string | null>(null);

  function abrirConfigurar(row: ItemReposicionCorp) {
    setItemModal(itemDesdeCorp(row));
    setModalOpen(true);
  }

  async function borrarConfig(row: ItemReposicionCorp) {
    if (!row.configurado) return;
    setBorrando(row.codTienda);
    try {
      const res = await deleteReglaReposicionCorpAction({ codTienda: row.codTienda });
      if (!res.ok) {
        toast.error(res.error ?? "Error al borrar.");
        return;
      }
      toast.success("Configuración corporativa borrada.");
      router.refresh();
    } finally {
      setBorrando(null);
    }
  }

  return (
    <>
      <ClassicFilteredTableLayout
        title="Administrador"
        subtitle="Reposición Corp."
        contentWidth="full"
        filters={
          <FiltrosReposicionCorp
            marcas={marcas}
            rubros={rubros}
            qActual={filtros.q}
            marcaActual={filtros.marca}
            rubroActual={filtros.rubro}
            configuradoActual={filtros.configurado}
          />
        }
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="contenedor-tabla-gestion min-h-0 flex-1">
            <Table variant="compact" className="tabla-gestion-compacta w-full">
              <colgroup>
                <col />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[6%]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead>DESCRIPCIÓN</TableHead>
                  <TableHead className="text-center">FORMA</TableHead>
                  <TableHead className="text-center">PTO.</TableHead>
                  <TableHead className="text-center">CANT.</TableHead>
                  <TableHead className="text-center" aria-label="Acciones" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <EmptyTableRow colSpan={5} message="No hay productos para mostrar." />
                ) : (
                  items.map((row) => (
                    <TableRow
                      key={row.codTienda}
                      className="cursor-pointer"
                      onDoubleClick={() => abrirConfigurar(row)}
                    >
                      <TableCell className="celda-datos text-left">
                        {fmtCelda(row.descripcionTienda)}
                      </TableCell>
                      <TableCell className="celda-datos text-center">
                        {row.configurado
                          ? labelReposicionFormaPedidoVendedor(row.formaPedir)
                          : ""}
                      </TableCell>
                      <TableCell className="celda-datos text-center tabular-nums">
                        {row.configurado ? fmtNumero(row.puntoReposicion) : ""}
                      </TableCell>
                      <TableCell className="celda-datos text-center tabular-nums">
                        {row.configurado ? fmtNumero(row.cant) : ""}
                      </TableCell>
                      <TableCell className="celda-datos text-center">
                        {row.configurado ? (
                          <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={cn(TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS)}
                              aria-label="Borrar configuración corporativa"
                              disabled={borrando === row.codTienda}
                              onClick={(e) => {
                                e.stopPropagation();
                                void borrarConfig(row);
                              }}
                            >
                              <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} />
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPaginas > 1 ? (
            <div className="flex justify-end pt-2 shrink-0">
              <PaginacionTabla
                basePath={APP_ROUTES.administrador.reposicionCorp.reposicionCorp}
                params={{
                  q: filtros.q,
                  marca: filtros.marca,
                  rubro: filtros.rubro,
                  configurado: filtros.configurado,
                }}
                paginaActual={paginaNum}
                totalPaginas={totalPaginas}
                total={total}
                pageSize={PAGE_SIZE}
              />
            </div>
          ) : null}
        </div>
      </ClassicFilteredTableLayout>
      {itemModal ? (
        <ConfigurarReposicionModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          item={itemModal}
          modo="corp"
        />
      ) : null}
    </>
  );
}
