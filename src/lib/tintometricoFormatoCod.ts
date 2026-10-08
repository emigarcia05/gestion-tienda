import { z } from "zod";

/**
 * Máscara de `prod_marcas.formato_cod_tintometrico`:
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

function longitudToken(t: TokenFormatoCod): number {
  return t.tipo === "FIJO" ? t.valor.length : 1;
}

/** Longitud del código completo (fijos + slots). `null` si la máscara es inválida. */
export function longitudCompletaFormatoCod(formato: string): number | null {
  const r = parsearFormatoCod(formato.trim());
  if (!r.ok) return null;
  return r.tokens.reduce((n, t) => n + longitudToken(t), 0);
}

/**
 * Aplica la máscara al texto tipeado (siempre MAYÚSCULAS).
 * FIJO y separadores quedan en el valor y no se pueden borrar.
 * Si el slot espera letra y llega un dígito (o al revés), no incorpora ese carácter
 * y devuelve `error` para el input.
 */
export function aplicarEntradaCodigoFormato(
  formato: string | null | undefined,
  raw: string
): { value: string; error: string | null } {
  const upper = raw.toUpperCase();
  if (formato == null || formato.trim() === "") {
    return { value: upper, error: null };
  }
  const parsed = parsearFormatoCod(formato.trim());
  if (!parsed.ok) return { value: upper, error: null };

  let i = 0;
  let out = "";

  function consumirLiteral(literal: string) {
    if (upper.startsWith(literal, i)) {
      i += literal.length;
      return;
    }
    const rest = upper.slice(i);
    if (rest.length > 0 && literal.startsWith(rest)) {
      i = upper.length;
    }
  }

  for (const t of parsed.tokens) {
    if (t.tipo === "FIJO" || t.tipo === "SEPARADOR") {
      out += t.valor;
      consumirLiteral(t.valor);
      continue;
    }

    if (i >= upper.length) break;

    let aceptado = false;
    while (i < upper.length && !aceptado) {
      const ch = upper[i]!;
      if (t.tipo === "LETRA") {
        if (/[A-Z]/.test(ch)) {
          out += ch;
          i += 1;
          aceptado = true;
        } else if (/[0-9]/.test(ch)) {
          return { value: out, error: "En esta posición va una letra." };
        } else {
          i += 1;
        }
      } else if (/[0-9]/.test(ch)) {
        out += ch;
        i += 1;
        aceptado = true;
      } else if (/[A-Z]/.test(ch)) {
        return { value: out, error: "En esta posición va un número." };
      } else {
        i += 1;
      }
    }
    if (!aceptado) break;
  }

  return { value: out, error: null };
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
