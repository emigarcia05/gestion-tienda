/**
 * Elimina filas de `prod_precios_provee` de un proveedor que no tienen vínculo
 * manual con `prod_propios` (`cod_tienda` IS NULL).
 *
 * Uso:
 *   npm run db:purge-lista-precio-sin-vinculo -- --proveedor "EL GARAGE REFINISH CENTER S. A. S."
 *   npm run db:purge-lista-precio-sin-vinculo -- --proveedor "..." --execute
 */
import "dotenv/config";

import { prisma } from "../src/lib/prisma";

const PROVEEDOR_DEFAULT = "EL GARAGE REFINISH CENTER S. A. S.";

function parseArgs(argv: string[]): { proveedorNombre: string; execute: boolean } {
  let proveedorNombre = PROVEEDOR_DEFAULT;
  let execute = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--execute") {
      execute = true;
      continue;
    }
    if (arg === "--proveedor" && argv[i + 1]) {
      proveedorNombre = argv[++i]!.trim();
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(`Uso: tsx scripts/purge-lista-precio-proveedor-sin-vinculo-tienda.ts [--proveedor "NOMBRE"] [--execute]`);
      process.exit(0);
    }
  }

  if (!proveedorNombre) {
    throw new Error("Falta el nombre del proveedor (--proveedor).");
  }

  return { proveedorNombre, execute };
}

async function main(): Promise<void> {
  const { proveedorNombre, execute } = parseArgs(process.argv.slice(2));

  try {
    const proveedor = await prisma.proveedor.findFirst({
      where: { nombre: { equals: proveedorNombre, mode: "insensitive" } },
      select: { id: true, nombre: true, prefijo: true },
    });

    if (!proveedor) {
      throw new Error(`Proveedor no encontrado: "${proveedorNombre}"`);
    }

    const [total, conVinculo, candidatos] = await Promise.all([
      prisma.listaPrecioProveedor.count({ where: { idProveedor: proveedor.id } }),
      prisma.listaPrecioProveedor.count({
        where: { idProveedor: proveedor.id, codTiendaVinculo: { not: null } },
      }),
      prisma.listaPrecioProveedor.findMany({
        where: { idProveedor: proveedor.id, codTiendaVinculo: null },
        select: { codExt: true },
      }),
    ]);

    const codExts = candidatos.map((c) => c.codExt);
    const aEliminar = codExts.length;

    console.log("── Purga lista precios sin vínculo tienda ──");
    console.log(`Proveedor: ${proveedor.nombre} (prefijo: ${proveedor.prefijo ?? "—"})`);
    console.log(`Total ítems en prod_precios_provee: ${total}`);
    console.log(`Con cod_tienda (se conservan): ${conVinculo}`);
    console.log(`Sin cod_tienda (candidatos a borrar): ${aEliminar}`);

    if (aEliminar === 0) {
      console.log("Nada que eliminar.");
      return;
    }

    const [comoCostoCx, enPedidoUrgente] = await Promise.all([
      prisma.prodPropio.count({
        where: { costoCompraCodExt: { in: codExts } },
      }),
      prisma.prodPedMerc2.count({
        where: { urgenteCodExt: { in: codExts } },
      }),
    ]);

    if (comoCostoCx > 0) {
      console.log(
        `⚠ ${comoCostoCx} fila(s) prod_propios usan estos cod_ext como costo_compra_cod_ext (FK → SET NULL al borrar).`
      );
    }
    if (enPedidoUrgente > 0) {
      console.log(
        `⚠ ${enPedidoUrgente} fila(s) prod_ped_merc referencian urgente_cod_ext (sin FK; quedarán huérfanas).`
      );
    }

    if (!execute) {
      console.log("\nModo simulación. Para borrar, agregá --execute");
      console.log("Ejemplo:");
      console.log(
        `  npm run db:purge-lista-precio-sin-vinculo -- --proveedor "${proveedor.nombre}" --execute`
      );
      return;
    }

    const CHUNK = 500;
    let eliminados = 0;

    for (let i = 0; i < codExts.length; i += CHUNK) {
      const chunk = codExts.slice(i, i + CHUNK);
      const result = await prisma.listaPrecioProveedor.deleteMany({
        where: {
          idProveedor: proveedor.id,
          codTiendaVinculo: null,
          codExt: { in: chunk },
        },
      });
      eliminados += result.count;
      console.log(`Progreso: ${Math.min(i + CHUNK, codExts.length)} / ${codExts.length}`);
    }

    const restantes = await prisma.listaPrecioProveedor.count({
      where: { idProveedor: proveedor.id },
    });

    console.log(`\n✓ Eliminados: ${eliminados}`);
    console.log(`Ítems restantes del proveedor: ${restantes} (todos con cod_tienda o 0)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
