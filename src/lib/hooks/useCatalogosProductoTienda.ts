"use client";

import { useEffect, useState } from "react";
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

/** Catálogos de los modales Agregar / Editar producto (Lista Productos). Se piden cada vez que `open` pasa a true. */
export function useCatalogosProductoTienda(open: boolean): CatalogosProductoTienda {
  const [catalogos, setCatalogos] = useState<CatalogosProductoTienda>(CATALOGOS_VACIOS);

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
  }, [open]);

  return catalogos;
}
