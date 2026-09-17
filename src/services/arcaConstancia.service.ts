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

async function resolverEmisorConstancia(): Promise<
  ServiceResult<{ ptoVenta?: string; cuitEmisor: string }>
> {
  const envSinPto = leerArcaEnv();
  if (!("error" in envSinPto)) {
    return { success: true, data: { cuitEmisor: envSinPto.cuit } };
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
  const vistos = new Set<string>();
  for (const pto of ordenados) {
    if (!pto.cuit || vistos.has(pto.cuit)) continue;
    vistos.add(pto.cuit);
    const env = leerArcaEnv({
      ptoVenta: pto.ptoVenta,
      cuitFallback: pto.cuit,
    });
    if ("error" in env) continue;
    return {
      success: true,
      data: { ptoVenta: pto.ptoVenta, cuitEmisor: env.cuit },
    };
  }

  return { success: false, error: MSG_SIN_PEM_EMISOR };
}

/**
 * Consulta un CUIT en Constancia de Inscripción (`getPersona_v2`).
 * No persiste. No expone token/sign ni XML.
 */
export async function consultarConstanciaArca(cuit: string): Promise<
  ServiceResult<ArcaConstanciaPersona>
> {
  const emisor = await resolverEmisorConstancia();
  if (!emisor.success) return emisor;
  const authRes = await obtenerAuthArca({
    servicio: ARCA_SERVICIO_CONSTANCIA,
    ptoVenta: emisor.data.ptoVenta,
    cuitEmisor: emisor.data.cuitEmisor,
  });
  if (!authRes.success) {
    const lower = authRes.error.toLowerCase();
    if (lower.includes("relacion") || lower.includes("web service")) {
      return {
        success: false,
        error:
          "El certificado no está habilitado para Constancia de Inscripción. En ARCA, asociá el WS ws_sr_constancia_inscripcion al certificado.",
      };
    }
    return authRes;
  }

  const persona = await constanciaGetPersonaV2(
    {
      token: authRes.data.token,
      sign: authRes.data.sign,
      cuit: authRes.data.cuit,
    },
    cuit
  );
  if (!persona.ok) return { success: false, error: persona.error };

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
