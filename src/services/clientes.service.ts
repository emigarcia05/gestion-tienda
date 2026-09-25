import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  CUENTA_CORRIENTE_TOKEN_MAX,
  type CuentaCorrientePublicaSesion,
} from "@/lib/cuentaCorrientePublica";
import {
  CLIENTE_CTA_CORRIENTE_PLAZO_DEFAULT,
  compararClientesParaListado,
  compararClientesTypeaheadFactura,
  etiquetaClienteListado,
  normalizarCelCliente,
  normalizarNombreCliente,
  soloDigitos,
  tokenCoincideClienteSinNombre,
  type ClienteItem,
  type ClienteListaItem,
  type ClienteResumen,
} from "@/lib/envios";
import {
  esCobroNotaCreditoNombre,
  FACTURA_CLIENTE_CONSUMIDOR_FINAL,
  FACTURA_COBRO_NOTA_CREDITO_LABEL,
  leftoverClienteCobroPesos,
  type CuentaCorrienteClienteDatos,
  type CuentaCorrienteClienteMovimiento,
  type CuentaCorrienteMovimientoTipo,
  type CuentaCorrienteProductoLinea,
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

/** Saldo CC: ventas − cobros reales − NC. Las imputaciones de NC en `imp_cobrado` se reponen para no duplicar. */
export async function saldosCuentaCorrientePorCliente(
  clienteIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (clienteIds.length === 0) return out;
  const rows = await prisma.comprobanteVta.groupBy({
    by: ["clienteId", "tipoComprobante"],
    where: {
      clienteId: { in: clienteIds },
      estado: { not: "rechazado" },
      tipoComprobante: { in: [...TIPOS_VENTA_CTA_CTE, ...TIPOS_NC_CTA_CTE] },
    },
    _sum: { impTotal: true, impCobrado: true },
  });
  for (const row of rows) {
    if (row.clienteId == null) continue;
    const total = Number(row._sum.impTotal ?? 0);
    if ((TIPOS_NC_CTA_CTE as readonly string[]).includes(row.tipoComprobante)) {
      out.set(row.clienteId, round2((out.get(row.clienteId) ?? 0) - total));
      continue;
    }
    const cobrado = Number(row._sum.impCobrado ?? 0);
    out.set(
      row.clienteId,
      round2((out.get(row.clienteId) ?? 0) + total - cobrado)
    );
  }
  const ncCobros = await prisma.comprobanteVtaCobro.findMany({
    where: {
      comprobante: {
        clienteId: { in: clienteIds },
        tipoComprobante: { in: [...TIPOS_VENTA_CTA_CTE] },
        estado: { not: "rechazado" },
      },
    },
    select: {
      montoCents: true,
      pagoNombre: true,
      comprobante: { select: { clienteId: true } },
    },
  });
  for (const cobro of ncCobros) {
    if (!esCobroNotaCreditoNombre(cobro.pagoNombre)) continue;
    const clienteId = cobro.comprobante.clienteId;
    if (!clienteId) continue;
    out.set(
      clienteId,
      round2((out.get(clienteId) ?? 0) + cobro.montoCents / 100)
    );
  }
  const anticipos = await prisma.clienteCobro.findMany({
    where: { clienteId: { in: clienteIds } },
    select: {
      clienteId: true,
      montoCents: true,
      imputaciones: { select: { montoCents: true } },
    },
  });
  for (const cobro of anticipos) {
    const leftover = leftoverClienteCobroPesos(cobro.montoCents, cobro.imputaciones);
    if (leftover <= 0) continue;
    out.set(cobro.clienteId, round2((out.get(cobro.clienteId) ?? 0) - leftover));
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
      return "No se puede eliminar: el cliente está asociado a un envío, a un proyecto, a un comprobante, a un cobro o como pintor de otro cliente.";
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

type LedgerCobroVenta = {
  id: string;
  comprobanteId: string;
  montoCents: number;
  createdAt: Date;
  pagoNombre: string;
  entidadNombre: string;
  cuotaEtiqueta: string | null;
  esCuentaCorriente: boolean;
  clienteCobroId: string | null;
};

type LedgerEvento = {
  id: string;
  tipo: CuentaCorrienteMovimientoTipo;
  fechaIso: string;
  createdAtIso: string;
  comprobanteId: string;
  nroComprobante: string;
  detalle: string;
  monto: number;
  saldoComprobante: number;
  sortMs: number;
  tipoOrden: number;
  /** false = fila informativa (p. ej. cobro marcado cuenta corriente); no mueve el saldo. */
  afectaSaldo: boolean;
  cuentaComoPago: boolean;
};

function detalleCobroLedger(cobro: {
  pagoNombre: string;
  entidadNombre: string;
  cuotaEtiqueta: string | null;
}): string {
  const entidad = cobro.entidadNombre.trim();
  const detalle = entidad
    ? `${cobro.pagoNombre} - ${entidad}`
    : cobro.pagoNombre;
  return [detalle, cobro.cuotaEtiqueta?.trim()].filter(Boolean).join(" · ");
}

function tipoMovimientoDesdeTipoComprobante(
  tipoComprobante: string
): CuentaCorrienteMovimientoTipo | null {
  if ((TIPOS_VENTA_CTA_CTE as readonly string[]).includes(tipoComprobante)) {
    return "venta";
  }
  if ((TIPOS_NC_CTA_CTE as readonly string[]).includes(tipoComprobante)) {
    return "nota_credito";
  }
  return null;
}

function signoMovimientoCc(tipo: CuentaCorrienteMovimientoTipo): number {
  return tipo === "venta" ? 1 : -1;
}

async function armarLineasProductosCuentaCorriente(
  rows: {
    id: string;
    tipoComprobante: string;
    fecha: Date;
    createdAt: Date;
  }[]
): Promise<CuentaCorrienteProductoLinea[]> {
  const cabeceras = new Map<
    string,
    { tipo: CuentaCorrienteProductoLinea["tipo"]; fechaIso: string; createdAtIso: string }
  >();
  for (const row of rows) {
    const tipo = tipoMovimientoDesdeTipoComprobante(row.tipoComprobante);
    if (tipo !== "venta" && tipo !== "nota_credito") continue;
    cabeceras.set(row.id, {
      tipo,
      fechaIso: isoYmdFromPrismaDateOnly(row.fecha),
      createdAtIso: row.createdAt.toISOString(),
    });
  }
  const ids = [...cabeceras.keys()];
  if (ids.length === 0) return [];

  const items = await prisma.comprobanteVtaItem.findMany({
    where: { comprobanteId: { in: ids } },
    orderBy: [{ comprobanteId: "asc" }, { orden: "asc" }],
    select: {
      id: true,
      comprobanteId: true,
      descripcion: true,
      cantidad: true,
      codTienda: true,
    },
  });
  const codigos = [...new Set(items.map((i) => i.codTienda).filter(Boolean))];
  const tiendaRows =
    codigos.length === 0
      ? []
      : await prisma.prodTienda.findMany({
          where: { codTienda: { in: codigos } },
          select: {
            codTienda: true,
            marca: true,
            rubro: true,
          },
        });
  const metaPorCod = new Map(
    tiendaRows.map((t) => {
      const marca = (t.marca ?? "").trim();
      const rubro = (t.rubro ?? "").trim();
      return [t.codTienda, { marca, rubro }] as const;
    })
  );

  const out: CuentaCorrienteProductoLinea[] = [];
  for (const item of items) {
    const cab = cabeceras.get(item.comprobanteId);
    if (!cab) continue;
    const meta = metaPorCod.get(item.codTienda);
    out.push({
      id: item.id,
      fechaIso: cab.fechaIso,
      createdAtIso: cab.createdAtIso,
      tipo: cab.tipo,
      descripcion: item.descripcion,
      cantidad: Number(item.cantidad),
      marca: meta?.marca ?? "",
      rubro: meta?.rubro ?? "",
    });
  }
  out.sort((a, b) => {
    if (a.fechaIso !== b.fechaIso) return a.fechaIso < b.fechaIso ? -1 : 1;
    if (a.createdAtIso !== b.createdAtIso) {
      return a.createdAtIso < b.createdAtIso ? -1 : 1;
    }
    if (a.tipo !== b.tipo) return a.tipo === "venta" ? -1 : 1;
    return a.descripcion.localeCompare(b.descripcion, "es-AR");
  });
  return out;
}

/** Ventas/NC del cliente: FK, CUIT del receptor o mismo nombre (incl. CONSUMIDOR FINAL). */
export function whereComprobantesCuentaCorriente(
  cliente: ClienteListaItem
): Prisma.ComprobanteVtaWhereInput {
  const or: Prisma.ComprobanteVtaWhereInput[] = [{ clienteId: cliente.id }];
  const cuit = soloDigitos(cliente.cuit ?? "");
  if (cuit.length > 0) {
    or.push({ receptorDocNro: cuit });
    const cuitRaw = cliente.cuit?.trim();
    if (cuitRaw && cuitRaw !== cuit) {
      or.push({ receptorDocNro: cuitRaw });
    }
  }
  const nombres = new Set<string>();
  const nombreCatalogo = normalizarNombreCliente(cliente.nombreCompleto);
  if (nombreCatalogo) nombres.add(nombreCatalogo);
  const etiqueta = etiquetaClienteListado(cliente).trim();
  if (etiqueta) nombres.add(etiqueta);
  if (
    nombreCatalogo === FACTURA_CLIENTE_CONSUMIDOR_FINAL ||
    etiqueta.toLocaleUpperCase("es-AR") === FACTURA_CLIENTE_CONSUMIDOR_FINAL
  ) {
    nombres.add(FACTURA_CLIENTE_CONSUMIDOR_FINAL);
  }
  for (const nombre of nombres) {
    or.push({
      receptorNombre: { equals: nombre, mode: "insensitive" },
    });
  }
  return { OR: or };
}

/**
 * Historial de cuenta corriente: VENTA, NOTA CRÉDITO y COBRO.
 * Comprobantes por `cliente_id`, CUIT o `receptor_nombre`. Cobros: todas las
 * filas de `comprobantes_vtas_cobros` de esas ventas (`monto_cents` > 0).
 * `es_cuenta_corriente` se lista como COBRO pero no mueve el SALDO CC.
 */
export async function obtenerCuentaCorrienteCliente(
  clienteId: string
): Promise<ServiceResult<CuentaCorrienteClienteDatos>> {
  try {
    const cliente = await obtenerClienteListaPorId(clienteId);
    if (!cliente) {
      return { success: false, error: "El cliente no existe." };
    }

    const tiposLedger = [...TIPOS_VENTA_CTA_CTE, ...TIPOS_NC_CTA_CTE];
    const rows = await prisma.comprobanteVta.findMany({
      where: {
        AND: [
          whereComprobantesCuentaCorriente(cliente),
          {
            estado: { not: "rechazado" },
            tipoComprobante: { in: tiposLedger },
          },
        ],
      },
      select: {
        id: true,
        tipoComprobante: true,
        fecha: true,
        createdAt: true,
        ptoVenta: true,
        cbteNro: true,
        impTotal: true,
        impCobrado: true,
      },
    });

    const idsVenta = rows
      .filter((row) => tipoMovimientoDesdeTipoComprobante(row.tipoComprobante) === "venta")
      .map((row) => row.id);
    const nrosNc = rows
      .filter(
        (row) =>
          tipoMovimientoDesdeTipoComprobante(row.tipoComprobante) ===
          "nota_credito"
      )
      .map((row) => formatoNroComprobante(row.ptoVenta, row.cbteNro));
    const [cobros, cobrosCliente, imputNc]: [
      LedgerCobroVenta[],
      {
        id: string;
        pagoNombre: string;
        entidadNombre: string;
        cuotaEtiqueta: string | null;
        montoCents: number;
        createdAt: Date;
        imputaciones: { montoCents: number }[];
      }[],
      { entidadNombre: string; montoCents: number }[],
    ] = await Promise.all([
      idsVenta.length === 0
        ? Promise.resolve([] as LedgerCobroVenta[])
        : prisma.comprobanteVtaCobro.findMany({
            where: { comprobanteId: { in: idsVenta } },
            orderBy: [{ createdAt: "asc" }, { orden: "asc" }],
            select: {
              id: true,
              comprobanteId: true,
              montoCents: true,
              createdAt: true,
              pagoNombre: true,
              entidadNombre: true,
              cuotaEtiqueta: true,
              esCuentaCorriente: true,
              clienteCobroId: true,
            },
          }),
      prisma.clienteCobro.findMany({
        where: { clienteId: cliente.id },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          pagoNombre: true,
          entidadNombre: true,
          cuotaEtiqueta: true,
          montoCents: true,
          createdAt: true,
          imputaciones: { select: { montoCents: true } },
        },
      }),
      nrosNc.length === 0
        ? Promise.resolve([] as { entidadNombre: string; montoCents: number }[])
        : prisma.comprobanteVtaCobro.findMany({
            where: {
              pagoNombre: FACTURA_COBRO_NOTA_CREDITO_LABEL,
              entidadNombre: { in: nrosNc },
            },
            select: { entidadNombre: true, montoCents: true },
          }),
    ]);

    const usadoNcPorNro = new Map<string, number>();
    for (const cobro of imputNc) {
      const nro = cobro.entidadNombre.trim();
      usadoNcPorNro.set(
        nro,
        round2((usadoNcPorNro.get(nro) ?? 0) + cobro.montoCents / 100)
      );
    }

    const cobrosPorComprobante = new Map<string, LedgerCobroVenta[]>();
    for (const cobro of cobros) {
      const lista = cobrosPorComprobante.get(cobro.comprobanteId);
      if (lista) lista.push(cobro);
      else cobrosPorComprobante.set(cobro.comprobanteId, [cobro]);
    }

    const eventos: LedgerEvento[] = [];
    for (const row of rows) {
      const tipo = tipoMovimientoDesdeTipoComprobante(row.tipoComprobante);
      if (!tipo) continue;
      const nroComprobante = formatoNroComprobante(row.ptoVenta, row.cbteNro);
      const fechaIso = isoYmdFromPrismaDateOnly(row.fecha);
      const impTotal = round2(Number(row.impTotal));
      const impCobrado = round2(Number(row.impCobrado));
      const saldoComprobante =
        tipo === "venta"
          ? round2(Math.max(0, impTotal - impCobrado))
          : round2(
              Math.max(
                0,
                impTotal - impCobrado - (usadoNcPorNro.get(nroComprobante) ?? 0)
              )
            );
      eventos.push({
        id: row.id,
        tipo,
        fechaIso,
        createdAtIso: row.createdAt.toISOString(),
        comprobanteId: row.id,
        nroComprobante,
        detalle: nroComprobante,
        monto: impTotal,
        saldoComprobante,
        sortMs: row.createdAt.getTime(),
        tipoOrden: tipo === "venta" ? 0 : 2,
        afectaSaldo: true,
        cuentaComoPago: false,
      });
      if (tipo !== "venta") continue;

      const cobrosDeVenta = (cobrosPorComprobante.get(row.id) ?? []).filter(
        (c) => c.montoCents > 0 && c.clienteCobroId == null
      );
      for (const cobro of cobrosDeVenta) {
        const esNcCobro = esCobroNotaCreditoNombre(cobro.pagoNombre);
        eventos.push({
          id: cobro.id,
          tipo: "cobro",
          fechaIso: dateToIsoYmdArgentina(cobro.createdAt),
          createdAtIso: cobro.createdAt.toISOString(),
          comprobanteId: row.id,
          nroComprobante,
          detalle: detalleCobroLedger(cobro),
          monto: round2(cobro.montoCents / 100),
          saldoComprobante: 0,
          sortMs: cobro.createdAt.getTime(),
          tipoOrden: 1,
          afectaSaldo: !cobro.esCuentaCorriente && !esNcCobro,
          cuentaComoPago: !cobro.esCuentaCorriente,
        });
      }
      const cobradoFilas = round2(
        (cobrosPorComprobante.get(row.id) ?? [])
          .filter((c) => c.montoCents > 0 && !c.esCuentaCorriente)
          .reduce((acc, c) => acc + c.montoCents / 100, 0)
      );
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
          saldoComprobante: 0,
          sortMs: row.createdAt.getTime() + 1,
          tipoOrden: 1,
          afectaSaldo: true,
          cuentaComoPago: true,
        });
      }
    }

    for (const cobro of cobrosCliente) {
      if (cobro.montoCents <= 0) continue;
      eventos.push({
        id: cobro.id,
        tipo: "cobro",
        fechaIso: dateToIsoYmdArgentina(cobro.createdAt),
        createdAtIso: cobro.createdAt.toISOString(),
        comprobanteId: "",
        nroComprobante: "",
        detalle: detalleCobroLedger(cobro),
        monto: round2(cobro.montoCents / 100),
        saldoComprobante: leftoverClienteCobroPesos(
          cobro.montoCents,
          cobro.imputaciones
        ),
        sortMs: cobro.createdAt.getTime(),
        tipoOrden: 1,
        afectaSaldo: true,
        cuentaComoPago: true,
      });
    }

    eventos.sort((a, b) => {
      if (a.fechaIso !== b.fechaIso) return a.fechaIso < b.fechaIso ? -1 : 1;
      if (a.sortMs !== b.sortMs) return a.sortMs - b.sortMs;
      if (a.tipoOrden !== b.tipoOrden) return a.tipoOrden - b.tipoOrden;
      return a.id < b.id ? -1 : 1;
    });

    const productos = await armarLineasProductosCuentaCorriente(rows);

    let saldo = 0;
    const movimientos: CuentaCorrienteClienteMovimiento[] = eventos.map((ev) => {
      if (ev.afectaSaldo) {
        saldo = round2(saldo + signoMovimientoCc(ev.tipo) * ev.monto);
      }
      return {
        id: ev.id,
        tipo: ev.tipo,
        fechaIso: ev.fechaIso,
        createdAtIso: ev.createdAtIso,
        comprobanteId: ev.comprobanteId,
        nroComprobante: ev.nroComprobante,
        detalle: ev.detalle,
        monto: ev.monto,
        saldoComprobante: ev.saldoComprobante,
        saldoCc: saldo,
        afectaSaldo: ev.afectaSaldo,
        cuentaComoPago: ev.cuentaComoPago,
      };
    });

    return { success: true, data: { cliente, movimientos, productos } };
  } catch (error) {
    console.error("[clientes][cuentaCorriente]", error);
    return {
      success: false,
      error: prismaErrorMessage(error, "No se pudo cargar la cuenta corriente."),
    };
  }
}

