import { prisma } from "@/lib/prisma";
import { etiquetaTipoCajaEnPantalla } from "@/lib/cajasTesoreriaTipos";
import type {
  ActualizarCobroPorSucursalInput,
  ActualizarFechaAcreditacionVariablePagoInput,
  CrearCobroPorSucursalInput,
  EliminarCobroPorSucursalInput,
} from "@/lib/validations/cobrosPorSucursal";
import { Prisma, type TipoCajaTesoreria } from "@prisma/client";
import type { ServiceResult } from "@/types";
import { listarFinAnaCosFinaPagos } from "@/services/finAnaCosFinaPago.service";
import type { FinAnaCosFinaPagoItem } from "@/lib/finAnaCosFinaPagos";

export type CobrosPorSucursalSucursalCol = {
  id: string;
  nombre: string;
};

export type CobrosPorSucursalCajaOption = {
  id: string;
  entidadId: string | null;
  sucursalId: string | null;
  tipoCaja: string;
  entidadNombre: string;
  sucursalNombre: string;
  titular: string;
  /** `TIPO CAJA - ENTIDAD - SUCURSAL - TITULAR`. Omite el tramo si el dato es null. */
  etiqueta: string;
  recibeCheque: boolean;
};

export type CobrosPorSucursalCatalogoItem = {
  id: string;
  nombre: string;
};

export type CobrosPorSucursalPagoCatalogo = CobrosPorSucursalCatalogoItem & {
  fechaAcreditacionVariable: boolean;
  /** `cobros_forma_pago.alias`: el cobro exige ALIAS. */
  alias: boolean;
};

/** Opción del Select PTO. VTA. (seguimiento fiscal). */
export type CobrosPorSucursalPtoVtaOption = {
  id: string;
  /** `00002 - TITULAR`. */
  etiqueta: string;
  activo: boolean;
};

export type CobrosPorSucursalVinculoPagoEntidad = {
  pagoId: string;
  entidadId: string;
};

/**
 * Una fila = un registro `cobros_vinc_cajas` (forma [× entidad] × una sola sucursal).
 * Si la forma no tiene entidades vinculadas, `entidadId` es null.
 */
export type CobrosPorSucursalFila = {
  id: string;
  pagoId: string;
  pagoNombre: string;
  entidadId: string | null;
  entidadNombre: string;
  sucursalId: string;
  sucursalNombre: string;
  cajaDestinoId: string | null;
  cajaEtiqueta: string;
  /** TRUE = Cx Fin con CX TOTAL S/ IVA; FALSE = C/ IVA. */
  generaIvaCredito: boolean;
  /** `cobros_vinc_cajas.seguimiento_fiscal`. */
  seguimientoFiscal: boolean;
  /** `cobros_vinc_cajas.pto_vta_id`; solo con seguimiento fiscal. */
  ptoVtaId: string | null;
  ptoVtaEtiqueta: string;
  /** De esta fila; no se hereda a otras sucursales. */
  esCheque: boolean;
  /** `cobros_vinc_cajas.alias`; null si la forma de pago no usa alias. */
  alias: string | null;
  observacion: string;
};

export type CobrosPorSucursalVista = {
  filas: CobrosPorSucursalFila[];
  sucursales: CobrosPorSucursalSucursalCol[];
  cajas: CobrosPorSucursalCajaOption[];
  pagos: CobrosPorSucursalPagoCatalogo[];
  entidades: CobrosPorSucursalCatalogoItem[];
  vinculosPagoEntidad: CobrosPorSucursalVinculoPagoEntidad[];
  ptosVenta: CobrosPorSucursalPtoVtaOption[];
};

function mapDbError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2003") return "Hay referencias inválidas (forma, entidad, sucursal o caja).";
    if (code === "P2025") return "Registro no encontrado.";
    if (code === "P2002") {
      return "Ya existe esa forma de pago para esa sucursal (con el mismo ALIAS).";
    }
  }
  return error instanceof Error ? error.message : fallback;
}

