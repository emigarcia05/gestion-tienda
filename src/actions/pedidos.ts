"use server";

import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import {
  getListaPreciosParaPedidoUrgente,
  getProveedoresParaPedidoUrgente,
} from "@/services/listaPrecios.service";
import { sumarIvaSaldoAcumuladoParaComparacionProveedoresPedido } from "@/services/finBalPosicionIvaSaldoAcumuladoPedido.service";
import { getPosicionIvaComparacionRevisionToken } from "@/services/finBalPosicionIvaComparacionRevision.service";
import {
  getItemsTablaEnviarPedido,
  getProveedoresConPedidoActivo,
  getItemsYProveedorParaEnviar,
  ajustarCantidadesParaGenerarPedido,
  getReposicionItemsProveedorPrioritarioAlternativo,
  type ReposicionProveedorPrioritarioItem,
  type SucursalPedidoEnvio,
  upsertPedidoMercaderiaUrgenteItem,
  upsertPedidoTintometricoItems,
  deletePedidoTintometricoItem,
  limpiarPedidoMercaderiaTrasGenerarPdf,
  sucursalPedidoHabilitada,
} from "@/services/pedidosEnvio.service";
import { crearPedidoHistoriaSnapshot } from "@/services/pedidosHistoria.service";
import { generarPdfPedido } from "@/lib/generarPdfPedido";
import { formatDdMmHhMmArgentina } from "@/lib/fechaArgentina";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/types";
import { PAGE_SIZE } from "@/lib/pagination";
import { revalidatePedidosMercaderiaListados } from "@/lib/revalidatePedidosMercaderia";
import {
  hayFiltroExtraPedidoUrgente,
  SUCURSAL_LABEL_PEDIDO,
  type SucursalPedido,
} from "@/lib/pedidos";
import {
  getSobreStockOtraSucursalParaPedidoEnviar,
  type SobreStockReposicionItem,
} from "@/services/sobreStock.service";
import {
  getPedidoUrgenteDataParamsSchema,
  getEnviarPedidoDataParamsSchema,
  getEnviarPedidoTablaParamsSchema,
} from "@/lib/validations/pedidosLectura";
import {
  comprobarItemsParaGenerarPedidoSchema,
  deleteTintometricoItemSchema,
  generarPdfEnviarPedidoSchema,
  getReposicionProveedorPrioritarioParaModalSchema,
  getSobreStockReposicionParaModalSchema,
  listarProveedoresConPedidoActivoSchema,
  upsertPedidoTintometricoItemsSchema,
  upsertPedidoUrgenteItemSchema,
} from "@/lib/validations/pedidosMutaciones";

/** Token liviano para polling en pantallas de pedido (cambios en Posición IVA). */
export async function getPosicionIvaComparacionRevisionTokenAction(): Promise<{
  token: string;
}> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) {
    return { token: "" };
  }
  try {
    const token = await getPosicionIvaComparacionRevisionToken();
    return { token };
  } catch {
    return { token: "" };
  }
}

