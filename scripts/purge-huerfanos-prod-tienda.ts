/**
 * Limpia filas huérfanas: referencias a `cod_tienda` sin fila en `prod_lista`.
 *
 * Uso:
 *   npm run db:purge-huerfanos-prod-tienda
 *   npm run db:purge-huerfanos-prod-tienda -- --execute
 *   npm run db:purge-huerfanos-prod-tienda -- --execute --incluir-historial
 */
import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { limpiarHuerfanosProdTienda } from "@/services/limpiarHuerfanosProdTienda.service";

function parseArgs(argv: string[]): { execute: boolean; incluirHistorial: boolean } {
  let execute = false;
  let incluirHistorial = false;

  for (const arg of argv) {
    if (arg === "--execute") execute = true;
    if (arg === "--incluir-historial") incluirHistorial = true;
    if (arg === "--help" || arg === "-h") {
      console.log(
        "Uso: tsx scripts/purge-huerfanos-prod-tienda.ts [--execute] [--incluir-historial]"
      );
      process.exit(0);
    }
  }

  return { execute, incluirHistorial };
}

async function main(): Promise<void> {
  const { execute, incluirHistorial } = parseArgs(process.argv.slice(2));

  console.log("── Limpieza huérfanos prod_lista ──");
  console.log(
    execute
      ? "Modo: EJECUCIÓN"
      : "Modo: simulación (agregá --execute para aplicar)"
  );
  if (incluirHistorial) {
    console.log("Incluye: prod_ped_historial_merc");
  }

  const resultados = await limpiarHuerfanosProdTienda({ execute, incluirHistorial });

  let totalCandidatos = 0;
  let totalAplicados = 0;

  for (const r of resultados) {
    totalCandidatos += r.candidatos;
    totalAplicados += r.aplicados;
    const accionLabel = r.accion === "delete" ? "DELETE" : "SET NULL";
    console.log(
      `${r.tabla} (${r.columna}) [${accionLabel}]: ${r.candidatos} huérfano(s)` +
        (execute ? ` → ${r.aplicados} aplicado(s)` : "")
    );
    if (r.candidatos > 0) {
      console.log(`  └ ${r.descripcion}`);
    }
  }

  console.log("");
  console.log(`Total candidatos: ${totalCandidatos}`);
  if (execute) {
    console.log(`Total aplicados: ${totalAplicados}`);
  } else if (totalCandidatos > 0) {
    console.log("Para aplicar: npm run db:purge-huerfanos-prod-tienda -- --execute");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
