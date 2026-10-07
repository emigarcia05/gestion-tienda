import { z } from "zod";

/**
 * Máscara de `tintometrico_marcas.formato_cod`:
 * - `L` = una letra (A–Z, sin distinguir mayúsculas).
 * - `N` = un número (0–9).
 * - `"…"` = texto fijo (ej. `"SW"`).
 * - Espacio, `/`, `-` y `.` = literales.
 * Ej.: `LLNN NN/NNN` ↔ `YY12 05/132`; `"SW"NNNN` ↔ `SW2365`.
 */
export type TokenFormatoCod =
  | { tipo: "LETRA" }
  | { tipo: "NUMERO" }
  | { tipo: "FIJO"; valor: string }
  | { tipo: "SEPARADOR"; valor: " " | "/" | "-" | "." };

const SEPARADORES = new Set([" ", "/", "-", "."]);

export function parsearFormatoCod(
  formato: string
): { ok: true; tokens: TokenFormatoCod[] } | { ok: false; error: string } {
  const tokens: TokenFormatoCod[] = [];
  let i = 0;
  while (i < formato.length) {
    const c = formato[i]!;
    if (c === "L") {
      tokens.push({ tipo: "LETRA" });
      i++;
    } else if (c === "N") {
      tokens.push({ tipo: "NUMERO" });
      i++;
    } else if (c === '"') {
      const fin = formato.indexOf('"', i + 1);
      if (fin === -1) return { ok: false, error: "Falta cerrar las comillas del texto fijo." };
      const valor = formato.slice(i + 1, fin).toUpperCase();
      if (!/^[A-Z0-9]+$/.test(valor)) {
        return { ok: false, error: "El texto fijo solo admite letras y números." };
      }
      tokens.push({ tipo: "FIJO", valor });
      i = fin + 1;
    } else if (SEPARADORES.has(c)) {
      tokens.push({ tipo: "SEPARADOR", valor: c as " " | "/" | "-" | "." });
      i++;
    } else {
      return {
        ok: false,
        error: `Carácter «${c}» inválido: usá L, N, "texto fijo", espacio, /, - o .`,
      };
    }
  }
  if (!tokens.some((t) => t.tipo !== "SEPARADOR")) {
    return { ok: false, error: "El formato debe tener al menos una letra, número o texto fijo." };
  }
  return { ok: true, tokens };
}

export const formatoCodSchema = z
  .string()
  .trim()
  .min(1, "Ingresá el formato del código.")
  .max(40, "Formato demasiado largo.")
  .superRefine((v, ctx) => {
    const r = parsearFormatoCod(v);
    if (!r.ok) ctx.addIssue({ code: "custom", message: r.error });
  });

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");
}

/** Regex anclada (sin distinguir mayúsculas); null si la máscara es inválida. */
export function regexDesdeFormatoCod(formato: string): RegExp | null {
  const r = parsearFormatoCod(formato.trim());
  if (!r.ok) return null;
  const cuerpo = r.tokens
    .map((t) => {
      if (t.tipo === "LETRA") return "[A-Z]";
      if (t.tipo === "NUMERO") return "[0-9]";
      return escaparRegex(t.valor);
    })
    .join("");
  return new RegExp(`^${cuerpo}$`, "i");
}

export function codigoCumpleFormatoCod(codigo: string, formato: string): boolean {
  return regexDesdeFormatoCod(formato)?.test(codigo.trim()) ?? false;
}

/** Lectura humana: `LETRA, LETRA, NÚMERO, …, "SW" FIJO`. */
export function describirFormatoCod(formato: string): string {
  const r = parsearFormatoCod(formato.trim());
  if (!r.ok) return "";
  return r.tokens
    .map((t) => {
      if (t.tipo === "LETRA") return "LETRA";
      if (t.tipo === "NUMERO") return "NÚMERO";
      if (t.tipo === "FIJO") return `"${t.valor}" FIJO`;
      return t.valor === " " ? "ESPACIO" : t.valor === "/" ? "BARRA" : t.valor === "-" ? "GUION" : "PUNTO";
    })
    .join(", ");
}

/** Máscara a partir de un código de ejemplo (letras → L, dígitos → N); no detecta texto fijo. */
export function inferirFormatoCodDesdeEjemplo(codigo: string): string {
  return codigo
    .trim()
    .toUpperCase()
    .replace(/[A-Z]/g, "L")
    .replace(/[0-9]/g, "N");
}