export async function getPedidoUrgenteData(params: {
  sucursal?: string;
  q?: string;
  pagina?: string;
  proveedor?: string;
  pedido?: string;
}) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) {
    return {
      proveedores: [],
      productos: [],
      total: 0,
      totalPaginas: 0,
      ivaSaldoAcumuladoComparacion: 0,
    };
  }

  const parsedParams = getPedidoUrgenteDataParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return {
      proveedores: [],
      productos: [],
      total: 0,
      totalPaginas: 0,
      ivaSaldoAcumuladoComparacion: 0,
    };
  }
  const { sucursal = "", q = "", pagina = "1", proveedor = "", pedido = "" } = parsedParams.data;
  const sucursalValida = sucursal.trim();
  const proveedorValido = proveedor.trim();
  const qValida = q.trim().length >= 3;
  const tieneSucursal = !!sucursalValida;
  const sucursalHabilitada = tieneSucursal
    ? await sucursalPedidoHabilitada(sucursalValida)
    : false;

  const paginaNum = Math.max(1, parseInt(pagina, 10) || 1);
  const pedidoTipo: "cualquier" | "urgente" | "reposicion" | undefined =
    pedido === "cualquier"
      ? "cualquier"
      : pedido === "urgente"
        ? "urgente"
        : pedido === "reposicion"
          ? "reposicion"
          : undefined;
  try {
    const proveedores = await getProveedoresParaPedidoUrgente();

    if (!tieneSucursal || !sucursalHabilitada) {
      return {
        proveedores,
        productos: [],
        total: 0,
        totalPaginas: 0,
        ivaSaldoAcumuladoComparacion: 0,
      };
    }

    if (
      !hayFiltroExtraPedidoUrgente({
        proveedor: proveedorValido,
        pedido,
        q,
      })
    ) {
      return {
        proveedores,
        productos: [],
        total: 0,
        totalPaginas: 0,
        ivaSaldoAcumuladoComparacion: 0,
      };
    }

    try {
      const [result, ivaSaldoAcumuladoComparacion] = await Promise.all([
        getListaPreciosParaPedidoUrgente(
          sucursalValida,
          proveedorValido || undefined,
          pedidoTipo,
          qValida ? q : undefined,
          paginaNum,
          PAGE_SIZE
        ),
        sumarIvaSaldoAcumuladoParaComparacionProveedoresPedido(),
      ]);

      return {
        proveedores,
        productos: result.items,
        total: result.total,
        totalPaginas: result.totalPaginas,
        ivaSaldoAcumuladoComparacion,
      };
    } catch (error: unknown) {
      console.error("[pedidos][getPedidoUrgenteData] lista", error);
      const ivaSaldoAcumuladoComparacion = await sumarIvaSaldoAcumuladoParaComparacionProveedoresPedido();
      return {
        proveedores,
        productos: [],
        total: 0,
        totalPaginas: 0,
        ivaSaldoAcumuladoComparacion,
      };
    }
  } catch (error: unknown) {
    console.error("[pedidos][getPedidoUrgenteData]", error);
    return {
      proveedores: [],
      productos: [],
      total: 0,
      totalPaginas: 0,
      ivaSaldoAcumuladoComparacion: 0,
    };
  }
}

/** Datos iniciales para Generar Pedido: solo proveedores con ítems y cantidad a pedir > 0. */
export async function getEnviarPedidoData(params?: {
  sucursal?: string;
  tipos?: string[];
}) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) {
    return { proveedores: [] };
  }
  const parsed = getEnviarPedidoDataParamsSchema.safeParse(params ?? {});
  if (!parsed.success) {
    return { proveedores: [] };
  }
  const sucursalCodigo = parsed.data.sucursal ?? "";
  const tipos = parsed.data.tipos ?? [];
  const proveedores = await getProveedoresConPedidoActivo({
    sucursalCodigo: sucursalCodigo || undefined,
    tipos,
  });
  return { proveedores };
}

/** Proveedores con pedido activo para el modal Generar Pedido (según sucursal y tipos). */
export async function listarProveedoresConPedidoActivoAction(
  raw: unknown
): Promise<ActionResult<{ proveedores: { id: string; nombre: string; prefijo: string }[] }>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) {
    return { ok: false, error: "Sin permisos para pedidos." };
  }
  const parsed = listarProveedoresConPedidoActivoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos." };
  }
  const { sucursal, tipos, soloNoFabrica } = parsed.data;
  if (!(await sucursalPedidoHabilitada(sucursal))) {
    return { ok: false, error: "La sucursal no está habilitada para pedidos." };
  }
  const proveedores = await getProveedoresConPedidoActivo({
    sucursalCodigo: sucursal,
    tipos,
    soloNoFabrica,
  });
  return { ok: true, data: { proveedores } };
}

/** Ítem de la tabla Generar Pedido: cant_pedir, proveedor y descripción (descripcion_tienda o descripcion_proveedor). */
export type EnviarPedidoTablaItem = {
  cantPedir: number;
  descripcion: string;
  tipoPedido: string;
  sucursal: string;
  proveedor: string;
};

/**
 * Datos de la tabla Generar Pedido. Sin filtros en URL: todos los ítems con cant_pedir > 0.
 * Cada filtro activo (sucursal, proveedor, tipo(s), búsqueda) acota el listado.
 */
export async function getEnviarPedidoTablaData(params: {
  sucursal: string;
  proveedor: string;
  tipos: string[];
  q?: string;
}): Promise<{ items: EnviarPedidoTablaItem[] }> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) {
    return { items: [] };
  }
  const parsed = getEnviarPedidoTablaParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { items: [] };
  }
  const { sucursal, proveedor, tipos, q } = parsed.data;
  const sucursalFiltro = sucursal || undefined;
  if (sucursalFiltro && !(await sucursalPedidoHabilitada(sucursalFiltro))) {
    return { items: [] };
  }
  const tiposFiltro = tipos.length > 0 ? tipos : undefined;
  const { items } = await getItemsTablaEnviarPedido({
    sucursalCodigo: sucursalFiltro,
    proveedorId: proveedor.trim() || undefined,
    tipos: tiposFiltro,
    q,
  });
  return { items };
}

