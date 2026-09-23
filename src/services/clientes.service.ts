import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  CLIENTE_CTA_CORRIENTE_PLAZO_DEFAULT,
  compararClientesParaListado,
  normalizarCelCliente,
  normalizarNombreCliente,
  soloDigitos,
  tokenCoincideClienteSinNombre,
  type ClienteItem,
  type ClienteListaItem,
  type ClienteResumen,
} from "@/lib/envios";
import type { CrearClienteInput, EditarClienteInput } from "@/lib/validations/envios";
import { mapEnviosDireccionItem } from "@/services/enviosDirecciones.service";
import type { ServiceResult } from "@/types/service.types";

const TIPOS_VENTA_CTA_CTE = ["factura_fiscal", "factura_no_fiscal"] as const;
const TIPOS_NC_CTA_CTE = ["nota_credito_fiscal", "nota_credito_no_fiscal"] as const;

const resumenSelect = {
  id: true,
  nombreCompleto: true,
  cel: true,
  esPintor: true,
} as const;

const select = {
  ...resumenSelect,
  pintorAsociadoId: true,
  pintorAsociado: { select: resumenSelect },
  cuit: true,
  condicionIva: true,
  ctaCorrientePlazo: true,
  ctaCorrienteMontoMax: true,
} as const;

function mapResumen(row: ClienteResumen): ClienteResumen {
  return {
    id: row.id,
    nombreCompleto: normalizarNombreCliente(row.nombreCompleto),
    cel: row.cel.trim(),
    esPintor: row.esPintor,
  };
}

function mapRow(row: {
  id: string;
  nombreCompleto: string;
  cel: string;
  esPintor: boolean;
  pintorAsociadoId: string | null;
  pintorAsociado: ClienteResumen | null;
  cuit: string | null;
  condicionIva: number | null;
  ctaCorrientePlazo: number | null;
  ctaCorrienteMontoMax: { toString(): string } | number | null;
}): ClienteItem {
  return {
    ...mapResumen(row),
    pintorAsociadoId: row.pintorAsociadoId,
    pintorAsociado: row.pintorAsociado ? mapResumen(row.pintorAsociado) : null,
    cuit: row.cuit,
    condicionIva: row.condicionIva,
    ctaCorrientePlazo: row.ctaCorrientePlazo,
    ctaCorrienteMontoMax: numeroMontoCtaCorriente(row.ctaCorrienteMontoMax),
  };
}

function numeroMontoCtaCorriente(
  value: { toString(): string } | number | null | undefined
): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Saldo CC: ventas con `dias_vencimiento` − notas de crédito (no rechazadas). */
export async function saldosCuentaCorrientePorCliente(
  clienteIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (clienteIds.length === 0) return out;
  const rows = await prisma.comprobanteVta.groupBy({
    by: ["clienteId", "tipoLocal"],
    where: {
      clienteId: { in: clienteIds },
      estado: { not: "rechazado" },
      OR: [
        { tipoLocal: { in: [...TIPOS_VENTA_CTA_CTE] }, diasVencimiento: { not: null } },
        { tipoLocal: { in: [...TIPOS_NC_CTA_CTE] } },
      ],
    },
    _sum: { impTotal: true },
  });
  for (const row of rows) {
    if (row.clienteId == null) continue;
    const total = Number(row._sum.impTotal ?? 0);
    const signo = (TIPOS_NC_CTA_CTE as readonly string[]).includes(row.tipoLocal) ? -1 : 1;
    out.set(row.clienteId, (out.get(row.clienteId) ?? 0) + signo * total);
  }
  return out;
}

async function conSaldoCuentaCorriente(
  items: Omit<ClienteListaItem, "saldoCuentaCorriente">[]
): Promise<ClienteListaItem[]> {
  const saldos = await saldosCuentaCorrientePorCliente(items.map((item) => item.id));
  return items.map((item) => ({
    ...item,
    saldoCuentaCorriente: saldos.get(item.id) ?? 0,
  }));
}

function prismaErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2025") return "El cliente no existe.";
    if (code === "P2003") {
      return "No se puede eliminar: el cliente está asociado a un envío, a un proyecto, a un comprobante o como pintor de otro cliente.";
    }
  }
  return error instanceof Error ? error.message : fallback;
}

async function resolverPintorAsociadoId(input: {
  id?: string;
  esPintor: boolean;
  pintorAsociadoId?: string | null;
}): Promise<ServiceResult<string | null>> {
  if (input.esPintor) {
    return { success: true, data: null };
  }
  const pintorAsociadoId = input.pintorAsociadoId ?? null;
  if (!pintorAsociadoId) {
    return { success: true, data: null };
  }
  if (input.id && pintorAsociadoId === input.id) {
    return { success: false, error: "El cliente no puede asociarse a sí mismo." };
  }
  const pintor = await prisma.cliente.findUnique({
    where: { id: pintorAsociadoId },
    select: { id: true, esPintor: true },
  });
  if (!pintor) {
    return { success: false, error: "El pintor asociado no existe." };
  }
  if (!pintor.esPintor) {
    return { success: false, error: "El pintor asociado debe tener ES PINTOR." };
  }
  return { success: true, data: pintor.id };
}