function nuevoTokenCuentaCorriente(): string {
  return randomBytes(32).toString("base64url").slice(0, CUENTA_CORRIENTE_TOKEN_MAX);
}

async function listarClientesAlcancePorTitular(
  titular: ClienteListaItem
): Promise<ClienteListaItem[]> {
  if (!titular.esPintor) return [titular];
  const asociados = await prisma.cliente.findMany({
    where: { pintorAsociadoId: titular.id },
    select: { id: true },
  });
  const filas: ClienteListaItem[] = [titular];
  for (const row of asociados) {
    const item = await obtenerClienteListaPorId(row.id);
    if (item) filas.push(item);
  }
  return filas;
}

async function resolverTitularPorToken(
  token: string
): Promise<ServiceResult<ClienteListaItem>> {
  const row = await prisma.cliente.findUnique({
    where: { tokenCuentaCorriente: token },
    select: { id: true },
  });
  if (!row) {
    return { success: false, error: "El link no es válido." };
  }
  const titular = await obtenerClienteListaPorId(row.id);
  if (!titular) {
    return { success: false, error: "El link no es válido." };
  }
  return { success: true, data: titular };
}

function sesionDesdeAlcance(
  titular: ClienteListaItem,
  alcance: readonly ClienteListaItem[]
): CuentaCorrientePublicaSesion {
  return {
    titularId: titular.id,
    cuentas: alcance.map((c) => ({
      id: c.id,
      etiqueta: etiquetaClienteListado(c),
    })),
  };
}

