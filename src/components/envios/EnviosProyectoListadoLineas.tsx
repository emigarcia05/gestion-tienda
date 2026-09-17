"use client";

import { partesProyectoEnvioListado, type EnviosDireccionItem } from "@/lib/envios";
import { cn } from "@/lib/utils";

interface Props {
  dir: EnviosDireccionItem;
  className?: string;
}

export default function EnviosProyectoListadoLineas({ dir, className }: Props) {
  const partes = partesProyectoEnvioListado(dir);
  const title = [partes.nombre, partes.direccion, partes.referencia]
    .filter((s) => s !== "")
    .join(" ");
  return (
    <div
      className={cn("min-w-0 flex-1 flex flex-col gap-0.5 text-sm text-foreground", className)}
      title={title}
    >
      {partes.nombre !== "" ? <span className="break-words">{partes.nombre}</span> : null}
      {partes.direccion !== "" ? <span className="break-words">{partes.direccion}</span> : null}
      {partes.referencia !== "" ? (
        <span className="break-words">({partes.referencia})</span>
      ) : null}
    </div>
  );
}
