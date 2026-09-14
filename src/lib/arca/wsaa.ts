import "server-only";

import { z } from "zod";
import { firmarTraCms } from "@/lib/arca/cms";
import { leerArcaEnv, urlWsaa, type ArcaEnvConfig } from "@/lib/arca/env";
import { postSoap } from "@/lib/arca/soap";
import { xmlEscape, xmlText, isRecord } from "@/lib/arca/xml";
import { TIMEZONE_ARGENTINA } from "@/lib/fechaArgentina";
import { ARCA_SERVICIO_WSFE, type ArcaAmbiente } from "@/lib/facturaFiscal";

const loginTicketResponseSchema = z.object({
  token: z.string().min(10),
  sign: z.string().min(10),
  expiration: z.date(),
});

export type WsaaTicket = {
  token: string;
  sign: string;
  expiration: Date;
  cuit: string;
  servicio: string;
  ambiente: ArcaAmbiente;
};

let lastUniqueId = 0;

function nextUniqueId(): number {
  const n = Math.floor(Date.now() / 1000);
  lastUniqueId = n <= lastUniqueId ? lastUniqueId + 1 : n;
  return lastUniqueId;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatArcaDateTime(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_ARGENTINA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${pad2(Number(get("second")))}-03:00`;
}

function buildTraXml(servicio: string, gen: Date, exp: Date, uniqueId: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${formatArcaDateTime(gen)}</generationTime>
    <expirationTime>${formatArcaDateTime(exp)}</expirationTime>
  </header>
  <service>${xmlEscape(servicio)}</service>
</loginTicketRequest>`;
}

function parseLoginCmsReturn(xml: string): { token: string; sign: string; expiration: Date } | { error: string } {
  const token = /<token>([^<]+)<\/token>/i.exec(xml)?.[1];
  const sign = /<sign>([^<]+)<\/sign>/i.exec(xml)?.[1];
  const expRaw = /<expirationTime>([^<]+)<\/expirationTime>/i.exec(xml)?.[1];
  if (!token || !sign || !expRaw) {
    return { error: "WSAA no devolvió token/sign/expiration." };
  }
  const expiration = new Date(expRaw);
  if (Number.isNaN(expiration.getTime())) {
    return { error: "WSAA devolvió una fecha de vencimiento inválida." };
  }
  const parsed = loginTicketResponseSchema.safeParse({ token, sign, expiration });
  if (!parsed.success) {
    return { error: "Ticket WSAA inválido." };
  }
  return parsed.data;
}

function decodeLoginCmsPayload(body: Record<string, unknown>): string | null {
  const login = isRecord(body.loginCmsResponse)
    ? body.loginCmsResponse
    : isRecord(body.LoginCmsResponse)
      ? body.LoginCmsResponse
      : body;
  const ret =
    xmlText(login.loginCmsReturn) ??
    xmlText(login.LoginCmsReturn) ??
    xmlText(isRecord(login) ? login.in0 : null);
  return ret;
}

export async function wsaaLoginCms(opts?: {
  servicio?: string;
  env?: ArcaEnvConfig;
}): Promise<{ ok: true; ticket: WsaaTicket } | { ok: false; error: string }> {
  const env = opts?.env ?? leerArcaEnv();
  if ("error" in env) return { ok: false, error: env.error };
  const servicio = opts?.servicio ?? ARCA_SERVICIO_WSFE;
  const now = new Date();
  const gen = new Date(now.getTime() - 5 * 60_000);
  const exp = new Date(now.getTime() + 12 * 60 * 60_000);
  const tra = buildTraXml(servicio, gen, exp, nextUniqueId());

  let cms: string;
  try {
    cms = firmarTraCms(tra, env.certPem, env.keyPem, env.keyPassphrase);
  } catch (e) {
    console.error("[arca][wsaa] cms", e instanceof Error ? e.message : "error");
    return { ok: false, error: "No se pudo firmar el ticket WSAA. Revisá certificado y clave." };
  }

  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.afip.gov.ar/ws/">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${xmlEscape(cms)}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

  const soap = await postSoap({
    url: urlWsaa(env.ambiente),
    soapAction: "",
    envelope,
    timeoutMs: env.timeoutMs,
  });
  if (!soap.ok) {
    return { ok: false, error: soap.error };
  }
  const payload = decodeLoginCmsPayload(soap.body);
  if (!payload) {
    return { ok: false, error: "WSAA no devolvió loginCmsReturn." };
  }
  const decoded = payload.includes("&lt;")
    ? payload.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    : payload;
  const parsed = parseLoginCmsReturn(decoded);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  return {
    ok: true,
    ticket: {
      token: parsed.token,
      sign: parsed.sign,
      expiration: parsed.expiration,
      cuit: env.cuit,
      servicio,
      ambiente: env.ambiente,
    },
  };
}
