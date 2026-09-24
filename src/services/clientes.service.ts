import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  CLIENTE_CTA_CORRIENTE_PLAZO_DEFAULT,
  compararClientesParaListado,
  compararClientesTypeaheadFactura,
  normalizarCelCliente,
  normalizarNombreCliente,
  soloDigitos,
  tokenCoincideClienteSinNombre,
  type ClienteItem,
  type ClienteListaItem,
  type ClienteResumen,
} from "@/lib/envios";
import type {
  CuentaCorrienteClienteDatos,
  CuentaCorrienteClienteMovimiento,
  CuentaCorrienteMovimientoTipo,
} from "@/lib/factura";
import { formatoNroComprobante } from "@/lib/facturaFiscal";
import {
  dateToIsoYmdArgentina,
  isoYmdFromPrismaDateOnly,
} from "@/lib/fechaArgentina";
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Saldo CC: ventas − cobros (`imp_cobrado`) − notas de crédito (no rechazadas). */
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
      tipoLocal: { in: [...TIPOS_VENTA_CTA_CTE, ...TIPOS_NC_CTA_CTE] },
    },
    _sum: { impTotal: true, impCobrado: true },
  });
  for (const row of rows) {
    if (row.clienteId == null) continue;
    const total = Number(row._sum.impTotal ?? 0);
    if ((TIPOS_NC_CTA_CTE as readonly string[]).includes(row.tipoLocal)) {
      out.set(row.clienteId, round2((out.get(row.clienteId) ?? 0) - total));
      continue;
    }
    const cobrado = Number(row._sum.impCobrado ?? 0);
    out.set(
      row.clienteId,
      round2((out.get(row.clienteId) ?? 0) + total - cobrado)
    );
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
 * Typeahead Factura · Crear / Cuenta Corrientes: tokens AND sobre nombre / CEL / CUIT / pintor asociado / `SIN NOMBRE`.
 * Orden: coincidencia en columna CLIENTE primero; luego asociados (u otros matches) A-Z.
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
  const takePool = Math.min(80, Math.max(take * 8, 40));

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
      take: takePool,
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
        ).sort(compararClientesTypeaheadFactura(tokens)).slice(0, take),
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

type LedgerEvento = {
  id: string;
  tipo: CuentaCorrienteMovimientoTipo;
  fechaIso: string;
  createdAtIso: string;
  comprobanteId: string;
  nroComprobante: string;
  detalle: string;
  monto: number;
  sortMs: number;
  tipoOrden: number;
};

function tipoMovimientoDesdeTipoLocal(
  tipoLocal: string
): CuentaCorrienteMovimientoTipo | null {
  if ((TIPOS_VENTA_CTA_CTE as readonly string[]).includes(tipoLocal)) {
    return "venta";
  }
  if ((TIPOS_NC_CTA_CTE as readonly string[]).includes(tipoLocal)) {
    return "nota_credito";
  }
  return null;
}

function signoMovimientoCc(tipo: CuentaCorrienteMovimientoTipo): number {
  return tipo === "venta" ? 1 : -1;
}

/**
 * Historial de cuenta corriente: VENTA, NOTA CRÉDITO y COBRO (filas `comprobantes_vtas_cobros`).
 * El SALDO CC de cada fila es acumulado (más antiguo primero).
 */
