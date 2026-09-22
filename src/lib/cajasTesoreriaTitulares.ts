import { z } from "zod";

/** Ítem del catálogo `tesoreria_titulares`. */
export interface TesoreriaTitularItem {
  id: string;
  nombre: string;
}

/** Nombre persistido en `tesoreria_cajas.titular` / `tesoreria_cheques.tenedor`. */
export const titularCajaTesoreriaSchema = z
  .string()
  .trim()
  .min(1, "Seleccioná un titular válido.")
  .max(200, "El titular es demasiado largo.");

export type TitularCajaTesoreria = string;

export function normalizarNombreTitularCaja(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

/** Catálogo de `personal` (titular financiero) + valor actual si es legado. */
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
