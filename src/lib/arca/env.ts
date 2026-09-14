import "server-only";

import { z } from "zod";
import type { ArcaAmbiente } from "@/lib/facturaFiscal";

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

export function leerArcaEnv(): ArcaEnvConfig | { error: string } {
  const ambienteParsed = ambienteSchema.safeParse(
    (process.env.ARCA_ENV ?? "homo").trim().toLowerCase() || "homo"
  );
  if (!ambienteParsed.success) {
    return { error: "ARCA_ENV debe ser homo o prod." };
  }
  const cuit = (process.env.ARCA_CUIT ?? "").replace(/\D/g, "");
  if (!/^\d{11}$/.test(cuit)) {
    return { error: "ARCA_CUIT debe tener 11 dígitos." };
  }
  const certPem = readPem(process.env.ARCA_CERT_PEM);
  const keyPem = readPem(process.env.ARCA_KEY_PEM);
  if (!certPem || !keyPem) {
    return { error: "Faltan ARCA_CERT_PEM o ARCA_KEY_PEM." };
  }
  const passRaw = process.env.ARCA_KEY_PASSPHRASE;
  const timeoutRaw = Number.parseInt(process.env.ARCA_TIMEOUT_MS ?? "30000", 10);
  const timeoutMs =
    Number.isFinite(timeoutRaw) && timeoutRaw >= 3000 ? timeoutRaw : 30_000;
  return {
    ambiente: ambienteParsed.data,
    cuit,
    certPem,
    keyPem,
    keyPassphrase: passRaw && passRaw.trim() ? passRaw : null,
    timeoutMs,
  };
}

export function arcaCertificadosConfigurados(): boolean {
  const cert = readPem(process.env.ARCA_CERT_PEM);
  const key = readPem(process.env.ARCA_KEY_PEM);
  const cuit = (process.env.ARCA_CUIT ?? "").replace(/\D/g, "");
  return Boolean(cert && key && /^\d{11}$/.test(cuit));
}

export function arcaAmbienteDesdeEnv(): ArcaAmbiente {
  const parsed = ambienteSchema.safeParse(
    (process.env.ARCA_ENV ?? "homo").trim().toLowerCase() || "homo"
  );
  return parsed.success ? parsed.data : "homo";
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
