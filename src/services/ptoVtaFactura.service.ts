/**
 * Pto. vta. con el que factura cada sucursal según el grupo de factura (`sucursal_ptos_vtas_factura`).
 * Opciones: pto. vta. activos asociados a la sucursal (`pto_vta_sucursales`); para `A`, solo emisores RI.
 */
import { prisma } from "@/lib/prisma";
import {
  GRUPOS_FACTURA_PTO_VTA,
  esGrupoFacturaPtoVta,
  ptoVtaAdmiteGrupoFactura,
  type GrupoFacturaPtoVta,
} from "@/lib/ptoVtaFactura";
import type { GuardarPtoVtaFacturaInput } from "@/lib/validations/ptoVtaFactura";
import type { ServiceResult } from "@/types";

export interface PtoVtaFacturaOpcion {
  id: string;
  ptoVenta: string;
  titular: string;
}

export interface PtoVtaFacturaFila {
  sucursalId: string;
  sucursalNombre: string;
  grupo: GrupoFacturaPtoVta;
  ptoVtaId: string | null;
  /** Incluye el pto. vta. configurado aunque ya no califique (inactivo / no RI). */
  opciones: PtoVtaFacturaOpcion[];
}

export interface PtoVtaFacturaGuardado {
  sucursalId: string;
  grupo: GrupoFacturaPtoVta;
  ptoVtaId: string | null;
}

/** Sucursales con al menos un pto. vta. asociado (A→Z), dos filas cada una (A, B/C). */
export async function listarPtoVtaFacturaFilas(): Promise<PtoVtaFacturaFila[]> {
  const [sucursales, configs] = await Promise.all([
    prisma.sucursal.findMany({
      where: { ptoVtasAsociados: { some: {} } },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        ptoVtasAsociados: {
          select: {
            ptoVta: {
              select: {
                id: true,
                ptoVenta: true,
                titular: true,
                estado: true,
                condicionIva: true,
              },
            },
          },
        },
      },
    }),
    prisma.sucursalPtoVtaFactura.findMany({
      select: { sucursalId: true, grupo: true, ptoVtaId: true },
    }),
  ]);

  const configPorClave = new Map<string, string>();
  for (const c of configs) {
    if (esGrupoFacturaPtoVta(c.grupo)) configPorClave.set(`${c.sucursalId}|${c.grupo}`, c.ptoVtaId);
  }

  return sucursales.flatMap((s) => {
    const ptos = s.ptoVtasAsociados
      .map((link) => link.ptoVta)
      .sort((a, b) => a.ptoVenta.localeCompare(b.ptoVenta));
    return GRUPOS_FACTURA_PTO_VTA.map((grupo) => {
      const ptoVtaId = configPorClave.get(`${s.id}|${grupo}`) ?? null;
      const opciones = ptos
        .filter(
          (p) =>
            p.id === ptoVtaId ||
            (p.estado === "activo" && ptoVtaAdmiteGrupoFactura(grupo, p.condicionIva))
        )
        .map((p) => ({
          id: p.id,
          ptoVenta: p.ptoVenta,
          titular: p.titular.toLocaleUpperCase("es-AR"),
        }));
      return {
        sucursalId: s.id,
        sucursalNombre: s.nombre.toLocaleUpperCase("es-AR"),
        grupo,
        ptoVtaId,
        opciones,
      };
    });
  });
}

export async function guardarPtoVtaFactura(
  input: GuardarPtoVtaFacturaInput
): Promise<ServiceResult<PtoVtaFacturaGuardado>> {
  const { sucursalId, grupo, ptoVtaId } = input;

  if (ptoVtaId == null) {
    await prisma.sucursalPtoVtaFactura.deleteMany({ where: { sucursalId, grupo } });
    return { success: true, data: { sucursalId, grupo, ptoVtaId: null } };
  }

  const vinculo = await prisma.ptoVtaSucursal.findUnique({
    where: { ptoVtaId_sucursalId: { ptoVtaId, sucursalId } },
    select: { ptoVta: { select: { estado: true, condicionIva: true } } },
  });
  if (!vinculo) {
    return { success: false, error: "El punto de venta no está asociado a esa sucursal." };
  }
  if (vinculo.ptoVta.estado !== "activo") {
    return { success: false, error: "El punto de venta está inactivo." };
  }
  if (!ptoVtaAdmiteGrupoFactura(grupo, vinculo.ptoVta.condicionIva)) {
    return {
      success: false,
      error: 'Solo un punto de venta Responsable Inscripto puede emitir FACT. "A".',
    };
  }

  await prisma.sucursalPtoVtaFactura.upsert({
    where: { sucursalId_grupo: { sucursalId, grupo } },
    create: { sucursalId, grupo, ptoVtaId },
    update: { ptoVtaId },
  });
  return { success: true, data: { sucursalId, grupo, ptoVtaId } };
}
