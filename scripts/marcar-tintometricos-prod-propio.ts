/**
 * Ejecución única: marca como PROD. PROPIO (`prod_lista.es_producto_propio = true`) todos los productos
 * del rubro TINTOMÉTRICO. Omite los que tengan vínculos con proveedores (un propio no admite vínculos).
 *
 * Uso:
 *   npx tsx scripts/marcar-tintometricos-prod-propio.ts            (simulación)
 *   npx tsx scripts/marcar-tintometricos-prod-propio.ts --execute  (aplica)
 */
import "dotenv/config";

import { prisma } from "../src/lib/prisma";

const NOMBRES_RUBRO = ["TINTOMETRICO", "TINTOMÉTRICO"];

async function main(): Promise<void> {
  const execute = process.argv.slice(2).includes("--execute");

  console.log("── Marcar TINTOMÉTRICOS como PROD. PROPIO ──");
  console.log(execute ? "Modo: EJECUCIÓN" : "Modo: simulación (agregá --execute para aplicar)");

  const productos = await prisma.prodPropio.findMany({
    where: { rubroRelation: { nombre: { in: NOMBRES_RUBRO } } },
    select: {
      codTienda: true,
      esProductoPropio: true,
      _count: { select: { listaPreciosProveedores: true } },
    },
    orderBy: { codTienda: "asc" },
  });

  const yaPropios = productos.filter((p) => p.esProductoPropio);
  const conVinculos = productos.filter((p) => !p.esProductoPropio && p._count.listaPreciosProveedores > 0);
  const aMarcar = productos.filter((p) => !p.esProductoPropio && p._count.listaPreciosProveedores === 0);

  console.log(`Productos del rubro: ${productos.length}`);
  console.log(`Ya propios: ${yaPropios.length}`);
  console.log(`Omitidos por tener vínculos: ${conVinculos.length}`);
  for (const p of conVinculos) console.log(`  └ ${p.codTienda}`);
  console.log(`A marcar: ${aMarcar.length}`);

  if (!execute || aMarcar.length === 0) return;

  const res = await prisma.prodPropio.updateMany({
    where: {
      codTienda: { in: aMarcar.map((p) => p.codTienda) },
      esProductoPropio: false,
      listaPreciosProveedores: { none: {} },
    },
    data: { esProductoPropio: true },
  });
  console.log(`Marcados: ${res.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
