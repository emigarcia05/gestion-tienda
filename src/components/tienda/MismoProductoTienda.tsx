"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  buscarSkusMismoProductoAction,
  leerProductoDelSkuAction,
} from "@/actions/listaProductos";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import type { SkuMismoProducto } from "@/services/prodProducto.service";

export type EleccionMismoProducto =
  | { tipo: "igual" }
  | { tipo: "unir"; codTienda: string; descripcion: string }
  | { tipo: "soltar" };

/** En Editar: muestra el producto y permite unir este SKU a otro de la misma marca. */
export default function MismoProductoTienda({
  codTienda,
  idMarca,
  disabled,
  eleccion,
  onChange,
}: {
  codTienda: string;
  idMarca: string;
  disabled: boolean;
  eleccion: EleccionMismoProducto;
  onChange: (eleccion: EleccionMismoProducto) => void;
}) {
  const [nombre, setNombre] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [items, setItems] = useState<SkuMismoProducto[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    let activo = true;
    void leerProductoDelSkuAction({ codTienda }).then((res) => {
      if (!activo) return;
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setNombre(res.data.nombre);
      setManual(res.data.manual);
    });
    return () => {
      activo = false;
    };
  }, [codTienda]);

  async function alBuscar(valor: string) {
    if (valor.trim().length < 3 || idMarca.length === 0) {
      setItems([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    const res = await buscarSkusMismoProductoAction({
      idMarca,
      q: valor,
      excluirCodTienda: codTienda,
    });
    setBuscando(false);
    if (!res.ok) {
      toast.error(res.error);
      setItems([]);
      return;
    }
    setItems(res.data);
  }

  const { q, handleQChange, isDebouncing, ref } = useFiltrosConBusqueda({
    qActual: "",
    debounceMs: 300,
    onDebouncedSearch: (valor) => {
      void alBuscar(valor);
    },
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <ModalMicroLabel>Producto</ModalMicroLabel>
        <p className="text-sm">{nombre ?? "Se asigna al guardar."}</p>
        {manual && eleccion.tipo === "igual" ? (
          <Button
            type="button"
            variant="outline"
            className="w-fit border-primary"
            disabled={disabled}
            onClick={() => onChange({ tipo: "soltar" })}
          >
            Separar
          </Button>
        ) : null}
        {eleccion.tipo === "soltar" ? (
          <p className="text-sm text-muted-foreground">Al guardar se calcula de nuevo por el nombre.</p>
        ) : null}
        {eleccion.tipo === "unir" ? (
          <p className="text-sm">Mismo producto que {eleccion.descripcion}</p>
        ) : null}
      </div>
      <label className="flex flex-col gap-1.5" htmlFor="mismo-producto-item">
        <ModalMicroLabel>Mismo producto que</ModalMicroLabel>
        <FiltroBusquedaInput
          id="mismo-producto-item"
          placeholder="BUSCAR ÍTEM DE LA MISMA MARCA..."
          value={q}
          onChange={handleQChange}
          isDebouncing={isDebouncing || buscando}
          inputRef={ref}
          disabled={disabled || idMarca.length === 0}
        />
      </label>
      {q.trim().length < 3 ? (
        <p className="text-sm text-muted-foreground">ESCRIBÍ AL MENOS 3 LETRAS.</p>
      ) : items.length === 0 && !buscando && !isDebouncing ? (
        <p className="text-sm text-muted-foreground">NO HAY ÍTEMS.</p>
      ) : (
        <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
          {items.map((item) => (
            <li key={item.codTienda}>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-start whitespace-normal border-primary py-2 text-left"
                disabled={disabled}
                onClick={() =>
                  onChange({ tipo: "unir", codTienda: item.codTienda, descripcion: item.descripcion })
                }
              >
                {item.descripcion}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
