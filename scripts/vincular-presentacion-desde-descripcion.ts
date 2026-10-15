/**
 * Ejecución única: vincula `prod_lista.id_presentacion` con `prod_presentaciones`
 * usando el mismo match que Estadísticas (`matchPresentacionEnDescripcion`).
 *
 * Match → escribe `id_presentacion`. Sin coincidencia → deja `id_presentacion` vacío
 * (y lo limpia si tenía un valor). No inventa presentación.
 *
 * Uso:
 *   npx tsx scripts/vincular-presentacion-desde-descripcion.ts            (simulación)
 *   npx tsx scripts/vincular-presentacion-desde-descripcion.ts --execute  (aplica)
 */
import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { matchPresentacionEnDescripcion } from "@/lib/estPorProdPresentacion";
import { listarEstPorProdPresentaciones } from "@/services/estPorProdPresentacion.service";

const EJEMPLOS = 20;
const CHUNK = 400;

type Fila = {
  codTienda: string;
  descripcion: string;
  idPresentacion: string | null;
  presentacionActual: string | null;
  matchTexto: string;
  matchId: string;
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main(): Promise<void> {
  const execute = process.argv.slice(2).includes("--execute");

  console.log("── Vincular presentación desde descripción ──");
  console.log(execute ? "Modo: EJECUCIÓN" : "Modo: simulación (agregá --execute para aplicar)");
  console.log("Match: igual que Estadísticas (texto más largo, MAYÚSCULAS, límite de palabra).");
  console.log("Sin coincidencia: id_presentacion queda vacío.\n");

  const [presentaciones, nCatalogo, productos] = await Promise.all([
    listarEstPorProdPresentaciones(),
    prisma.prodPresentacion.count(),
    prisma.prodPropio.findMany({
      select: {
        codTienda: true,
        descripcionTienda: true,
        idPresentacion: true,
        presentacion: { select: { texto: true } },
      },
      orderBy: { codTienda: "asc" },
    }),
  ]);

  if (nCatalogo > 0 && presentaciones.length === 0) {
    throw new Error("No se pudo leer el catálogo de presentaciones.");
  }
  if (nCatalogo === 0) {
    console.log("No hay filas en prod_presentaciones. Nada que vincular.");
    return;
  }

  const aVincular: Fila[] = [];
  const yaOk: Fila[] = [];
  const aVaciar: { codTienda: string; descripcion: string; presentacionActual: string }[] = [];
  const conflicto: Fila[] = [];
  let sinMatch = 0;

  for (const p of productos) {
    const matched = matchPresentacionEnDescripcion(p.descripcionTienda, presentaciones);
    if (!matched) {
      sinMatch += 1;
      if (p.idPresentacion) {
        aVaciar.push({
          codTienda: p.codTienda,
          descripcion: p.descripcionTienda ?? "",
          presentacionActual: p.presentacion?.texto ?? "",
        });
      }
      continue;
    }
    const fila: Fila = {
      codTienda: p.codTienda,
      descripcion: p.descripcionTienda ?? "",
      idPresentacion: p.idPresentacion,
      presentacionActual: p.presentacion?.texto ?? null,
      matchTexto: matched.texto,
      matchId: matched.id,
    };
    if (!p.idPresentacion) {
      aVincular.push(fila);
    } else if (p.idPresentacion === matched.id) {
      yaOk.push(fila);
    } else {
      conflicto.push(fila);
    }
  }

  console.log(`Catálogo presentaciones: ${nCatalogo}`);
  console.log(`Productos: ${productos.length}`);
  console.log(`Sin coincidencia (quedan vacíos): ${sinMatch}`);
  console.log(`De esos, a vaciar (tenían presentación): ${aVaciar.length}`);
  console.log(`Ya vinculados (mismo match): ${yaOk.length}`);
  console.log(`Conflicto (ya tienen otra presentación; no se pisan): ${conflicto.length}`);
  console.log(`A vincular (id_presentacion vacío): ${aVincular.length}`);

  if (conflicto.length > 0) {
    console.log("\nConflictos:");
    for (const f of conflicto) {
      console.log(
        `  ${f.codTienda} | actual=${f.presentacionActual ?? ""} | match=${f.matchTexto} | ${f.descripcion}`
      );
    }
  }

  console.log(`\nEjemplos a vincular (máx. ${EJEMPLOS}):`);
  for (const f of aVincular.slice(0, EJEMPLOS)) {
    console.log(`  ${f.codTienda} | ${f.matchTexto} | ${f.descripcion}`);
  }

  if (!execute) return;
  if (aVincular.length === 0 && aVaciar.length === 0) return;

  let escritos = 0;
  const porPresentacion = new Map<string, string[]>();
  for (const f of aVincular) {
    const ids = porPresentacion.get(f.matchId) ?? [];
    ids.push(f.codTienda);
    porPresentacion.set(f.matchId, ids);
  }
  for (const [idPresentacion, codigos] of porPresentacion) {
    for (const lote of chunk(codigos, CHUNK)) {
      const res = await prisma.prodPropio.updateMany({
        where: { codTienda: { in: lote }, idPresentacion: null },
        data: { idPresentacion },
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
      data: { idPresentacion: null },
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
