import "server-only";

import {
  leerArcaConexion,
  urlConstancia,
  type ArcaConexionConfig,
} from "@/lib/arca/env";
import { postSoap } from "@/lib/arca/soap";
import type {
  ArcaConstanciaImpuesto,
  ArcaConstanciaRaw,
  WsfeAuth,
} from "@/lib/arca/types";
import {
  asXmlArray,
  isRecord,
  xmlEscape,
  xmlInt,
  xmlText,
} from "@/lib/arca/xml";

const NS = "http://a5.soap.ws.server.puc.sr/";

function envelopeGetPersonaV2(auth: WsfeAuth, idPersona: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <getPersona_v2 xmlns="${NS}">
      <token>${xmlEscape(auth.token)}</token>
      <sign>${xmlEscape(auth.sign)}</sign>
      <cuitRepresentada>${xmlEscape(auth.cuit)}</cuitRepresentada>
      <idPersona>${xmlEscape(idPersona)}</idPersona>
    </getPersona_v2>
  </soap:Body>
</soap:Envelope>`;
}

function personaReturn(body: Record<string, unknown>): Record<string, unknown> | null {
  const resp = body.getPersona_v2Response ?? body.GetPersona_v2Response;
  if (!isRecord(resp)) return null;
  const ret = resp.personaReturn ?? resp.PersonaReturn;
  return isRecord(ret) ? ret : null;
}

function parseImpuestos(raw: unknown): ArcaConstanciaImpuesto[] {
  if (!isRecord(raw)) return [];
  const list = asXmlArray(raw.impuesto ?? raw.Impuesto);
  const out: ArcaConstanciaImpuesto[] = [];
  for (const item of list) {
    if (!isRecord(item)) continue;
    const idImpuesto = xmlInt(item.idImpuesto ?? item.IdImpuesto);
    if (idImpuesto == null) continue;
    out.push({
      idImpuesto,
      estadoImpuesto: xmlText(item.estadoImpuesto ?? item.EstadoImpuesto),
      descripcionImpuesto: xmlText(item.descripcionImpuesto ?? item.DescripcionImpuesto),
    });
  }
  return out;
}

function parseCategoria(raw: unknown): ArcaConstanciaRaw["categoriaMonotributo"] {
  if (!isRecord(raw)) return null;
  const idCategoria = xmlInt(raw.idCategoria ?? raw.IdCategoria);
  const descripcionCategoria = xmlText(raw.descripcionCategoria ?? raw.DescripcionCategoria);
  if (idCategoria == null && !descripcionCategoria) return null;
  return { idCategoria, descripcionCategoria };
}

function textoErrores(raw: unknown): string[] {
  if (!isRecord(raw)) return [];
  const list = asXmlArray(raw.error ?? raw.Error);
  const out: string[] = [];
  for (const item of list) {
    const t = xmlText(item);
    if (t && t.trim()) out.push(t.trim());
  }
  return out;
}

function mapRaw(idPersona: string, ret: Record<string, unknown>): ArcaConstanciaRaw {
  const generales = isRecord(ret.datosGenerales) ? ret.datosGenerales : null;
  const errorConstancia = isRecord(ret.errorConstancia) ? ret.errorConstancia : null;
  const mono = isRecord(ret.datosMonotributo) ? ret.datosMonotributo : null;
  const rg = isRecord(ret.datosRegimenGeneral) ? ret.datosRegimenGeneral : null;

  const cuitRaw =
    xmlText(generales?.idPersona) ??
    xmlText(errorConstancia?.idPersona) ??
    idPersona;
  const cuit = cuitRaw.replace(/\D/g, "") || idPersona;

  return {
    cuit,
    razonSocial: xmlText(generales?.razonSocial),
    nombre:
      xmlText(generales?.nombre) ?? xmlText(errorConstancia?.nombre) ?? null,
    apellido:
      xmlText(generales?.apellido) ?? xmlText(errorConstancia?.apellido) ?? null,
    tipoPersona: xmlText(generales?.tipoPersona),
    estadoClave: xmlText(generales?.estadoClave),
    tieneDatosMonotributo: mono != null,
    categoriaMonotributo: parseCategoria(mono?.categoriaMonotributo),
    impuestosRegimenGeneral: parseImpuestos(rg),
  };
}

function mensajeFaultUsable(raw: string): string {
  const t = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return "ARCA rechazó la consulta de constancia.";
  const lower = t.toLowerCase();
  if (lower.includes("no existe") || lower.includes("no se encontr")) {
    return "ARCA no encontró un contribuyente con ese CUIT.";
  }
  if (lower.includes("relacion") || lower.includes("web service")) {
    return "El certificado no está habilitado para Constancia de Inscripción. En ARCA, asociá el WS ws_sr_constancia_inscripcion al certificado.";
  }
  return t.slice(0, 300);
}

export async function constanciaGetPersonaV2(
  auth: WsfeAuth,
  idPersona: string
): Promise<{ ok: true; data: ArcaConstanciaRaw } | { ok: false; error: string }> {
  const env: ArcaConexionConfig | { error: string } = leerArcaConexion();
  if ("error" in env) return { ok: false, error: env.error };

  const soap = await postSoap({
    url: urlConstancia(env.ambiente),
    soapAction: "",
    envelope: envelopeGetPersonaV2(auth, idPersona),
    timeoutMs: env.timeoutMs,
  });
  if (!soap.ok) {
    return { ok: false, error: mensajeFaultUsable(soap.error) };
  }
  const ret = personaReturn(soap.body);
  if (!ret) {
    return { ok: false, error: "ARCA no devolvió la constancia del contribuyente." };
  }
  const mapped = mapRaw(idPersona, ret);
  const erroresConstancia = isRecord(ret.errorConstancia)
    ? textoErrores(ret.errorConstancia)
    : [];
  if (!mapped.razonSocial && !mapped.nombre && !mapped.apellido) {
    const detalle = erroresConstancia[0];
    return {
      ok: false,
      error: detalle
        ? mensajeFaultUsable(detalle)
        : "ARCA no devolvió el nombre del contribuyente.",
    };
  }
  return { ok: true, data: mapped };
}
