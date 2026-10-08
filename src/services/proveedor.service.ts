/**
 * Servicio de Proveedores – Conexión a Neon/PostgreSQL vía Prisma.
 */
import { randomBytes } from "node:crypto";
import { IvaProveedor } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPlanPlazosLabel, resolverPlazosEfectivos } from "@/lib/comprobanteCuotasPlazoPago";
import type { ServiceResult } from "@/types";

export { IvaProveedor };

function labelPlazosProveedor(p: {
  plazoPago1Dias: number | null;
  plazoPago2Dias: number | null;
  plazoPago3Dias: number | null;
  plazoPago4Dias: number | null;
}): string | null {
  if (p.plazoPago1Dias == null) return null;
  return formatPlanPlazosLabel(
    resolverPlazosEfectivos(null, {
      plazo1: p.plazoPago1Dias,
      plazo2: p.plazoPago2Dias,
      plazo3: p.plazoPago3Dias,
      plazo4: p.plazoPago4Dias,
    })
  );
}

export interface CreateProveedorInput {
  nombre: string;
  /** Vacío o null: sin prefijo en BD; se genera `codigoUnico` único. */
  prefijo?: string | null;
  idProveedorDux?: string | null;
  whatsapp?: string | null;
  coeficienteTintometrico: number;
  plazoPago1Dias: number;
  plazoPago2Dias?: number | null;
  plazoPago3Dias?: number | null;
  plazoPago4Dias?: number | null;
  /** Tiempo de entrega en días (≥ 0); null = no configurado. */
  tiempoEntregaEnDias?: number | null;
  /** Obligatorio en alta (formulario SI/NO). */
  proveedorMercaderia: boolean;
  /** Flag fábrica (Pedido A Fábrica); formulario SI/NO. */
  esFabrica: boolean;
  /** Política IVA: SIEMPRE | NUNCA | PREGUNTA (default DB: PREGUNTA). */
  iva: IvaProveedor;
}

export interface UpdateProveedorInput {
  id: string;
  nombre: string;
  /** Vacío o null: se guarda prefijo NULL (salvo validación Zod de 3 letras si hay texto). */
  prefijo?: string | null;
  idProveedorDux?: string | null;
  whatsapp?: string | null;
  coeficienteTintometrico: number;
  plazoPago1Dias: number;
  plazoPago2Dias?: number | null;
  plazoPago3Dias?: number | null;
  plazoPago4Dias?: number | null;
  /** Tiempo de entrega en días (≥ 0); null = no configurado. */
  tiempoEntregaEnDias?: number | null;
  /** Obligatorio en edición desde el formulario. */
  proveedorMercaderia: boolean;
  /** Flag fábrica (Pedido A Fábrica); formulario SI/NO. */
  esFabrica: boolean;
  /** Política IVA: SIEMPRE | NUNCA | PREGUNTA. */
  iva: IvaProveedor;
}

export interface UpdateCoeficienteTintometricoInput {
  id: string;
  coeficienteTintometrico: number;
}

export interface ProveedorListItem {
  id: string;
  nombre: string;
  codigoUnico: string;
  prefijo: string;
  /** ID del proveedor en DUX (si está configurado). */
  idProveedorDux: string | null;
  /** Número WhatsApp para envío de pedido (internacional sin +). */
  whatsapp: string | null;
  /** Coeficiente para cálculo tintométrico. */
  coeficienteTintometrico: number;
  plazoPago1Dias: number | null;
  plazoPago2Dias: number | null;
  plazoPago3Dias: number | null;
  plazoPago4Dias: number | null;
  /** Label derivado `30, 60, 90` para listados. */
  plazosPagos: string | null;
  /** Tiempo de entrega en días; null = no configurado. */
  tiempoEntregaEnDias: number | null;
  /**
   * Flag "proveedor de mercadería". Solo los TRUE se listan en
   * /gestion-productos/proveedores/lista (ver `getProveedoresMercaderia`).
   */
  proveedorMercaderia: boolean;
  /** True si el proveedor es fábrica (Pedido A Fábrica). */
  esFabrica: boolean;
  /** Política IVA: SIEMPRE | NUNCA | PREGUNTA (default BD: PREGUNTA). */
  iva: IvaProveedor;
  /** Cantidad de ítems en proveedor_prod_lista. */
  cantProductos: number;
  /** Cantidad de ítems de `proveedor_prod_lista` con `cod_tienda_vinculo` no nulo (vinculados manualmente a un `prod_lista`). */
  cantVinculados: number;
}

