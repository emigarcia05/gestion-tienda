import { NextResponse } from "next/server";
import { esEditor, getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";

/** Lectura/descarga de comprobante PDF de Envios. */
export async function guardEnviosLectura(): Promise<NextResponse | null> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.envios.acceso)) {
    return NextResponse.json({ ok: false, error: "Sin permisos para envíos." }, { status: 403 });
  }
  return null;
}

/** Lectura de historial de pedidos (detalle HTTP). */
export async function guardPedidosLectura(): Promise<NextResponse | null> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) {
    return NextResponse.json({ ok: false, error: "Sin permisos para pedidos." }, { status: 403 });
  }
  return null;
}

/** Lista tienda DUX: mismo gate que POST `/api/sync-lista-precios-tienda`. */
export async function guardTiendaListaPreciosSincronizar(): Promise<NextResponse | null> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.tienda.acciones.sincronizar)) {
    return NextResponse.json({ ok: false, error: "Sin permisos para sincronizar." }, { status: 403 });
  }
  return null;
}

/** Sync comprobantes DUX / tesorería: lectura del estado igual que uso en sidebar financiero. */
export async function guardFinanzasLectura(): Promise<NextResponse | null> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    return NextResponse.json({ ok: false, error: "Sin permisos para finanzas." }, { status: 403 });
  }
  return null;
}

/** Sync Fact & Cobros (remitos de venta DUX): escritura editor. */
export async function guardFinanzasEditor(): Promise<NextResponse | null> {
  const denied = await guardFinanzasLectura();
  if (denied) return denied;
  if (!(await esEditor())) {
    return NextResponse.json({ ok: false, error: "Sin permisos de editor." }, { status: 403 });
  }
  return null;
}

/** Sync precios competencia (scraping) + polling de estado. */
export async function guardCompetenciaPreciosSyncEsEditor(): Promise<NextResponse | null> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.competenciaPrecios.editar)) {
    return NextResponse.json(
      { ok: false, error: "Sin permisos para sincronizar precios de competencia." },
      { status: 403 }
    );
  }
  if (!(await esEditor())) {
    return NextResponse.json({ ok: false, error: "Sin permisos de editor." }, { status: 403 });
  }
  return null;
}

/** Import lista precios por API + polling de estado. */
export async function guardListaPreciosImportarEsEditor(): Promise<NextResponse | null> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.listaPrecios.acciones.importarLista)) {
    return NextResponse.json({ ok: false, error: "Sin permisos para importar lista de precios." }, { status: 403 });
  }
  if (!(await esEditor())) {
    return NextResponse.json({ ok: false, error: "Sin permisos de editor." }, { status: 403 });
  }
  return null;
}

/** Import estadísticas por producto (`est_por_prod`). */
export async function guardEstPorProdImportarEsEditor(): Promise<NextResponse | null> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.estadisticasProductos.acceso)) {
    return NextResponse.json(
      { ok: false, error: "Sin permisos para estadísticas de productos." },
      { status: 403 }
    );
  }
  if (!(await esEditor())) {
    return NextResponse.json(
      { ok: false, error: "Solo el modo editor puede importar estadísticas." },
      { status: 403 }
    );
  }
  return null;
}

/** Lectura del indicador Pendientes (slidenav). */
export async function guardIndicadorSlidenavLectura(): Promise<NextResponse | null> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso) && !puede(rol, PERMISOS.stock.acceso)) {
    return NextResponse.json({ ok: false, error: "Sin permisos." }, { status: 403 });
  }
  return null;
}
