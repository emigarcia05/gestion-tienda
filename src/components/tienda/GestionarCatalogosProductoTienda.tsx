"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import GestionarFamiliasModal from "@/components/tienda/GestionarFamiliasModal";
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

export type CatalogoProductoTienda =
  | "marcas"
  | "rubros"
  | "subRubros"
  | "colores"
  | "presentacion"
  | "familias";

/**
 * Catálogos de producto. Desde el header de Lista Productos abre el listado «GESTIONAR…».
 * Desde el «+» de Crear / Editar (`altaDirecta`) abre solo el alta del atributo.
 * Presentación pide antes las unidades; el modal se abre cuando llegan.
 */
export default function GestionarCatalogosProductoTienda({
  abierto,
  onClose,
  esEditor,
  onCatalogoChanged,
  altaDirecta = false,
  rubroPadre = null,
  onCreado,
}: {
  abierto: CatalogoProductoTienda | null;
  onClose: () => void;
  esEditor: boolean;
  onCatalogoChanged?: () => void;
  /** El «+» del producto abre el alta, no el listado GESTIONAR. */
  altaDirecta?: boolean;
  /** Rubro ya elegido en el producto; lo usa el alta de sub-rubro. */
  rubroPadre?: { id: string; nombre: string } | null;
  /** Atributo recién creado, para dejarlo elegido en el producto. */
  onCreado?: (catalogo: CatalogoProductoTienda, id: string) => void;
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

  const altaRubro = altaDirecta && abierto === "rubros";
  const altaSubRubro = altaDirecta && abierto === "subRubros";

  return (
    <>
      <GestionarFamiliasModal
        open={abierto === "familias"}
        onOpenChange={cerrar}
        esEditor={esEditor}
        soloCrear={altaDirecta && abierto === "familias"}
        onCreado={(id) => onCreado?.("familias", id)}
        onCatalogoChanged={onCatalogoChanged}
      />
      <GestionarMarcasModal
        open={abierto === "marcas"}
        onOpenChange={cerrar}
        esEditor={esEditor}
        soloCrear={altaDirecta && abierto === "marcas"}
        onCreado={(id) => onCreado?.("marcas", id)}
        onCatalogoChanged={onCatalogoChanged}
      />
      <GestionarRubrosModal
        open={abierto === "rubros" || abierto === "subRubros"}
        onOpenChange={cerrar}
        esEditor={esEditor}
        soloCrear={altaSubRubro ? "subRubro" : altaRubro ? "rubro" : false}
        rubroPadreId={rubroPadre?.id ?? null}
        rubroPadreNombre={rubroPadre?.nombre ?? null}
        onCreado={(id) => onCreado?.(altaSubRubro ? "subRubros" : "rubros", id)}
        onCatalogoChanged={onCatalogoChanged}
      />
      <GestionarEstPorProdColoresModal
        open={abierto === "colores"}
        onOpenChange={cerrar}
        itemsIniciales={COLORES_INICIALES}
        esEditor={esEditor}
        soloCrear={altaDirecta && abierto === "colores"}
        onColorCreado={(color: EstPorProdColorItem) => onCreado?.("colores", color.id)}
        onCatalogoChanged={onCatalogoChanged}
      />
      <GestionarEstPorProdPresentacionModal
        open={abierto === "presentacion" && unidades !== null}
        onOpenChange={cerrar}
        itemsIniciales={PRESENTACIONES_INICIALES}
        unidades={unidades ?? []}
        esEditor={esEditor}
        soloCrear={altaDirecta && abierto === "presentacion"}
        onCreado={(id) => onCreado?.("presentacion", id)}
        onCatalogoChanged={onCatalogoChanged}
      />
    </>
  );
}
