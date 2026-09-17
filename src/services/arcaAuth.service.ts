import { prisma } from "@/lib/prisma";
import {
  arcaAmbienteDesdeEnv,
  leerArcaEnv,
  wsaaLoginCms,
  type WsaaTicket,
} from "@/lib/arca";
import { ARCA_SERVICIO_WSFE } from "@/lib/facturaFiscal";
import type { ServiceResult } from "@/types/service.types";

const MARGIN_MS = 10 * 60_000;

type TicketMem = {
  token: string;
  sign: string;
  expiration: Date;
};

const mem = new Map<string, TicketMem>();

function cacheKey(cuit: string, servicio: string, ambiente: string): string {
  return `${cuit}:${servicio}:${ambiente}`;
}

function vigente(expiration: Date, now: Date): boolean {
  return expiration.getTime() - MARGIN_MS > now.getTime();
}

export type ArcaAuthTicket = {
  token: string;
  sign: string;
  cuit: string;
  ambiente: "homo" | "prod";
};

/**
 * Ticket WSAA (token+sign) cacheado en memoria + `arca_wsaa_tickets`.
 * Un ticket por CUIT+servicio+ambiente. Nunca devolver token/sign a Actions/UI.
 */
export async function obtenerAuthArca(args: {
  servicio: string;
  ptoVenta?: string;
  cuitEmisor?: string | null;
}): Promise<ServiceResult<ArcaAuthTicket>> {
  const env = leerArcaEnv({
    ptoVenta: args.ptoVenta,
    cuitFallback: args.cuitEmisor,
  });
  if ("error" in env) {
    return { success: false, error: env.error };
  }
  const now = new Date();
  const key = cacheKey(env.cuit, args.servicio, env.ambiente);
  const fromMem = mem.get(key);
  if (fromMem && vigente(fromMem.expiration, now)) {
    return {
      success: true,
      data: {
        token: fromMem.token,
        sign: fromMem.sign,
        cuit: env.cuit,
        ambiente: env.ambiente,
      },
    };
  }

  try {
    const row = await prisma.arcaWsaaTicket.findUnique({
      where: {
        cuit_servicio_ambiente: {
          cuit: env.cuit,
          servicio: args.servicio,
          ambiente: env.ambiente,
        },
      },
    });
    if (row && vigente(row.expiration, now)) {
      mem.set(key, { token: row.token, sign: row.sign, expiration: row.expiration });
      return {
        success: true,
        data: {
          token: row.token,
          sign: row.sign,
          cuit: env.cuit,
          ambiente: env.ambiente,
        },
      };
    }
  } catch (e) {
    console.error("[arca][obtenerAuthArca] db", e instanceof Error ? e.message : "error");
  }

  const login = await wsaaLoginCms({ env, servicio: args.servicio });
  if (!login.ok) {
    return { success: false, error: login.error };
  }
  const ticket: WsaaTicket = login.ticket;
  mem.set(key, {
    token: ticket.token,
    sign: ticket.sign,
    expiration: ticket.expiration,
  });
  try {
    await prisma.arcaWsaaTicket.upsert({
      where: {
        cuit_servicio_ambiente: {
          cuit: ticket.cuit,
          servicio: ticket.servicio,
          ambiente: ticket.ambiente,
        },
      },
      create: {
        cuit: ticket.cuit,
        servicio: ticket.servicio,
        ambiente: ticket.ambiente,
        token: ticket.token,
        sign: ticket.sign,
        expiration: ticket.expiration,
      },
      update: {
        token: ticket.token,
        sign: ticket.sign,
        expiration: ticket.expiration,
      },
    });
  } catch (e) {
    console.error("[arca][obtenerAuthArca] persist", e instanceof Error ? e.message : "error");
  }
  return {
    success: true,
    data: {
      token: ticket.token,
      sign: ticket.sign,
      cuit: env.cuit,
      ambiente: env.ambiente,
    },
  };
}

/**
 * Ticket WSAA para WSFEv1.
 * Nunca devolver token/sign a Actions/UI.
 */
export async function obtenerAuthWsfe(args: {
  ptoVenta: string;
  cuitEmisor?: string | null;
}): Promise<ServiceResult<ArcaAuthTicket>> {
  return obtenerAuthArca({
    servicio: ARCA_SERVICIO_WSFE,
    ptoVenta: args.ptoVenta,
    cuitEmisor: args.cuitEmisor,
  });
}

export function ambienteArcaActual(): "homo" | "prod" {
  return arcaAmbienteDesdeEnv();
}
