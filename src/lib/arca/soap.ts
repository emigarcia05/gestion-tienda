import "server-only";

import { XMLParser } from "fast-xml-parser";
import { isRecord, xmlText } from "@/lib/arca/xml";

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
});

export type SoapCallResult =
  | { ok: true; body: Record<string, unknown>; raw: string }
  | { ok: false; error: string };

function soapFaultMessage(body: Record<string, unknown>): string | null {
  const fault = body.Fault;
  if (!isRecord(fault)) return null;
  const msg =
    xmlText(fault.faultstring) ??
    xmlText(fault.Reason) ??
    (isRecord(fault.detail) ? xmlText(fault.detail) : null);
  return msg && msg.trim() ? msg.trim() : "Error SOAP de ARCA.";
}

export async function postSoap(opts: {
  url: string;
  soapAction: string;
  envelope: string;
  timeoutMs: number;
}): Promise<SoapCallResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await fetch(opts.url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${opts.soapAction}"`,
      },
      body: opts.envelope,
      signal: controller.signal,
      cache: "no-store",
    });
    const raw = await res.text();
    let parsed: unknown;
    try {
      parsed = parser.parse(raw);
    } catch {
      console.error("[arca][soap] XML inválido", res.status);
      return { ok: false, error: "ARCA devolvió una respuesta XML inválida." };
    }
    if (!isRecord(parsed)) {
      return { ok: false, error: "ARCA devolvió una respuesta vacía." };
    }
    const envelope = isRecord(parsed.Envelope) ? parsed.Envelope : parsed;
    const bodyRaw = isRecord(envelope) ? envelope.Body : null;
    if (!isRecord(bodyRaw)) {
      if (!res.ok) {
        return {
          ok: false,
          error: `ARCA respondió HTTP ${res.status}.`,
        };
      }
      return { ok: false, error: "ARCA no devolvió Body SOAP." };
    }
    const fault = soapFaultMessage(bodyRaw);
    if (fault) {
      console.error("[arca][soap] Fault", fault);
      return { ok: false, error: fault };
    }
    if (!res.ok) {
      return { ok: false, error: `ARCA respondió HTTP ${res.status}.` };
    }
    return { ok: true, body: bodyRaw, raw };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "Tiempo de espera agotado al llamar a ARCA." };
    }
    console.error("[arca][soap] red", e instanceof Error ? e.message : "error");
    return { ok: false, error: "No se pudo conectar con ARCA." };
  } finally {
    clearTimeout(timer);
  }
}
