import { Prisma } from "@prisma/client";
import type { FilaFormaPagoPresupuestoPdf } from "@/lib/facturaFormasPagoPdf";
import type { DescuentoMensajePresupuesto } from "@/lib/mensajeWhatsappPresupuesto";
import { prisma } from "@/lib/prisma";
import { cantidadDesdePrisma, fmtCantidad } from "@/lib/cantidadUnDecimal";
import {
  costoNuevoLoteDescPromo,
  estadoDescPromo,
  ETIQUETA_CATEGORIA_DESC_PROMO,
  etiquetaAlcanceDescPromo,
  etiquetaFormaPagoCuotaDescPromo,
  lineasEtiquetaCuotaDescPromo,
  type DescPromoEspecialFactura,
  type DescPromoFila,
  type DescPromoLoteRef,
} from "@/lib/descPromo";
import {
  dateToIsoYmdArgentina,
  isoYmdFromPrismaDateOnly,
  prismaDateOnlyFromIsoYmd,
} from "@/lib/fechaArgentina";
import type {
  CrearDescPromoInput,
  EditarDescPromoInput,
} from "@/lib/validations/descPromo";
import {
  resolverCostoCompraTienda,
  SELECT_COSTO_COMPRA_TIENDA,
} from "@/services/costoListaTienda.service";
import type { ServiceResult } from "@/types";

const promoInclude = Prisma.validator<Prisma.DescPromoInclude>()({
  items: {
    orderBy: { producto: { descripcionTienda: "asc" } },
    select: {
      codTienda: true,
      cantidad: true,
      cantidadConsumida: true,
      costoTipo: true,
      costoValor: true,
      costoBase: true,
      costoUnitario: true,
      producto: {
        select: {
          descripcionTienda: true,
          idMarca: true,
          idRubro: true,
          marcaRelation: { select: { nombre: true } },
          rubroRelation: { select: { nombre: true } },
        },
      },
    },
  },
  formasPago: {
    orderBy: { id: "asc" },
    select: {
      pagoId: true,
      cuotaId: true,
      pago: { select: { nombre: true } },
      cuota: { select: { cuotas: true } },
    },
  },
  lineasPdf: { orderBy: { orden: "asc" }, select: { texto: true } },
  lineasValidaDesc: { orderBy: { orden: "asc" }, select: { texto: true } },
  marca: { select: { nombre: true } },
  rubro: { select: { nombre: true } },
});

type PromoRow = Prisma.DescPromoGetPayload<{ include: typeof promoInclude }>;
type PromoItemRow = PromoRow["items"][number];

function decimalANumero(value: Prisma.Decimal | null): number | null {
  if (value == null) return null;
  const n = value.toNumber();
  return Number.isFinite(n) ? n : null;
}

function mapLote(item: PromoItemRow): DescPromoLoteRef | null {
  if (item.cantidad == null || item.costoTipo == null) return null;
  const cantidad = cantidadDesdePrisma(item.cantidad);
  const consumida = cantidadDesdePrisma(item.cantidadConsumida);
  return {
    cantidad,
    consumida,
    saldo: Math.max(0, Math.round((cantidad - consumida) * 10) / 10),
    costoTipo: item.costoTipo,
    costoValor: decimalANumero(item.costoValor) ?? 0,
    costoBase: decimalANumero(item.costoBase),
    costoUnitario: decimalANumero(item.costoUnitario) ?? 0,
  };
}

