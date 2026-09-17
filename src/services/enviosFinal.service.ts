import { prisma } from "@/lib/prisma";
import {
  addDaysToIsoYmdArgentina,
  isoYmdFromPrismaDateOnly,
  dateToIsoYmdArgentina,
} from "@/lib/fechaArgentina";
import {
  ENVIOS_PDF_MAX_BYTES,
  capitalizarTextoEnvio,
  normalizarNombreCliente,
  pagadoDesdeFormaPagado,
  properTextoEnvio,
  type ClienteItem,
  type EnviosDireccionItem,
  type EnviosFinalListItem,
  type EnviosSucursalOption,
} from "@/lib/envios";
import type {
  CrearEnviosFinalInput,
  EditarEnviosFinalInput,
} from "@/lib/validations/envios";
import type { ServiceResult } from "@/types/service.types";

function dateFromIsoYmd(isoYmd: string): Date {
  return new Date(`${isoYmd}T12:00:00.000Z`);
}

const clienteResumenSelect = {
  id: true,
  nombreCompleto: true,
  cel: true,
  tipo: true,
} as const;

const clienteSelect = {
  ...clienteResumenSelect,
  pintorAsociadoId: true,
  pintorAsociado: { select: clienteResumenSelect },
  cuit: true,
  condicionIva: true,
} as const;

const direccionSelect = {
  id: true,
  personaId: true,
  calleNombre: true,
  numeracion: true,
  distrito: true,
  departamento: true,
  urlMaps: true,
  referencia: true,
} as const;

const sucursalSelect = {
  id: true,
  codigo: true,
  nombre: true,
} as const;

const listSelect = {
  id: true,
  fechaEnvio: true,
  horaDesde: true,
  horaHasta: true,
  observacionEnvio: true,
  pagado: true,
  formaPagado: true,
  entregado: true,
  pdfComprobanteNombre: true,
  sucursal: { select: sucursalSelect },
  clienteFinal: { select: clienteSelect },
  pintor: { select: clienteSelect },
  direccion: { select: direccionSelect },
} as const;

function mapCliente(row: {
  id: string;
  nombreCompleto: string;
  cel: string;
  tipo: ClienteItem["tipo"];
  pintorAsociadoId: string | null;
  pintorAsociado: {
    id: string;
    nombreCompleto: string;
    cel: string;
    tipo: ClienteItem["tipo"];
  } | null;
  cuit: string | null;
  condicionIva: number | null;
} | null): ClienteItem | null {
  if (!row) return null;
  return {
    id: row.id,
    nombreCompleto: normalizarNombreCliente(row.nombreCompleto),
    cel: row.cel.trim(),
    tipo: row.tipo,
    pintorAsociadoId: row.pintorAsociadoId,
    pintorAsociado: row.pintorAsociado
      ? {
          id: row.pintorAsociado.id,
          nombreCompleto: normalizarNombreCliente(row.pintorAsociado.nombreCompleto),
          cel: row.pintorAsociado.cel.trim(),
          tipo: row.pintorAsociado.tipo,
        }
      : null,
    cuit: row.cuit,
    condicionIva: row.condicionIva,
  };
}

function mapDireccion(row: {
  id: string;
  personaId: string;
  calleNombre: string;
  numeracion: string;
  distrito: string;
  departamento: EnviosDireccionItem["departamento"];
  urlMaps: string | null;
  referencia: string | null;
}): EnviosDireccionItem {
  return {
    id: row.id,
    personaId: row.personaId,
    calleNombre: properTextoEnvio(row.calleNombre),
    numeracion: capitalizarTextoEnvio(row.numeracion),
    distrito: properTextoEnvio(row.distrito),
    departamento: row.departamento,
    urlMaps: (row.urlMaps ?? "").trim(),
    referencia: row.referencia ? capitalizarTextoEnvio(row.referencia) : "",
  };
}

function mapSucursal(row: {
  id: string;
  codigo: string;
  nombre: string;
}): EnviosSucursalOption {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre.trim(),
  };
}

