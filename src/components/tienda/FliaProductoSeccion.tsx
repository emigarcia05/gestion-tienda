"use client";

import { useEffect, useState } from "react";
import { listarDescripcionesFliaItemAction } from "@/actions/listaProductos";
import { Input } from "@/components/ui/input";
import { normalizarCodFliaItem } from "@/lib/prodProducto";

const TITULO_SECCION_CLASS = "text-center text-xs font-bold uppercase tracking-wide text-foreground";

/** Familia del ítem: número a la izquierda y las descripciones de esa familia a la derecha. */
export default function FliaProductoSeccion({
  codigo,
  onChange,
  disabled,
}: {
  codigo: string;
  onChange: (codigo: string) => void;
  disabled: boolean;
}) {
  const [descripciones, setDescripciones] = useState<string[]>([]);

  useEffect(() => {
    const normal = normalizarCodFliaItem(codigo);
    let activo = true;
    const timer = setTimeout(() => {
      if (!activo) return;
      if (!normal.ok || normal.codigo == null) {
        setDescripciones([]);
        return;
      }
      void listarDescripcionesFliaItemAction({ codigo: normal.codigo }).then((res) => {
        if (!activo) return;
        setDescripciones(res.ok ? res.data.descripciones : []);
      });
    }, 300);
    return () => {
      activo = false;
      clearTimeout(timer);
    };
  }, [codigo]);

  return (
    <section className="modal-seccion-formulario flex flex-col gap-3">
      <h3 className={TITULO_SECCION_CLASS}>COD. FAMILIA</h3>
      <div className="grid grid-cols-[minmax(0,15%)_minmax(0,1fr)] items-start gap-3">
        <Input
          value={codigo}
          inputMode="numeric"
          maxLength={6}
          aria-label="Código de familia"
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onBlur={() => {
            const normal = normalizarCodFliaItem(codigo);
            if (normal.ok && normal.codigo) onChange(normal.codigo);
          }}
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