export async function obtenerCuentaCorrienteCliente(
  clienteId: string
): Promise<ServiceResult<CuentaCorrienteClienteDatos>> {
  try {
    const cliente = await obtenerClienteListaPorId(clienteId);
    if (!cliente) {
      return { success: false, error: "El cliente no existe." };
    }

    const rows = await prisma.comprobanteVta.findMany({
      where: {
        clienteId,
        estado: { not: "rechazado" },
        tipoLocal: { in: [...TIPOS_VENTA_CTA_CTE, ...TIPOS_NC_CTA_CTE] },
      },
      select: {
        id: true,
        tipoLocal: true,
        fecha: true,
        createdAt: true,
        ptoVenta: true,
        cbteNro: true,
        impTotal: true,
        impCobrado: true,
        cobros: {
          orderBy: [{ createdAt: "asc" }, { orden: "asc" }],
          select: {
            id: true,
            montoCents: true,
            createdAt: true,
            orden: true,
            pagoNombre: true,
            entidadNombre: true,
            cuotaEtiqueta: true,
            esCuentaCorriente: true,
          },
        },
      },
    });

    const eventos: LedgerEvento[] = [];
    for (const row of rows) {
      const tipo = tipoMovimientoDesdeTipoLocal(row.tipoLocal);
      if (!tipo) continue;
      const nroComprobante = formatoNroComprobante(row.ptoVenta, row.cbteNro);
      const fechaIso = isoYmdFromPrismaDateOnly(row.fecha);
      eventos.push({
        id: row.id,
        tipo,
        fechaIso,
        createdAtIso: row.createdAt.toISOString(),
        comprobanteId: row.id,
        nroComprobante,
        detalle: nroComprobante,
        monto: round2(Number(row.impTotal)),
        sortMs: row.createdAt.getTime(),
        tipoOrden: tipo === "venta" ? 0 : 2,
      });
      if (tipo !== "venta") continue;

      const cobrosReales = row.cobros.filter(
        (c) => c.montoCents > 0 && !c.esCuentaCorriente
      );
      for (const cobro of cobrosReales) {
        const entidad = cobro.entidadNombre.trim();
        const detalle = entidad
          ? `${cobro.pagoNombre} - ${entidad}`
          : cobro.pagoNombre;
        eventos.push({
          id: cobro.id,
          tipo: "cobro",
          fechaIso: dateToIsoYmdArgentina(cobro.createdAt),
          createdAtIso: cobro.createdAt.toISOString(),
          comprobanteId: row.id,
          nroComprobante,
          detalle: [detalle, cobro.cuotaEtiqueta?.trim()]
            .filter(Boolean)
            .join(" · "),
          monto: round2(cobro.montoCents / 100),
          sortMs: cobro.createdAt.getTime(),
          tipoOrden: 1,
        });
      }
      const cobradoFilas = round2(
        cobrosReales.reduce((acc, c) => acc + c.montoCents / 100, 0)
      );
      const impCobrado = round2(Number(row.impCobrado));
      const restoCobrado = round2(impCobrado - cobradoFilas);
      if (restoCobrado > 0.009) {
        eventos.push({
          id: `imp-cobrado-${row.id}`,
          tipo: "cobro",
          fechaIso,
          createdAtIso: row.createdAt.toISOString(),
          comprobanteId: row.id,
          nroComprobante,
          detalle: nroComprobante,
          monto: restoCobrado,
          sortMs: row.createdAt.getTime() + 1,
          tipoOrden: 1,
        });
      }
    }

    eventos.sort((a, b) => {
      if (a.fechaIso !== b.fechaIso) return a.fechaIso < b.fechaIso ? -1 : 1;
      if (a.sortMs !== b.sortMs) return a.sortMs - b.sortMs;
      if (a.tipoOrden !== b.tipoOrden) return a.tipoOrden - b.tipoOrden;
      return a.id < b.id ? -1 : 1;
    });

    let saldo = 0;
    const movimientos: CuentaCorrienteClienteMovimiento[] = eventos.map((ev) => {
      saldo = round2(saldo + signoMovimientoCc(ev.tipo) * ev.monto);
      return {
        id: ev.id,
        tipo: ev.tipo,
        fechaIso: ev.fechaIso,
        createdAtIso: ev.createdAtIso,
        comprobanteId: ev.comprobanteId,
        nroComprobante: ev.nroComprobante,
        detalle: ev.detalle,
        monto: ev.monto,
        saldoCc: saldo,
      };
    });

    return { success: true, data: { cliente, movimientos } };
  } catch (error) {
    console.error("[clientes][cuentaCorriente]", error);
    return {
      success: false,
      error: prismaErrorMessage(error, "No se pudo cargar la cuenta corriente."),
    };
  }
}
