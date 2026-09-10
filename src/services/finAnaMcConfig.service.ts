import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types/service.types";
import {
  FIN_ANA_MC_CONFIG_DEFAULT,
  FIN_ANA_MC_CONFIG_ID,
  esVariableObjetivoMargenContribucion,
  type FinAnaMcConfigItem,
} from "@/lib/finAnaMcConfig";
import type { TipoComprobanteVentaMargenContribucion } from "@/lib/finAnaMargenContribucion";
import { FIN_ANA_MC_TIPOS_COMPROBANTE } from "@/lib/finAnaMargenContribucion";
import type { GuardarFinAnaMcConfigInput } from "@/lib/validations/finAnaMcConfig";

function mapRow(row: {
  id: string;
  terminalId: string | null;
  tipoComprobante: string;
  variableObjetivo: string;
  updatedAt: Date;
}): FinAnaMcConfigItem {
  const tipo = (FIN_ANA_MC_TIPOS_COMPROBANTE as readonly string[]).includes(
    row.tipoComprobante
  )
    ? (row.tipoComprobante as TipoComprobanteVentaMargenContribucion)
    : FIN_ANA_MC_CONFIG_DEFAULT.tipoComprobante;

  const variable = esVariableObjetivoMargenContribucion(row.variableObjetivo)
    ? row.variableObjetivo
    : FIN_ANA_MC_CONFIG_DEFAULT.variableObjetivo;

  return {
    id: row.id,
    terminalId: row.terminalId,
    tipoComprobante: tipo,
    variableObjetivo: variable,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function ensureFinAnaMcConfig(): Promise<FinAnaMcConfigItem> {
  const existing = await prisma.finAnaMcConfig.findUnique({
    where: { id: FIN_ANA_MC_CONFIG_ID },
  });
  if (existing) return mapRow(existing);

  const created = await prisma.finAnaMcConfig.create({
    data: {
      id: FIN_ANA_MC_CONFIG_ID,
      terminalId: FIN_ANA_MC_CONFIG_DEFAULT.terminalId,
      tipoComprobante: FIN_ANA_MC_CONFIG_DEFAULT.tipoComprobante,
      variableObjetivo: FIN_ANA_MC_CONFIG_DEFAULT.variableObjetivo,
    },
  });
  return mapRow(created);
}

export async function getFinAnaMcConfig(): Promise<FinAnaMcConfigItem> {
  return ensureFinAnaMcConfig();
}

export async function guardarFinAnaMcConfig(
  input: GuardarFinAnaMcConfigInput
): Promise<ServiceResult<FinAnaMcConfigItem>> {
  try {
    if (input.terminalId) {
      const terminal = await prisma.finAnaCosFinaTerminalMarca.findUnique({
        where: { id: input.terminalId },
        select: { id: true },
      });
      if (!terminal) {
        return { success: false, error: "Marca no encontrada." };
      }
    }

    const row = await prisma.finAnaMcConfig.upsert({
      where: { id: FIN_ANA_MC_CONFIG_ID },
      create: {
        id: FIN_ANA_MC_CONFIG_ID,
        terminalId: input.terminalId,
        tipoComprobante: input.tipoComprobante,
        variableObjetivo: input.variableObjetivo,
      },
      update: {
        terminalId: input.terminalId,
        tipoComprobante: input.tipoComprobante,
        variableObjetivo: input.variableObjetivo,
      },
    });

    return { success: true, data: mapRow(row) };
  } catch (e) {
    console.error("guardarFinAnaMcConfig", e);
    return { success: false, error: "No se pudo guardar la configuración." };
  }
}
