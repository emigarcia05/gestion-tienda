import { prisma } from "@/lib/prisma";
import {
  CX_PROD_SELECCION_PROM,
  type CxProdDatosFila,
  type OpcionCostoCxProdProveedor,
} from "@/lib/cxPxTienda";
import {
  costoDesdeCandidato,
  etiquetaProveedorCosto,
  listarCandidatosCostoPorCodTienda,
} from "@/services/costoListaTienda.service";

export type FilaCxProdDb = {
  codTienda: string;
  costoManual: unknown;
  costoCompraCodExt: string | null;
};

type CandidatoCostoVinculo = Awaited<
  ReturnType<typeof listarCandidatosCostoPorCodTienda>
>[number];

async function cargarVinculosCostoPorCodTienda(codTiendas: string[]) {
  if (codTiendas.length === 0) return new Map<string, CandidatoCostoVinculo[]>();

  const vinculos = await prisma.listaPrecioProveedor.findMany({
    where: { codTiendaVinculo: { in: codTiendas }, habilitado: true },
    select: {
      codExt: true,
      codTiendaVinculo: true,
      pxCompraFinalSinIva: true,
      proveedor: { select: { nombre: true, prefijo: true } },
    },
    orderBy: [{ proveedor: { nombre: "asc" } }],
  });

  const vinculosPorTienda = new Map<string, CandidatoCostoVinculo[]>();
  for (const v of vinculos) {
    if (!v.codTiendaVinculo) continue;
    const lista = vinculosPorTienda.get(v.codTiendaVinculo) ?? [];
    lista.push(v);
    vinculosPorTienda.set(v.codTiendaVinculo, lista);
  }
  return vinculosPorTienda;
}

/**
 * CX PROD. para Cx Compra: proveedor elegido (`costo_compra_cod_ext`); sin vínculos → `costo_manual`;
 * con vínculos y sin elección → 0.
 */
export function mapCxProdDesdeCandidatos(
  costoManual: unknown,
  costoCompraCodExt: string | null,
  candidatos: CandidatoCostoVinculo[]
): CxProdDatosFila {
  const opcionesProveedor: OpcionCostoCxProdProveedor[] = candidatos.map((c) => ({
    tipo: "proveedor",
    codExt: c.codExt,
    etiqueta: etiquetaProveedorCosto(c.proveedor.prefijo, c.proveedor.nombre),
    costo: costoDesdeCandidato(c.pxCompraFinalSinIva),
  }));

  const elegido = costoCompraCodExt
    ? opcionesProveedor.find((o) => o.codExt === costoCompraCodExt)
    : undefined;
  if (elegido) {
    return { opcionesProveedor, seleccion: elegido.codExt, costoMostrado: elegido.costo };
  }
  return {
    opcionesProveedor,
    seleccion: CX_PROD_SELECCION_PROM,
    costoMostrado: opcionesProveedor.length === 0 ? Number(costoManual) || 0 : 0,
  };
}

export async function buildCxProdMapDesdeFilas(
  rows: FilaCxProdDb[]
): Promise<Map<string, CxProdDatosFila>> {
  const vinculosPorTienda = await cargarVinculosCostoPorCodTienda(
    rows.map((r) => r.codTienda)
  );
  const map = new Map<string, CxProdDatosFila>();
  for (const r of rows) {
    map.set(
      r.codTienda,
      mapCxProdDesdeCandidatos(
        r.costoManual,
        r.costoCompraCodExt,
        vinculosPorTienda.get(r.codTienda) ?? []
      )
    );
  }
  return map;
}