function mapListRow(row: {
  id: string;
  fechaEnvio: Date;
  horaDesde: string;
  horaHasta: string;
  observacionEnvio: string;
  pagado: boolean;
  formaPagado: EnviosFinalListItem["formaPagado"];
  entregado: boolean;
  pdfComprobanteNombre: string | null;
  sucursal: { id: string; codigo: string; nombre: string };
  clienteFinal: Parameters<typeof mapCliente>[0];
  pintor: Parameters<typeof mapCliente>[0];
  direccion: {
    id: string;
    personaId: string;
    calleNombre: string;
    numeracion: string;
    distrito: string;
    departamento: EnviosDireccionItem["departamento"];
    urlMaps: string | null;
    referencia: string | null;
  };
}): EnviosFinalListItem {
  const nombrePdf = row.pdfComprobanteNombre?.trim() || null;
  return {
    id: row.id,
    sucursal: mapSucursal(row.sucursal),
    clienteFinal: mapCliente(row.clienteFinal),
    pintor: mapCliente(row.pintor),
    direccion: mapDireccion(row.direccion),
    fechaEnvioIso: isoYmdFromPrismaDateOnly(row.fechaEnvio),
    horaDesde: row.horaDesde,
    horaHasta: row.horaHasta,
    observacionEnvio: row.observacionEnvio.trim(),
    pagado: row.pagado,
    formaPagado: row.formaPagado,
    entregado: row.entregado,
    pdfComprobanteNombre: nombrePdf,
    tienePdf: nombrePdf != null,
  };
}

function prismaErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2025") return "El envío no existe.";
    if (code === "P2003") return "Cliente, dirección o sucursal inválida.";
  }
  return error instanceof Error ? error.message : fallback;
}

function sanitizePdfNombre(nombre: string): string {
  const base = nombre.replace(/\\/g, "/").split("/").pop() ?? nombre;
  return base.replace(/[^\w.\- áéíóúÁÉÍÓÚñÑ]/gi, "_").trim() || "comprobante.pdf";
}

function toPdfBytes(source: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return copy;
}

function decodePdfBase64(
  nombre: string,
  base64: string
): ServiceResult<{ nombre: string; bytes: Uint8Array<ArrayBuffer> }> {
  const raw = base64.includes(",") ? (base64.split(",").pop() ?? "") : base64;
  let decoded: Buffer;
  try {
    decoded = Buffer.from(raw, "base64");
  } catch {
    return { success: false, error: "El PDF no se pudo leer." };
  }
  if (decoded.length === 0) return { success: false, error: "El PDF está vacío." };
  if (decoded.length > ENVIOS_PDF_MAX_BYTES) {
    return { success: false, error: "El PDF supera el tamaño máximo (5 MB)." };
  }
  if (
    decoded.length < 4 ||
    decoded[0] !== 0x25 ||
    decoded[1] !== 0x50 ||
    decoded[2] !== 0x44 ||
    decoded[3] !== 0x46
  ) {
    return { success: false, error: "El archivo no es un PDF válido." };
  }
  return { success: true, data: { nombre: sanitizePdfNombre(nombre), bytes: toPdfBytes(decoded) } };
}

async function validarPersonasYDireccion(input: {
  clienteFinalId?: string | null;
  pintorId?: string | null;
  direccionId: string;
}): Promise<ServiceResult<void>> {
  const clienteFinalId = input.clienteFinalId ?? null;
  const pintorId = input.pintorId ?? null;

  if (!clienteFinalId && !pintorId) {
    return { success: false, error: "Asociá al menos un cliente final o un pintor." };
  }

  const direccion = await prisma.enviosDireccion.findUnique({
    where: { id: input.direccionId },
    select: { id: true, personaId: true },
  });
  if (!direccion) return { success: false, error: "La dirección no existe." };

  if (clienteFinalId) {
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteFinalId },
      select: { tipo: true },
    });
    if (!cliente) return { success: false, error: "El cliente final no existe." };
    if (cliente.tipo !== "CONSUMIDOR_FINAL") {
      return { success: false, error: "El cliente debe ser de tipo CONSUMIDOR FINAL." };
    }
    if (direccion.personaId !== clienteFinalId) {
      return { success: false, error: "La dirección debe pertenecer al cliente final seleccionado." };
    }
  }

  if (pintorId) {
    const clientePintor = await prisma.cliente.findUnique({
      where: { id: pintorId },
      select: { tipo: true },
    });
    if (!clientePintor) return { success: false, error: "El pintor no existe." };
    if (clientePintor.tipo !== "PINTOR") {
      return { success: false, error: "El pintor debe ser de tipo PINTOR." };
    }
    if (!clienteFinalId && direccion.personaId !== pintorId) {
      return { success: false, error: "La dirección debe pertenecer al pintor seleccionado." };
    }
  }

  return { success: true, data: undefined };
}

