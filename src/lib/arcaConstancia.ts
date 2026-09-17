/**
 * DTO de consulta Constancia de Inscripción (cliente + borde).
 * Sin SOAP ni secretos.
 */

export type ArcaConstanciaPersona = {
  cuit: string;
  nombre: string;
  /** Código `condicion_iva_cod_arca`. Null si ARCA no informó un régimen claro. */
  condicionIva: number | null;
  condicionIvaDescripcion: string | null;
  estadoClave: string | null;
  tipoPersona: string | null;
};

export type ArcaConstanciaApiResult =
  | { ok: true; data: ArcaConstanciaPersona }
  | { ok: false; error: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textoOpcional(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Parsea el JSON de `GET /api/arca/constancia` (borde cliente). */
export function parseArcaConstanciaApiJson(json: unknown): ArcaConstanciaApiResult {
  const rec = asRecord(json);
  if (!rec) return { ok: false, error: "No se pudo consultar el CUIT en ARCA." };
  if (rec.ok === true) {
    const d = asRecord(rec.data);
    if (!d || typeof d.cuit !== "string" || typeof d.nombre !== "string") {
      return { ok: false, error: "ARCA devolvió una constancia inválida." };
    }
    return {
      ok: true,
      data: {
        cuit: d.cuit,
        nombre: d.nombre,
        condicionIva: typeof d.condicionIva === "number" ? d.condicionIva : null,
        condicionIvaDescripcion: textoOpcional(d.condicionIvaDescripcion),
        estadoClave: textoOpcional(d.estadoClave),
        tipoPersona: textoOpcional(d.tipoPersona),
      },
    };
  }
  return {
    ok: false,
    error: typeof rec.error === "string" ? rec.error : "No se pudo consultar el CUIT en ARCA.",
  };
}