function textoEtiqueta(valor: string | null | undefined): string | null {
  const texto = (valor ?? "").trim();
  return texto.length > 0 ? texto.toLocaleUpperCase("es-AR") : null;
}

function etiquetaCajaLista(row: {
  entidad: { nombre: string } | null;
  titular: string;
  sucursal: { nombre: string } | null;
  tipoCaja: TipoCajaTesoreria;
}): string {
  const partes = [
    textoEtiqueta(etiquetaTipoCajaEnPantalla(row.tipoCaja)),
    textoEtiqueta(row.entidad?.nombre),
    textoEtiqueta(row.sucursal?.nombre),
    textoEtiqueta(row.titular),
  ].filter((parte): parte is string => parte != null);
  return partes.join(" - ");
}

function normalizarObservacion(raw: string): string {
  return raw.trim();
}

function etiquetaPtoVta(row: { ptoVenta: string; titular: string }): string {
  return `${row.ptoVenta} - ${row.titular.toLocaleUpperCase("es-AR")}`;
}

async function resolverPtoVta(
  seguimientoFiscal: boolean,
  ptoVtaId: string | null
): Promise<ServiceResult<{ id: string; etiqueta: string } | null>> {
  if (!seguimientoFiscal) return { success: true, data: null };
  if (!ptoVtaId) {
    return {
      success: false,
      error: "Con SEGUIMIENTO FISCAL tenés que elegir un punto de venta.",
    };
  }
  const row = await prisma.globalPtoVta.findUnique({
    where: { id: ptoVtaId },
    select: { id: true, ptoVenta: true, titular: true },
  });
  if (!row) return { success: false, error: "Punto de venta inválido." };
  return { success: true, data: { id: row.id, etiqueta: etiquetaPtoVta(row) } };
}

function resolverAlias(
  pagoUsaAlias: boolean,
  raw: string
): ServiceResult<string | null> {
  if (!pagoUsaAlias) return { success: true, data: null };
  const alias = raw.trim();
  if (alias.length === 0) {
    return { success: false, error: "Esta forma de pago exige ALIAS." };
  }
  return { success: true, data: alias };
}

function sortFilas(a: CobrosPorSucursalFila, b: CobrosPorSucursalFila): number {
  const byPago = a.pagoNombre.localeCompare(b.pagoNombre, "es", {
    sensitivity: "base",
  });
  if (byPago !== 0) return byPago;
  const byEntidad = a.entidadNombre.localeCompare(b.entidadNombre, "es", {
    sensitivity: "base",
  });
  if (byEntidad !== 0) return byEntidad;
  return a.sucursalNombre.localeCompare(b.sucursalNombre, "es", {
    sensitivity: "base",
  });
}

function mensajeDuplicado(conEntidad: boolean, conAlias: boolean): string {
  const base = conEntidad
    ? "Ya existe esa forma de pago × entidad para esa sucursal"
    : "Ya existe esa forma de pago para esa sucursal";
  return conAlias ? `${base} con ese ALIAS.` : `${base}.`;
}

/** Unicidad: forma [× entidad] × sucursal × ALIAS (sin mayúsculas; null = sin alias). */
async function buscarDuplicado(input: {
  pagoId: string;
  entidadId: string | null;
  sucursalId: string;
  alias: string | null;
  excludeId?: string;
}): Promise<boolean> {
  const where: Prisma.CobrosPorSucursalWhereInput = {
    pagoId: input.pagoId,
    entidadId: input.entidadId,
    sucursalId: input.sucursalId,
    alias: input.alias
      ? { equals: input.alias, mode: "insensitive" }
      : null,
    ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
  };
  const row = await prisma.cobrosPorSucursal.findFirst({
    where,
    select: { id: true },
  });
  return Boolean(row);
}

