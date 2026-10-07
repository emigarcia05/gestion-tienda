"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  listarColoresOpcionesAction,
  listarMarcasCatalogoAction,
  listarPresentacionesOpcionesAction,
  listarRubrosCatalogoAction,
} from "@/actions/listaProductos";
import type { MarcaCatalogoItem, OpcionCatalogoItem, RubroCatalogoItem } from "@/lib/listaProductos";

export type CatalogosProductoTienda = {
  rubros: RubroCatalogoItem[];
  marcas: MarcaCatalogoItem[];
  presentaciones: OpcionCatalogoItem[];
  colores: OpcionCatalogoItem[];
};

const CATALOGOS_VACIOS: CatalogosProductoTienda = {
  rubros: [],
  marcas: [],
  presentaciones: [],
  colores: [],
};

/**
 * Catálogos de los modales Agregar / Editar producto (Lista Productos). Se piden cada vez que `open`
 * pasa a true y al llamar `recargar` (p. ej. al cerrar un modal «GESTIONAR…»).
 */
export function useCatalogosProductoTienda(
  open: boolean
): CatalogosProductoTienda & { recargar: () => void } {
  const [catalogos, setCatalogos] = useState<CatalogosProductoTienda>(CATALOGOS_VACIOS);
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!open) return;
    let activo = true;
    void Promise.all([
      listarRubrosCatalogoAction(),
      listarMarcasCatalogoAction(),
      listarPresentacionesOpcionesAction(),
      listarColoresOpcionesAction(),
    ]).then(([rubros, marcas, presentaciones, colores]) => {
      if (!activo) return;
      for (const res of [rubros, marcas, presentaciones, colores]) {
        if (!res.ok) toast.error(res.error);
      }
      setCatalogos({
        rubros: rubros.ok ? rubros.data : [],
        marcas: marcas.ok ? marcas.data : [],
        presentaciones: presentaciones.ok ? presentaciones.data : [],
        colores: colores.ok ? colores.data : [],
      });
    });
    return () => {
      activo = false;
    };
  }, [open, version]);

  return { ...catalogos, recargar };
}