/**
 * Indica si existen ítems con cantidad a pedir > 0 para generar el PDF (misma lógica que la tabla Generar Pedido).
 */
export async function comprobarItemsParaGenerarPedidoAction(
  raw: unknown
): Promise<ActionResult<{ hayItems: boolean }>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) {
    return { ok: false, error: "Sin permisos para pedidos." };
  }
  const parsed = comprobarItemsParaGenerarPedidoSchema.safeParse(raw);
  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    const msg =
      f.proveedorId?.[0] ??
      f.sucursal?.[0] ??
      f.tipos?.[0] ??
      "Datos inválidos para comprobar ítems.";
    return { ok: false, error: msg };
  }
  const { proveedorId, sucursal, tipos } = parsed.data;
  if (!(await sucursalPedidoHabilitada(sucursal))) {
    return { ok: false, error: "La sucursal no está habilitada para pedidos." };
  }
  try {
    const { items } = await getItemsTablaEnviarPedido({
      sucursalCodigo: sucursal,
      proveedorId: proveedorId.trim() || undefined,
      tipos,
    });
    return { ok: true, data: { hayItems: items.length > 0 } };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al comprobar ítems del pedido.";
    return { ok: false, error: message };
  }
}

export async function getSobreStockReposicionParaModalAction(
  raw: unknown
): Promise<
  ActionResult<{
    tieneSobreStock: boolean;
    items: SobreStockReposicionItem[];
  }>
> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) {
    return { ok: false, error: "Sin permisos para pedidos." };
  }

  const parsed = getSobreStockReposicionParaModalSchema.safeParse(raw);
  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    const msg =
      f.proveedorId?.[0] ??
      f.sucursal?.[0] ??
      f.tipos?.[0] ??
      "Datos inválidos para obtener sobrestock.";
    return { ok: false, error: msg };
  }

  const { proveedorId, sucursal, tipos, forzarIdsReposicionAlProveedor } = parsed.data;
  if (!(await sucursalPedidoHabilitada(sucursal))) {
    return { ok: false, error: "La sucursal no está habilitada para pedidos." };
  }

  const getItemsOpts =
    (forzarIdsReposicionAlProveedor?.length ?? 0) > 0
      ? { forzarIdsReposicionAlProveedor: new Set(forzarIdsReposicionAlProveedor) }
      : undefined;

  const { rows } = await getItemsYProveedorParaEnviar(
    proveedorId.trim(),
    sucursal,
    tipos,
    undefined,
    getItemsOpts
  );
  const res = await getSobreStockOtraSucursalParaPedidoEnviar({
    proveedorId: proveedorId.trim(),
    sucursal,
    filas: rows,
  });

  return { ok: true, data: res };
}

export async function getReposicionProveedorPrioritarioParaModalAction(
  raw: unknown
): Promise<
  ActionResult<{
    tieneItems: boolean;
    items: ReposicionProveedorPrioritarioItem[];
  }>
> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) {
    return { ok: false, error: "Sin permisos para pedidos." };
  }

  const parsed = getReposicionProveedorPrioritarioParaModalSchema.safeParse(raw);
  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    const msg =
      f.proveedorId?.[0] ??
      f.sucursal?.[0] ??
      "Datos inválidos para obtener ítems de reposición.";
    return { ok: false, error: msg };
  }

  const { proveedorId, sucursal } = parsed.data;
  if (!(await sucursalPedidoHabilitada(sucursal))) {
    return { ok: false, error: "La sucursal no está habilitada para pedidos." };
  }

  const items = await getReposicionItemsProveedorPrioritarioAlternativo({
    proveedorSeleccionadoId: proveedorId.trim(),
    sucursalCodigo: sucursal as SucursalPedidoEnvio,
  });

  return {
    ok: true,
    data: {
      tieneItems: items.length > 0,
      items,
    },
  };
}

export async function upsertPedidoUrgenteMercaderiaItemAction(raw: unknown): Promise<ActionResult<void>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) {
    return { ok: false, error: "Sin permisos para pedidos." };
  }
  const parsed = upsertPedidoUrgenteItemSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    const first = Object.values(msg).flat().find(Boolean);
    return { ok: false, error: (first as string) ?? "Datos inválidos." };
  }
  if (!(await sucursalPedidoHabilitada(parsed.data.sucursal))) {
    return { ok: false, error: "La sucursal no está habilitada para pedidos." };
  }

  const result = await upsertPedidoMercaderiaUrgenteItem({
    sucursal: parsed.data.sucursal,
    listaPrecioProveedorId: parsed.data.listaPrecioProveedorId,
    cant: parsed.data.cant,
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: undefined };
}

