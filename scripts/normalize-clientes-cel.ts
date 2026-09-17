/**
 * One-shot: deja `clientes.cel` solo con dígitos (sin espacios, guiones ni otros signos).
 *
 * Uso:
 *   npm run db:normalize-clientes-cel
 *   npm run db:normalize-clientes-cel -- --execute
 */
import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { normalizarCelCliente } from "../src/lib/envios";

type CelSucio = {
  id: string;
  cel: string;
  nombreCompleto: string;
};

function parseArgs(argv: string[]): { execute: boolean } {
  let execute = false;
  for (const arg of argv) {
    if (arg === "--execute") execute = true;
    if (arg === "--help" || arg === "-h") {
      console.log("Uso: tsx scripts/normalize-clientes-cel.ts [--execute]");
      process.exit(0);
    }
  }
  return { execute };
}

async function listarCelsSucios(): Promise<CelSucio[]> {
  return prisma.$queryRaw<CelSucio[]>`
    SELECT id, cel, nombre_completo AS "nombreCompleto"
    FROM clientes
    WHERE cel ~ '[^0-9]'
    ORDER BY nombre_completo ASC, id ASC
  `;
}

async function main(): Promise<void> {
  const { execute } = parseArgs(process.argv.slice(2));

  console.log("── Normalizar clientes.cel (solo dígitos) ──");
  console.log(
    execute
      ? "Modo: EJECUCIÓN"
      : "Modo: simulación (agregá --execute para aplicar)"
  );

  const sucios = await listarCelsSucios();
  console.log(`Filas con caracteres no numéricos: ${sucios.length}`);

  const muestras = sucios.slice(0, 20);
  for (const row of muestras) {
    console.log(`  ${row.cel} → ${normalizarCelCliente(row.cel)}`);
  }
  if (sucios.length > muestras.length) {
    console.log(`  … y ${sucios.length - muestras.length} más`);
  }

  if (!execute) {
    if (sucios.length > 0) {
      console.log("Para aplicar: npm run db:normalize-clientes-cel -- --execute");
    }
    return;
  }

  if (sucios.length === 0) {
    console.log("Nada para actualizar.");
    return;
  }

  const actualizados = await prisma.$executeRaw`
    UPDATE clientes
    SET cel = regexp_replace(cel, '[^0-9]', '', 'g')
    WHERE cel ~ '[^0-9]'
  `;
  const restantes = await listarCelsSucios();
  console.log(`Actualizadas: ${actualizados}`);
  console.log(`Restantes con no dígitos: ${restantes.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