async function validarCondicionIvaCliente(
  codigo: number | null | undefined,
  codigoPersistido?: number | null
): Promise<ServiceResult<number | null>> {
  if (codigo == null) return { success: true, data: null };
  const row = await prisma.ptoVentasCodArca.findUnique({
    where: { codigo },
    select: { codigo: true, activo: true },
  });
  if (!row) {
    return { success: false, error: "Seleccioná una condición IVA válida." };
  }
  if (!row.activo && row.codigo !== codigoPersistido) {
    return { success: false, error: "Seleccioná una condición IVA válida." };
  }
  return { success: true, data: row.codigo };
}

function normalizarCuitCliente(cuit: string | null | undefined): string | null {
  if (cuit == null || cuit === "") return null;
  return cuit;
}

export async function listarClientes(): Promise<ClienteItem[]> {
  try {
    const rows = await prisma.cliente.findMany({
      orderBy: [{ nombreCompleto: "asc" }, { createdAt: "asc" }],
      select,
    });
    return rows.map(mapRow).sort(compararClientesParaListado);
  } catch (e) {
    console.error("[clientes][listar]", e);
    return [];
  }
}

export async function listarClientesConProyectos(): Promise<ClienteListaItem[]> {
  try {
    const rows = await prisma.cliente.findMany({
      orderBy: [{ nombreCompleto: "asc" }, { createdAt: "asc" }],
      select: {
        ...select,
        direcciones: {
          select: {
            id: true,
            personaId: true,
            nombreProyecto: true,
            calleNombre: true,
            numeracion: true,
            distrito: true,
            departamento: true,
            urlMaps: true,
            referencia: true,
          },
          orderBy: [
            { nombreProyecto: "asc" },
            { calleNombre: "asc" },
            { numeracion: "asc" },
            { createdAt: "asc" },
          ],
        },
      },
    });
    const items = await conSaldoCuentaCorriente(
      rows.map((row) => ({
        ...mapRow(row),
        proyectos: row.direcciones.map(mapEnviosDireccionItem),
      }))
    );
    return items.sort(compararClientesParaListado);
  } catch (e) {
    console.error("[clientes][listarConProyectos]", e);
    return [];
  }
}

export async function obtenerClienteListaPorId(
  id: string
): Promise<ClienteListaItem | null> {
  try {
    const row = await prisma.cliente.findUnique({
      where: { id },
      select: {
        ...select,
        direcciones: {
          select: {
            id: true,
            personaId: true,
            nombreProyecto: true,
            calleNombre: true,
            numeracion: true,
            distrito: true,
            departamento: true,
            urlMaps: true,
            referencia: true,
          },
          orderBy: [
            { nombreProyecto: "asc" },
            { calleNombre: "asc" },
            { numeracion: "asc" },
            { createdAt: "asc" },
          ],
        },
      },
    });
    if (!row) return null;
    const [item] = await conSaldoCuentaCorriente([
      {
        ...mapRow(row),
        proyectos: row.direcciones.map(mapEnviosDireccionItem),
      },
    ]);
    return item ?? null;
  } catch (e) {
    console.error("[clientes][obtenerListaPorId]", e);
    return null;
  }
}

/**
 * Typeahead Factura · Crear: tokens AND sobre nombre / CEL / CUIT / pintor asociado / `SIN NOMBRE`.
 * Incluye clientes con nombre vacío si tienen CEL (trazables al agregar nombre después).
 */
export async function buscarClientesParaFactura(params: {
  q: string;
  take?: number;
}): Promise<ServiceResult<{ items: ClienteListaItem[] }>> {
  const tokens = params.q
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    return { success: true, data: { items: [] } };
  }
  const take = Math.min(10, Math.max(1, Math.floor(Number(params.take) || 10)));

  try {
    const where: Prisma.ClienteWhereInput = {
      AND: [
        {
          OR: [
            { nombreCompleto: { not: "" } },
            { AND: [{ nombreCompleto: "" }, { cel: { not: "" } }] },
          ],
        },
        ...tokens.map((t) => {
          const digitos = soloDigitos(t);
          const or: Prisma.ClienteWhereInput[] = [
            { nombreCompleto: { contains: t, mode: "insensitive" } },
            {
              pintorAsociado: {
                nombreCompleto: { contains: t, mode: "insensitive" },
              },
            },
          ];
          if (digitos.length > 0) {
            or.push({ cel: { contains: digitos } });
            or.push({ cuit: { contains: digitos } });
          }
          if (tokenCoincideClienteSinNombre(t)) {
            or.push({ AND: [{ nombreCompleto: "" }, { cel: { not: "" } }] });
          }
          return { OR: or };
        }),
      ],
    };
    const rows = await prisma.cliente.findMany({
      where,
      orderBy: [{ nombreCompleto: "asc" }, { createdAt: "asc" }],
      take,
      select: {
        ...select,
        direcciones: {
          select: {
            id: true,
            personaId: true,
            nombreProyecto: true,
            calleNombre: true,
            numeracion: true,
            distrito: true,
            departamento: true,
            urlMaps: true,
            referencia: true,
          },
          orderBy: [
            { nombreProyecto: "asc" },
            { calleNombre: "asc" },
            { numeracion: "asc" },
            { createdAt: "asc" },
          ],
        },
      },
    });
    return {
      success: true,
      data: {
        items: (
          await conSaldoCuentaCorriente(
            rows.map((row) => ({
              ...mapRow(row),
              proyectos: row.direcciones.map(mapEnviosDireccionItem),
            }))
          )
        ).sort(compararClientesParaListado),
      },
    };
  } catch (e) {
    console.error("[clientes][buscarFactura]", e);
    return { success: false, error: "No se pudo buscar clientes." };
  }
}

