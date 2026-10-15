/**
 * Ejecución única: vincula `prod_lista.id_color` con `prod_colores`
 * usando el mismo match que Estadísticas (`matchColoresEnDescripcion`).
 *
 * La FK admite un solo color: si hay varios matches, se toma el de nombre más largo
 * (el matcher ya los ordena así). Sin coincidencia → `id_color` vacío.
 *
 * Uso:
 *   npx tsx scripts/vincular-color-desde-descripcion.ts            (simulación)
 *   npx tsx scripts/vincular-color-desde-descripcion.ts --execute  (aplica)
 */
import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { matchColoresEnDescripcion } from "@/lib/estPorProdColores";
import { listarEstPorProdColores } from "@/services/estPorProdColores.service";

const EJEMPLOS = 20;
const CHUNK = 400;

type Fila = {
  codTienda: string;
  descripcion: string;
  idColor: string | null;
  colorActual: string | null;
  matchNombre: string;
  matchId: string;
  extras: string;
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main(): Promise<void> {
  const execute = process.argv.slice(2).includes("--execute");

  console.log("── Vincular color desde descripción ──");
  console.log(execute ? "Modo: EJECUCIÓN" : "Modo: simulación (agregá --execute para aplicar)");
  console.log("Match: igual que Estadísticas (MAYÚSCULAS, límite de palabra, nombres más largos primero).");
  console.log("Un color por ítem (el más largo). Sin coincidencia: id_color queda vacío.\n");

  const [colores, nCatalogo, productos] = await Promise.all([
    listarEstPorProdColores(),
    prisma.prodColor.count(),
    prisma.prodPropio.findMany({
      select: {
        codTienda: true,
        descripcionTienda: true,
        idColor: true,
        color: { select: { nombre: true } },
      },
      orderBy: { codTienda: "asc" },
    }),
  ]);

  if (nCatalogo > 0 && colores.length === 0) {
    throw new Error("No se pudo leer el catálogo de colores.");
  }
  if (nCatalogo === 0) {
    console.log("No hay filas en prod_colores. Nada que vincular.");
    return;
  }

  const aVincular: Fila[] = [];
  const yaOk: Fila[] = [];
  const aVaciar: { codTienda: string; descripcion: string; colorActual: string }[] = [];
  const conflicto: Fila[] = [];
  let sinMatch = 0;
  let varios = 0;

  for (const p of productos) {
    const matched = matchColoresEnDescripcion(p.descripcionTienda, colores);
    if (matched.length === 0) {
      sinMatch += 1;
      if (p.idColor) {
        aVaciar.push({
          codTienda: p.codTienda,
          descripcion: p.descripcionTienda ?? "",
          colorActual: p.color?.nombre ?? "",
        });
      }
      continue;
    }
    if (matched.length > 1) varios += 1;
    const elegido = matched[0];
    const fila: Fila = {
      codTienda: p.codTienda,
      descripcion: p.descripcionTienda ?? "",
      idColor: p.idColor,
      colorActual: p.color?.nombre ?? null,
      matchNombre: elegido.nombre,
      matchId: elegido.id,
      extras: matched
        .slice(1)
        .map((c) => c.nombre)
        .join(" · "),
    };
    if (!p.idColor) {
      aVincular.push(fila);
    } else if (p.idColor === elegido.id) {
      yaOk.push(fila);
    } else {
      conflicto.push(fila);
    }
  }

  console.log(`Catálogo colores: ${nCatalogo}`);
  console.log(`Productos: ${productos.length}`);
  console.log(`Sin coincidencia (quedan vacíos): ${sinMatch}`);
  console.log(`De esos, a vaciar (tenían color): ${aVaciar.length}`);
  console.log(`Con más de un color en la descripción (se toma el más largo): ${varios}`);
  console.log(`Ya vinculados (mismo match): ${yaOk.length}`);
  console.log(`Conflicto (ya tienen otro color; no se pisan): ${conflicto.length}`);
  console.log(`A vincular (id_color vacío): ${aVincular.length}`);

  if (conflicto.length > 0) {
    console.log("\nConflictos:");
    for (const f of conflicto) {
      console.log(
        `  ${f.codTienda} | actual=${f.colorActual ?? ""} | match=${f.matchNombre} | ${f.descripcion}`
      );
    }
  }

  console.log(`\nEjemplos a vincular (máx. ${EJEMPLOS}):`);
  for (const f of aVincular.slice(0, EJEMPLOS)) {
    const extra = f.extras ? ` (+ ${f.extras})` : "";
    console.log(`  ${f.codTienda} | ${f.matchNombre}${extra} | ${f.descripcion}`);
  }

  if (!execute) return;
  if (aVincular.length === 0 && aVaciar.length === 0) return;

  let escritos = 0;
  const porColor = new Map<string, string[]>();
  for (const f of aVincular) {
    const ids = porColor.get(f.matchId) ?? [];
    ids.push(f.codTienda);
    porColor.set(f.matchId, ids);
  }
  for (const [idColor, codigos] of porColor) {
    for (const lote of chunk(codigos, CHUNK)) {
      const res = await prisma.prodPropio.updateMany({
        where: { codTienda: { in: lote }, idColor: null },
        data: { idColor },
      });
      escritos += res.count;
    }
  }

  let vaciados = 0;
  for (const lote of chunk(
    aVaciar.map((f) => f.codTienda),
    CHUNK
  )) {
    const res = await prisma.prodPropio.updateMany({
      where: { codTienda: { in: lote } },
      data: { idColor: null },
    });
    vaciados += res.count;
  }

  console.log(`\nVinculados: ${escritos}`);
  console.log(`Vaciados (sin coincidencia): ${vaciados}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