export async function listarSucursalesParaEnvios(): Promise<EnviosSucursalOption[]> {
  try {
    const rows = await prisma.sucursal.findMany({
      where: { pedido: true },
      select: sucursalSelect,
      orderBy: { nombre: "asc" },
    });
    return rows.map(mapSucursal);
  } catch (e) {
    console.error("[enviosFinal][listarSucursales]", e);
    return [];
  }
}

async function validarSucursalParaEnvio(sucursalId: string): Promise<ServiceResult<void>> {
  const sucursal = await prisma.sucursal.findUnique({
    where: { id: sucursalId },
    select: { id: true, pedido: true },
  });
  if (!sucursal) return { success: false, error: "La sucursal no existe." };
  if (!sucursal.pedido) {
    return { success: false, error: "Esa sucursal no puede enviar mercadería." };
  }
  return { success: true, data: undefined };
}

export async function listarEnviosFinal(): Promise<EnviosFinalListItem[]> {
  try {
    const rows = await prisma.enviosFinal.findMany({
      orderBy: [{ fechaEnvio: "desc" }, { horaDesde: "asc" }, { createdAt: "desc" }],
      select: listSelect,
    });
    return rows.map(mapListRow);
  } catch (e) {
    console.error("[enviosFinal][listar]", e);
    return [];
  }
}

/**
 * Purga automática al abrir Programados:
 * borra envíos con antigüedad >= 7 días (por `fecha_envio` calendario AR),
 * independientemente del estado `entregado`.
 */
export async function purgarEnviosFinalAntiguosProgramados(): Promise<number> {
  try {
    const hoyIso = dateToIsoYmdArgentina(new Date());
    const fechaCorteIso = addDaysToIsoYmdArgentina(hoyIso, -7);
    const res = await prisma.enviosFinal.deleteMany({
      where: { fechaEnvio: { lte: dateFromIsoYmd(fechaCorteIso) } },
    });
    return res.count;
  } catch (e) {
    console.error("[enviosFinal][purgarAntiguosProgramados]", e);
    return 0;
  }
}

/** Envíos no entregados con `fecha_envio` ≥ hoy (AR), para el módulo Conductor. */
export async function listarEnviosPendientesConductor(): Promise<EnviosFinalListItem[]> {
  try {
    const hoyIso = dateToIsoYmdArgentina(new Date());
    const rows = await prisma.enviosFinal.findMany({
      where: { fechaEnvio: { gte: dateFromIsoYmd(hoyIso) }, entregado: false },
      orderBy: [
        { fechaEnvio: "asc" },
        { horaDesde: "asc" },
        { horaHasta: "asc" },
        { createdAt: "asc" },
      ],
      select: listSelect,
    });
    return rows.map(mapListRow);
  } catch (e) {
    console.error("[enviosFinal][listarPendientesConductor]", e);
    return [];
  }
}

export async function crearEnviosFinal(
  input: CrearEnviosFinalInput
): Promise<ServiceResult<EnviosFinalListItem>> {
  try {
    let pintorId = input.pintorId ?? null;
    if (!pintorId && input.clienteFinalId) {
      const cliente = await prisma.cliente.findUnique({
        where: { id: input.clienteFinalId },
        select: { pintorAsociadoId: true },
      });
      pintorId = cliente?.pintorAsociadoId ?? null;
    }

    const sucursalOk = await validarSucursalParaEnvio(input.sucursalId);
    if (!sucursalOk.success) return sucursalOk;

    const valid = await validarPersonasYDireccion({
      clienteFinalId: input.clienteFinalId ?? null,
      pintorId,
      direccionId: input.direccionId,
    });
    if (!valid.success) return valid;

    let pdfNombre: string | null = null;
    let pdfBytes: Uint8Array<ArrayBuffer> | null = null;
    if (input.pdfComprobante) {
      const decoded = decodePdfBase64(input.pdfComprobante.nombre, input.pdfComprobante.base64);
      if (!decoded.success) return decoded;
      pdfNombre = decoded.data.nombre;
      pdfBytes = decoded.data.bytes;
    }

    const row = await prisma.enviosFinal.create({
      data: {
        sucursalId: input.sucursalId,
        clienteFinalId: input.clienteFinalId ?? null,
        pintorId,
        direccionId: input.direccionId,
        fechaEnvio: dateFromIsoYmd(input.fechaEnvioIso),
        horaDesde: input.horaDesde,
        horaHasta: input.horaHasta,
        observacionEnvio: input.observacionEnvio.trim(),
        pagado: pagadoDesdeFormaPagado(input.formaPagado, input.pagado),
        formaPagado: input.formaPagado,
        pdfComprobanteNombre: pdfNombre,
        pdfComprobante: pdfBytes,
      },
      select: listSelect,
    });
    return { success: true, data: mapListRow(row) };
  } catch (error) {
    console.error("[enviosFinal][crear]", error);
    return { success: false, error: prismaErrorMessage(error, "No se pudo crear el envío.") };
  }
}

