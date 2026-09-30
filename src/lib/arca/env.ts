import "server-only";

import nodeProcess from "node:process";
import { z } from "zod";
import { cnDesdeCertPem, cuitDesdeCertPem } from "@/lib/arca/cms";
import { ARCA_CUIT_CONSTANCIA, esCuitValido, type ArcaAmbiente } from "@/lib/facturaFiscal";

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
  return (raw ?? "").replace(/^\uFEFF/, "").replace(/\\n/g, "\n").trim();
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

/** Nombres ENV por CUIT emisor. Todos los pto. vta. de ese CUIT usan el mismo par. */
export function nombresPemPorCuit(cuit: string): {
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

function primerPem(...raws: (string | undefined)[]): string {
  for (const raw of raws) {
    const v = readPem(raw);
    if (v) return v;
  }
  return "";
}

function primerPass(...raws: (string | undefined)[]): string | null {
  for (const raw of raws) {
    if (raw && raw.trim()) return raw;
  }
  return null;
}

/** Runtime Node. Evita que Next inline `process.env.FOO` vacío en el build. */
function envRuntime(nombre: string): string | undefined {
  const v = nodeProcess.env[nombre];
  return typeof v === "string" ? v : undefined;
}

/**
 * Acceso con literal estático para que Next/Turbopack no pierda `ARCA_*_{CUIT}`
 * cuando el nombre se arma en runtime (`ARCA_CERT_PEM_${cuit}`).
 */
function envPemPorCuitEstatico(cuit: string): {
  cert: string | undefined;
  key: string | undefined;
  passphrase: string | undefined;
} {
  switch (cuit) {
    case "20372672235":
      return {
        cert: primerPem(
          envRuntime("ARCA_CONSTANCIA_CERT_PEM"),
          envRuntime("ARCA_CERT_PEM_20372672235")
        ),
        key: primerPem(
          envRuntime("ARCA_CONSTANCIA_KEY_PEM"),
          envRuntime("ARCA_KEY_PEM_20372672235")
        ),
        passphrase: primerPass(
          envRuntime("ARCA_CONSTANCIA_KEY_PASSPHRASE"),
          envRuntime("ARCA_KEY_PASSPHRASE_20372672235")
        ),
      };
    case "23169084289":
      return {
        cert: envRuntime("ARCA_CERT_PEM_23169084289"),
        key: envRuntime("ARCA_KEY_PEM_23169084289"),
        passphrase: envRuntime("ARCA_KEY_PASSPHRASE_23169084289"),
      };
    case "20329808824":
      return {
        cert: envRuntime("ARCA_CERT_PEM_20329808824"),
        key: envRuntime("ARCA_KEY_PEM_20329808824"),
        passphrase: envRuntime("ARCA_KEY_PASSPHRASE_20329808824"),
      };
    default:
      return { cert: undefined, key: undefined, passphrase: undefined };
  }
}

/** `ARCA_*_{CUIT}` compartido; fallback genérico solo si `fallbackGenerico`. */
function leerPems(
  cuit: string | null,
  opts?: { fallbackGenerico?: boolean }
): {
  certPem: string;
  keyPem: string;
  keyPassphrase: string | null;
} {
  const fallbackGenerico = opts?.fallbackGenerico !== false;
  const porCuit = cuit ? nombresPemPorCuit(cuit) : null;
  const estatico = cuit ? envPemPorCuitEstatico(cuit) : null;
  const soloConstancia = fallbackGenerico === false;
  return {
    certPem: primerPem(
      soloConstancia ? envRuntime("ARCA_CONSTANCIA_CERT_PEM") : undefined,
      estatico?.cert,
      porCuit ? envRuntime(porCuit.cert) : undefined,
      fallbackGenerico ? envRuntime("ARCA_CERT_PEM") : undefined
    ),
    keyPem: primerPem(
      soloConstancia ? envRuntime("ARCA_CONSTANCIA_KEY_PEM") : undefined,
      estatico?.key,
      porCuit ? envRuntime(porCuit.key) : undefined,
      fallbackGenerico ? envRuntime("ARCA_KEY_PEM") : undefined
    ),
    keyPassphrase: primerPass(
      soloConstancia ? envRuntime("ARCA_CONSTANCIA_KEY_PASSPHRASE") : undefined,
      estatico?.passphrase,
      porCuit ? envRuntime(porCuit.passphrase) : undefined,
      fallbackGenerico ? envRuntime("ARCA_KEY_PASSPHRASE") : undefined
    ),
  };
}

function msgFaltanCerts(cuit: string | null, opts?: { fallbackGenerico?: boolean }): string {
  if (cuit) {
    const n = nombresPemPorCuit(cuit);
    if (opts?.fallbackGenerico === false) {
      return `Faltan ARCA_CONSTANCIA_CERT_PEM / ARCA_CONSTANCIA_KEY_PEM (o ${n.cert} / ${n.key}) en el entorno. Reiniciá npm run dev después de cargarlas. La constancia no usa ARCA_CERT_PEM genérico.`;
    }
    return `Faltan ${n.cert} y ${n.key} en el entorno (o el par ARCA_CERT_PEM / ARCA_KEY_PEM). El CUIT en la base no alcanza: hace falta el PEM de ese emisor.`;
  }
  return "Faltan ARCA_CERT_PEM y ARCA_KEY_PEM en el entorno (.env). El CUIT del punto de venta en la base no alcanza: para el CAE hace falta el certificado digital del emisor.";
}

/**
 * Certificados solo desde ENV PEM.
 * Un par por CUIT: `ARCA_CERT_PEM_{CUIT}` / `ARCA_KEY_PEM_{CUIT}`.
 * Todos los pto. vta. de ese CUIT (ej. 00005 y 00006) apuntan a las mismas variables.
 * Fallback: `ARCA_CERT_PEM` / `ARCA_KEY_PEM`.
 */
export function leerArcaEnv(opts?: {
  ptoVenta?: string | number | null;
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
  const cuitParaPem = fromPto ?? fromEnv;
  const pems = leerPems(cuitParaPem);
  if (!pems.certPem || !pems.keyPem) {
    return { error: msgFaltanCerts(cuitParaPem) };
  }

  const fromCert = cuitDesdeCertPem(pems.certPem);
  const cuitLookup = fromPto ?? fromEnv ?? fromCert;
  if (!cuitLookup) {
    return { error: MSG_SIN_CUIT };
  }

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

/**
 * PEM de un CUIT emisor concreto. Ignora `ARCA_CUIT`.
 * Sin fallback a `ARCA_CERT_PEM` (otro DN del mismo CUIT firmaría WSAA y ARCA responde 10.4).
 */
export function leerArcaEnvPorCuit(cuitRaw: string): ArcaEnvConfig | { error: string } {
  const ambiente = parseAmbiente();
  if (typeof ambiente !== "string") return ambiente;
  const cuit = cuit11(cuitRaw);
  if (!cuit) {
    return { error: MSG_SIN_CUIT };
  }
  const pems = leerPems(cuit, { fallbackGenerico: false });
  if (!pems.certPem || !pems.keyPem) {
    return { error: msgFaltanCerts(cuit, { fallbackGenerico: false }) };
  }
  const fromCert = cuitDesdeCertPem(pems.certPem);
  if (fromCert && fromCert !== cuit) {
    return { error: MSG_CUIT_DISTINTO };
  }
  return {
    ambiente,
    cuit,
    certPem: pems.certPem,
    keyPem: pems.keyPem,
    keyPassphrase: pems.keyPassphrase,
    timeoutMs: parseTimeoutMs(),
  };
}

/** Alias CN del certificado del emisor (para errores/logs; no es el PEM). */
export function aliasCertArcaPorCuit(cuitRaw: string): string | null {
  const env = leerArcaEnvPorCuit(cuitRaw);
  if ("error" in env) return null;
  return cnDesdeCertPem(env.certPem);
}

/** CUIT con el que se autentica la constancia (clientes). Override `ARCA_CONSTANCIA_CUIT`. */
export function cuitEmisorConstancia(): string | { error: string } {
  const raw = (envRuntime("ARCA_CONSTANCIA_CUIT") ?? "").trim();
  if (!raw) return ARCA_CUIT_CONSTANCIA;
  const cuit = cuit11(raw);
  if (!cuit) {
    return { error: "ARCA_CONSTANCIA_CUIT debe ser un CUIT de 11 dígitos." };
  }
  return cuit;
}

export function arcaCertificadosConfigurados(): boolean {
  return listarCuitsEmisorConPem().length > 0;
}

/** Par PEM dedicado `ARCA_CERT_PEM_{CUIT}` + `ARCA_KEY_PEM_{CUIT}` (no el fallback genérico). */
export function tieneParPemPorCuit(cuit: string): boolean {
  const d = (cuit ?? "").replace(/\D/g, "");
  if (!/^\d{11}$/.test(d)) return false;
  const pems = leerPems(d, { fallbackGenerico: false });
  return Boolean(pems.certPem && pems.keyPem);
}

/**
 * CUITs emisores con certificado en ENV.
 * Un par por CUIT, no por punto de venta. Incluye fallback `ARCA_CERT_PEM` / `ARCA_CUIT`.
 */
export function listarCuitsEmisorConPem(): string[] {
  const seen = new Set<string>();
  for (const name of Object.keys(nodeProcess.env)) {
    const m = /^ARCA_CERT_PEM_(\d{11})$/.exec(name);
    if (!m?.[1]) continue;
    if (tieneParPemPorCuit(m[1])) seen.add(m[1]);
  }
  const fallbackCert = readPem(envRuntime("ARCA_CERT_PEM"));
  const fallbackKey = readPem(envRuntime("ARCA_KEY_PEM"));
  if (fallbackCert && fallbackKey) {
    const fromEnv = cuit11(envRuntime("ARCA_CUIT"));
    const fromCert = cuitDesdeCertPem(fallbackCert);
    const cuit = fromEnv ?? fromCert;
    if (cuit) seen.add(cuit);
  }
  return [...seen];
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
  /** Constancia de Inscripción (manual v3.7). Hosts AFIP = alias histórico. */
  constancia: {
    homo: "https://awshomo.arca.gov.ar/sr-padron/webservices/personaServiceA5",
    prod: "https://aws.arca.gov.ar/sr-padron/webservices/personaServiceA5",
  },
  constanciaAfip: {
    homo: "https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5",
    prod: "https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5",
  },
} as const;

export function urlWsaa(ambiente: ArcaAmbiente): string {
  return ARCA_URLS.wsaa[ambiente];
}

export function urlWsfev1(ambiente: ArcaAmbiente): string {
  return ARCA_URLS.wsfev1[ambiente];
}

export function urlConstancia(ambiente: ArcaAmbiente): string {
  return ARCA_URLS.constancia[ambiente];
}

export function urlConstanciaAfip(ambiente: ArcaAmbiente): string {
  return ARCA_URLS.constanciaAfip[ambiente];
}

export function topeCfSinDocDesdeEnv(): number {
  const legal = 10_000_000;
  const raw = Number.parseInt(process.env.ARCA_CF_MAX_SIN_DOC ?? "", 10);
  if (!Number.isFinite(raw) || raw <= 0) return legal;
  return Math.min(raw, legal);
}
