import "server-only";

import { z } from "zod";
import { cuitDesdeCertPem } from "@/lib/arca/cms";
import { esCuitValido, type ArcaAmbiente } from "@/lib/facturaFiscal";

const ambienteSchema = z.enum(["homo", "prod"]);

export type ArcaEnvConfig = {
  ambiente: ArcaAmbiente;
  cuit: string;
  certPem: string;
  keyPem: string;
  keyPassphrase: string | null;
  timeoutMs: number;
};

function readPem(raw: string | undefined): string {
  return (raw ?? "").replace(/\\n/g, "\n").trim();
}

function cuit11(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  return esCuitValido(d) ? d : null;
}

export type ArcaConexionConfig = {
  ambiente: ArcaAmbiente;
  timeoutMs: number;
};

function parseAmbiente(): ArcaAmbiente | { error: string } {
  const ambienteParsed = ambienteSchema.safeParse(
    (process.env.ARCA_ENV ?? "homo").trim().toLowerCase() || "homo"
  );
  if (!ambienteParsed.success) {
    return { error: "ARCA_ENV debe ser homo o prod." };
  }
  return ambienteParsed.data;
}

function parseTimeoutMs(): number {
  const timeoutRaw = Number.parseInt(process.env.ARCA_TIMEOUT_MS ?? "30000", 10);
  return Number.isFinite(timeoutRaw) && timeoutRaw >= 3000 ? timeoutRaw : 30_000;
}

/** Ambiente + timeout para SOAP WSFEv1 (no exige CUIT ni PEM). */
export function leerArcaConexion(): ArcaConexionConfig | { error: string } {
  const ambiente = parseAmbiente();
  if (typeof ambiente !== "string") return ambiente;
  return { ambiente, timeoutMs: parseTimeoutMs() };
}

const MSG_CUIT_ENV_INVALIDO =
  "ARCA_CUIT en el entorno no es un CUIT de 11 dígitos. Es el CUIT del emisor (el de ptos_vtas), no el código de punto de venta.";

const MSG_SIN_CUIT =
  "No hay CUIT de emisor para ARCA. Completá el CUIT del punto de venta o ARCA_CUIT en .env.";

const MSG_CUIT_DISTINTO =
  "El CUIT del punto de venta no coincide con el certificado o con ARCA_CUIT.";

function nombresPemPorCuit(cuit: string): {
  cert: string;
  key: string;
  passphrase: string;
} {
  return {
    cert: `ARCA_CERT_PEM_${cuit}`,
    key: `ARCA_KEY_PEM_${cuit}`,
    passphrase: `ARCA_KEY_PASSPHRASE_${cuit}`,
  };
}

function leerPemsEmisor(cuit: string): {
  certPem: string;
  keyPem: string;
  keyPassphrase: string | null;
} {
  const names = nombresPemPorCuit(cuit);
  const certPem =
    readPem(process.env[names.cert]) || readPem(process.env.ARCA_CERT_PEM);
  const keyPem =
    readPem(process.env[names.key]) || readPem(process.env.ARCA_KEY_PEM);
  const passRaw =
    process.env[names.passphrase] ?? process.env.ARCA_KEY_PASSPHRASE;
  return {
    certPem,
    keyPem,
    keyPassphrase: passRaw && passRaw.trim() ? passRaw : null,
  };
}

function msgFaltanCerts(cuit: string | null): string {
  if (cuit) {
    const n = nombresPemPorCuit(cuit);
    return `Faltan ${n.cert} y ${n.key} en el entorno. El CUIT del punto de venta en la base no alcanza: para el CAE hace falta el certificado digital de ese emisor.`;
  }
  return "Faltan ARCA_CERT_PEM y ARCA_KEY_PEM en el entorno (.env). El CUIT del punto de venta en la base no alcanza: para el CAE hace falta el certificado digital del emisor.";
}

/**
 * Certificados solo desde ENV PEM.
 * Por emisor: `ARCA_CERT_PEM_{CUIT}` / `ARCA_KEY_PEM_{CUIT}`.
 * Fallback global: `ARCA_CERT_PEM` / `ARCA_KEY_PEM`.
 * CUIT: punto de venta, o `ARCA_CUIT`, o subject del certificado.
 */
export function leerArcaEnv(opts?: {
  cuitFallback?: string | null;
}): ArcaEnvConfig | { error: string } {
  const ambiente = parseAmbiente();
  if (typeof ambiente !== "string") return ambiente;

  const cuitEnvRaw = (process.env.ARCA_CUIT ?? "").trim();
  const fromEnv = cuit11(cuitEnvRaw);
  if (cuitEnvRaw && !fromEnv) {
    return { error: MSG_CUIT_ENV_INVALIDO };
  }
  const fromPto = cuit11(opts?.cuitFallback ?? null);
  const cuitLookup = fromPto ?? fromEnv;

  if (!cuitLookup) {
    const globalCert = readPem(process.env.ARCA_CERT_PEM);
    const globalKey = readPem(process.env.ARCA_KEY_PEM);
    if (!globalCert || !globalKey) {
      return { error: msgFaltanCerts(null) };
    }
    const fromCert = cuitDesdeCertPem(globalCert);
    if (!fromCert) {
      return { error: MSG_SIN_CUIT };
    }
    const passRaw = process.env.ARCA_KEY_PASSPHRASE;
    return {
      ambiente,
      cuit: fromCert,
      certPem: globalCert,
      keyPem: globalKey,
      keyPassphrase: passRaw && passRaw.trim() ? passRaw : null,
      timeoutMs: parseTimeoutMs(),
    };
  }

  const pems = leerPemsEmisor(cuitLookup);
  if (!pems.certPem || !pems.keyPem) {
    return { error: msgFaltanCerts(cuitLookup) };
  }

  const fromCert = cuitDesdeCertPem(pems.certPem);
  const candidatos = [fromEnv, fromCert, fromPto, cuitLookup].filter(
    (c): c is string => c != null
  );
  if (new Set(candidatos).size > 1) {
    return { error: MSG_CUIT_DISTINTO };
  }

  return {
    ambiente,
    cuit: cuitLookup,
    certPem: pems.certPem,
    keyPem: pems.keyPem,
    keyPassphrase: pems.keyPassphrase,
    timeoutMs: parseTimeoutMs(),
  };
}

export function arcaCertificadosConfigurados(): boolean {
  if (readPem(process.env.ARCA_CERT_PEM) && readPem(process.env.ARCA_KEY_PEM)) {
    return true;
  }
  for (const name of Object.keys(process.env)) {
    const m = /^ARCA_CERT_PEM_(\d{11})$/.exec(name);
    if (!m?.[1]) continue;
    const cuit = m[1];
    if (readPem(process.env[name]) && readPem(process.env[`ARCA_KEY_PEM_${cuit}`])) {
      return true;
    }
  }
  return false;
}

export function arcaAmbienteDesdeEnv(): ArcaAmbiente {
  const ambiente = parseAmbiente();
  return typeof ambiente === "string" ? ambiente : "homo";
}

export const ARCA_URLS = {
  wsaa: {
    homo: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    prod: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
  },
  wsfev1: {
    homo: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
    prod: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
  },
} as const;

export function urlWsaa(ambiente: ArcaAmbiente): string {
  return ARCA_URLS.wsaa[ambiente];
}

export function urlWsfev1(ambiente: ArcaAmbiente): string {
  return ARCA_URLS.wsfev1[ambiente];
}

export function topeCfSinDocDesdeEnv(): number {
  const raw = Number.parseInt(process.env.ARCA_CF_MAX_SIN_DOC ?? "", 10);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 10_000_000;
}
