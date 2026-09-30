import { prisma } from "@/lib/prisma";
import { constanciaGetPersonaV2, leerArcaEnv } from "@/lib/arca";
import type { ArcaConstanciaPersona } from "@/lib/arcaConstancia";
import {
  ARCA_SERVICIO_CONSTANCIA,
  condicionIvaDesdeConstanciaArca,
  nombreDesdeConstanciaArca,
} from "@/lib/facturaFiscal";
import { obtenerAuthArca } from "@/services/arcaAuth.service";
import type { ServiceResult } from "@/types/service.types";

const MSG_SIN_PEM_EMISOR =
  "No se encontró un certificado PEM del emisor en el entorno. Cargá ARCA_CERT_PEM_{CUIT} y ARCA_KEY_PEM_{CUIT} del CUIT de la empresa (el mismo que usa WSAA para facturar). No hace falta un par por punto de venta ni por el CUIT del cliente.";

const MSG_WS_NO_AUTORIZADO =
  "ARCA rechazó la constancia porque el certificado no está autorizado para este servicio. En ARCA, asociá ws_sr_constancia_inscripcion / ws_sr_padron_a5 al certificado del CUIT emisor.";
const MSG_FALLO_CONSTANCIA =
  "No se pudo consultar CUIT con ARCA para ningún emisor habilitado.";

const SERVICIOS_CONSTANCIA_WSAA = [
  ARCA_SERVICIO_CONSTANCIA,
  "ws_sr_padron_a5",
] as const;

type EmisorConstancia = { ptoVenta?: string; cuitEmisor: string };

function esErrorRelacionOWebService(mensaje: string): boolean {
  const lower = mensaje.toLowerCase();
  return lower.includes("relacion") || lower.includes("web service");
}

function esErrorComputadorNoAutorizado(mensaje: string): boolean {
  const lower = mensaje.toLowerCase();
  return (
    lower.includes("computador no autorizado") ||
    lower.includes("computadora no autorizada") ||
    lower.includes("no autorizado a acceder al servicio")
  );
}

function esErrorNoAutorizadoConstancia(mensaje: string): boolean {
  return esErrorRelacionOWebService(mensaje) || esErrorComputadorNoAutorizado(mensaje);
}

function compactarError(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ");
  return t.length > 220 ? `${t.slice(0, 220)}...` : t;
}

async function resolverEmisoresConstancia(): Promise<ServiceResult<EmisorConstancia[]>> {
  const candidatos: EmisorConstancia[] = [];
  const vistos = new Set<string>();

  const envSinPto = leerArcaEnv();
  if (!("error" in envSinPto)) {
    candidatos.push({ cuitEmisor: envSinPto.cuit });
    vistos.add(envSinPto.cuit);
  }

  const ptos = await prisma.globalPtoVta.findMany({
    where: { cuit: { not: null } },
    orderBy: [{ ptoVenta: "asc" }],
    select: { ptoVenta: true, cuit: true, estado: true },
  });
  const ordenados = [
    ...ptos.filter((p) => p.estado === "activo"),
    ...ptos.filter((p) => p.estado !== "activo"),
  ];
  for (const pto of ordenados) {
    if (!pto.cuit || vistos.has(pto.cuit)) continue;
    vistos.add(pto.cuit);
    const env = leerArcaEnv({
      ptoVenta: pto.ptoVenta,
      cuitFallback: pto.cuit,
    });
    if ("error" in env) continue;
    candidatos.push({ ptoVenta: pto.ptoVenta, cuitEmisor: env.cuit });
  }

  if (candidatos.length === 0) {
    return { success: false, error: MSG_SIN_PEM_EMISOR };
  }
  return { success: true, data: candidatos };
}

/**
 * Consulta un CUIT en Constancia de Inscripción (`getPersona_v2`).
 * No persiste. No expone token/sign ni XML.
 */
export async function consultarConstanciaArca(cuit: string): Promise<
  ServiceResult<ArcaConstanciaPersona>
> {
  const emisores = await resolverEmisoresConstancia();
  if (!emisores.success) return emisores;

  const erroresNoAutorizado: string[] = [];
  const erroresOperativos: string[] = [];

  for (const emisor of emisores.data) {
    for (const servicio of SERVICIOS_CONSTANCIA_WSAA) {
      const contexto = `${emisor.cuitEmisor}${emisor.ptoVenta ? ` pto ${emisor.ptoVenta}` : ""} (${servicio})`;
      try {
        const authRes = await obtenerAuthArca({
          servicio,
          ptoVenta: emisor.ptoVenta,
          cuitEmisor: emisor.cuitEmisor,
        });
        if (!authRes.success) {
          if (esErrorNoAutorizadoConstancia(authRes.error)) {
            erroresNoAutorizado.push(contexto);
            continue;
          }
          erroresOperativos.push(`${contexto}: ${compactarError(authRes.error)}`);
          continue;
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
          if (esErrorNoAutorizadoConstancia(persona.error)) {
            erroresNoAutorizado.push(contexto);
            continue;
          }
          erroresOperativos.push(`${contexto}: ${compactarError(persona.error)}`);
          continue;
        }

        const nombre = nombreDesdeConstanciaArca({
          razonSocial: persona.data.razonSocial,
          apellido: persona.data.apellido,
          nombre: persona.data.nombre,
        });
        if (!nombre) {
          erroresOperativos.push(`${contexto}: ARCA no devolvió el nombre del contribuyente.`);
          continue;
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
      } catch (error) {
        const detalle =
          error instanceof Error ? compactarError(error.message) : "Error inesperado.";
        erroresOperativos.push(`${contexto}: ${detalle}`);
      }
    }
  }

  if (erroresNoAutorizado.length > 0) {
    const cuitsProbados = [...new Set(erroresNoAutorizado)].join(", ");
    return {
      success: false,
      error: `${MSG_WS_NO_AUTORIZADO} Emisores/servicios probados: ${cuitsProbados}.`,
    };
  }

  if (erroresOperativos.length > 0) {
    const detalle = [...new Set(erroresOperativos)].slice(0, 3).join(" | ");
    return { success: false, error: `${MSG_FALLO_CONSTANCIA} Detalle: ${detalle}` };
  }

  return {
    success: false,
    error: "No se encontró un emisor habilitado para consultar la constancia en ARCA.",
  };
}