function mapPromo(row: PromoRow): DescPromoFila {
  return {
    id: row.id,
    categoria: row.categoria,
    categoriaEtiqueta: ETIQUETA_CATEGORIA_DESC_PROMO[row.categoria],
    fechaDesdeIso: row.fechaDesde ? isoYmdFromPrismaDateOnly(row.fechaDesde) : null,
    fechaHastaIso: row.fechaHasta ? isoYmdFromPrismaDateOnly(row.fechaHasta) : null,
    alcance: row.alcance,
    alcanceEtiqueta: etiquetaAlcanceDescPromo(row.alcance),
    nombre: row.nombre,
    descuento: row.descuento,
    enPresupuesto: row.enPresupuesto,
    prioridad: row.prioridad,
    idMarca: row.idMarca,
    marcaNombre: row.marca
      ? row.marca.nombre.toLocaleUpperCase("es-AR")
      : null,
    idRubro: row.idRubro,
    rubroNombre: row.rubro
      ? row.rubro.nombre.toLocaleUpperCase("es-AR")
      : null,
    items: row.items.map((item) => ({
      codTienda: item.codTienda,
      descripcion: (item.producto.descripcionTienda ?? "").toLocaleUpperCase("es-AR"),
      idMarca: item.producto.idMarca,
      marcaNombre: item.producto.marcaRelation
        ? item.producto.marcaRelation.nombre.toLocaleUpperCase("es-AR")
        : null,
      idRubro: item.producto.idRubro,
      rubroNombre: item.producto.rubroRelation
        ? item.producto.rubroRelation.nombre.toLocaleUpperCase("es-AR")
        : null,
      lote: row.categoria === "STOCK" ? mapLote(item) : null,
    })),
    formasPago: row.formasPago
      .map((fp) => ({
        pagoId: fp.pagoId,
        nombre: fp.pago.nombre.toLocaleUpperCase("es-AR"),
        cuotaId: fp.cuotaId,
        cuotaEtiqueta: fp.cuota
          ? fp.cuota.cuotas.toLocaleUpperCase("es-AR")
          : null,
      }))
      .sort((a, b) => {
        const na = a.cuotaEtiqueta
          ? `${a.nombre} · ${a.cuotaEtiqueta}`
          : a.nombre;
        const nb = b.cuotaEtiqueta
          ? `${b.nombre} · ${b.cuotaEtiqueta}`
          : b.nombre;
        return na.localeCompare(nb, "es");
      }),
    lineasPdf: row.lineasPdf.map((linea) => linea.texto),
    lineasValidaDesc: row.lineasValidaDesc.map((linea) => linea.texto),
  };
}

function normalizarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

function ejesSegunAlcance(input: CrearDescPromoInput): {
  idMarca: string | null;
  idRubro: string | null;
  codTiendas: string[];
} {
  if (input.alcance === "MARCA") {
    return { idMarca: input.idMarca ?? null, idRubro: null, codTiendas: [] };
  }
  if (input.alcance === "RUBRO") {
    return { idMarca: null, idRubro: input.idRubro ?? null, codTiendas: [] };
  }
  if (input.alcance === "MARCA_RUBRO") {
    return {
      idMarca: input.idMarca ?? null,
      idRubro: input.idRubro ?? null,
      codTiendas: [],
    };
  }
  if (input.alcance === "ITEMS") {
    return { idMarca: null, idRubro: null, codTiendas: input.codTiendas };
  }
  return { idMarca: null, idRubro: null, codTiendas: [] };
}

function mapDbError(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    if (code === "P2002") return "La prioridad ya está en uso. Reintentá.";
    if (code === "P2003") return "Hay un producto, forma de cobro, marca o rubro inválido.";
    if (code === "P2025") return "La promoción no existe.";
    if (code === "P2004" || code === "23514") {
      return "Los datos no cumplen las reglas del descuento (fechas, alcance o lote).";
    }
  }
  return error instanceof Error ? error.message : fallback;
}