const TIPO_LABEL: Record<string, string> = {
  URGENTE: "Urgente",
  TINTOMETRICO: "Tintométrico",
  REPOSICION: "Reposición",
  "A FÁBRICA": "A Fábrica",
};

export async function upsertPedidoTintometricoItemsAction(
  raw: unknown
): Promise<ActionResult<{ actualizados: number }>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) {
    return { ok: false, error: "Sin permisos para pedidos." };
  }

  const parsed = upsertPedidoTintometricoItemsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Datos de ítems tintométricos inválidos." };
  }

  const sucursal = parsed.data[0].sucursalCodigo;
  const todosMismaSucursal = parsed.data.every((i) => i.sucursalCodigo === sucursal);
  if (!todosMismaSucursal) {
    return { ok: false, error: "Todos los ítems deben ser de la misma sucursal." };
  }
  if (!(await sucursalPedidoHabilitada(sucursal))) {
    return { ok: false, error: "La sucursal no está habilitada para pedidos." };
  }

  const { actualizados, error } = await upsertPedidoTintometricoItems(
    sucursal,
    parsed.data
  );
  if (error) {
    return { ok: false, error };
  }
  return { ok: true, data: { actualizados } };
}

export async function deletePedidoTintometricoItemAction(
  raw: unknown
): Promise<ActionResult<void>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) {
    return { ok: false, error: "Sin permisos para pedidos." };
  }

  const parsed = deleteTintometricoItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos para borrar el ítem." };
  }
  if ("sucursalCodigo" in parsed.data) {
    if (!(await sucursalPedidoHabilitada(parsed.data.sucursalCodigo))) {
      return { ok: false, error: "La sucursal no está habilitada para pedidos." };
    }
  }

  const result =
    "id" in parsed.data
      ? await deletePedidoTintometricoItem({ id: parsed.data.id })
      : await deletePedidoTintometricoItem(parsed.data);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, data: undefined };
}

/** Genera el PDF del pedido y limpia ítems enviados según el flujo del módulo. */
export async function generarPdfEnviarPedidoAction(raw: unknown): Promise<
  ActionResult<{
    pdfBase64: string;
    whatsapp: string | null;
    nombreProveedor: string;
    filename: string;
    /** true si se envió por API (no hace falta descargar ni abrir wa.me). */
    sentViaWhatsApp: boolean;
  }>
> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) {
    return { ok: false, error: "Sin permisos para pedidos." };
  }
  const parsedParams = generarPdfEnviarPedidoSchema.safeParse(raw);
  if (!parsedParams.success) {
    const flat = parsedParams.error.flatten();
    const msg =
      [...Object.values(flat.fieldErrors).flat(), ...flat.formErrors][0] ??
      "Seleccioná proveedor, sucursal y al menos un tipo de pedido.";
    return { ok: false, error: msg };
  }
  const {
    proveedorId,
    sucursal: sucursalValida,
    tipos,
    confirmarSobreStock,
    ajustesSobreStock,
    confirmarReposicionProveedorPrioritario,
    itemsReposicionProveedorPrioritario,
  } = parsedParams.data;
  if (!(await sucursalPedidoHabilitada(sucursalValida))) {
    return { ok: false, error: "La sucursal no está habilitada para pedidos." };
  }

  function sanitizeFilenamePart(s: string): string {
    // Reemplaza caracteres no válidos para nombres de archivo (Windows y, por compatibilidad, también para WhatsApp).
    return s.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim();
  }

  try {
    const sucursalRow = await prisma.sucursal.findUnique({
      where: { codigo: sucursalValida },
      select: { id: true },
    });
    if (!sucursalRow) {
      return { ok: false, error: "Sucursal no encontrada." };
    }

    if (confirmarSobreStock && (ajustesSobreStock?.length ?? 0) > 0) {
      const ajusteRes = await ajustarCantidadesParaGenerarPedido({
        proveedorId: proveedorId.trim(),
        sucursalCodigo: sucursalValida as SucursalPedidoEnvio,
        tipos,
        ajustes: ajustesSobreStock ?? [],
      });
      if (!ajusteRes.success) {
        return { ok: false, error: ajusteRes.error };
      }
    }

    const incluyeReposicion = tipos.includes("REPOSICION");
    if (incluyeReposicion && !confirmarReposicionProveedorPrioritario) {
      const alternativos = await getReposicionItemsProveedorPrioritarioAlternativo({
        proveedorSeleccionadoId: proveedorId.trim(),
        sucursalCodigo: sucursalValida as SucursalPedidoEnvio,
      });
      if (alternativos.length > 0) {
        return {
          ok: false,
          error: `REPOSICION_PROVEEDOR_PRIORITARIO_REQUIERE_CONFIRMACION:${alternativos.length}`,
        };
      }
    }

    let forzarIdsReposicionAlProveedor: Set<string> | undefined;
    if (
      confirmarReposicionProveedorPrioritario &&
      (itemsReposicionProveedorPrioritario?.length ?? 0) > 0
    ) {
      const alternativos = await getReposicionItemsProveedorPrioritarioAlternativo({
        proveedorSeleccionadoId: proveedorId.trim(),
        sucursalCodigo: sucursalValida as SucursalPedidoEnvio,
      });
      const alternativosById = new Map(
        alternativos.map((a) => [a.idItemPedidoEnvio, a] as const)
      );
      for (const sel of itemsReposicionProveedorPrioritario ?? []) {
        const alt = alternativosById.get(sel.idItemPedidoEnvio);
        if (!alt || alt.proveedorPrioritarioId !== sel.proveedorPrioritarioId) {
          return { ok: false, error: "Selección de reposición inválida o desactualizada." };
        }
      }
      forzarIdsReposicionAlProveedor = new Set(
        itemsReposicionProveedorPrioritario!.map((s) => s.idItemPedidoEnvio)
      );
    }

    const getItemsOpts = forzarIdsReposicionAlProveedor?.size
      ? { forzarIdsReposicionAlProveedor }
      : undefined;

    const result = await getItemsYProveedorParaEnviar(
      proveedorId.trim(),
      sucursalValida as SucursalPedidoEnvio,
      tipos,
      undefined,
      getItemsOpts
    );
    const { rows: envioRows, items, proveedor } = result;
    if (!proveedor) {
      return { ok: false, error: "Proveedor no encontrado." };
    }
    if (items.length === 0) {
      return {
        ok: false,
        error: "No hay ítems para generar el pedido con la selección indicada.",
      };
    }

    // Sobrestock en la otra sucursal (ítems con cod_tienda): no persistir snapshot hasta confirmación.
    const sobreStockRes = await getSobreStockOtraSucursalParaPedidoEnviar({
      proveedorId: proveedorId.trim(),
      sucursal: sucursalValida as SucursalPedidoEnvio,
      filas: envioRows,
    });

    if (sobreStockRes.items.length > 0 && !confirmarSobreStock) {
      return {
        ok: false,
        error: `SOBRESTOCK_REQUIERE_CONFIRMACION:${sobreStockRes.items.length}`,
      };
    }

    const historiaRes = await crearPedidoHistoriaSnapshot({
      proveedorId: proveedorId.trim(),
      sucursalCodigo: sucursalValida as SucursalPedidoEnvio,
      tipos,
      forzarIdsReposicionAlProveedor: forzarIdsReposicionAlProveedor
        ? [...forzarIdsReposicionAlProveedor]
        : undefined,
    });
    if (!historiaRes.success) {
      return { ok: false, error: historiaRes.error };
    }

    const tiposLabel = tipos.map((t) => TIPO_LABEL[t] ?? t).join(", ");
    const sucursalLabel =
      SUCURSAL_LABEL_PEDIDO[sucursalValida as SucursalPedido] ?? sucursalValida;
    const pdfBuffer = generarPdfPedido(
      items,
      proveedor.nombre,
      sucursalLabel,
      tiposLabel
    );
    const prefijoProveedor = sanitizeFilenamePart(proveedor.prefijo || "");
    const fechaStr = formatDdMmHhMmArgentina(new Date());
    const filename = `Nota Pedido - ${prefijoProveedor} - ${fechaStr}.pdf`;
    const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

    const sentViaWhatsApp = false;

    // Solo ítems del proveedor del PDF (no borrar URGENTE/TINTOMÉTRICO de otros proveedores).
    await limpiarPedidoMercaderiaTrasGenerarPdf({
      sucursalId: sucursalRow.id,
      proveedorId: proveedorId.trim(),
      tipos,
    });

    // Refrescar listados afectados para que no queden ítems viejos.
    revalidatePedidosMercaderiaListados();

    return {
      ok: true,
      data: {
        pdfBase64,
        whatsapp: proveedor.whatsapp,
        nombreProveedor: proveedor.nombre,
        filename,
        sentViaWhatsApp,
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al generar el PDF.";
    return { ok: false, error: message };
  }
}
