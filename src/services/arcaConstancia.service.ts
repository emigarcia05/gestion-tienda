import { prisma } from "@/lib/prisma";
import {
  cnDesdeCertPem,
  constanciaGetPersonaV2,
  cuitEmisorConstancia,
  leerArcaEnvPorCuit,
} from "@/lib/arca";
import type { ArcaConstanciaPersona } from "@/lib/arcaConstancia";
import {
  ARCA_SERVICIO_CONSTANCIA,
  condicionIvaDesdeConstanciaArca,
  nombreDesdeConstanciaArca,
} from "@/lib/facturaFiscal";
import { obtenerAuthArca } from "@/services/arcaAuth.service";
import type { ServiceResult } from "@/types/service.types";

function esDnFacturacionNoConstancia(cn: string | null): boolean {
  if (!cn) return false;
  return cn.toLowerCase().includes("tiendagestion");
}

function msgReiniciarPorDn(cn: string, ambiente: string): string {
  return `ARCA_CONSTANCIA_CERT_PEM tiene el certificado «${cn}» (ambiente ${ambiente}), que es el de facturación. Pegá ahí el PEM de TiedaColorC1 (en Vercel: Production y Preview, después Redeploy; en local: .env y reiniciar npm run dev).`;
}

function msgWsNoAutorizado(cn: string | null, ambiente: string): string {
  const alias = cn ? ` «${cn}»` : "";
  return `ARCA rechazó la constancia: el certificado${alias} de 20-37267223-5 no está autorizado para ws_sr_constancia_inscripcion (ambiente ${ambiente}). En homologación: WSASS → Consultar autorizaciones del DN ${cn ?? "TiedaColorC1"} para ese WS. En producción: Administrador de Relaciones. ARCA_ENV tiene que coincidir con el certificado.`;
}

const MSG_AMBIENTE_CRUZADO =
  "El certificado no corresponde a este ambiente. ARCA_ENV (homo/prod) tiene que coincidir con el certificado (homologación vs producción).";

function esErrorAmbienteCruzado(mensaje: string): boolean {
  const lower = mensaje.toLowerCase();
  return (
    lower.includes("no corresponde a este ambiente") ||
    lower.includes("acceder a los servicios de afip") ||
    lower.includes("acceder a los servicios de arca")
  );
}

function esErrorCuitInexistente(mensaje: string): boolean {
  const lower = mensaje.toLowerCase();
  return lower.includes("no encontró un contribuyente") || lower.includes("no existe persona");
}

function esErrorComputadorNoAutorizado(mensaje: string): boolean {
  const lower = mensaje.toLowerCase();
  return (
    lower.includes("computador no autorizado") ||
    lower.includes("computadora no autorizada") ||
    lower.includes("no autorizado a acceder al servicio")
  );
}

function esErrorRelacionOWebService(mensaje: string): boolean {
  const lower = mensaje.toLowerCase();
  return lower.includes("relacion") || lower.includes("web service");
}

function esErrorNoAutorizadoConstancia(mensaje: string): boolean {
  return (
    esErrorRelacionOWebService(mensaje) ||
    esErrorComputadorNoAutorizado(mensaje) ||
    esErrorAmbienteCruzado(mensaje)
  );
}

function compactarError(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ");
  return t.length > 220 ? `${t.slice(0, 220)}...` : t;
}

/**
 * Consulta un CUIT en Constancia de Inscripción (`getPersona_v2`).
 * Siempre autentica con el CUIT emisor de constancia (20-37267223-5).
 * WSAA solo `ws_sr_constancia_inscripcion`. No persiste. No expone token/sign ni XML.
 */
export async function consultarConstanciaArca(cuit: string): Promise<
  ServiceResult<ArcaConstanciaPersona>
> {
  const emisor = cuitEmisorConstancia();
  if (typeof emisor !== "string") return { success: false, error: emisor.error };

  const envEmisor = leerArcaEnvPorCuit(emisor);
  if ("error" in envEmisor) return { success: false, error: envEmisor.error };
  const certCn = cnDesdeCertPem(envEmisor.certPem);
  if (esDnFacturacionNoConstancia(certCn) && certCn) {
    console.error("[arca][constancia] DN de facturación en proceso stale", {
      cn: certCn,
      ambiente: envEmisor.ambiente,
    });
    return { success: false, error: msgReiniciarPorDn(certCn, envEmisor.ambiente) };
  }

  const authRes = await obtenerAuthArca({
    servicio: ARCA_SERVICIO_CONSTANCIA,
    cuitEmisor: emisor,
    forzarCuitEmisor: true,
  });
  if (!authRes.success) {
    if (esErrorAmbienteCruzado(authRes.error)) {
      return { success: false, error: MSG_AMBIENTE_CRUZADO };
    }
    if (esErrorNoAutorizadoConstancia(authRes.error)) {
      console.error("[arca][constancia] WSAA no autorizado", {
        cn: certCn,
        ambiente: envEmisor.ambiente,
      });
      return { success: false, error: msgWsNoAutorizado(certCn, envEmisor.ambiente) };
    }
    return { success: false, error: compactarError(authRes.error) };
  }

  const persona = await constanciaGetPersonaV2(
    {
      token: authRes.data.token,
      sign: authRes.data.sign,
      cuit: authRes.data.cuit,
    },
    cuit
  );
  if (!persona.ok) {
    if (esErrorCuitInexistente(persona.error)) {
      return { success: false, error: persona.error };
    }
    if (esErrorAmbienteCruzado(persona.error)) {
      return { success: false, error: MSG_AMBIENTE_CRUZADO };
    }
    if (esErrorNoAutorizadoConstancia(persona.error)) {
      console.error("[arca][constancia] getPersona_v2 no autorizado", {
        cn: certCn,
        ambiente: envEmisor.ambiente,
      });
      return { success: false, error: msgWsNoAutorizado(certCn, envEmisor.ambiente) };
    }
    return { success: false, error: persona.error };
  }

  const nombre = nombreDesdeConstanciaArca({
    razonSocial: persona.data.razonSocial,
    apellido: persona.data.apellido,
    nombre: persona.data.nombre,
  });
  if (!nombre) {
    return { success: false, error: "ARCA no devolvió el nombre del contribuyente." };
  }

  const condicionIva = condicionIvaDesdeConstanciaArca({
    tieneDatosMonotributo: persona.data.tieneDatosMonotributo,
    categoriaMonotributo: persona.data.categoriaMonotributo,
    impuestosRegimenGeneral: persona.data.impuestosRegimenGeneral,
  });

  let condicionIvaDescripcion: string | null = null;
  if (condicionIva != null) {
    const cat = await prisma.ptoVentasCodArca.findUnique({
      where: { codigo: condicionIva },
      select: { descripcion: true },
    });
    condicionIvaDescripcion = cat?.descripcion ?? null;
  }

  return {
    success: true,
    data: {
      cuit: persona.data.cuit,
      nombre,
      condicionIva,
      condicionIvaDescripcion,
      estadoClave: persona.data.estadoClave,
      tipoPersona: persona.data.tipoPersona,
    },
  };
}