async function validarVinculos(
  input: CrearDescPromoInput
): Promise<ServiceResult<void>> {
  const pagoIds = [...new Set(input.vinculosCobro.map((v) => v.pagoId))];
  if (pagoIds.length === 0) {
    return { success: false, error: "Elegí al menos una forma de cobro." };
  }
  const nPagos = await prisma.finAnaCosFinaPagoCat.count({
    where: { id: { in: pagoIds } },
  });
  if (nPagos !== pagoIds.length) {
    return { success: false, error: "Hay formas de pago que ya no existen." };
  }

  const cuotaIds = [
    ...new Set(
      input.vinculosCobro
        .map((v) => v.cuotaId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];
  if (cuotaIds.length > 0) {
    const nCuotas = await prisma.cobrosCuota.count({
      where: { id: { in: cuotaIds } },
    });
    if (nCuotas !== cuotaIds.length) {
      return { success: false, error: "Hay cantidades de cuotas que ya no existen." };
    }
  }

  const pagosConCuotas = await prisma.cobrosCuotaVinculo.findMany({
    where: { pagoId: { in: pagoIds } },
    select: { pagoId: true, cuotaId: true },
  });
  const cuotasPorPago = new Map<string, Set<string>>();
  for (const row of pagosConCuotas) {
    const set = cuotasPorPago.get(row.pagoId) ?? new Set<string>();
    set.add(row.cuotaId);
    cuotasPorPago.set(row.pagoId, set);
  }

  for (const pagoId of pagoIds) {
    const catalogo = cuotasPorPago.get(pagoId);
    const filas = input.vinculosCobro.filter((v) => v.pagoId === pagoId);
    if (catalogo && catalogo.size > 0) {
      for (const fila of filas) {
        const cuotaId = fila.cuotaId ?? null;
        if (cuotaId == null) {
          return {
            success: false,
            error: "Elegí al menos una CANT. CUOTAS para cada forma que las tiene.",
          };
        }
        if (!catalogo.has(cuotaId)) {
          return {
            success: false,
            error: "Hay una CANT. CUOTAS que no corresponde a esa forma de pago.",
          };
        }
      }
    } else if (filas.some((f) => f.cuotaId)) {
      return {
        success: false,
        error: "Esa forma de pago no tiene CANT. CUOTAS.",
      };
    }
  }

  const ejes = ejesSegunAlcance(input);
  if (ejes.codTiendas.length > 0) {
    const n = await prisma.prodPropio.count({
      where: { codTienda: { in: ejes.codTiendas } },
    });
    if (n !== ejes.codTiendas.length) {
      return { success: false, error: "Hay productos que ya no existen." };
    }
  }
  if (ejes.idMarca) {
    const marca = await prisma.marca.findUnique({
      where: { id: ejes.idMarca },
      select: { id: true },
    });
    if (!marca) return { success: false, error: "La marca ya no existe." };
  }
  if (ejes.idRubro) {
    const rubro = await prisma.prodRubro.findUnique({
      where: { id: ejes.idRubro },
      select: { id: true },
    });
    if (!rubro) return { success: false, error: "El rubro ya no existe." };
  }
  return { success: true, data: undefined };
}

function dataCabecera(input: CrearDescPromoInput) {
  const ejes = ejesSegunAlcance(input);
  const conFechas = input.categoria === "FECHA";
  return {
    categoria: input.categoria,
    fechaDesde:
      conFechas && input.fechaDesde ? prismaDateOnlyFromIsoYmd(input.fechaDesde) : null,
    fechaHasta:
      conFechas && input.fechaHasta ? prismaDateOnlyFromIsoYmd(input.fechaHasta) : null,
    alcance: input.alcance,
    descuento: input.descuento,
    enPresupuesto: input.enPresupuesto,
    idMarca: ejes.idMarca,
    idRubro: ejes.idRubro,
  };
}

function dataLineasPdf(input: CrearDescPromoInput) {
  return input.lineasPdf.map((texto, orden) => ({ orden, texto }));
}

function dataLineasValidaDesc(input: CrearDescPromoInput) {
  return input.lineasValidaDesc.map((texto, orden) => ({ orden, texto }));
}

function dataFormasPago(input: CrearDescPromoInput) {
  return input.vinculosCobro.map((v) => ({
    pagoId: v.pagoId,
    cuotaId: v.cuotaId ?? null,
  }));
}

type DataLoteItem = {
  cantidad: number | null;
  costoTipo: CrearDescPromoInput["lotes"][number]["costoTipo"] | null;
  costoValor: number | null;
  costoBase: number | null;
  costoUnitario: number | null;
};

const LOTE_VACIO: DataLoteItem = {
  cantidad: null,
  costoTipo: null,
  costoValor: null,
  costoBase: null,
  costoUnitario: null,
};

/** Costo vigente sin IVA (SSOT `costoListaTienda`) por `cod_tienda`. */
async function costosVigentesPorCodigo(
  codTiendas: readonly string[],
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Map<string, number>> {
  if (codTiendas.length === 0) return new Map();
  const rows = await db.prodPropio.findMany({
    where: { codTienda: { in: [...codTiendas] } },
    select: { codTienda: true, ...SELECT_COSTO_COMPRA_TIENDA },
  });
  return new Map(rows.map((r) => [r.codTienda, resolverCostoCompraTienda(r)]));
}

/**
 * Lote por ítem (solo STOCK). PORCENTAJE congela `costo_base`: se conserva el del ítem
 * si ya era PORCENTAJE; si no, se toma el costo vigente.
 */
async function lotesPorCodigo(
  input: CrearDescPromoInput,
  previos: ReadonlyMap<string, { costoTipo: string | null; costoBase: number | null }>,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Map<string, DataLoteItem>> {
  const out = new Map<string, DataLoteItem>();
  if (input.categoria !== "STOCK") return out;
  const sinBase = input.lotes
    .filter((l) => {
      if (l.costoTipo !== "PORCENTAJE") return false;
      const previo = previos.get(l.codTienda);
      return previo?.costoTipo !== "PORCENTAJE" || previo.costoBase == null;
    })
    .map((l) => l.codTienda);
  const vigentes = await costosVigentesPorCodigo(sinBase, db);
  for (const lote of input.lotes) {
    const previo = previos.get(lote.codTienda);
    const costoBase =
      lote.costoTipo === "PORCENTAJE"
        ? previo?.costoTipo === "PORCENTAJE" && previo.costoBase != null
          ? previo.costoBase
          : (vigentes.get(lote.codTienda) ?? 0)
        : null;
    out.set(lote.codTienda, {
      cantidad: lote.cantidad,
      costoTipo: lote.costoTipo,
      costoValor: lote.costoValor,
      costoBase,
      costoUnitario: costoNuevoLoteDescPromo(
        lote.costoTipo,
        lote.costoValor,
        costoBase ?? 0
      ),
    });
  }
  return out;
}

export async function costosVigentesDescPromo(
  codTiendas: readonly string[]
): Promise<Record<string, number>> {
  try {
    return Object.fromEntries(await costosVigentesPorCodigo(codTiendas));
  } catch (e: unknown) {
    console.error("[descPromo.service] costosVigentesDescPromo:", e);
    return {};
  }
}

function hoyIsoArgentina(): string {
  return dateToIsoYmdArgentina(new Date());
}

/**
 * Factura: FECHA solo dentro del rango; STOCK solo si algún ítem tiene saldo > 0
 * (la venta puede superar el saldo: se respeta el desc. para toda la línea).
 * `conAgotados`: deja los ítems con saldo 0 para mostrarlos (no aplican: `aCandidataFactura`).
 */
function soloVigentesFactura(
  filas: DescPromoFila[],
  { conAgotados }: { conAgotados: boolean }
): DescPromoFila[] {
  const hoy = hoyIsoArgentina();
  const out: DescPromoFila[] = [];
  for (const fila of filas) {
    if (fila.categoria === "FECHA" && estadoDescPromo(fila, hoy) !== "VIGENTE") continue;
    if (fila.categoria === "STOCK") {
      const items = fila.items.filter((i) => (i.lote?.saldo ?? 0) > 0);
      if (items.length === 0) continue;
      out.push(conAgotados ? fila : { ...fila, items });
      continue;
    }
    out.push(fila);
  }
  return out;
}

/** Prioridad 1 = la que gana. Una promo nueva va al final (máximo + 1 = la de menor peso). */
async function siguientePrioridad(): Promise<number> {
  const agg = await prisma.descPromo.aggregate({ _max: { prioridad: true } });
  return (agg._max.prioridad ?? 0) + 1;
}

async function compactarPrioridad(): Promise<void> {
  await prisma.$executeRaw`
    UPDATE cobro_desc_promo SET prioridad = prioridad + 100000
  `;
  await prisma.$executeRaw`
    UPDATE cobro_desc_promo AS d
    SET prioridad = s.rn
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY prioridad ASC, id ASC) AS rn
      FROM cobro_desc_promo
    ) AS s
    WHERE d.id = s.id
  `;
}

export type DescPromoOpcionProducto = {
  codTienda: string;
  descripcion: string;
};

export async function listarOpcionesProductoDescPromo(): Promise<
  DescPromoOpcionProducto[]
> {
  try {
    const rows = await prisma.prodPropio.findMany({
      select: { codTienda: true, descripcionTienda: true },
      orderBy: [{ descripcionTienda: "asc" }, { codTienda: "asc" }],
    });
    return rows.map((row) => ({
      codTienda: row.codTienda,
      descripcion: (row.descripcionTienda ?? "").toLocaleUpperCase("es-AR"),
    }));
  } catch (e: unknown) {
    console.error("[descPromo.service] listarOpcionesProductoDescPromo:", e);
    return [];
  }
}

export async function listarDescPromos(): Promise<DescPromoFila[]> {
  try {
    const rows = await prisma.descPromo.findMany({
      include: promoInclude,
      orderBy: [{ prioridad: "asc" }, { id: "asc" }],
    });
    return rows.map(mapPromo);
  } catch (e: unknown) {
    console.error("[descPromo.service] listarDescPromos:", e);
    return [];
  }
}

/**
 * Promos de alcance ITEMS (DESC. ESPECIAL) vigentes indexadas por `cod_tienda`
 * pedido. Un código puede tener varias; orden: prioridad asc (1 = la que gana).
 */
export async function listarDescPromosEspecialesPorCodigos(
  codigos: readonly string[]
): Promise<Map<string, DescPromoEspecialFactura[]>> {
  const unicos = [...new Set(codigos.map((c) => c.trim()).filter(Boolean))];
  const out = new Map<string, DescPromoEspecialFactura[]>();
  if (unicos.length === 0) return out;
  const pedido = new Set(unicos);
  try {
    const rows = await prisma.descPromo.findMany({
      where: {
        alcance: "ITEMS",
        items: { some: { codTienda: { in: unicos } } },
      },
      include: promoInclude,
      orderBy: [{ prioridad: "asc" }, { id: "asc" }],
    });
    for (const mapped of soloVigentesFactura(rows.map(mapPromo), { conAgotados: false })) {
      const especial: DescPromoEspecialFactura = {
        id: mapped.id,
        nombre: mapped.nombre,
        descuento: mapped.descuento,
        prioridad: mapped.prioridad,
        formasPago: mapped.formasPago
          .map(etiquetaFormaPagoCuotaDescPromo)
          .join(" · "),
      };
      for (const item of mapped.items) {
        if (!pedido.has(item.codTienda)) continue;
        const lista = out.get(item.codTienda) ?? [];
        lista.push(especial);
        out.set(item.codTienda, lista);
      }
    }
    return out;
  } catch (e: unknown) {
    console.error(
      "[descPromo.service] listarDescPromosEspecialesPorCodigos:",
      e
    );
    return out;
  }
}

/** Formas del cartel «DESCUENTO VÁLIDO ABONANDO CON» para el % aplicado. */
export async function textoFormasPagoHabilitadasPorDescuento(
  descuentoPct: number
): Promise<string> {
  const pct = Math.round(descuentoPct);
  if (!Number.isFinite(pct) || pct <= 0) return "";
  const rows = await prisma.descPromo.findMany({
    where: { descuento: pct, enPresupuesto: true },
    orderBy: { prioridad: "asc" },
    select: {
      lineasValidaDesc: { orderBy: { orden: "asc" }, select: { texto: true } },
    },
  });
  const textos: string[] = [];
  const vistos = new Set<string>();
  for (const row of rows) {
    for (const linea of row.lineasValidaDesc) {
      const texto = linea.texto.trim();
      if (!texto) continue;
      const clave = texto.toLocaleUpperCase("es-AR");
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      textos.push(texto);
    }
  }
  return textos.join(" | ");
}

/** Recuadro del presupuesto: líneas de FORMA DE PAGO EN PRESUPUESTO, agrupadas por %. */
export async function listarFormasPagoPresupuesto(): Promise<FilaFormaPagoPresupuestoPdf[]> {
  const rows = await prisma.descPromo.findMany({
    where: { enPresupuesto: true, lineasPdf: { some: {} } },
    orderBy: { prioridad: "asc" },
    select: {
      descuento: true,
      lineasPdf: { orderBy: { orden: "asc" }, select: { texto: true } },
    },
  });
  const grupos: { descuento: number; formas: string[]; incluyeDescuento: boolean }[] = [];
  const indice = new Map<number, number>();
  for (const row of rows) {
    const formas = row.lineasPdf.map((linea) => linea.texto.trim()).filter((texto) => texto.length > 0);
    if (formas.length === 0) continue;
    if (row.descuento <= 0) {
      grupos.push({ descuento: row.descuento, formas, incluyeDescuento: false });
      continue;
    }
    const actual = indice.get(row.descuento);
    if (actual == null) {
      indice.set(row.descuento, grupos.length);
      grupos.push({ descuento: row.descuento, formas, incluyeDescuento: true });
      continue;
    }
    grupos[actual].formas.push(...formas);
  }
  grupos.sort((a, b) => {
    if (a.incluyeDescuento !== b.incluyeDescuento) return a.incluyeDescuento ? -1 : 1;
    return b.descuento - a.descuento;
  });
  return grupos;
}

function cuotaNumericaMensaje(etiqueta: string | null): number | null {
  const n = Number.parseInt(lineasEtiquetaCuotaDescPromo(etiqueta).linea1, 10);
  return Number.isFinite(n) && n > 1 ? n : null;
}

/** Descuentos con SE MUESTRA EN PRESUPUESTOS, para el mensaje de WhatsApp. */
export async function listarDescuentosMensajePresupuesto(): Promise<DescuentoMensajePresupuesto[]> {
  const rows = await prisma.descPromo.findMany({
    where: { enPresupuesto: true },
    orderBy: [{ descuento: "desc" }, { prioridad: "asc" }],
    select: {
      descuento: true,
      lineasPdf: { orderBy: { orden: "asc" }, select: { texto: true } },
      lineasValidaDesc: { orderBy: { orden: "asc" }, select: { texto: true } },
      formasPago: { select: { cuota: { select: { cuotas: true } } } },
    },
  });
  return rows.map((row) => {
    const cuotas: number[] = [];
    if (row.descuento <= 0) {
      const vistos = new Set<number>();
      for (const forma of row.formasPago) {
        const cuota = cuotaNumericaMensaje(forma.cuota?.cuotas ?? null);
        if (cuota == null || vistos.has(cuota)) continue;
        vistos.add(cuota);
        cuotas.push(cuota);
      }
    }
    return {
      descuento: row.descuento,
      abonandoCon: row.lineasValidaDesc.map((linea) => linea.texto.trim()).filter((texto) => texto.length > 0),
      lineasFormaPago: row.lineasPdf.map((linea) => linea.texto.trim()).filter((texto) => texto.length > 0),
      cuotas,
    };
  });
}

export async function listarDescPromosPorFormaPago(): Promise<DescPromoFila[]> {
  try {
    const rows = await prisma.descPromo.findMany({
      where: { formasPago: { some: {} } },
      include: promoInclude,
      orderBy: [{ prioridad: "asc" }, { id: "asc" }],
    });
    return soloVigentesFactura(rows.map(mapPromo), { conAgotados: true });
  } catch (e: unknown) {
    console.error("[descPromo.service] listarDescPromosPorFormaPago:", e);
    return [];
  }
}

export async function crearDescPromo(
  input: CrearDescPromoInput
): Promise<ServiceResult<DescPromoFila>> {
  const nombre = normalizarNombre(input.nombre);
  if (!nombre) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }
  const vinculos = await validarVinculos(input);
  if (!vinculos.success) return vinculos;
  const crear = async () => {
    const lotes = await lotesPorCodigo(input, new Map());
    const prioridad = await siguientePrioridad();
    const created = await prisma.descPromo.create({
      data: {
        nombre,
        prioridad,
        ...dataCabecera(input),
        items: {
          create: ejesSegunAlcance(input).codTiendas.map((codTienda) => ({
            codTienda,
            ...(lotes.get(codTienda) ?? LOTE_VACIO),
          })),
        },
        formasPago: { create: dataFormasPago(input) },
        lineasPdf: { create: dataLineasPdf(input) },
        lineasValidaDesc: { create: dataLineasValidaDesc(input) },
      },
      include: promoInclude,
    });
    return mapPromo(created);
  };
  try {
    return { success: true, data: await crear() };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      try {
        await compactarPrioridad();
        return { success: true, data: await crear() };
      } catch (retryError) {
        return {
          success: false,
          error: mapDbError(retryError, "No se pudo crear la promoción."),
        };
      }
    }
    return {
      success: false,
      error: mapDbError(error, "No se pudo crear la promoción."),
    };
  }
}

export async function editarDescPromo(
  input: EditarDescPromoInput
): Promise<ServiceResult<DescPromoFila>> {
  const nombre = normalizarNombre(input.nombre);
  if (!nombre) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }
  const vinculos = await validarVinculos(input);
  if (!vinculos.success) return vinculos;
  try {
    return await prisma.$transaction(async (tx) => {
      const existe = await tx.descPromo.findUnique({
        where: { id: input.id },
        select: { id: true },
      });
      if (!existe) {
        return { success: false as const, error: "La promoción no existe." };
      }
      /** Bloquea los lotes: una venta concurrente espera a que termine la edición. */
      const previosRows = await tx.$queryRaw<
        {
          cod_tienda: string;
          cantidad_consumida: Prisma.Decimal;
          costo_tipo: string | null;
          costo_base: Prisma.Decimal | null;
          descripcion: string | null;
        }[]
      >`
        SELECT i.cod_tienda, i.cantidad_consumida, i.costo_tipo::text AS costo_tipo,
               i.costo_base, p.descripcion
        FROM cobro_desc_promo_items i
        INNER JOIN prod_lista p ON p.cod_tienda = i.cod_tienda
        WHERE i.promo_id = ${input.id}
        FOR UPDATE OF i
      `;
      const codTiendas = ejesSegunAlcance(input).codTiendas;
      const nuevos = new Set(codTiendas);
      const cantidadNueva = new Map(input.lotes.map((l) => [l.codTienda, l.cantidad]));
      for (const previo of previosRows) {
        const consumida = cantidadDesdePrisma(previo.cantidad_consumida);
        if (consumida <= 0) continue;
        const nombreItem = (previo.descripcion ?? previo.cod_tienda).toLocaleUpperCase("es-AR");
        if (input.categoria !== "STOCK") {
          return {
            success: false as const,
            error: "Este DESC. POR STOCK ya tiene unidades vendidas: no se puede cambiar la categoría.",
          };
        }
        if (!nuevos.has(previo.cod_tienda)) {
          return {
            success: false as const,
            error: `No se puede quitar ${nombreItem}: ya tiene unidades vendidas.`,
          };
        }
        const cantidad = cantidadNueva.get(previo.cod_tienda) ?? 0;
        if (cantidad < consumida) {
          return {
            success: false as const,
            error: `La cantidad de ${nombreItem} no puede ser menor a lo ya vendido (${fmtCantidad(consumida)}).`,
          };
        }
      }
      const previos = new Map(
        previosRows.map((r) => [
          r.cod_tienda,
          {
            costoTipo: r.costo_tipo,
            costoBase: r.costo_base == null ? null : r.costo_base.toNumber(),
          },
        ])
      );
      const lotes = await lotesPorCodigo(input, previos, tx);

      await tx.descPromoItem.deleteMany({
        where: { promoId: input.id, codTienda: { notIn: codTiendas } },
      });
      for (const codTienda of codTiendas) {
        const lote = lotes.get(codTienda) ?? LOTE_VACIO;
        await tx.descPromoItem.upsert({
          where: { promoId_codTienda: { promoId: input.id, codTienda } },
          create: { promoId: input.id, codTienda, ...lote },
          update: lote,
        });
      }
      await tx.descPromoFormaPago.deleteMany({ where: { promoId: input.id } });
      await tx.descPromoFormaPago.createMany({
        data: dataFormasPago(input).map((fp) => ({ ...fp, promoId: input.id })),
      });
      await tx.descPromoLineaPdf.deleteMany({ where: { promoId: input.id } });
      if (input.lineasPdf.length > 0) {
        await tx.descPromoLineaPdf.createMany({
          data: dataLineasPdf(input).map((linea) => ({ ...linea, promoId: input.id })),
        });
      }
      await tx.descPromoLineaValidaDesc.deleteMany({ where: { promoId: input.id } });
      if (input.lineasValidaDesc.length > 0) {
        await tx.descPromoLineaValidaDesc.createMany({
          data: dataLineasValidaDesc(input).map((linea) => ({ ...linea, promoId: input.id })),
        });
      }
      const updated = await tx.descPromo.update({
        where: { id: input.id },
        data: { nombre, ...dataCabecera(input) },
        include: promoInclude,
      });
      return { success: true as const, data: mapPromo(updated) };
    });
  } catch (error) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo actualizar la promoción."),
    };
  }
}

