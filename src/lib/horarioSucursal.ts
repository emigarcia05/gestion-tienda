import type { HorarioBloque, HorarioSucursal } from "@/lib/validations/sucursalCatalogo";

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
