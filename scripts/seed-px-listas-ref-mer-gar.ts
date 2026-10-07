/**
 * One-shot: configura REF. (1 - GENERAL) en Px Listas según vínculo MER → GAR.
 *
 * Prioridad:
 *   1) Si el ítem tiene proveedor MER vinculado y precio de referencia > 0 → REF = competidor MER
 *   2) Si no, y tiene GAR vinculado con precio > 0 → REF = competidor GAR
 *   3) Si no aplica → se omite
 *
 * Sobre-escribe `competencia_id_px_lista_general` y copia PX a staging (misma lógica UI).
 *
 * Uso:
 *   npx tsx scripts/seed-px-listas-ref-mer-gar.ts
 *   npx tsx scripts/seed-px-listas-ref-mer-gar.ts --execute
 *   npm run db:seed-px-listas-ref-mer-gar
 *   npm run db:seed-px-listas-ref-mer-gar -- --execute
 */
import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { roundPxListaEntero } from "../src/lib/pxListasPreciosFormat";
import { guardarCompetenciaRefPxListaGeneral } from "../src/services/pxListasCompetenciaRef.service";

const PREFIJOS_PRIORIDAD = ["MER", "GAR"] as const;
const PROGRESS_EVERY = 100;

type CompetenciaResuelta = {
  prefijo: string;
  proveedorId: string;
  proveedorNombre: string;
  competenciaId: string;
  competenciaNombre: string;
};

type PlanItem = {
  codTienda: string;
  elegido: CompetenciaResuelta;
  pxRef: number;
  fkActual: string | null;
};

function parseArgs(argv: string[]): { execute: boolean } {
  let execute = false;
  for (const arg of argv) {
    if (arg === "--execute") {
      execute = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(
        "Uso: tsx scripts/seed-px-listas-ref-mer-gar.ts [--execute]\n" +
          "  Sin --execute: dry-run (solo reporte).\n" +
          "  Con --execute: persiste FK + PX staging de 1 - GENERAL."
      );
      process.exit(0);
    }
  }
  return { execute };
}