export async function eliminarDescPromo(
  id: string
): Promise<ServiceResult<{ id: string }>> {
  try {
    await prisma.descPromo.delete({ where: { id } });
    await compactarPrioridad();
    return { success: true, data: { id } };
  } catch (error) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo eliminar la promoción."),
    };
  }
}

/** `up` = sube prioridad (número menor, hacia 1); `down` = baja prioridad (número mayor). */
export async function moverPrioridadDescPromo(
  id: string,
  direccion: "up" | "down"
): Promise<ServiceResult<DescPromoFila>> {
  try {
    const rows = await prisma.descPromo.findMany({
      select: { id: true, prioridad: true },
      orderBy: { prioridad: "asc" },
    });
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return { success: false, error: "La promoción no existe." };
    const j = direccion === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= rows.length) {
      const actual = await prisma.descPromo.findUnique({
        where: { id },
        include: promoInclude,
      });
      if (!actual) return { success: false, error: "La promoción no existe." };
      return { success: true, data: mapPromo(actual) };
    }
    const a = rows[i];
    const b = rows[j];
    const offset = 100000;
    await prisma.descPromo.update({
      where: { id: a.id },
      data: { prioridad: a.prioridad + offset },
    });
    await prisma.descPromo.update({
      where: { id: b.id },
      data: { prioridad: a.prioridad },
    });
    await prisma.descPromo.update({
      where: { id: a.id },
      data: { prioridad: b.prioridad },
    });
    await compactarPrioridad();
    const updated = await prisma.descPromo.findUnique({
      where: { id },
      include: promoInclude,
    });
    if (!updated) return { success: false, error: "La promoción no existe." };
    return { success: true, data: mapPromo(updated) };
  } catch (error) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo cambiar la prioridad."),
    };
  }
}
