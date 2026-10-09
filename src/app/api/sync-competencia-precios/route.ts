import { NextResponse } from "next/server";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { revalidatePath } from "next/cache";
import { guardCompetenciaPreciosSyncEsEditor } from "@/lib/apiRouteAuth";
import { syncCompetenciaPreciosBodySchema } from "@/lib/validations/competenciaPrecios";
import { prisma } from "@/lib/prisma";
import {
  syncCompetenciaPrecios,
  SyncCompetenciaPreciosCancelledError,
} from "@/services/syncCompetenciaPrecios.service";
import { countVinculosRelevablesCompetencia } from "@/services/competenciaPxSugerido.service";
import {
  setCompetenciaSyncErrorInDb,
  setCompetenciaSyncProgressInDb,
  setCompetenciaSyncResultInDb,
  startCompetenciaSyncInDb,
  getCompetenciaSyncProgressFromDb,
  clearCompetenciaSyncRunningStateInDb,
} from "@/lib/competenciaPreciosProgressDb";

export const maxDuration = 300;

let syncInProgress = false;

/**
 * POST: sincroniza precios de competencia (px_vta_sugerido del proveedor asociado o scraping).
 * Body: { competenciaId } o { todos: true }; { codTienda? } opcional para un solo ítem.
 */
export async function POST(request: Request) {
  const denied = await guardCompetenciaPreciosSyncEsEditor();
  if (denied) return denied;

  const current = await getCompetenciaSyncProgressFromDb();
  if (syncInProgress || current.running) {
    return NextResponse.json(
      { ok: false, error: "Sincronización de competencia ya en curso." },
      { status: 409 }
    );
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "Body JSON inválido." }, { status: 400 });
  }

  const parsed = syncCompetenciaPreciosBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Parámetros inválidos." }, { status: 400 });
  }

  const codTienda = parsed.data.codTienda;
  const limiteProductos = parsed.data.limiteProductos;

  type CompetidorSync = {
    id: string;
    nombre: string;
    idProveedor: string | null;
    totalEnBd: number;
  };

  let competidoresSync: CompetidorSync[] = [];

  if (parsed.data.todos === true) {
    const todos = await prisma.prodCompetencia.findMany({
      select: { id: true, nombre: true, idProveedor: true },
      orderBy: { nombre: "asc" },
    });
    for (const c of todos) {
      const totalEnBd = await countVinculosRelevablesCompetencia({
        competenciaId: c.id,
        idProveedor: c.idProveedor,
        codTienda,
      });
      if (totalEnBd > 0) {
        competidoresSync.push({
          id: c.id,
          nombre: c.nombre,
          idProveedor: c.idProveedor,
          totalEnBd,
        });
      }
    }
    if (competidoresSync.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No hay productos con URL cargada ni con Px. Vta. Sugerido para comparar. Asigná URLs o configurá el proveedor asociado.",
        },
        { status: 400 }
      );
    }
  } else {
    const competidor = await prisma.prodCompetencia.findUnique({
      where: { id: parsed.data.competenciaId! },
      select: { id: true, nombre: true, idProveedor: true },
    });
    if (!competidor) {
      return NextResponse.json({ ok: false, error: "Competidor no encontrado." }, { status: 404 });
    }
    const totalEnBd = await countVinculosRelevablesCompetencia({
      competenciaId: competidor.id,
      idProveedor: competidor.idProveedor,
      codTienda,
    });
    if (totalEnBd === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No hay productos con URL cargada ni con Px. Vta. Sugerido para este competidor.",
        },
        { status: 400 }
      );
    }
    competidoresSync = [
      {
        id: competidor.id,
        nombre: competidor.nombre,
        idProveedor: competidor.idProveedor,
        totalEnBd,
      },
    ];
  }

  const limite = limiteProductos;
  const totalPairs = competidoresSync.reduce((acc, c) => {
    const t =
      limite != null && limite > 0 ? Math.min(c.totalEnBd, limite) : c.totalEnBd;
    return acc + t;
  }, 0);

  syncInProgress = true;
  await startCompetenciaSyncInDb(totalPairs);

  try {
    let processedOffset = 0;
    let encontrados = 0;
    let vacios = 0;
    let errores = 0;
    let desdeSugerido = 0;
    let procesados = 0;

    for (const competidor of competidoresSync) {
      const result = await syncCompetenciaPrecios({
        codTienda,
        competenciaId: competidor.id,
        idProveedor: competidor.idProveedor,
        limiteProductos,
        onProgress(processed, _total) {
          void setCompetenciaSyncProgressInDb(processedOffset + processed, totalPairs);
        },
      });
      processedOffset += result.procesados;
      procesados += result.procesados;
      encontrados += result.encontrados;
      vacios += result.vacios;
      errores += result.errores;
      desdeSugerido += result.desdeSugerido;
    }

    const result = { procesados, encontrados, vacios, errores, desdeSugerido };

    await setCompetenciaSyncResultInDb({
      encontrados: result.encontrados,
      vacios: result.vacios,
      errores: result.errores,
    });
    revalidatePath(GP_ROUTES.analisisPrecios.pxCompetencia);
    const competenciaNombre =
      parsed.data.todos === true
        ? `Todos (${competidoresSync.length} competidores)`
        : competidoresSync[0]!.nombre;
    return NextResponse.json({
      ok: true,
      todos: parsed.data.todos === true,
      competenciaId: parsed.data.todos === true ? null : competidoresSync[0]!.id,
      competenciaNombre,
      competidoresProcesados: competidoresSync.length,
      ...result,
    });
  } catch (e) {
    if (e instanceof SyncCompetenciaPreciosCancelledError) {
      await clearCompetenciaSyncRunningStateInDb();
      return NextResponse.json(
        { ok: false, cancelled: true, error: e.message },
        { status: 200 }
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    await setCompetenciaSyncErrorInDb(message);
    console.error("Error sync competencia precios:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    syncInProgress = false;
  }
}
