"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AppModal from "@/components/shared/AppModal";
import ModalSiNoChoice from "@/components/shared/ModalSiNoChoice";
import FliaProductoSeccion from "@/components/tienda/FliaProductoSeccion";
import { siguienteCodFliaItemAction } from "@/actions/listaProductos";
import { normalizarCodFliaItem } from "@/lib/prodProducto";
import PxListasItemEnProducto, {
  type PxVentaItemHandle,
} from "@/components/tienda/PxListasItemEnProducto";
import MismoProductoTienda, {
  type EleccionMismoProducto,
} from "@/components/tienda/MismoProductoTienda";
import ProductoTiendaCampos, {
  SIN_VALOR_PRODUCTO_TIENDA,
  camposProductoTiendaCompletos,
  camposProductoTiendaParaAction,
  type CamposProductoTiendaForm,
} from "@/components/tienda/ProductoTiendaCampos";
import VinculosCostoProductoTienda from "@/components/tienda/VinculosCostoProductoTienda";
import GestionarCatalogosProductoTienda, {
  type CatalogoProductoTienda,
} from "@/components/tienda/GestionarCatalogosProductoTienda";
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
  const pxVentaRef = useRef<PxVentaItemHandle>(null);
  const catalogos = useCatalogosProductoTienda(true);
  const [campos, setCampos] = useState<CamposProductoTiendaForm>({
    descripcion: item.descripcion,
    idRubro: item.idRubro ?? "",
    idSubRubro: item.idSubRubro ?? SIN_VALOR_PRODUCTO_TIENDA,
    idMarca: item.idMarca ?? "",
    idPresentacion: item.idPresentacion ?? SIN_VALOR_PRODUCTO_TIENDA,
    idColor: item.idColor ?? SIN_VALOR_PRODUCTO_TIENDA,
    terminacion: item.terminacion ?? SIN_VALOR_PRODUCTO_TIENDA,
    bulto: item.bulto != null ? String(item.bulto) : "",
    precioEditable: item.precioEditable,
  });
  const [eleccion, setEleccion] = useState<EleccionMismoProducto>({ tipo: "igual" });
  const [codFliaItem, setCodFliaItem] = useState(item.codFliaItem ?? "");

  useEffect(() => {
    if (item.codFliaItem) return;
    let activo = true;
    void siguienteCodFliaItemAction().then((res) => {
      if (!activo || !res.ok) return;
      setCodFliaItem((prev) => (prev === "" ? res.data.codigo : prev));
    });
    return () => {
      activo = false;
    };
  }, [item.codFliaItem]);
  const [pending, setPending] = useState(false);
  const [gestionando, setGestionando] = useState<CatalogoProductoTienda | null>(null);
  const { recargar } = catalogos;
  const cerrarGestion = useCallback(() => {
    setGestionando(null);
    recargar();
  }, [recargar]);

  const flia = normalizarCodFliaItem(codFliaItem);
  const fliaOk = flia.ok && flia.codigo != null;
  const puedeGuardar = camposProductoTiendaCompletos(campos) && fliaOk && !pending;

  async function guardar() {
    if (!puedeGuardar) return;
    setPending(true);
    try {
      const res = await editarProductoTiendaAction({
        ...camposProductoTiendaParaAction(campos),
        codTienda: item.codItem,
        codMismoProducto: eleccion.tipo === "unir" ? eleccion.codTienda : null,
        soltarProducto: eleccion.tipo === "soltar",
        codFliaItem,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const px = await pxVentaRef.current?.guardar(item.codItem);
      if (px && !px.ok) {
        toast.error(px.error);
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
        title="EDITAR PRODUCTO"
        size="xl"
        className="max-w-[56rem]"
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
              campos={campos}
              onChange={(patch) => {
                if (patch.idMarca && patch.idMarca !== campos.idMarca) {
                  setEleccion({ tipo: "igual" });
                }
                setCampos((prev) => ({ ...prev, ...patch }));
              }}
              catalogos={catalogos}
              disabled={pending}
              onGestionar={setGestionando}
            />
          </section>
          <FliaProductoSeccion codigo={codFliaItem} onChange={setCodFliaItem} disabled={pending} />
          <section className="modal-seccion-formulario flex flex-col gap-3">
            <h3 className={SECCION_TITULO_CLASS}>Mismo producto</h3>
            <MismoProductoTienda
              key={campos.idMarca}
              codTienda={item.codItem}
              idMarca={campos.idMarca}
              disabled={pending}
              eleccion={eleccion}
              onChange={setEleccion}
            />
          </section>
          <section className="modal-seccion-formulario flex flex-col gap-3">
            <h3 className={SECCION_TITULO_CLASS}>Tipo & Costo</h3>
            <VinculosCostoProductoTienda
              codTienda={item.codItem}
              descripcion={item.descripcion}
              marca={item.marca}
              rubro={item.rubro}
              subRubro={item.subRubro}
              prefijoProveedor={item.proveedorDux}
              esProductoPropioInicial={item.esProductoPropio}
              esProductoCompuestoInicial={item.esProductoCompuesto}
              puedeVincular={puedeVincular}
              puedeEditarCosto={puedeEditarCosto}
            />
          </section>
          <section className="modal-seccion-formulario flex flex-col gap-3">
            <h3 className={SECCION_TITULO_CLASS}>Px Venta</h3>
            <PxListasItemEnProducto
              ref={pxVentaRef}
              codTienda={item.codItem}
              disabled={pending}
            />
            <ModalSiNoChoice
              label="PX. EDITABLE"
              value={campos.precioEditable}
              onChange={(precioEditable) => setCampos((prev) => ({ ...prev, precioEditable }))}
              disabled={pending}
              className="h-9 py-0"
            />
          </section>
        </div>
      </AppModal>
      <GestionarCatalogosProductoTienda
        abierto={gestionando}
        onClose={cerrarGestion}
        esEditor
        onCatalogoChanged={recargar}
      />
    </Dialog>
  );
}
