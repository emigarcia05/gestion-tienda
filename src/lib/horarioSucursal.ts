import {
  horarioSucursalSchema,
  type HorarioBloque,
  type HorarioSucursal,
} from "@/lib/validations/sucursalCatalogo";

export const HORARIO_SUCURSAL_CERRADO: HorarioSucursal = {
  lunVie: { modo: "cerrado" },
  sabado: { modo: "cerrado" },
  domingo: { modo: "cerrado" },
};

const TEXTOS_BLOQUE: { clave: keyof HorarioSucursal; texto: string }[] = [
  { clave: "lunVie", texto: "Lun a Vie" },
  { clave: "sabado", texto: "Sáb" },
  { clave: "domingo", texto: "Dom" },
];

function textoBloque(etiqueta: string, bloque: HorarioBloque): string {
  if (bloque.modo === "cerrado") return `${etiqueta} cerrado`;
  if (bloque.modo === "corrido") return `${etiqueta} ${bloque.desde}–${bloque.hasta}`;
  return `${etiqueta} ${bloque.mananaDesde}–${bloque.mananaHasta} y ${bloque.tardeDesde}–${bloque.tardeHasta}`;
}

/** Una sola celda: los tres tramos, domingo incluido aunque esté cerrado. */
export function textoHorarioSucursal(horario: HorarioSucursal): string {
  return TEXTOS_BLOQUE.map((fila) => textoBloque(fila.texto, horario[fila.clave])).join(" · ");
}

function horaPdf(hhmm: string): string {
  const [hora, minuto] = hhmm.split(":");
  const numero = Number(hora);
  if (!Number.isFinite(numero) || minuto == null) return hhmm;
  return `${numero}:${minuto}`;
}

const ETIQUETAS_PDF: { clave: keyof HorarioSucursal; texto: string }[] = [
  { clave: "lunVie", texto: "Lun a Vie" },
  { clave: "sabado", texto: "Sábado" },
  { clave: "domingo", texto: "Domingo" },
];

/** Una fila por día abierto. Los cerrados no entran. */
export function lineasHorarioSucursalPdf(horario: HorarioSucursal): string[] {
  const lineas: string[] = [];
  for (const fila of ETIQUETAS_PDF) {
    const bloque = horario[fila.clave];
    if (bloque.modo === "cerrado") continue;
    if (bloque.modo === "corrido") {
      lineas.push(`${fila.texto} ${horaPdf(bloque.desde)} a ${horaPdf(bloque.hasta)}`);
      continue;
    }
    lineas.push(
      `${fila.texto} ${horaPdf(bloque.mananaDesde)} a ${horaPdf(bloque.mananaHasta)} / ${horaPdf(bloque.tardeDesde)} a ${horaPdf(bloque.tardeHasta)}`
    );
  }
  return lineas;
}

/** Horario del PDF: un día por línea. Null si no hay forma válida o todos están cerrados. */
export function textoHorarioSucursalDesdeDb(value: unknown): string | null {
  const parsed = horarioSucursalSchema.safeParse(value);
  if (!parsed.success) return null;
  const lineas = lineasHorarioSucursalPdf(parsed.data);
  return lineas.length > 0 ? lineas.join("\n") : null;
}