export const PROVEEDOR_ERROR = {
  NOMBRE_DUPLICADO: "Ya existe un proveedor con ese nombre.",
  PREFIJO_DUPLICADO: "Ya existe un proveedor con ese prefijo.",
  CODIGO_UNICO_DUPLICADO: "Ya existe un proveedor con ese código interno. Reintentá el alta.",
} as const;

/** Si no hay prefijo de 3 letras, `codigo_unico` debe ser único (no coincide con prefijos típicos). */
async function generarCodigoUnicoDisponible(): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const candidate = `Z${randomBytes(8).toString("hex").toUpperCase()}`;
    const exists = await prisma.proveedor.findFirst({
      where: { codigoUnico: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  throw new Error("No se pudo generar un código único para el proveedor.");
}

/**
 * Lista de proveedores desde la base de datos con conteos en proveedor_prod_lista y prod_lista.
 *
 * Devuelve TODOS los proveedores (sin filtrar por `proveedorMercaderia`).
 * Este método alimenta vistas transversales (Px Sugeridos, Lista Px Proveedores,
 * Comparación por Categorías, sincronizaciones, etc.). Para la vista específica
 * "Lista Proveedores" usar `getProveedoresMercaderia()`.
 */
export async function getProveedores(): Promise<ProveedorListItem[]> {
  return listarProveedoresInterno(null);
}

/**
 * Lista únicamente los proveedores con `proveedor_mercaderia = true`.
 * Alimenta /gestion-productos/proveedores/lista (tabla "Lista Proveedores").
 * Usa el índice `proveedores_proveedor_mercaderia_idx` para el filtro.
 */
export async function getProveedoresMercaderia(): Promise<ProveedorListItem[]> {
  return listarProveedoresInterno({ proveedorMercaderia: true });
}

export interface ProveedorMercaderiaPlazosFila {
  id: string;
  nombre: string;
  plazoPago1Dias: number | null;
  plazoPago2Dias: number | null;
  plazoPago3Dias: number | null;
  plazoPago4Dias: number | null;
}

/** Proveedores de mercadería con plazos de pago (Comprobantes · Gestionar Venc.). */
export async function listarProveedoresMercaderiaPlazosPagos(): Promise<
  ProveedorMercaderiaPlazosFila[]
> {
  const rows = await prisma.proveedor.findMany({
    where: { proveedorMercaderia: true },
    select: {
      id: true,
      nombre: true,
      plazoPago1Dias: true,
      plazoPago2Dias: true,
      plazoPago3Dias: true,
      plazoPago4Dias: true,
    },
    orderBy: { nombre: "asc" },
  });
  return rows.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    plazoPago1Dias: p.plazoPago1Dias,
    plazoPago2Dias: p.plazoPago2Dias,
    plazoPago3Dias: p.plazoPago3Dias,
    plazoPago4Dias: p.plazoPago4Dias,
  }));
}

export async function actualizarPlazosPagosProveedoresMercaderia(
  items: {
    id: string;
    plazoPago1Dias: number;
    plazoPago2Dias: number | null;
    plazoPago3Dias: number | null;
    plazoPago4Dias: number | null;
  }[]
): Promise<ServiceResult<void>> {
  try {
    await prisma.$transaction(
      items.map((item) =>
        prisma.proveedor.updateMany({
          where: { id: item.id, proveedorMercaderia: true },
          data: {
            plazoPago1Dias: item.plazoPago1Dias,
            plazoPago2Dias: item.plazoPago2Dias,
            plazoPago3Dias: item.plazoPago3Dias,
            plazoPago4Dias: item.plazoPago4Dias,
          },
        })
      )
    );
    return { success: true, data: undefined };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "No se pudieron guardar los plazos de pago.";
    return { success: false, error: message };
  }
}

