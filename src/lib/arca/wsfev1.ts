import "server-only";

import { leerArcaEnv, urlWsfev1, type ArcaEnvConfig } from "@/lib/arca/env";
import { postSoap } from "@/lib/arca/soap";
import type {
  WsfeAuth,
  WsfeCaeRequest,
  WsfeCaeResult,
  WsfeCatalogoItem,
  WsfeCompConsultarResult,
  WsfeDummyResult,
  WsfeErr,
  WsfePtoVentaParam,
} from "@/lib/arca/types";
import {
  asXmlArray,
  isRecord,
  xmlDecimal2,
  xmlEscape,
  xmlInt,
  xmlNumber,
  xmlText,
} from "@/lib/arca/xml";

const NS = "http://ar.gov.afip.dif.FEV1/";

function authXml(auth: WsfeAuth): string {
  return `<Auth>
      <Token>${xmlEscape(auth.token)}</Token>
      <Sign>${xmlEscape(auth.sign)}</Sign>
      <Cuit>${xmlEscape(auth.cuit)}</Cuit>
    </Auth>`;
}

function envelope(inner: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    ${inner}
  </soap:Body>
</soap:Envelope>`;
}

function parseErrs(raw: unknown): WsfeErr[] {
  if (!isRecord(raw)) return [];
  const list = asXmlArray(raw.Err ?? raw.Evt ?? raw.Obs);
  const out: WsfeErr[] = [];
  for (const item of list) {
    if (!isRecord(item)) continue;
    const code = xmlInt(item.Code) ?? 0;
    const msg = xmlText(item.Msg) ?? "";
    if (code || msg) out.push({ code, msg });
  }
  return out;
}

function nestedResult(body: Record<string, unknown>, responseTag: string): Record<string, unknown> | null {
  const resp = body[responseTag];
  if (!isRecord(resp)) return null;
  const keys = Object.keys(resp);
  const resultKey = keys.find((k) => k.endsWith("Result") || k === responseTag.replace(/Response$/, "Result"));
  const inner = resultKey ? resp[resultKey] : resp;
  return isRecord(inner) ? inner : resp;
}

function resultadoLetra(raw: unknown): "A" | "R" | "P" | null {
  const t = (xmlText(raw) ?? "").trim().toUpperCase();
  if (t === "A" || t === "R" || t === "P") return t;
  return null;
}

function mapErrorsEvents(result: Record<string, unknown>): { errors: WsfeErr[]; events: WsfeErr[] } {
  return {
    errors: parseErrs(result.Errors),
    events: parseErrs(result.Events),
  };
}

function mensajeErroresArca(errors: WsfeErr[], fallback: string): string {
  if (errors.length === 0) return fallback;
  return errors
    .map((e) => (e.code ? `${e.code}: ${e.msg}` : e.msg))
    .filter((m) => m.trim())
    .join(" · ");
}

async function callWsfe(opts: {
  env: ArcaEnvConfig;
  method: string;
  inner: string;
}): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; error: string }> {
  const soap = await postSoap({
    url: urlWsfev1(opts.env.ambiente),
    soapAction: `${NS}${opts.method}`,
    envelope: envelope(opts.inner),
    timeoutMs: opts.env.timeoutMs,
  });
  if (!soap.ok) return soap;
  return { ok: true, body: soap.body };
}

function alicIvaXml(req: WsfeCaeRequest): string {
  const iva = req.det.iva ?? [];
  if (iva.length === 0) return "";
  const items = iva
    .map(
      (a) => `<AlicIva>
            <Id>${a.id}</Id>
            <BaseImp>${xmlDecimal2(a.baseImp)}</BaseImp>
            <Importe>${xmlDecimal2(a.importe)}</Importe>
          </AlicIva>`
    )
    .join("");
  return `<Iva>${items}</Iva>`;
}

function cbtesAsocXml(req: WsfeCaeRequest): string {
  const asoc = req.det.cbtesAsoc ?? [];
  if (asoc.length === 0) return "";
  const items = asoc
    .map((c) => {
      const cuit = c.cuit ? `<Cuit>${xmlEscape(c.cuit)}</Cuit>` : "";
      const fch = c.cbteFch ? `<CbteFch>${xmlEscape(c.cbteFch)}</CbteFch>` : "";
      return `<CbteAsoc>
            <Tipo>${c.tipo}</Tipo>
            <PtoVta>${c.ptoVta}</PtoVta>
            <Nro>${c.nro}</Nro>
            ${cuit}
            ${fch}
          </CbteAsoc>`;
    })
    .join("");
  return `<CbtesAsoc>${items}</CbtesAsoc>`;
}

function optionalYyyymmdd(tag: string, value: string | undefined, concepto: number): string {
  if (concepto === 1 || !value) return "";
  return `<${tag}>${xmlEscape(value)}</${tag}>`;
}

export async function wsfeDummy(): Promise<
  { ok: true; data: WsfeDummyResult } | { ok: false; error: string }
> {
  const timeoutRaw = Number.parseInt(process.env.ARCA_TIMEOUT_MS ?? "30000", 10);
  const timeoutMs =
    Number.isFinite(timeoutRaw) && timeoutRaw >= 3000 ? timeoutRaw : 30_000;
  const ambiente =
    (process.env.ARCA_ENV ?? "homo").trim().toLowerCase() === "prod" ? "prod" : "homo";
  const soap = await postSoap({
    url: urlWsfev1(ambiente),
    soapAction: `${NS}FEDummy`,
    envelope: envelope(`<FEDummy xmlns="${NS}" />`),
    timeoutMs,
  });
  if (!soap.ok) return soap;
  const result = nestedResult(soap.body, "FEDummyResponse");
  if (!result) return { ok: false, error: "FEDummy no devolvió resultado." };
  return {
    ok: true,
    data: {
      appServer: xmlText(result.AppServer) ?? "",
      dbServer: xmlText(result.DbServer) ?? "",
      authServer: xmlText(result.AuthServer) ?? "",
    },
  };
}

export async function wsfeCompUltimoAutorizado(
  auth: WsfeAuth,
  ptoVta: number,
  cbteTipo: number
): Promise<{ ok: true; cbteNro: number } | { ok: false; error: string }> {
  const env = leerArcaEnv();
  if ("error" in env) return { ok: false, error: env.error };
  const called = await callWsfe({
    env,
    method: "FECompUltimoAutorizado",
    inner: `<FECompUltimoAutorizado xmlns="${NS}">
      ${authXml(auth)}
      <PtoVta>${ptoVta}</PtoVta>
      <CbteTipo>${cbteTipo}</CbteTipo>
    </FECompUltimoAutorizado>`,
  });
  if (!called.ok) return called;
  const result = nestedResult(called.body, "FECompUltimoAutorizadoResponse");
  if (!result) return { ok: false, error: "FECompUltimoAutorizado sin resultado." };
  const { errors } = mapErrorsEvents(result);
  if (errors.length > 0) {
    return { ok: false, error: mensajeErroresArca(errors, "No se pudo leer el último autorizado.") };
  }
  const nro = xmlInt(result.CbteNro);
  if (nro == null) return { ok: false, error: "ARCA no informó el último número autorizado." };
  return { ok: true, cbteNro: nro };
}

export async function wsfeCaeSolicitar(
  auth: WsfeAuth,
  req: WsfeCaeRequest
): Promise<{ ok: true; data: WsfeCaeResult } | { ok: false; error: string }> {
  const env = leerArcaEnv();
  if ("error" in env) return { ok: false, error: env.error };
  const d = req.det;
  const inner = `<FECAESolicitar xmlns="${NS}">
      ${authXml(auth)}
      <FeCAEReq>
        <FeCabReq>
          <CantReg>1</CantReg>
          <PtoVta>${req.ptoVta}</PtoVta>
          <CbteTipo>${req.cbteTipo}</CbteTipo>
        </FeCabReq>
        <FeDetReq>
          <FECAEDetRequest>
            <Concepto>${d.concepto}</Concepto>
            <DocTipo>${d.docTipo}</DocTipo>
            <DocNro>${d.docNro}</DocNro>
            <CbteDesde>${d.cbteDesde}</CbteDesde>
            <CbteHasta>${d.cbteHasta}</CbteHasta>
            <CbteFch>${xmlEscape(d.cbteFch)}</CbteFch>
            <ImpTotal>${xmlDecimal2(d.impTotal)}</ImpTotal>
            <ImpTotConc>${xmlDecimal2(d.impTotConc)}</ImpTotConc>
            <ImpNeto>${xmlDecimal2(d.impNeto)}</ImpNeto>
            <ImpOpEx>${xmlDecimal2(d.impOpEx)}</ImpOpEx>
            <ImpTrib>${xmlDecimal2(d.impTrib)}</ImpTrib>
            <ImpIVA>${xmlDecimal2(d.impIVA)}</ImpIVA>
            ${optionalYyyymmdd("FchServDesde", d.fchServDesde, d.concepto)}
            ${optionalYyyymmdd("FchServHasta", d.fchServHasta, d.concepto)}
            ${optionalYyyymmdd("FchVtoPago", d.fchVtoPago, d.concepto)}
            <MonId>${xmlEscape(d.monId)}</MonId>
            <MonCotiz>${d.monCotiz}</MonCotiz>
            <CondicionIVAReceptorId>${d.condicionIvaReceptorId}</CondicionIVAReceptorId>
            ${cbtesAsocXml(req)}
            ${alicIvaXml(req)}
          </FECAEDetRequest>
        </FeDetReq>
      </FeCAEReq>
    </FECAESolicitar>`;
  const called = await callWsfe({ env, method: "FECAESolicitar", inner });
  if (!called.ok) return called;
  const result = nestedResult(called.body, "FECAESolicitarResponse");
  if (!result) return { ok: false, error: "FECAESolicitar sin resultado." };
  const { errors, events } = mapErrorsEvents(result);
  const cab = isRecord(result.FeCabResp) ? result.FeCabResp : {};
  const detWrap = isRecord(result.FeDetResp) ? result.FeDetResp : {};
  const detList = asXmlArray(detWrap.FECAEDetResponse);
  const det = detList[0] && isRecord(detList[0]) ? detList[0] : {};
  const resultado =
    resultadoLetra(det.Resultado) ?? resultadoLetra(cab.Resultado) ?? "R";
  const obs = parseErrs(isRecord(det.Observaciones) ? det.Observaciones : null);
  const data: WsfeCaeResult = {
    resultado,
    cae: xmlText(det.CAE) || null,
    caeFchVto: xmlText(det.CAEFchVto) || null,
    cbteDesde: xmlInt(det.CbteDesde) ?? d.cbteDesde,
    cbteHasta: xmlInt(det.CbteHasta) ?? d.cbteHasta,
    observaciones: obs,
    errors,
    events,
  };
  if (errors.length > 0 && resultado !== "A") {
    return { ok: false, error: mensajeErroresArca(errors, "ARCA rechazó el comprobante.") };
  }
  if (resultado === "R") {
    const obsMsg = mensajeErroresArca(obs, "ARCA rechazó el comprobante.");
    return { ok: false, error: obsMsg };
  }
  return { ok: true, data };
}

export async function wsfeCompConsultar(
  auth: WsfeAuth,
  ptoVta: number,
  cbteTipo: number,
  cbteNro: number
): Promise<{ ok: true; data: WsfeCompConsultarResult } | { ok: false; error: string }> {
  const env = leerArcaEnv();
  if ("error" in env) return { ok: false, error: env.error };
  const called = await callWsfe({
    env,
    method: "FECompConsultar",
    inner: `<FECompConsultar xmlns="${NS}">
      ${authXml(auth)}
      <FeCompConsReq>
        <PtoVta>${ptoVta}</PtoVta>
        <CbteTipo>${cbteTipo}</CbteTipo>
        <CbteNro>${cbteNro}</CbteNro>
      </FeCompConsReq>
    </FECompConsultar>`,
  });
  if (!called.ok) return called;
  const result = nestedResult(called.body, "FECompConsultarResponse");
  if (!result) return { ok: false, error: "FECompConsultar sin resultado." };
  const { errors } = mapErrorsEvents(result);
  if (errors.length > 0) {
    return { ok: false, error: mensajeErroresArca(errors, "No se pudo consultar el comprobante.") };
  }
  const inner = isRecord(result.ResultGet) ? result.ResultGet : result;
  const obs = parseErrs(isRecord(inner.Observaciones) ? inner.Observaciones : null);
  return {
    ok: true,
    data: {
      resultado: resultadoLetra(inner.Resultado),
      cae: xmlText(inner.CodAutorizacion) ?? xmlText(inner.CAE) ?? null,
      caeFchVto: xmlText(inner.FchVto) ?? xmlText(inner.CAEFchVto) ?? null,
      cbteNro: xmlInt(inner.CbteDesde) ?? cbteNro,
      cbteFch: xmlText(inner.CbteFch),
      impTotal: xmlNumber(inner.ImpTotal),
      observaciones: obs,
      errors,
    },
  };
}

export async function wsfeParamGetPtosVenta(
  auth: WsfeAuth
): Promise<{ ok: true; data: WsfePtoVentaParam[] } | { ok: false; error: string }> {
  const env = leerArcaEnv();
  if ("error" in env) return { ok: false, error: env.error };
  const called = await callWsfe({
    env,
    method: "FEParamGetPtosVenta",
    inner: `<FEParamGetPtosVenta xmlns="${NS}">${authXml(auth)}</FEParamGetPtosVenta>`,
  });
  if (!called.ok) return called;
  const result = nestedResult(called.body, "FEParamGetPtosVentaResponse");
  if (!result) return { ok: false, error: "FEParamGetPtosVenta sin resultado." };
  const { errors } = mapErrorsEvents(result);
  if (errors.length > 0) {
    return { ok: false, error: mensajeErroresArca(errors, "No se pudieron leer los puntos de venta ARCA.") };
  }
  const get = isRecord(result.ResultGet) ? result.ResultGet : result;
  const rows = asXmlArray(get.PtoVenta);
  const data: WsfePtoVentaParam[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const nro = xmlInt(row.Nro);
    if (nro == null) continue;
    data.push({
      nro,
      emisionTipo: xmlText(row.EmisionTipo) ?? "",
      bloqueado: xmlText(row.Bloqueado) ?? "",
    });
  }
  return { ok: true, data };
}

async function wsfeParamCatalogo(
  auth: WsfeAuth,
  method: string,
  itemTag: string
): Promise<{ ok: true; data: WsfeCatalogoItem[] } | { ok: false; error: string }> {
  const env = leerArcaEnv();
  if ("error" in env) return { ok: false, error: env.error };
  const called = await callWsfe({
    env,
    method,
    inner: `<${method} xmlns="${NS}">${authXml(auth)}</${method}>`,
  });
  if (!called.ok) return called;
  const result = nestedResult(called.body, `${method}Response`);
  if (!result) return { ok: false, error: `${method} sin resultado.` };
  const { errors } = mapErrorsEvents(result);
  if (errors.length > 0) {
    return { ok: false, error: mensajeErroresArca(errors, `No se pudo leer ${method}.`) };
  }
  const get = isRecord(result.ResultGet) ? result.ResultGet : result;
  const rows = asXmlArray(get[itemTag]);
  const data: WsfeCatalogoItem[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const id = xmlInt(row.Id);
    if (id == null) continue;
    data.push({ id, desc: xmlText(row.Desc) ?? "" });
  }
  return { ok: true, data };
}

export function wsfeParamGetTiposCbte(auth: WsfeAuth) {
  return wsfeParamCatalogo(auth, "FEParamGetTiposCbte", "CbteTipo");
}

export function wsfeParamGetTiposIva(auth: WsfeAuth) {
  return wsfeParamCatalogo(auth, "FEParamGetTiposIva", "IvaTipo");
}

export function wsfeParamGetTiposDoc(auth: WsfeAuth) {
  return wsfeParamCatalogo(auth, "FEParamGetTiposDoc", "DocTipo");
}

export function wsfeParamGetTiposConcepto(auth: WsfeAuth) {
  return wsfeParamCatalogo(auth, "FEParamGetTiposConcepto", "ConceptoTipo");
}

export function wsfeParamGetTiposMonedas(auth: WsfeAuth) {
  return wsfeParamCatalogo(auth, "FEParamGetTiposMonedas", "Moneda");
}

export function formatearErroresWsfe(errors: WsfeErr[], fallback: string): string {
  return mensajeErroresArca(errors, fallback);
}