/** Sucursales para filtro/listado de Cobros & Cajas. */
export async function listarSucursalesCobrosPorSucursal(): Promise<
  CobrosPorSucursalSucursalCol[]
> {
  const rows = await prisma.sucursal.findMany({
    orderBy: [{ nombre: "asc" }],
    select: { id: true, nombre: true },
  });
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre.toLocaleUpperCase("es-AR"),
  }));
}

async function validarCajaDestino(
  cajaDestinoId: string,
  pagoEsCheque: boolean
): Promise<
  ServiceResult<{
    id: string;
    sucursalId: string | null;
    etiqueta: string;
    sucursalNombre: string;
  }>
> {
  const caja = await prisma.cajaTesoreria.findFirst({
    where: { id: cajaDestinoId },
    select: {
      id: true,
      entidadId: true,
      sucursalId: true,
      titular: true,
      tipoCaja: true,
      recibeCheque: true,
      entidad: { select: { nombre: true } },
      sucursal: { select: { nombre: true } },
    },
  });
  if (!caja) {
    return { success: false, error: "Caja vinculada inválida." };
  }
  if (pagoEsCheque && !caja.recibeCheque) {
    return {
      success: false,
      error: "Este cobro es cheque: elegí una caja que reciba cheques.",
    };
  }
  return {
    success: true,
    data: {
      id: caja.id,
      sucursalId: caja.sucursalId,
      etiqueta: etiquetaCajaLista(caja),
      sucursalNombre: textoEtiqueta(caja.sucursal?.nombre) ?? "",
    },
  };
}

export async function listarVistaCobrosPorSucursal(): Promise<CobrosPorSucursalVista> {
  const [
    sucursales,
    cajasRows,
    destinos,
    pagosRows,
    entidadesRows,
    vinculosRows,
    ptosVentaRows,
  ] = await Promise.all([
      listarSucursalesCobrosPorSucursal(),
      prisma.cajaTesoreria.findMany({
        orderBy: [{ titular: "asc" }],
        select: {
          id: true,
          entidadId: true,
          sucursalId: true,
          titular: true,
          tipoCaja: true,
          recibeCheque: true,
          entidad: { select: { nombre: true } },
          sucursal: { select: { nombre: true } },
        },
      }),
      prisma.cobrosPorSucursal.findMany({
        select: {
          id: true,
          pagoId: true,
          entidadId: true,
          sucursalId: true,
          cajaDestinoId: true,
          generaIvaCredito: true,
          seguimientoFiscal: true,
          ptoVtaId: true,
          ptoVta: { select: { ptoVenta: true, titular: true } },
          esCheque: true,
          alias: true,
          observacion: true,
          sucursal: { select: { nombre: true } },
          cajaDestino: {
            select: {
              titular: true,
              tipoCaja: true,
              entidad: { select: { nombre: true } },
              sucursal: { select: { nombre: true } },
            },
          },
          pago: { select: { nombre: true } },
          entidad: { select: { nombre: true } },
        },
      }),
      prisma.finAnaCosFinaPagoCat.findMany({
        orderBy: [{ nombre: "asc" }],
        select: { id: true, nombre: true, fechaAcreditacionVariable: true, alias: true },
      }),
      prisma.finAnaCosFinaTerminalMarca.findMany({
        orderBy: [{ nombre: "asc" }],
        select: { id: true, nombre: true },
      }),
      prisma.cobrosFormaPagoEntidad.findMany({
        select: { pagoId: true, entidadId: true },
      }),
      prisma.globalPtoVta.findMany({
        orderBy: [{ ptoVenta: "asc" }],
        select: { id: true, ptoVenta: true, titular: true, estado: true },
      }),
    ]);

  const sucursalIds = new Set(sucursales.map((s) => s.id));

  const filas: CobrosPorSucursalFila[] = destinos
    .filter((d) => sucursalIds.has(d.sucursalId))
    .map((d) => ({
      id: d.id,
      pagoId: d.pagoId,
      pagoNombre: d.pago.nombre.toLocaleUpperCase("es-AR"),
      entidadId: d.entidadId,
      entidadNombre: d.entidad
        ? d.entidad.nombre.toLocaleUpperCase("es-AR")
        : "",
      sucursalId: d.sucursalId,
      sucursalNombre: d.sucursal.nombre.toLocaleUpperCase("es-AR"),
      cajaDestinoId: d.cajaDestinoId,
      cajaEtiqueta: d.cajaDestino ? etiquetaCajaLista(d.cajaDestino) : "",
      generaIvaCredito: d.generaIvaCredito,
      seguimientoFiscal: d.seguimientoFiscal,
      ptoVtaId: d.ptoVtaId,
      ptoVtaEtiqueta: d.ptoVta ? etiquetaPtoVta(d.ptoVta) : "",
      esCheque: d.esCheque,
      alias: d.alias,
      observacion: d.observacion,
    }))
    .sort(sortFilas);

  const cajas: CobrosPorSucursalCajaOption[] = cajasRows.map((row) => ({
    id: row.id,
    entidadId: row.entidadId,
    sucursalId: row.sucursalId,
    tipoCaja: row.tipoCaja,
    entidadNombre: textoEtiqueta(row.entidad?.nombre) ?? "",
    sucursalNombre: textoEtiqueta(row.sucursal?.nombre) ?? "",
    titular: textoEtiqueta(row.titular) ?? "",
    etiqueta: etiquetaCajaLista(row),
    recibeCheque: row.recibeCheque,
  }));

  return {
    filas,
    sucursales,
    cajas,
    pagos: pagosRows.map((p) => ({
      id: p.id,
      nombre: p.nombre.toLocaleUpperCase("es-AR"),
      fechaAcreditacionVariable: p.fechaAcreditacionVariable,
      alias: p.alias,
    })),
    entidades: entidadesRows.map((e) => ({
      id: e.id,
      nombre: e.nombre.toLocaleUpperCase("es-AR"),
    })),
    vinculosPagoEntidad: vinculosRows,
    ptosVenta: ptosVentaRows.map((p) => ({
      id: p.id,
      etiqueta: etiquetaPtoVta(p),
      activo: p.estado === "activo",
    })),
  };
}

