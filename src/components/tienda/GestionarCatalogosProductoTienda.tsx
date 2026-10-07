"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import GestionarMarcasModal from "@/components/tienda/GestionarMarcasModal";
import GestionarRubrosModal from "@/components/tienda/GestionarRubrosModal";
import GestionarEstPorProdColoresModal from "@/components/estadisticas-productos/GestionarEstPorProdColoresModal";
import GestionarEstPorProdPresentacionModal from "@/components/estadisticas-productos/GestionarEstPorProdPresentacionModal";
import { listarEstPorProdUnPresentacionesAction } from "@/actions/estPorProdUnPresentacion";
import type { EstPorProdColorItem } from "@/lib/estPorProdColores";
import type { EstPorProdPresentacionItem } from "@/lib/estPorProdPresentacion";
import type { EstPorProdUnPresentacionItem } from "@/lib/estPorProdUnPresentacion";

/** Referencias estables: los modales de estadísticas recargan al cambiar `itemsIniciales`. */
const COLORES_INICIALES: EstPorProdColorItem[] = [];
const PRESENTACIONES_INICIALES: EstPorProdPresentacionItem[] = [];

export type CatalogoProductoTienda = "marcas" | "rubros" | "colores" | "presentacion";

/**
 * Modales «GESTIONAR…» de los catálogos de producto (Lista Productos y botón «+» de Agregar / Editar).
 * Presentación pide antes las unidades; el modal se abre cuando llegan.
 */
export default function GestionarCatalogosProductoTienda({
  abierto,
  onClose,
  esEditor,
  onCatalogoChanged,
}: {
  abierto: CatalogoProductoTienda | null;
  onClose: () => void;
  esEditor: boolean;
  onCatalogoChanged?: () => void;
}) {
  const [unidades, setUnidades] = useState<EstPorProdUnPresentacionItem[] | null>(null);

  useEffect(() => {
    if (abierto !== "presentacion") return;
    let activo = true;
    void listarEstPorProdUnPresentacionesAction().then((res) => {
      if (!activo) return;
      if (res.ok) {
        setUnidades(res.data);
      } else {
        toast.error(res.error);
        onClose();
      }
    });
    return () => {
      activo = false;
      setUnidades(null);
    };
  }, [abierto, onClose]);

  const cerrar = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <>
      <GestionarMarcasModal
        open={abierto === "marcas"}
        onOpenChange={cerrar}
        esEditor={esEditor}
        onCatalogoChanged={onCatalogoChanged}
      />
      <GestionarRubrosModal
        open={abierto === "rubros"}
        onOpenChange={cerrar}
        esEditor={esEditor}
        onCatalogoChanged={onCatalogoChanged}
      />
      <GestionarEstPorProdColoresModal
        open={abierto === "colores"}
        onOpenChange={cerrar}
        itemsIniciales={COLORES_INICIALES}
        esEditor={esEditor}
      />
      <GestionarEstPorProdPresentacionModal
        open={abierto === "presentacion" && unidades !== null}
        onOpenChange={cerrar}
        itemsIniciales={PRESENTACIONES_INICIALES}
        unidades={unidades ?? []}
        esEditor={esEditor}
      />
    </>
  );
}
