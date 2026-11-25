"use client";

import { useEffect, useState } from "react";
import { listarDescripcionesFliaItemAction } from "@/actions/listaProductos";
import { Input } from "@/components/ui/input";

const TITULO_SECCION_CLASS = "text-center text-xs font-bold uppercase tracking-wide text-foreground";

/** Familia del ítem: el nombre del catálogo, y las descripciones de los SKU a la derecha. */
export default function FliaProductoSeccion({
  nombre,
  onChangeNombre,
  disabled,
}: {
  nombre: string;
  onChangeNombre: (nombre: string) => void;
  disabled: boolean;
}) {
  const [descripciones, setDescripciones] = useState<string[]>([]);

  useEffect(() => {
    let activo = true;
    const timer = setTimeout(() => {
      if (!activo) return;
      if (nombre.trim().length === 0) {
        setDescripciones([]);
        return;
      }
      void listarDescripcionesFliaItemAction({ nombre }).then((res) => {
        if (!activo) return;
        setDescripciones(res.ok ? res.data.descripciones : []);
      });
    }, 300);
    return () => {
      activo = false;
      clearTimeout(timer);
    };
  }, [nombre]);

  return (
    <section className="modal-seccion-formulario flex flex-col gap-3">
      <h3 className={TITULO_SECCION_CLASS}>FAMILIA</h3>
      <div className="grid grid-cols-[minmax(0,18rem)_minmax(0,1fr)] items-start gap-3">
        <Input
          value={nombre}
          maxLength={120}
          aria-label="Nombre de familia"
          disabled={disabled}
          onChange={(e) => onChangeNombre(e.target.value.toLocaleUpperCase("es-AR"))}
        />
        <ul className="flex max-h-40 min-w-0 flex-col gap-1 overflow-y-auto">
          {descripciones.map((descripcion, indice) => (
            <li key={`${indice}-${descripcion}`} className="text-sm leading-snug text-foreground">
              {descripcion}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
