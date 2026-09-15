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

const MSG_FALTAN_CERTS =
  "Faltan ARCA_CERT_PEM y ARCA_KEY_PEM en el entorno (.env). El CUIT del punto de venta en la base no alcanza: para el CAE hace falta el certificado digital del emisor.";

const MSG_CUIT_ENV_INVALIDO =
  "ARCA_CUIT en el entorno no es un CUIT de 11 dígitos. Es el CUIT del emisor (el de ptos_vtas), no el código de punto de venta.";

const MSG_SIN_CUIT =
  "No hay CUIT de emisor para ARCA. Completá el CUIT del punto de venta o ARCA_CUIT en .env.";

const MSG_CUIT_DISTINTO =
  "El CUIT del punto de venta no coincide con el certificado o con ARCA_CUIT.";

/**
 * Certificados solo desde ENV PEM.
 * CUIT: `ARCA_CUIT` si está, si no el del certificado, si no el del punto de venta.
 */
export function leerArcaEnv(opts?: {
  cuitFallback?: string | null;
}): ArcaEnvConfig | { error: string } {
  const ambiente = parseAmbiente();
  if (typeof ambiente !== "string") return ambiente;

  const certPem = readPem(process.env.ARCA_CERT_PEM);
  const keyPem = readPem(process.env.ARCA_KEY_PEM);
  if (!certPem || !keyPem) {
    return { error: MSG_FALTAN_CERTS };
  }

  const cuitEnvRaw = (process.env.ARCA_CUIT ?? "").trim();
  const fromEnv = cuit11(cuitEnvRaw);
  if (cuitEnvRaw && !fromEnv) {
    return { error: MSG_CUIT_ENV_INVALIDO };
  }
  const fromCert = cuitDesdeCertPem(certPem);
  const fromPto = cuit11(opts?.cuitFallback ?? null);

  const candidatos = [fromEnv, fromCert, fromPto].filter(
    (c): c is string => c != null
  );
  if (candidatos.length === 0) {
    return { error: MSG_SIN_CUIT };
  }
  if (new Set(candidatos).size > 1) {
    return { error: MSG_CUIT_DISTINTO };
  }

  const passRaw = process.env.ARCA_KEY_PASSPHRASE;
  return {
    ambiente,
    cuit: candidatos[0],
    certPem,
    keyPem,
    keyPassphrase: passRaw && passRaw.trim() ? passRaw : null,
    timeoutMs: parseTimeoutMs(),
  };
}

export function arcaCertificadosConfigurados(): boolean {
  const cert = readPem(process.env.ARCA_CERT_PEM);
  const key = readPem(process.env.ARCA_KEY_PEM);
  return Boolean(cert && key);
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