async function resolverCompetenciaPorPrefijo(
  prefijo: string
): Promise<CompetenciaResuelta | null> {
  const proveedor = await prisma.proveedor.findFirst({
    where: { prefijo: { equals: prefijo, mode: "insensitive" } },
    select: { id: true, nombre: true, prefijo: true },
  });
  if (!proveedor) {
    console.warn(`⚠ Proveedor con prefijo ${prefijo} no encontrado.`);
    return null;
  }

  const competencias = await prisma.prodCompetencia.findMany({
    where: { idProveedor: proveedor.id },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
  if (competencias.length === 0) {
    console.warn(
      `⚠ No hay prod_competencia con id_proveedor = ${proveedor.nombre} (${prefijo}).`
    );
    return null;
  }
  if (competencias.length > 1) {
    console.warn(
      `⚠ Varios competidores para ${prefijo}; se usa el primero: ${competencias
        .map((c) => c.nombre)
        .join(", ")}`
    );
  }

  const competencia = competencias[0]!;
  return {
    prefijo: (proveedor.prefijo ?? prefijo).toUpperCase(),
    proveedorId: proveedor.id,
    proveedorNombre: proveedor.nombre,
    competenciaId: competencia.id,
    competenciaNombre: competencia.nombre,
  };
}

/** Clave `codTienda:proveedorId` → px sugerido entero. */
async function buildMapPxSugerido(
  codTiendas: string[],
  proveedorIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (codTiendas.length === 0 || proveedorIds.length === 0) return map;

  const rows = await prisma.listaPrecioProveedor.findMany({
    where: {
      codTiendaVinculo: { in: codTiendas },
      idProveedor: { in: proveedorIds },
      habilitado: true,
      pxVtaSugerido: { not: null, gt: 0 },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      codTiendaVinculo: true,
      idProveedor: true,
      pxVtaSugerido: true,
    },
  });

  for (const row of rows) {
    const cod = row.codTiendaVinculo;
    if (!cod || row.pxVtaSugerido == null) continue;
    const key = `${cod}:${row.idProveedor}`;
    if (map.has(key)) continue;
    const n = Number(row.pxVtaSugerido);
    if (Number.isFinite(n) && n > 0) map.set(key, roundPxListaEntero(n));
  }
  return map;
}

/** Clave `codTienda:competenciaId` → px scraping entero. */
async function buildMapPxScraping(
  codTiendas: string[],
  competenciaIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (codTiendas.length === 0 || competenciaIds.length === 0) return map;

  const rows = await prisma.prodPrecioCompetencia.findMany({
    where: {
      codTienda: { in: codTiendas },
      competenciaId: { in: competenciaIds },
      pxCompetencia: { not: null, gt: 0 },
    },
    select: {
      codTienda: true,
      competenciaId: true,
      pxCompetencia: true,
    },
  });

  for (const row of rows) {
    if (row.pxCompetencia == null) continue;
    const n = Number(row.pxCompetencia);
    if (!Number.isFinite(n) || n <= 0) continue;
    map.set(
      `${row.codTienda}:${row.competenciaId}`,
      roundPxListaEntero(n)
    );
  }
  return map;
}

function resolverPxDesdeMaps(
  codTienda: string,
  candidato: CompetenciaResuelta,
  sugeridoMap: Map<string, number>,
  scrapMap: Map<string, number>
): number | null {
  const sugerido =
    sugeridoMap.get(`${codTienda}:${candidato.proveedorId}`) ?? null;
  if (sugerido != null && sugerido > 0) return sugerido;
  const scrap =
    scrapMap.get(`${codTienda}:${candidato.competenciaId}`) ?? null;
  if (scrap != null && scrap > 0) return scrap;
  return null;
}

async function main(): Promise<void> {
  const { execute } = parseArgs(process.argv.slice(2));

  console.log("── Seed REF. Px Listas (MER → GAR) ──");
  console.log(execute ? "Modo: EXECUTE (escribe BD)" : "Modo: DRY-RUN (sin escribir)");

  const resueltos: CompetenciaResuelta[] = [];
  for (const prefijo of PREFIJOS_PRIORIDAD) {
    const r = await resolverCompetenciaPorPrefijo(prefijo);
    if (r) resueltos.push(r);
  }

  if (resueltos.length === 0) {
    throw new Error("No se pudo resolver ningún competidor MER/GAR. Abortado.");
  }

  for (const r of resueltos) {
    console.log(
      `OK ${r.prefijo}: proveedor=${r.proveedorNombre} → competencia=${r.competenciaNombre} (${r.competenciaId})`
    );
  }

  const idsProveedor = resueltos.map((r) => r.proveedorId);
  const idsCompetencia = resueltos.map((r) => r.competenciaId);

  console.log("Cargando vínculos MER/GAR…");
  const vinculos = await prisma.listaPrecioProveedor.findMany({
    where: {
      idProveedor: { in: idsProveedor },
      codTiendaVinculo: { not: null },
      habilitado: true,
    },
    select: {
      codTiendaVinculo: true,
      idProveedor: true,
    },
  });

  const proveedoresPorCod = new Map<string, Set<string>>();
  for (const v of vinculos) {
    const cod = v.codTiendaVinculo;
    if (!cod) continue;
    const set = proveedoresPorCod.get(cod) ?? new Set<string>();
    set.add(v.idProveedor);
    proveedoresPorCod.set(cod, set);
  }

  const codTiendas = [...proveedoresPorCod.keys()].sort();
  console.log(`Ítems prod_propios con vínculo MER y/o GAR: ${codTiendas.length}`);

  console.log("Cargando precios de referencia (lote)…");
  const [sugeridoMap, scrapMap, tiendas] = await Promise.all([
    buildMapPxSugerido(codTiendas, idsProveedor),
    buildMapPxScraping(codTiendas, idsCompetencia),
    prisma.prodPropio.findMany({
      where: { codTienda: { in: codTiendas } },
      select: {
        codTienda: true,
        competenciaIdPxListaGeneral: true,
      },
    }),
  ]);
  const fkActualMap = new Map(
    tiendas.map((t) => [t.codTienda, t.competenciaIdPxListaGeneral])
  );
  console.log(
    `Maps listos: sugeridos=${sugeridoMap.size}, scraping=${scrapMap.size}`
  );

  console.log("Armando plan MER→GAR…");
  const plan: PlanItem[] = [];
  let omitidosSinPx = 0;

  for (let i = 0; i < codTiendas.length; i++) {
    const codTienda = codTiendas[i]!;
    if ((i + 1) % PROGRESS_EVERY === 0 || i + 1 === codTiendas.length) {
      console.log(`  plan ${i + 1}/${codTiendas.length}…`);
    }

    const idsProv = proveedoresPorCod.get(codTienda)!;
    let elegido: CompetenciaResuelta | null = null;
    let pxRef: number | null = null;

    for (const candidato of resueltos) {
      if (!idsProv.has(candidato.proveedorId)) continue;
      const px = resolverPxDesdeMaps(
        codTienda,
        candidato,
        sugeridoMap,
        scrapMap
      );
      if (px == null || !(px > 0)) continue;
      elegido = candidato;
      pxRef = px;
      break;
    }

    if (!elegido || pxRef == null) {
      omitidosSinPx += 1;
      continue;
    }
    if (!fkActualMap.has(codTienda)) {
      omitidosSinPx += 1;
      continue;
    }

    plan.push({
      codTienda,
      elegido,
      pxRef,
      fkActual: fkActualMap.get(codTienda) ?? null,
    });
  }

  let aplicados = 0;
  let errores = 0;
  let yaCorrectos = 0;
  const porPrefijo = new Map<string, number>();

  if (!execute) {
    for (const item of plan) {
      const mismaFk = item.fkActual === item.elegido.competenciaId;
      if (mismaFk) {
        yaCorrectos += 1;
      } else {
        aplicados += 1;
        porPrefijo.set(
          item.elegido.prefijo,
          (porPrefijo.get(item.elegido.prefijo) ?? 0) + 1
        );
      }
    }
  } else {
    console.log(`Aplicando ${plan.length} ítems (puede demorar)…`);
    for (let i = 0; i < plan.length; i++) {
      const item = plan[i]!;
      if ((i + 1) % PROGRESS_EVERY === 0 || i + 1 === plan.length) {
        console.log(`  execute ${i + 1}/${plan.length}…`);
      }

      const mismaFk = item.fkActual === item.elegido.competenciaId;
      const res = await guardarCompetenciaRefPxListaGeneral(
        item.codTienda,
        item.elegido.competenciaId
      );
      if (!res.success) {
        errores += 1;
        console.error(
          `ERROR ${item.codTienda} (${item.elegido.prefijo}): ${res.error}`
        );
        continue;
      }
      if (mismaFk && !res.data.pxActualizado) {
        yaCorrectos += 1;
      } else {
        aplicados += 1;
        porPrefijo.set(
          item.elegido.prefijo,
          (porPrefijo.get(item.elegido.prefijo) ?? 0) + 1
        );
      }
    }
  }

  console.log("── Resumen ──");
  console.log(`Candidatos (vínculo MER/GAR): ${codTiendas.length}`);
  console.log(
    `${execute ? "Aplicados" : "A aplicar"} (precio > 0, FK distinta): ${aplicados}`
  );
  for (const [pref, n] of [...porPrefijo.entries()].sort()) {
    console.log(`  · ${pref}: ${n}`);
  }
  console.log(`Omitidos (sin precio de referencia > 0): ${omitidosSinPx}`);
  console.log(`Ya con misma REF.: ${yaCorrectos}`);
  if (execute) console.log(`Errores: ${errores}`);
  if (!execute) {
    console.log("Dry-run terminado. Reejecutá con --execute para persistir.");
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