export async function crearCobroPorSucursal(
  input: CrearCobroPorSucursalInput
): Promise<ServiceResult<CobrosPorSucursalFila>> {
  try {
    const observacion = normalizarObservacion(input.observacion);

    const pago = await prisma.finAnaCosFinaPagoCat.findUnique({
      where: { id: input.pagoId },
      select: { id: true, nombre: true, alias: true },
    });
    if (!pago) {
      return { success: false, error: "Forma de pago inválida." };
    }
    const aliasRes = resolverAlias(pago.alias, input.alias);
    if (!aliasRes.success) return aliasRes;
    const alias = aliasRes.data;

    const vinculos = await prisma.cobrosFormaPagoEntidad.findMany({
      where: { pagoId: input.pagoId },
      select: {
        entidadId: true,
        entidad: { select: { nombre: true } },
      },
    });
    const exigeEntidad = vinculos.length > 0;
    const entidadId = exigeEntidad ? (input.entidadId ?? null) : null;
    let entidadNombre = "";
    if (exigeEntidad) {
      if (!entidadId) {
        return { success: false, error: "Seleccioná una entidad." };
      }
      const vinculo = vinculos.find((v) => v.entidadId === entidadId);
      if (!vinculo) {
        return { success: false, error: "Combinación forma de pago × entidad inválida." };
      }
      entidadNombre = vinculo.entidad.nombre.toLocaleUpperCase("es-AR");
    }

    const cajaRes = await validarCajaDestino(input.cajaDestinoId, input.esCheque);
    if (!cajaRes.success) return cajaRes;

    const ptoVtaRes = await resolverPtoVta(input.seguimientoFiscal, input.ptoVtaId);
    if (!ptoVtaRes.success) return ptoVtaRes;
    const ptoVta = ptoVtaRes.data;

    const sucursal = await prisma.sucursal.findUnique({
      where: { id: input.sucursalId },
      select: { id: true, nombre: true },
    });
    if (!sucursal) {
      return { success: false, error: "Sucursal inválida." };
    }

    const duplicado = await buscarDuplicado({
      pagoId: input.pagoId,
      entidadId,
      sucursalId: input.sucursalId,
      alias,
    });
    if (duplicado) {
      return {
        success: false,
        error: mensajeDuplicado(Boolean(entidadId), Boolean(alias)),
      };
    }

    const created = await prisma.cobrosPorSucursal.create({
      data: {
        pagoId: input.pagoId,
        entidadId,
        sucursalId: sucursal.id,
        cajaDestinoId: cajaRes.data.id,
        generaIvaCredito: input.generaIvaCredito,
        seguimientoFiscal: input.seguimientoFiscal,
        ptoVtaId: ptoVta?.id ?? null,
        esCheque: input.esCheque,
        alias,
        observacion,
      },
      select: { id: true },
    });

    return {
      success: true,
      data: {
        id: created.id,
        pagoId: input.pagoId,
        pagoNombre: pago.nombre.toLocaleUpperCase("es-AR"),
        entidadId,
        entidadNombre,
        sucursalId: sucursal.id,
        sucursalNombre: textoEtiqueta(sucursal.nombre) ?? "",
        cajaDestinoId: cajaRes.data.id,
        cajaEtiqueta: cajaRes.data.etiqueta,
        generaIvaCredito: input.generaIvaCredito,
        seguimientoFiscal: input.seguimientoFiscal,
        ptoVtaId: ptoVta?.id ?? null,
        ptoVtaEtiqueta: ptoVta?.etiqueta ?? "",
        esCheque: input.esCheque,
        alias,
        observacion,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo crear el cobro."),
    };
  }
}

export async function actualizarCobroPorSucursal(
  input: ActualizarCobroPorSucursalInput
): Promise<ServiceResult<CobrosPorSucursalFila>> {
  try {
    const observacion = normalizarObservacion(input.observacion);

    const existente = await prisma.cobrosPorSucursal.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        pagoId: true,
        entidadId: true,
        sucursalId: true,
        sucursal: { select: { nombre: true } },
        pago: { select: { nombre: true, alias: true } },
        entidad: { select: { nombre: true } },
      },
    });
    if (!existente) {
      return { success: false, error: "Cobro no encontrado." };
    }
    const aliasRes = resolverAlias(existente.pago.alias, input.alias);
    if (!aliasRes.success) return aliasRes;
    const alias = aliasRes.data;

    const duplicado = await buscarDuplicado({
      pagoId: existente.pagoId,
      entidadId: existente.entidadId,
      sucursalId: existente.sucursalId,
      alias,
      excludeId: existente.id,
    });
    if (duplicado) {
      return {
        success: false,
        error: mensajeDuplicado(Boolean(existente.entidadId), Boolean(alias)),
      };
    }

    const cajaRes = await validarCajaDestino(input.cajaDestinoId, input.esCheque);
    if (!cajaRes.success) return cajaRes;

    const ptoVtaRes = await resolverPtoVta(input.seguimientoFiscal, input.ptoVtaId);
    if (!ptoVtaRes.success) return ptoVtaRes;
    const ptoVta = ptoVtaRes.data;

    await prisma.cobrosPorSucursal.update({
      where: { id: existente.id },
      data: {
        cajaDestinoId: cajaRes.data.id,
        generaIvaCredito: input.generaIvaCredito,
        seguimientoFiscal: input.seguimientoFiscal,
        ptoVtaId: ptoVta?.id ?? null,
        esCheque: input.esCheque,
        alias,
        observacion,
      },
    });

    return {
      success: true,
      data: {
        id: existente.id,
        pagoId: existente.pagoId,
        pagoNombre: existente.pago.nombre.toLocaleUpperCase("es-AR"),
        entidadId: existente.entidadId,
        entidadNombre: existente.entidad
          ? existente.entidad.nombre.toLocaleUpperCase("es-AR")
          : "",
        sucursalId: existente.sucursalId,
        sucursalNombre: textoEtiqueta(existente.sucursal.nombre) ?? "",
        cajaDestinoId: cajaRes.data.id,
        cajaEtiqueta: cajaRes.data.etiqueta,
        generaIvaCredito: input.generaIvaCredito,
        seguimientoFiscal: input.seguimientoFiscal,
        ptoVtaId: ptoVta?.id ?? null,
        ptoVtaEtiqueta: ptoVta?.etiqueta ?? "",
        esCheque: input.esCheque,
        alias,
        observacion,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo actualizar el cobro."),
    };
  }
}

