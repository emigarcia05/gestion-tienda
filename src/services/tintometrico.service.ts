import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { normalizarCodColor, RUBRO_TINTOMETRICO } from "@/lib/codColorTintometrico";
import { codigoCumpleFormatoCod } from "@/lib/tintometricoFormatoCod";
import type { ServiceResult } from "@/types";

const PROVEEDORES_TINTOMETRICOS_IDS = [
  "cmm546hyj000004lbskwbrvb6",
  "cmm5a3iaq000004l8shjzf4cz",
  "cmm5473mk000104jro6bcypp5",
] as const;

export type ProveedorTintometrico = {
  id: string;
  nombre: string;
  prefijo: string;
};

export type SucursalTintometrica = {
  id: string;
  codigo: string;
  nombre: string;
};

export async function getProveedoresTintometricos(): Promise<ProveedorTintometrico[]> {
  const where: Prisma.ProveedorWhereInput = {
    id: { in: [...PROVEEDORES_TINTOMETRICOS_IDS] },
    proveedorMercaderia: true,
  };

  const rows = await prisma.proveedor.findMany({
    where,
    select: { id: true, nombre: true, prefijo: true },
  });

  const order = new Map<string, number>(
    PROVEEDORES_TINTOMETRICOS_IDS.map((id, i) => [id, i])
  );

  return [...rows]
    .sort((a, b) => {
      const ai = order.get(a.id) ?? 999;
      const bi = order.get(b.id) ?? 999;
      return ai - bi;
    })
    .map((r) => ({ ...r, prefijo: r.prefijo ?? "" }));
}

export type ProveedorCoefTintometrico = ProveedorTintometrico & { coeficienteTintometrico: number };

/** Proveedores de mercadería con COEF. TINTOMÉTRICO > 1 (mismo criterio que Px Tintométrico). */
export async function listarProveedoresCoefTintometrico(): Promise<ProveedorCoefTintometrico[]> {
  const rows = await prisma.proveedor.findMany({
    where: { proveedorMercaderia: true, coeficienteTintometrico: { gt: 1 } },
    select: { id: true, nombre: true, prefijo: true, coeficienteTintometrico: true },
    orderBy: { nombre: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    prefijo: r.prefijo ?? "",
    coeficienteTintometrico: Number(r.coeficienteTintometrico),
  }));
}

