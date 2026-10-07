import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

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
  /** Máscaras `tintometrico_marcas.formato_cod`; vacío = sin formato cargado (código libre). */
  formatos: string[];
};

export type BaseTintometricaCatalogo = {
  codTienda: string;
  descripcionTienda: string;
  idMarca: string;
};

const WHERE_BASE_TINTOMETRICA: Prisma.ProdTiendaWhereInput = {
  rubro: { equals: "Tintometrico", mode: "insensitive" },
};

/**
 * Catálogo del modal «Agregar Tintométrico» (Pedir Mercadería): bases `prod_tienda` rubro Tintometrico
 * con marca vinculada + marcas presentes en esas bases con sus formatos de código.
 */
export async function getCatalogoAgregarTintometrico(): Promise<{
  marcas: MarcaTintometricaCatalogo[];
  bases: BaseTintometricaCatalogo[];
}> {
  const rows = await prisma.prodTienda.findMany({
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
            tintometricoFormatos: { select: { formatoCod: true }, orderBy: { createdAt: "asc" } },
          },
          orderBy: { nombre: "asc" },
        })
      : [];
  return {
    marcas: marcas.map((m) => ({
      idMarca: m.id,
      nombre: m.nombre,
      formatos: m.tintometricoFormatos.map((f) => f.formatoCod),
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
  const andParts: Prisma.ProdTiendaWhereInput[] = [
    { rubro: { equals: "Tintometrico", mode: "insensitive" as const } },
  ];

  if (query.length >= 3) {
    const tokens = query.split(/\s+/).filter(Boolean);
    if (tokens.length > 0) {
      andParts.push({
        AND: tokens.map((t) => ({
          OR: [
            { descripcionTienda: { contains: t, mode: "insensitive" as const } },
            { codTienda: { contains: t, mode: "insensitive" as const } },
            { marca: { contains: t, mode: "insensitive" as const } },
          ],
        })),
      });
    }
  }

  const where: Prisma.ProdTiendaWhereInput = andParts.length ? { AND: andParts } : {};

  const [rows, total] = await Promise.all([
    prisma.prodTienda.findMany({
      where,
      select: {
        codTienda: true,
        descripcionTienda: true,
        marca: true,
        rubro: true,
      },
      orderBy: [{ descripcionTienda: "asc" }, { codTienda: "asc" }],
      take,
    }),
    prisma.prodTienda.count({ where }),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.codTienda,
      codTienda: r.codTienda,
      descripcionTienda: (r.descripcionTienda ?? "").trim(),
      marca: r.marca ?? null,
      rubro: r.rubro ?? null,
    })),
    total,
  };
}