export async function crearCliente(
  input: CrearClienteInput
): Promise<ServiceResult<ClienteItem>> {
  try {
    const pintor = await resolverPintorAsociadoId(input);
    if (!pintor.success) return pintor;
    const condicion = await validarCondicionIvaCliente(input.condicionIva ?? null);
    if (!condicion.success) return condicion;
    const row = await prisma.cliente.create({
      data: {
        nombreCompleto: normalizarNombreCliente(input.nombreCompleto),
        cel: normalizarCelCliente(input.cel),
        esPintor: input.esPintor,
        pintorAsociadoId: pintor.data,
        cuit: normalizarCuitCliente(input.cuit ?? null),
        condicionIva: condicion.data,
        ctaCorrientePlazo:
          input.ctaCorrientePlazo ?? CLIENTE_CTA_CORRIENTE_PLAZO_DEFAULT,
        ctaCorrienteMontoMax: input.ctaCorrienteMontoMax ?? null,
      },
      select,
    });
    return { success: true, data: mapRow(row) };
  } catch (error) {
    console.error("[clientes][crear]", error);
    return { success: false, error: prismaErrorMessage(error, "No se pudo crear el cliente.") };
  }
}

export async function editarCliente(
  input: EditarClienteInput
): Promise<ServiceResult<ClienteItem>> {
  try {
    const usada = await prisma.enviosFinal.findFirst({
      where: input.esPintor ? { clienteFinalId: input.id } : { pintorId: input.id },
      select: { id: true },
    });
    if (usada) {
      return {
        success: false,
        error:
          "No se puede cambiar ES PINTOR: el cliente ya está asociado a un envío con el rol actual.",
      };
    }
    if (!input.esPintor) {
      const asociadoComoPintor = await prisma.cliente.findFirst({
        where: { pintorAsociadoId: input.id },
        select: { id: true },
      });
      if (asociadoComoPintor) {
        return {
          success: false,
          error: "No se puede desmarcar ES PINTOR: hay clientes que lo tienen como pintor asociado.",
        };
      }
    }
    const pintor = await resolverPintorAsociadoId(input);
    if (!pintor.success) return pintor;
    const existente = await prisma.cliente.findUnique({
      where: { id: input.id },
      select: { condicionIva: true },
    });
    if (!existente) {
      return { success: false, error: "El cliente no existe." };
    }
    const data: {
      nombreCompleto: string;
      cel: string;
      esPintor: boolean;
      pintorAsociadoId: string | null;
      cuit?: string | null;
      condicionIva?: number | null;
      ctaCorrientePlazo?: number | null;
      ctaCorrienteMontoMax?: number | null;
    } = {
      nombreCompleto: normalizarNombreCliente(input.nombreCompleto),
      cel: normalizarCelCliente(input.cel),
      esPintor: input.esPintor,
      pintorAsociadoId: pintor.data,
    };
    if (input.cuit !== undefined) {
      data.cuit = normalizarCuitCliente(input.cuit);
    }
    if (input.condicionIva !== undefined) {
      const condicion = await validarCondicionIvaCliente(
        input.condicionIva,
        existente.condicionIva
      );
      if (!condicion.success) return condicion;
      data.condicionIva = condicion.data;
    }
    if (input.ctaCorrientePlazo !== undefined) {
      data.ctaCorrientePlazo = input.ctaCorrientePlazo;
    }
    if (input.ctaCorrienteMontoMax !== undefined) {
      data.ctaCorrienteMontoMax = input.ctaCorrienteMontoMax;
    }
    const row = await prisma.cliente.update({
      where: { id: input.id },
      data,
      select,
    });
    return { success: true, data: mapRow(row) };
  } catch (error) {
    console.error("[clientes][editar]", error);
    return { success: false, error: prismaErrorMessage(error, "No se pudo actualizar el cliente.") };
  }
}

export async function eliminarCliente(id: string): Promise<ServiceResult<{ id: string }>> {
  try {
    await prisma.cliente.delete({ where: { id } });
    return { success: true, data: { id } };
  } catch (error) {
    console.error("[clientes][eliminar]", error);
    return { success: false, error: prismaErrorMessage(error, "No se pudo eliminar el cliente.") };
  }
}