export async function getSucursalesTintometricas(): Promise<SucursalTintometrica[]> {
  const rows = await prisma.sucursal.findMany({
    where: { pedido: true },
    select: { id: true, codigo: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
  return rows;
}

export type MarcaTintometricaCatalogo = {
  idMarca: string;
  nombre: string;
  /** Máscara `prod_marcas.formato_cod_tintometrico`; `null` = sin formato cargado (código libre). */
  formatoCod: string | null;
};

export type BaseTintometricaCatalogo = {
  codTienda: string;
  descripcionTienda: string;
  idMarca: string;
};

const WHERE_BASE_TINTOMETRICA: Prisma.ProdPropioWhereInput = {
  rubroRelation: { nombre: { equals: RUBRO_TINTOMETRICO, mode: "insensitive" } },
};

/**
 * COD. COLOR por línea de venta: normalizado, `null` si el producto no es tintométrico,
 * y validado contra la máscara de la marca cuando existe.
 */
export async function resolverCodColorLineas(
  lineas: { codTienda: string; codColor: string | null | undefined }[]
): Promise<ServiceResult<(string | null)[]>> {
  const conCod = lineas.filter((l) => normalizarCodColor(l.codColor) != null);
  if (conCod.length === 0) return { success: true, data: lineas.map(() => null) };

  const rows = await prisma.prodPropio.findMany({
    where: { ...WHERE_BASE_TINTOMETRICA, codTienda: { in: [...new Set(conCod.map((l) => l.codTienda))] } },
    select: { codTienda: true, marcaRelation: { select: { formatoCodTintometrico: true } } },
  });
  const formatoPorCod = new Map(
    rows.map((r) => [r.codTienda, r.marcaRelation?.formatoCodTintometrico?.trim() || null])
  );

  const out: (string | null)[] = [];
  for (let i = 0; i < lineas.length; i += 1) {
    const l = lineas[i]!;
    const cod = normalizarCodColor(l.codColor);
    if (!cod || !formatoPorCod.has(l.codTienda)) {
      out.push(null);
      continue;
    }
    const formato = formatoPorCod.get(l.codTienda) ?? null;
    if (formato && !codigoCumpleFormatoCod(cod, formato)) {
      return {
        success: false,
        error: `El COD. COLOR «${cod}» de la línea ${i + 1} no respeta el formato ${formato}.`,
      };
    }
    out.push(cod);
  }
  return { success: true, data: out };
}

/**
 * Catálogo del modal «Agregar Tintométrico» (Pedir Mercadería): bases `prod_propios` rubro Tintometrico
 * con marca vinculada + marcas presentes en esas bases con su formato de código.
 */
export async function getCatalogoAgregarTintometrico(): Promise<{
  marcas: MarcaTintometricaCatalogo[];
  bases: BaseTintometricaCatalogo[];
}> {
  const rows = await prisma.prodPropio.findMany({
    where: { ...WHERE_BASE_TINTOMETRICA, idMarca: { not: null } },
    select: { codTienda: true, descripcionTienda: true, idMarca: true },
    orderBy: [{ descripcionTienda: "asc" }, { codTienda: "asc" }],
  });
  const idsMarca = [...new Set(rows.map((r) => r.idMarca!))];
  const marcas =
    idsMarca.length > 0
      ? await prisma.marca.findMany({
          where: { id: { in: idsMarca } },
          select: {
            id: true,
            nombre: true,
            formatoCodTintometrico: true,
          },
          orderBy: { nombre: "asc" },
        })
      : [];
  return {
    marcas: marcas.map((m) => ({
      idMarca: m.id,
      nombre: m.nombre,
      formatoCod: m.formatoCodTintometrico?.trim() || null,
    })),
    bases: rows.map((r) => ({
      codTienda: r.codTienda.trim(),
      descripcionTienda: (r.descripcionTienda ?? "").trim(),
      idMarca: r.idMarca!,
    })),
  };
}

export type BaseTintometricaRow = {
  id: string;
  codTienda: string;
  descripcionTienda: string;
  marca: string | null;
  rubro: string | null;
};

export async function buscarBasesTintometricas(
  q: string | undefined,
  take: number
): Promise<{ items: BaseTintometricaRow[]; total: number }> {
  const query = (q ?? "").trim();
  const andParts: Prisma.ProdPropioWhereInput[] = [WHERE_BASE_TINTOMETRICA];

  if (query.length >= 3) {
    const tokens = query.split(/\s+/).filter(Boolean);
    if (tokens.length > 0) {
      andParts.push({
        AND: tokens.map((t) => ({
          OR: [
            { descripcionTienda: { contains: t, mode: "insensitive" as const } },
            { codTienda: { contains: t, mode: "insensitive" as const } },
            { marcaRelation: { nombre: { contains: t, mode: "insensitive" as const } } },
          ],
        })),
      });
    }
  }

  const where: Prisma.ProdPropioWhereInput = andParts.length ? { AND: andParts } : {};

  const [rows, total] = await Promise.all([
    prisma.prodPropio.findMany({
      where,
      select: {
        codTienda: true,
        descripcionTienda: true,
        marcaRelation: { select: { nombre: true } },
        rubroRelation: { select: { nombre: true } },
      },
      orderBy: [{ descripcionTienda: "asc" }, { codTienda: "asc" }],
      take,
    }),
    prisma.prodPropio.count({ where }),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.codTienda,
      codTienda: r.codTienda,
      descripcionTienda: (r.descripcionTienda ?? "").trim(),
      marca: r.marcaRelation?.nombre ?? null,
      rubro: r.rubroRelation?.nombre ?? null,
    })),
    total,
  };
}