/**
 * Lista únicamente los proveedores con `proveedor_mercaderia = false`
 * (contraparte de `getProveedoresMercaderia`). Alimenta la columna
 * "PROVEEDORES" de `/finanzas/balance/gastos/catalogo`, donde se gestiona
 * el catálogo maestro de proveedores "no de mercadería" (gastos operativos,
 * servicios, impuestos, etc.). Usa el mismo índice
 * `proveedores_proveedor_mercaderia_idx`.
 */
export async function getProveedoresNoMercaderia(): Promise<ProveedorListItem[]> {
  return listarProveedoresInterno({ proveedorMercaderia: false });
}

/**
 * Lista únicamente los proveedores con `es_fabrica = true`.
 * Alimenta el selector **PROVEEDOR** de **Pedido A Fábrica**.
 * Usa el índice `proveedores_es_fabrica_idx`.
 */
export async function getProveedoresFabrica(): Promise<ProveedorListItem[]> {
  return listarProveedoresInterno({ esFabrica: true });
}

/** Implementación compartida: arma el payload con conteos en una sola pasada. */
async function listarProveedoresInterno(
  where: { proveedorMercaderia?: boolean; esFabrica?: boolean } | null
): Promise<ProveedorListItem[]> {
  const [rows, vinculadosByProveedor] = await Promise.all([
    prisma.proveedor.findMany({
      where: where ?? undefined,
      orderBy: { nombre: "asc" },
      include: { _count: { select: { listaPrecios: true } } },
    }),
    prisma.listaPrecioProveedor.groupBy({
      by: ["idProveedor"],
      where: { codTiendaVinculo: { not: null } },
      _count: { codExt: true },
    }),
  ]);

  const vinculadosMap = new Map(
    vinculadosByProveedor.map((g) => [g.idProveedor, g._count.codExt])
  );

  return rows.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    codigoUnico: p.codigoUnico,
    prefijo: p.prefijo ?? "",
    idProveedorDux: p.idProveedorDux ?? null,
    whatsapp: p.whatsapp ?? null,
    coeficienteTintometrico: Number(p.coeficienteTintometrico),
    plazoPago1Dias: p.plazoPago1Dias,
    plazoPago2Dias: p.plazoPago2Dias,
    plazoPago3Dias: p.plazoPago3Dias,
    plazoPago4Dias: p.plazoPago4Dias,
    plazosPagos: labelPlazosProveedor(p),
    tiempoEntregaEnDias: p.tiempoEntregaEnDias ?? null,
    proveedorMercaderia: p.proveedorMercaderia,
    esFabrica: p.esFabrica,
    iva: p.iva,
    cantProductos: p._count.listaPrecios,
    cantVinculados: vinculadosMap.get(p.id) ?? 0,
  }));
}

/** Obtiene un proveedor por id (para validaciones sin cargar toda la lista). */
export async function getProveedorById(id: string): Promise<{
  id: string;
  nombre: string;
  prefijo: string | null;
  codigoUnico: string;
  whatsapp: string | null;
  coeficienteTintometrico: number;
  plazoPago1Dias: number | null;
  plazoPago2Dias: number | null;
  plazoPago3Dias: number | null;
  plazoPago4Dias: number | null;
  plazosPagos: string | null;
  tiempoEntregaEnDias: number | null;
  iva: IvaProveedor;
} | null> {
  const p = await prisma.proveedor.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      prefijo: true,
      codigoUnico: true,
      whatsapp: true,
      coeficienteTintometrico: true,
      plazoPago1Dias: true,
      plazoPago2Dias: true,
      plazoPago3Dias: true,
      plazoPago4Dias: true,
      tiempoEntregaEnDias: true,
      iva: true,
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    nombre: p.nombre,
    prefijo: p.prefijo,
    codigoUnico: p.codigoUnico,
    whatsapp: p.whatsapp ?? null,
    coeficienteTintometrico: Number(p.coeficienteTintometrico),
    plazoPago1Dias: p.plazoPago1Dias,
    plazoPago2Dias: p.plazoPago2Dias,
    plazoPago3Dias: p.plazoPago3Dias,
    plazoPago4Dias: p.plazoPago4Dias,
    plazosPagos: labelPlazosProveedor(p),
    tiempoEntregaEnDias: p.tiempoEntregaEnDias ?? null,
    iva: p.iva,
  };
}

