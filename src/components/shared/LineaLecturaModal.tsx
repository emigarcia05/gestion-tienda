import { cn } from "@/lib/utils";

/** Dato de solo lectura en modal: etiqueta en negrita y valor en la misma línea. */
export default function LineaLecturaModal({
  etiqueta,
  valor,
  tabular = false,
}: {
  etiqueta: string;
  valor: string;
  tabular?: boolean;
}) {
  return (
    <p className="text-sm leading-snug text-foreground">
      <span className="font-bold">{etiqueta}:</span>{" "}
      <span className={cn(tabular && "tabular-nums")}>{valor}</span>
    </p>
  );
}