export async function editarEnviosFinal(
  input: EditarEnviosFinalInput
): Promise<ServiceResult<EnviosFinalListItem>> {
  try {
    const sucursalOk = await validarSucursalParaEnvio(input.sucursalId);
    if (!sucursalOk.success) return sucursalOk;

    const valid = await validarPersonasYDireccion(input);
    if (!valid.success) return valid;

    const data: {
      sucursalId: string;
      clienteFinalId: string | null;
      pintorId: string | null;
      direccionId: string;
      fechaEnvio: Date;
      horaDesde: string;
      horaHasta: string;
      observacionEnvio: string;
      pagado: boolean;
      formaPagado: CrearEnviosFinalInput["formaPagado"];
      pdfComprobanteNombre?: string | null;
      pdfComprobante?: Uint8Array<ArrayBuffer> | null;
    } = {
      sucursalId: input.sucursalId,
      clienteFinalId: input.clienteFinalId ?? null,
      pintorId: input.pintorId ?? null,
      direccionId: input.direccionId,
      fechaEnvio: dateFromIsoYmd(input.fechaEnvioIso),
      horaDesde: input.horaDesde,
      horaHasta: input.horaHasta,
      observacionEnvio: input.observacionEnvio.trim(),
      pagado: pagadoDesdeFormaPagado(input.formaPagado, input.pagado),
      formaPagado: input.formaPagado,
    };

    if (input.quitarPdf) {
      data.pdfComprobanteNombre = null;
      data.pdfComprobante = null;
    } else if (input.pdfComprobante) {
      const decoded = decodePdfBase64(input.pdfComprobante.nombre, input.pdfComprobante.base64);
      if (!decoded.success) return decoded;
      data.pdfComprobanteNombre = decoded.data.nombre;
      data.pdfComprobante = decoded.data.bytes;
    }

    const row = await prisma.enviosFinal.update({
      where: { id: input.id },
      data,
      select: listSelect,
    });
    return { success: true, data: mapListRow(row) };
  } catch (error) {
    console.error("[enviosFinal][editar]", error);
    return { success: false, error: prismaErrorMessage(error, "No se pudo actualizar el envío.") };
  }
}

export async function marcarEnviosFinalEntregado(
  id: string,
  entregado = true
): Promise<ServiceResult<EnviosFinalListItem>> {
  try {
    const row = await prisma.enviosFinal.update({
      where: { id },
      data: { entregado },
      select: listSelect,
    });
    return { success: true, data: mapListRow(row) };
  } catch (error) {
    console.error("[enviosFinal][marcarEntregado]", error);
    return {
      success: false,
      error: prismaErrorMessage(error, "No se pudo marcar el envío como entregado."),
    };
  }
}

export async function eliminarEnviosFinal(
  id: string
): Promise<ServiceResult<{ id: string }>> {
  try {
    await prisma.enviosFinal.delete({ where: { id } });
    return { success: true, data: { id } };
  } catch (error) {
    console.error("[enviosFinal][eliminar]", error);
    return { success: false, error: prismaErrorMessage(error, "No se pudo eliminar el envío.") };
  }
}

export async function getEnviosFinalPdfComprobante(
  id: string
): Promise<ServiceResult<{ nombre: string; bytes: Uint8Array<ArrayBuffer> }>> {
  try {
    const row = await prisma.enviosFinal.findUnique({
      where: { id },
      select: { pdfComprobanteNombre: true, pdfComprobante: true },
    });
    if (!row) return { success: false, error: "El envío no existe." };
    if (!row.pdfComprobante || row.pdfComprobante.length === 0) {
      return { success: false, error: "El envío no tiene comprobante PDF." };
    }
    const nombre = row.pdfComprobanteNombre?.trim() || "comprobante.pdf";
    return { success: true, data: { nombre, bytes: toPdfBytes(row.pdfComprobante) } };
  } catch (error) {
    console.error("[enviosFinal][getPdf]", error);
    return { success: false, error: "No se pudo obtener el comprobante." };
  }
}
