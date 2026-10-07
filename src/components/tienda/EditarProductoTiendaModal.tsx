"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AppModal from "@/components/shared/AppModal";
import ProductoTiendaCampos, {
  SIN_VALOR_PRODUCTO_TIENDA,
  camposProductoTiendaCompletos,
  camposProductoTiendaParaAction,
  type CamposProductoTiendaForm,
} from "@/components/tienda/ProductoTiendaCampos";
import VinculosCostoProductoTienda from "@/components/tienda/VinculosCostoProductoTienda";
import { editarProductoTiendaAction } from "@/actions/listaProductos";
import type { ItemTiendaParaTabla } from "@/actions/tienda";
import { useCatalogosProductoTienda } from "@/lib/hooks/useCatalogosProductoTienda";

const SECCION_TITULO_CLASS = "text-center text-xs font-bold uppercase tracking-wide text-foreground";

/** Montar con `key={item.codItem}`: el estado inicial sale del ítem. */
export default function EditarProductoTiendaModal({
  item,
  puedeVincular,
  puedeEditarCosto,
  onClose,
}: {
  item: ItemTiendaParaTabla;
  puedeVincular: boolean;
  puedeEditarCosto: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const catalogos = useCatalogosProductoTienda(true);
  const [campos, setCampos] = useState<CamposProductoTiendaForm>({
    descripcion: item.descripcion,
    idRubro: "",
    subRubro: item.subRubro ?? "",
    idMarca: "",
    idPresentacion: item.idPresentacion ?? SIN_VALOR_PRODUCTO_TIENDA,
    idColor: item.idColor ?? SIN_VALOR_PRODUCTO_TIENDA,
    bulto: item.bulto != null ? String(item.bulto) : "",
  });
  const [pending, setPending] = useState(false);

  // Rubro y marca del ítem se resuelven contra el catálogo cuando llega (rubro por nombre; marca por id o nombre).
  const camposEfectivos: CamposProductoTiendaForm = {
    ...campos,
    idRubro: campos.idRubro || (catalogos.rubros.find((r) => r.nombre === item.rubro)?.id ?? ""),
    idMarca:
      campos.idMarca ||
      (catalogos.marcas.find((m) => m.id === item.idMarca)?.id ??
        catalogos.marcas.find((m) => m.nombre === item.marca)?.id ??
        ""),
  };

  const puedeGuardar = camposProductoTiendaCompletos(camposEfectivos) && !pending;

  async function guardar() {
    if (!puedeGuardar) return;
    setPending(true);
    try {
      const res = await editarProductoTiendaAction({
        ...camposProductoTiendaParaAction(camposEfectivos),
        codTienda: item.codItem,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Producto actualizado.");
      onClose();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !pending && onClose()}>
      <AppModal
        title={`EDITAR PRODUCTO ${item.codItem}`}
        size="xl"
        actions={
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" disabled={!puedeGuardar} onClick={() => void guardar()}>
              Guardar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <section className="modal-seccion-formulario flex flex-col gap-3">
            <h3 className={SECCION_TITULO_CLASS}>DATOS DEL PRODUCTO</h3>
            <ProductoTiendaCampos
              campos={camposEfectivos}
              onChange={(patch) => setCampos((prev) => ({ ...prev, ...patch }))}
              catalogos={catalogos}
              disabled={pending}
            />
          </section>
          <section className="modal-seccion-formulario flex flex-col gap-3">
            <h3 className={SECCION_TITULO_CLASS}>VINCULACIÓN CON COSTO</h3>
            <VinculosCostoProductoTienda
              codTienda={item.codItem}
              descripcion={item.descripcion}
              marca={item.marca}
              rubro={item.rubro}
              subRubro={item.subRubro}
              prefijoProveedor={item.proveedorDux}
              esProductoPropioInicial={item.esProductoPropio}
              puedeVincular={puedeVincular}
              puedeEditarCosto={puedeEditarCosto}
            />
          </section>
        </div>
      </AppModal>
    </Dialog>
  );
}
