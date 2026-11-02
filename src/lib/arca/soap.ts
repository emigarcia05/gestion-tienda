import "server-only";

import https from "node:https";
import { XMLParser } from "fast-xml-parser";
import { isRecord, xmlText } from "@/lib/arca/xml";

/**
 * WSFEv1 de producción (`servicios1.afip.gov.ar`) negocia DHE con un grupo
 * que OpenSSL 3 rechaza: `ERR_SSL_DH_KEY_TOO_SMALL`. `SECLEVEL=1` lo acepta
 * y el canal sigue en TLS 1.2 con AES-256-GCM. Solo este agente.
 */
const agenteTlsArca = new https.Agent({
  keepAlive: true,
  ciphers: "DEFAULT@SECLEVEL=1",
});

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
});

export type SoapCallResult =
  | { ok: true; body: Record<string, unknown>; raw: string }
  | { ok: false; error: string };

function hostDeUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "desconocido";
  }
}

function textoCodigo(value: unknown): string | null {
  return typeof value === "string" && /^[A-Z][A-Z0-9_]{1,40}$/.test(value) ? value : null;
}

/** Código de red o TLS. OpenSSL a veces lo deja en `cause`. */
function codigoFalloRed(error: unknown): string | null {
  let actual: unknown = error;
  for (let i = 0; i < 5 && isRecord(actual); i++) {
    const codigo = textoCodigo(actual.code);
    if (codigo && codigo !== "ABORT_ERR") return codigo;
    const mensaje = typeof actual.message === "string" ? actual.message : "";
    const enMensaje = /\b([A-Z][A-Z0-9_]{2,40})\b/.exec(mensaje)?.[1] ?? null;
    if (enMensaje) return enMensaje;
    actual = actual.cause;
  }
  return null;
}

function mensajeFalloRed(codigo: string | null): string {
  switch (codigo) {
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return "No se pudo resolver el servidor de ARCA.";
    case "ECONNRESET":
    case "ECONNREFUSED":
    case "EPIPE":
    case "ECONNABORTED":
    case "UND_ERR_SOCKET":
      return "ARCA cortó la conexión.";
    case "UND_ERR_CONNECT_TIMEOUT":
      return "Tiempo de espera agotado al llamar a ARCA.";
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
    case "CERT_HAS_EXPIRED":
    case "DEPTH_ZERO_SELF_SIGNED_CERT":
    case "ERR_TLS_CERT_ALTNAME_INVALID":
    case "SELF_SIGNED_CERT_IN_CHAIN":
      return "No se pudo verificar el certificado del servidor de ARCA.";
    default:
      return codigo ? `No se pudo conectar con ARCA (${codigo}).` : "No se pudo conectar con ARCA.";
  }
}

function soapFaultMessage(body: Record<string, unknown>): string | null {
  const fault = body.Fault;
  if (!isRecord(fault)) return null;
  const msg =
    xmlText(fault.faultstring) ??
    xmlText(fault.Reason) ??
    (isRecord(fault.detail) ? xmlText(fault.detail) : null);
  return msg && msg.trim() ? msg.trim() : "Error SOAP de ARCA.";
}

function pedirSoap(opts: {
  url: string;
  soapAction: string;
  envelope: string;
  signal: AbortSignal;
}): Promise<{ status: number; raw: string }> {
  const url = new URL(opts.url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port === "" ? 443 : Number(url.port),
        path: `${url.pathname}${url.search}`,
        method: "POST",
        agent: agenteTlsArca,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: `"${opts.soapAction}"`,
          "Content-Length": Buffer.byteLength(opts.envelope),
        },
        signal: opts.signal,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer | string) => {
          chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            raw: Buffer.concat(chunks).toString("utf8"),
          });
        });
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.write(opts.envelope);
    req.end();
  });
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
    const res = await pedirSoap({
      url: opts.url,
      soapAction: opts.soapAction,
      envelope: opts.envelope,
      signal: controller.signal,
    });
    const raw = res.raw;
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
      if (res.status < 200 || res.status >= 300) {
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
    if (res.status < 200 || res.status >= 300) {
      return { ok: false, error: `ARCA respondió HTTP ${res.status}.` };
    }
    return { ok: true, body: bodyRaw, raw };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "Tiempo de espera agotado al llamar a ARCA." };
    }
    const codigo = codigoFalloRed(e);
    console.error(
      "[arca][soap] red",
      e instanceof Error ? e.message : "error",
      codigo ?? "-",
      hostDeUrl(opts.url)
    );
    return { ok: false, error: mensajeFalloRed(codigo) };
  } finally {
    clearTimeout(timer);
  }
}