/**
 * Crea un proveedor en la base de datos.
 * Si hay prefijo (3 letras), `codigo_unico` coincide con él; si no, se genera un código interno único.
 */
export async function createProveedor(
  input: CreateProveedorInput
): Promise<{ id: string; codigoUnico: string }> {
  const raw = input.prefijo?.trim() ?? "";
  const prefijoNorm = raw === "" ? null : raw.toUpperCase();
  if (prefijoNorm !== null && !/^[A-Z]{3}$/.test(prefijoNorm)) {
    throw new Error("Prefijo inválido.");
  }
  const codigoUnico = prefijoNorm ?? (await generarCodigoUnicoDisponible());
  const proveedor = await prisma.proveedor.create({
    data: {
      nombre: input.nombre.trim(),
      prefijo: prefijoNorm,
      codigoUnico,
      idProveedorDux: input.idProveedorDux?.trim() || null,
      whatsapp: normalizarWhatsapp(input.whatsapp),
      coeficienteTintometrico: input.coeficienteTintometrico,
      plazoPago1Dias: input.plazoPago1Dias,
      plazoPago2Dias: input.plazoPago2Dias ?? null,
      plazoPago3Dias: input.plazoPago3Dias ?? null,
      plazoPago4Dias: input.plazoPago4Dias ?? null,
      tiempoEntregaEnDias: input.tiempoEntregaEnDias ?? null,
      proveedorMercaderia: input.proveedorMercaderia,
      esFabrica: input.esFabrica,
      iva: input.iva,
    },
  });
  return { id: proveedor.id, codigoUnico: proveedor.codigoUnico };
}

/**
 * Actualiza un proveedor existente en la base de datos.
 */
export async function updateProveedor(
  input: UpdateProveedorInput
): Promise<void> {
  const raw = input.prefijo?.trim() ?? "";
  const prefijoNorm = raw === "" ? null : raw.toUpperCase();
  if (prefijoNorm !== null && !/^[A-Z]{3}$/.test(prefijoNorm)) {
    throw new Error("Prefijo inválido.");
  }
  await prisma.proveedor.update({
    where: { id: input.id },
    data: {
      nombre: input.nombre.trim(),
      prefijo: prefijoNorm,
      idProveedorDux: input.idProveedorDux?.trim() || null,
      whatsapp: normalizarWhatsapp(input.whatsapp),
      coeficienteTintometrico: input.coeficienteTintometrico,
      plazoPago1Dias: input.plazoPago1Dias,
      plazoPago2Dias: input.plazoPago2Dias ?? null,
      plazoPago3Dias: input.plazoPago3Dias ?? null,
      plazoPago4Dias: input.plazoPago4Dias ?? null,
      tiempoEntregaEnDias: input.tiempoEntregaEnDias ?? null,
      proveedorMercaderia: input.proveedorMercaderia,
      esFabrica: input.esFabrica,
      iva: input.iva,
    },
  });
}

/**
 * Actualiza coeficientes tintométricos de múltiples proveedores en una sola transacción.
 */
export async function updateCoeficientesTintometricos(
  items: UpdateCoeficienteTintometricoInput[]
): Promise<void> {
  await prisma.$transaction(
    items.map((item) =>
      prisma.proveedor.update({
        where: { id: item.id },
        data: { coeficienteTintometrico: item.coeficienteTintometrico },
      })
    )
  );
}

/**
 * Elimina un proveedor. Falla si existen referencias con `onDelete: Restrict` (p. ej. historial de pedidos).
 */
export async function deleteProveedor(id: string): Promise<ServiceResult<void>> {
  try {
    await prisma.proveedor.delete({ where: { id } });
    return { success: true, data: undefined };
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2003" || code === "P2014") {
      return {
        success: false,
        error:
          "No se puede eliminar: el proveedor tiene pedidos u otros datos vinculados. Quitá esas referencias primero.",
      };
    }
    const message = e instanceof Error ? e.message : "Error al eliminar el proveedor.";
    return { success: false, error: message };
  }
}

/** Normaliza número WhatsApp: solo dígitos, null si queda vacío. */
function normalizarWhatsapp(value: string | null | undefined): string | null {
  if (value == null) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}
