import {
  addDaysToIsoYmdArgentina,
  diffCalendarDaysIsoYmdArgentina,
} from "@/lib/fechaArgentina";
import {
  horarioSucursalSchema,
  type HorarioBloque,
  type HorarioSucursal,
} from "@/lib/validations/sucursalCatalogo";

/** Un día cuenta entero si la sucursal abre al menos estas horas. */
const HORAS_DIA_HABIL = 8;

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

function minutosHora(hora: string): number {
  const [horas, minutos] = hora.split(":");
  const h = Number(horas);
  const m = Number(minutos);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/** Horas abiertas de un tramo. Cerrado = 0. */
export function horasHorarioBloque(bloque: HorarioBloque): number {
  if (bloque.modo === "cerrado") return 0;
  if (bloque.modo === "corrido") {
    return Math.max(0, (minutosHora(bloque.hasta) - minutosHora(bloque.desde)) / 60);
  }
  const manana = Math.max(0, (minutosHora(bloque.mananaHasta) - minutosHora(bloque.mananaDesde)) / 60);
  const tarde = Math.max(0, (minutosHora(bloque.tardeHasta) - minutosHora(bloque.tardeDesde)) / 60);
  return manana + tarde;
}

/**
 * 1 = abre al menos 8 h. 0,5 = abre, pero menos de 8 h. 0 = no abre.
 */
export function pesoDiaHabilDesdeHoras(horas: number): number {
  if (!Number.isFinite(horas) || horas <= 0) return 0;
  if (horas >= HORAS_DIA_HABIL) return 1;
  return 0.5;
}

function claveHorarioIso(isoYmd: string): keyof HorarioSucursal | null {
  const [anio, mes, dia] = isoYmd.split("-").map(Number);
  if (!anio || !mes || !dia) return null;
  const dow = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  if (dow === 0) return "domingo";
  if (dow === 6) return "sabado";
  return "lunVie";
}

export function horarioSucursalDesdeDb(value: unknown): HorarioSucursal | null {
  const parsed = horarioSucursalSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Null si no se lee o si los tres tramos están cerrados: ahí se usa el calendario fijo. */
export function horarioSucursalParaDiasHabiles(value: unknown): HorarioSucursal | null {
  const horario = horarioSucursalDesdeDb(value);
  if (!horario) return null;
  const abre =
    horasHorarioBloque(horario.lunVie) > 0 ||
    horasHorarioBloque(horario.sabado) > 0 ||
    horasHorarioBloque(horario.domingo) > 0;
  return abre ? horario : null;
}

/** Peso del día según el horario de la sucursal. */
export function pesoDiaHabilSucursal(horario: HorarioSucursal, isoYmd: string): number {
  const clave = claveHorarioIso(isoYmd);
  if (!clave) return 0;
  return pesoDiaHabilDesdeHoras(horasHorarioBloque(horario[clave]));
}

/** Lun a vie entero, sábado medio día, domingo cerrado. Si el horario no se puede leer. */
export function pesoDiaHabilFijo(isoYmd: string): number {
  const clave = claveHorarioIso(isoYmd);
  if (clave === "domingo") return 0;
  if (clave === "sabado") return 0.5;
  if (clave === "lunVie") return 1;
  return 0;
}

/** Suma de pesos entre dos fechas inclusive. */
export function sumaPesosDiasHabiles(
  pesoDeDia: (isoYmd: string) => number,
  desdeIso: string,
  hastaIsoInclusive: string
): number {
  const dias = diffCalendarDaysIsoYmdArgentina(desdeIso, hastaIsoInclusive);
  if (dias == null || dias < 0) return 0;
  let total = 0;
  let cursor = desdeIso;
  for (let i = 0; i <= dias; i += 1) {
    total += pesoDeDia(cursor);
    cursor = addDaysToIsoYmdArgentina(cursor, 1);
  }
  return total;
}
