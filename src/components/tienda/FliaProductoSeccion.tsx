"use client";

import { useEffect, useState } from "react";
import { listarDescripcionesFliaItemAction } from "@/actions/listaProductos";
import { Input } from "@/components/ui/input";
import { normalizarCodFliaItem } from "@/lib/prodProducto";

const TITULO_SECCION_CLASS = "text-center text-xs font-bold uppercase tracking-wide text-foreground";

/** Familia del ítem: código y nombre del catálogo, y las descripciones de los SKU a la derecha. */
export default function FliaProductoSeccion({
  codigo,
  nombre,
  onChangeCodigo,
  onChangeNombre,
  disabled,
}: {
  codigo: string;
  nombre: string;
  onChangeCodigo: (codigo: string) => void;
  onChangeNombre: (nombre: string) => void;
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
        onChangeNombre("");
        return;
      }
      void listarDescripcionesFliaItemAction({ codigo: normal.codigo }).then((res) => {
        if (!activo) return;
        setDescripciones(res.ok ? res.data.descripciones : []);
        if (res.ok) onChangeNombre(res.data.nombre);
      });
    }, 300);
    return () => {
      activo = false;
      clearTimeout(timer);
    };
  }, [codigo, onChangeNombre]);

  return (
    <section className="modal-seccion-formulario flex flex-col gap-3">
      <h3 className={TITULO_SECCION_CLASS}>FAMILIA</h3>
      <div className="grid grid-cols-[minmax(0,15%)_minmax(0,1fr)] items-start gap-3">
        <div className="flex flex-col gap-2">
          <Input
            value={codigo}
            inputMode="numeric"
            maxLength={6}
            aria-label="Código de familia"
            disabled={disabled}
            onChange={(e) => onChangeCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onBlur={() => {
              const normal = normalizarCodFliaItem(codigo);
              if (normal.ok && normal.codigo) onChangeCodigo(normal.codigo);
            }}
          />
          <Input
            value={nombre}
            maxLength={120}
            aria-label="Nombre de familia"
            disabled={disabled}
            onChange={(e) => onChangeNombre(e.target.value.toLocaleUpperCase("es-AR"))}
          />
        </div>
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
