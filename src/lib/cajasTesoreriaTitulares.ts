import { z } from "zod";

export const TITULARES_CAJA_TESORERIA = [
  "SUC. GUAYMALLEN",
  "SUC. MAIPU",
  "WALTER GARCIA",
  "FERNANDO PANAIA",
  "EMILIANO GARCIA",
  "VANESA GARCIA",
  "COORPORATIVO",
] as const;

export type TitularCajaTesoreria = (typeof TITULARES_CAJA_TESORERIA)[number];

/** Nombre persistido en `fin_tesoreria.titular` / `fin_tesoreria_cheques.tenedor`. */
export const titularCajaTesoreriaSchema = z
  .string()
  .trim()
  .min(1, "Seleccioná un titular válido.")
  .max(200, "El titular es demasiado largo.");

export function normalizarNombreTitularCaja(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

/** Catálogo + valor actual si ya no está marcado como titular financiero. */
export function opcionesTitularTesoreria(
  catalogo: readonly string[],
  valorActual?: string | null
): string[] {
  const nombres = [...catalogo];
  const actual = valorActual ? normalizarNombreTitularCaja(valorActual) : "";
  if (actual && !nombres.includes(actual)) {
    nombres.unshift(actual);
  }
  return nombres;
}
