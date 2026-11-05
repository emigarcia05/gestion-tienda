import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  REVALIDATE_LISTA_PRECIOS,
  REVALIDATE_LISTA_PROVEEDORES_TABLERO,
} from "@/lib/gestionProductosRoutes";
import { guardListaPreciosImportarEsEditor } from "@/lib/apiRouteAuth";
import { aplicarMapeoListaPrecios } from "@/lib/parsearImport";
import { importarListaPreciosProveedorSchema } from "@/lib/validations/importar";
import * as proveedorService from "@/services/proveedor.service";
import * as listaPreciosService from "@/services/listaPrecios.service";
import {
  startImportInDb,
  setImportProgressInDb,
  setImportResultInDb,
  setImportErrorInDb,
} from "@/lib/importProgressDb";

export const maxDuration = 300;

/**
 * POST: Ejecuta la importación de lista de precios en segundo plano.
 * El cliente puede cerrar el modal y ver el progreso en la sidebar (GET .../status).
 */
export async function POST(request: Request) {
  const denied = await guardListaPreciosImportarEsEditor();
  if (denied) return denied;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body JSON inválido." }, { status: 400 });
  }

  const parsed = importarListaPreciosProveedorSchema.safeParse(rawBody);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg =
      [...Object.values(flat.fieldErrors).flat(), ...flat.formErrors][0] ??
      "Datos de importación inválidos.";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  const { proveedorId, filasCrudas, mapeo, precioEnDolares, habilitado } = parsed.data;

  const proveedores = await proveedorService.getProveedores();
  const proveedor = proveedores.find((p) => p.id === proveedorId);
  if (!proveedor) {
    return NextResponse.json({ ok: false, error: "Proveedor no encontrado." }, { status: 404 });
  }

  const filas = aplicarMapeoListaPrecios(filasCrudas, mapeo);
  if (filas.length === 0) {
    return NextResponse.json({ ok: false, error: "No hay filas válidas para importar." }, { status: 400 });
  }

  await startImportInDb(filas.length);

  try {
    const { creados, actualizados, errores, aumentos } = await listaPreciosService.upsertListaPrecios(
      proveedorId,
      proveedor.prefijo,
      filas,
      precioEnDolares,
      habilitado,
      {
        onProgress(processed, total) {
          void setImportProgressInDb(processed, total);
        },
      }
    );

    await setImportResultInDb(
      { creados, actualizados, eliminados: 0, errores },
      { proveedor: proveedor.nombre, items: aumentos }
    );

    for (const path of REVALIDATE_LISTA_PRECIOS) {
      revalidatePath(path);
    }
    for (const path of REVALIDATE_LISTA_PROVEEDORES_TABLERO) {
      revalidatePath(path);
    }

    return NextResponse.json({ ok: true, creados, actualizados, errores });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await setImportErrorInDb(message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