export async function obtenerOCrearTokenCuentaCorriente(
  clienteId: string
): Promise<ServiceResult<{ token: string }>> {
  try {
    const existente = await prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { id: true, tokenCuentaCorriente: true },
    });
    if (!existente) {
      return { success: false, error: "El cliente no existe." };
    }
    if (existente.tokenCuentaCorriente) {
      return { success: true, data: { token: existente.tokenCuentaCorriente } };
    }
    for (let i = 0; i < 5; i += 1) {
      const token = nuevoTokenCuentaCorriente();
      try {
        await prisma.cliente.update({
          where: { id: clienteId },
          data: { tokenCuentaCorriente: token },
        });
        return { success: true, data: { token } };
      } catch (error) {
        console.error("[clientes][tokenCuentaCorriente][retry]", error);
      }
    }
    return { success: false, error: "No se pudo generar el link." };
  } catch (error) {
    console.error("[clientes][tokenCuentaCorriente]", error);
    return {
      success: false,
      error: prismaErrorMessage(error, "No se pudo generar el link."),
    };
  }
}

export async function resolverSesionCuentaCorrientePublica(
  token: string
): Promise<ServiceResult<CuentaCorrientePublicaSesion>> {
  try {
    const titularRes = await resolverTitularPorToken(token);
    if (!titularRes.success) return titularRes;
    const alcance = await listarClientesAlcancePorTitular(titularRes.data);
    return { success: true, data: sesionDesdeAlcance(titularRes.data, alcance) };
  } catch (error) {
    console.error("[clientes][cuentaCorrientePublica]", error);
    return {
      success: false,
      error: prismaErrorMessage(error, "El link no es válido."),
    };
  }
}