export async function eliminarCobroPorSucursal(
  input: EliminarCobroPorSucursalInput
): Promise<ServiceResult<{ id: string }>> {
  try {
    await prisma.cobrosPorSucursal.delete({
      where: { id: input.id },
    });
    return { success: true, data: { id: input.id } };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo eliminar el cobro."),
    };
  }
}

/** Formas de pago con fila en `cobros_vinc_cajas` para esa sucursal (código `guaymallen` | `maipu`). */
export async function listarPagosCobroHabilitadosSucursal(
  sucursalCodigo: string
): Promise<FinAnaCosFinaPagoItem[]> {
  const [pagos, vinculos] = await Promise.all([
    listarFinAnaCosFinaPagos(),
    prisma.cobrosPorSucursal.findMany({
      where: { sucursal: { codigo: sucursalCodigo } },
      select: { pagoId: true, entidadId: true, esCheque: true },
    }),
  ]);

  const pagosConFila = new Set<string>();
  const entidadesPorPago = new Map<string, Set<string>>();
  const chequePorPago = new Map<string, boolean>();
  for (const vinculo of vinculos) {
    pagosConFila.add(vinculo.pagoId);
    if (vinculo.esCheque) chequePorPago.set(vinculo.pagoId, true);
    if (!vinculo.entidadId) continue;
    const entidades = entidadesPorPago.get(vinculo.pagoId) ?? new Set<string>();
    entidades.add(vinculo.entidadId);
    entidadesPorPago.set(vinculo.pagoId, entidades);
  }

  return pagos.flatMap((pago) => {
    if (!pagosConFila.has(pago.id)) return [];
    const esCheque = chequePorPago.get(pago.id) === true;
    const permitidas = entidadesPorPago.get(pago.id);
    if (!permitidas || permitidas.size === 0) {
      return [
        {
          ...pago,
          entidadIds: [],
          entidadNombres: [],
          esCheque,
          fechaAcreditacionVariable: pago.fechaAcreditacionVariable || esCheque,
        },
      ];
    }
    const pares = pago.entidadIds
      .map((id, indice) => ({ id, nombre: pago.entidadNombres[indice] ?? "" }))
      .filter((entidad) => permitidas.has(entidad.id));
    return [
      {
        ...pago,
        entidadIds: pares.map((entidad) => entidad.id),
        entidadNombres: pares.map((entidad) => entidad.nombre),
        esCheque,
        fechaAcreditacionVariable: pago.fechaAcreditacionVariable || esCheque,
      },
    ];
  });
}

export async function actualizarFechaAcreditacionVariablePago(
  input: ActualizarFechaAcreditacionVariablePagoInput
): Promise<ServiceResult<void>> {
  try {
    await prisma.finAnaCosFinaPagoCat.update({
      where: { id: input.pagoId },
      data: { fechaAcreditacionVariable: input.fechaAcreditacionVariable },
      select: { id: true },
    });
    return { success: true, data: undefined };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo actualizar la forma de pago."),
    };
  }
}
