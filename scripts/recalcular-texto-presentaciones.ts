/**
 * Ejecución única: vuelve a armar `prod_presentaciones.texto` con la unidad actual de
 * `prod_un_medida` (nombre + posición) y el número guardado. Conserva el literal escrito si el
 * texto viejo lo tiene (`080`). Si algún cambio dejaría dos presentaciones con el mismo texto,
 * no aplica nada y lista los conflictos.
 *
 * Uso:
 *   npx tsx scripts/recalcular-texto-presentaciones.ts            (simulación)
 *   npx tsx scripts/recalcular-texto-presentaciones.ts --execute  (aplica)
 */
import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import {
  aplicarCambiosTextoPresentaciones,
  planificarTextosPresentaciones,
} from "@/services/estPorProdPresentacion.service";

async function main(): Promise<void> {
  const execute = process.argv.slice(2).includes("--execute");

  console.log("── Recalcular texto de prod_presentaciones desde prod_un_medida ──");
  console.log(execute ? "Modo: EJECUCIÓN" : "Modo: simulación (agregá --execute para aplicar)");

  const total = await prisma.prodPresentacion.count();
  const { cambios, conflictos } = await planificarTextosPresentaciones();

  console.log(`Presentaciones: ${total}`);
  console.log(`Sin cambios: ${total - cambios.length}`);
  console.log(`A cambiar: ${cambios.length}`);
  for (const c of cambios) console.log(`  ${c.antes}  →  ${c.despues}`);

  if (conflictos.length > 0) {
    console.log(`Conflictos (texto duplicado): ${conflictos.length}`);
    for (const c of conflictos) {
      console.log(`  ${c.antes}  →  ${c.despues}  (choca con «${c.conflictoCon}»)`);
    }
    console.log("No se aplica nada hasta resolver los conflictos.");
    return;
  }

  if (!execute || cambios.length === 0) return;

  await prisma.$transaction((tx) => aplicarCambiosTextoPresentaciones(tx, cambios), {
    timeout: 60_000,
  });
  console.log(`Actualizadas: ${cambios.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