export async function obtenerCuentaCorrientePublica(
  token: string,
  clienteId: string
): Promise<ServiceResult<CuentaCorrienteClienteDatos>> {
  try {
    const titularRes = await resolverTitularPorToken(token);
    if (!titularRes.success) return titularRes;
    const alcance = await listarClientesAlcancePorTitular(titularRes.data);
    if (!alcance.some((c) => c.id === clienteId)) {
      return { success: false, error: "No se pudo cargar la cuenta corriente." };
    }
    return obtenerCuentaCorrienteCliente(clienteId);
  } catch (error) {
    console.error("[clientes][cuentaCorrientePublica][ledger]", error);
    return {
      success: false,
      error: prismaErrorMessage(error, "No se pudo cargar la cuenta corriente."),
    };
  }
}

export async function assertComprobanteCuentaCorrientePublica(
  token: string,
  comprobanteId: string
): Promise<ServiceResult<void>> {
  try {
    const titularRes = await resolverTitularPorToken(token);
    if (!titularRes.success) return titularRes;
    const alcance = await listarClientesAlcancePorTitular(titularRes.data);
    const or = alcance.flatMap((c) => {
      const w = whereComprobantesCuentaCorriente(c);
      return Array.isArray(w.OR) ? w.OR : [];
    });
    const row = await prisma.comprobanteVta.findFirst({
      where: { id: comprobanteId, OR: or },
      select: { id: true },
    });
    if (!row) {
      return { success: false, error: "No se pudo leer el comprobante." };
    }
    return { success: true, data: undefined };
  } catch (error) {
    console.error("[clientes][cuentaCorrientePublica][comprobante]", error);
    return {
      success: false,
      error: prismaErrorMessage(error, "No se pudo leer el comprobante."),
    };
  }
}

export async function assertCobroCuentaCorrientePublica(
  token: string,
  cobroId: string
): Promise<ServiceResult<void>> {
  try {
    const cobroVta = await prisma.comprobanteVtaCobro.findUnique({
      where: { id: cobroId },
      select: { comprobanteId: true, clienteCobroId: true },
    });
    if (cobroVta) {
      return assertComprobanteCuentaCorrientePublica(token, cobroVta.comprobanteId);
    }
    const cobroCliente = await prisma.clienteCobro.findUnique({
      where: { id: cobroId },
      select: { clienteId: true },
    });
    if (!cobroCliente) {
      return { success: false, error: "No se pudo leer el cobro." };
    }
    const titularRes = await resolverTitularPorToken(token);
    if (!titularRes.success) return titularRes;
    const alcance = await listarClientesAlcancePorTitular(titularRes.data);
    if (!alcance.some((c) => c.id === cobroCliente.clienteId)) {
      return { success: false, error: "No se pudo leer el cobro." };
    }
    return { success: true, data: undefined };
  } catch (error) {
    console.error("[clientes][cuentaCorrientePublica][cobro]", error);
    return {
      success: false,
      error: prismaErrorMessage(error, "No se pudo leer el cobro."),
    };
  }
}
