/**
 * Ventana (días) compartida: historial del modal y aviso de transferencia duplicada.
 * Mismo `cod_tienda` + origen + destino + cantidad dentro de esta ventana → advertencia.
 * Borrador de grilla: `localStorage` por par origen→destino hasta **Crear Transferencia**.
 * Si el local está vacío, la grilla no se hidrata desde BD (`stock_trasn_depositos` eliminada).
 */

import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { listaPreciosCodTiendaSchema } from "@/lib/validations/common";
import { itemBorradorTransfDepositosSchema } from "@/lib/validations/transfDepositos";

export type SucursalTransfDepositos = "guaymallen" | "maipu";

export type ParTransfConSucursalUsuario = {
  origen: SucursalTransfDepositos | null;
  destino: SucursalTransfDepositos | null;
  origenBloqueado: boolean;
  destinoBloqueado: boolean;
};

/**
 * Una punta del par debe ser la sucursal del usuario.
 * Si origen es otra sucursal → destino = usuario (bloqueado).
 * Si destino es otra sucursal → origen = usuario (bloqueado).
 */
export function parTransfConSucursalUsuario(
  origen: SucursalTransfDepositos | null,
  destino: SucursalTransfDepositos | null,
  sucursalUsuario: SucursalTransfDepositos
): ParTransfConSucursalUsuario {
  if (origen != null && origen !== sucursalUsuario) {
    return {
      origen,
      destino: sucursalUsuario,
      origenBloqueado: false,
      destinoBloqueado: true,
    };
  }
  if (destino != null && destino !== sucursalUsuario) {
    return {
      origen: sucursalUsuario,
      destino,
      origenBloqueado: true,
      destinoBloqueado: false,
    };
  }
  const origenResuelto = origen ?? sucursalUsuario;
  const destinoResuelto =
    destino != null && destino !== origenResuelto ? destino : null;
  return {
    origen: origenResuelto,
    destino: destinoResuelto,
    origenBloqueado: false,
    destinoBloqueado: false,
  };
}

export function parTransfIncluyeSucursalUsuario(
  origen: SucursalTransfDepositos,
  destino: SucursalTransfDepositos,
  sucursalUsuario: SucursalTransfDepositos
): boolean {
  return origen === sucursalUsuario || destino === sucursalUsuario;
}

export type ItemBorradorTransfDepositos = {
  cantidad: string;
  descripcion: string;
};

export type BorradorTransfDepositos = Record<string, ItemBorradorTransfDepositos>;

export type LoteAbiertoParaBorradorTransf = {
  codTienda: string;
  cantidad: number;
  descripcion: string;
};

/** Convierte un lote (si hubiera) al shape del borrador de grilla. */
export function borradorDesdeLoteAbiertoTransfDepositos(
  loteAbierto: LoteAbiertoParaBorradorTransf[]
): BorradorTransfDepositos {
  const out: BorradorTransfDepositos = {};
  for (const p of loteAbierto) {
    if (!Number.isFinite(p.cantidad) || p.cantidad <= 0) continue;
    const parsed = parseEntradaBorrador(p.codTienda, {
      cantidad: p.cantidad,
      descripcion: p.descripcion,
    });
    if (!parsed) continue;
    out[p.codTienda] = parsed;
  }
  return out;
}

export const STORAGE_BORRADOR_TRANSF_DEPOSITOS_PREFIX =
  "transf-depositos-borrador-v1";

const MAX_ITEMS_BORRADOR_TRANSF_DEPOSITOS = 500;

/** Ventana del aviso de duplicado en la grilla (triángulo). */
export const TRANSF_DEPOSITOS_VENTANA_DUPLICADO_DIAS = 14;

export const SUCURSAL_LABEL_TRANSF: Record<"guaymallen" | "maipu", string> = {
  guaymallen: "GUAYMALLÉN",
  maipu: "MAIPÚ",
};

/**
 * URL canónica de Trans. Depósitos (opcionalmente con origen).
 */
export function hrefAbrirGenerarTransfDepositos(
  origen?: "guaymallen" | "maipu" | null
): string {
  const p = new URLSearchParams();
  if (origen) p.set("origen", origen);
  const query = p.toString();
  return query
    ? `${GP_ROUTES.ayudaVendedor.transfDepositos}?${query}`
    : GP_ROUTES.ayudaVendedor.transfDepositos;
}

export function claveStorageBorradorTransfDepositos(
  origen: SucursalTransfDepositos,
  destino: SucursalTransfDepositos
): string {
  return `${STORAGE_BORRADOR_TRANSF_DEPOSITOS_PREFIX}:${origen}:${destino}`;
}

function parseEntradaBorrador(
  codRaw: string,
  valor: unknown
): ItemBorradorTransfDepositos | null {
  const cod = listaPreciosCodTiendaSchema.safeParse(codRaw);
  if (!cod.success) return null;

  if (typeof valor === "string" || typeof valor === "number") {
    const parsed = itemBorradorTransfDepositosSchema.safeParse({
      cantidad: valor,
      descripcion: "",
    });
    if (!parsed.success) return null;
    return {
      cantidad: String(parsed.data.cantidad),
      descripcion: "",
    };
  }

  if (!valor || typeof valor !== "object") return null;
  const parsed = itemBorradorTransfDepositosSchema.safeParse(valor);
  if (!parsed.success) return null;
  return {
    cantidad: String(parsed.data.cantidad),
    descripcion: parsed.data.descripcion ?? "",
  };
}

function parseBorradorTransfDepositos(raw: unknown): BorradorTransfDepositos {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: BorradorTransfDepositos = {};
  for (const [codRaw, valor] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_ITEMS_BORRADOR_TRANSF_DEPOSITOS) break;
    const item = parseEntradaBorrador(codRaw, valor);
    if (!item) continue;
    const cod = listaPreciosCodTiendaSchema.safeParse(codRaw);
    if (!cod.success) continue;
    out[cod.data] = item;
  }
  return out;
}

function normalizarBorradorParaGuardar(
  borrador: BorradorTransfDepositos
): BorradorTransfDepositos {
  const out: BorradorTransfDepositos = {};
  for (const [codRaw, item] of Object.entries(borrador)) {
    if (Object.keys(out).length >= MAX_ITEMS_BORRADOR_TRANSF_DEPOSITOS) break;
    const parsed = parseEntradaBorrador(codRaw, {
      cantidad: item.cantidad,
      descripcion: item.descripcion,
    });
    if (!parsed) continue;
    const cod = listaPreciosCodTiendaSchema.safeParse(codRaw);
    if (!cod.success) continue;
    out[cod.data] = parsed;
  }
  return out;
}

/**
 * Borrador de Cód. / Cant. de la grilla para un par origen→destino.
 * Vive hasta **Crear Transferencia** (ahí pasa a `stock_transferencias`).
 */
export function leerBorradorTransfDepositos(
  origen: SucursalTransfDepositos | null,
  destino: SucursalTransfDepositos | null
): BorradorTransfDepositos {
  if (typeof window === "undefined" || !origen || !destino || origen === destino) {
    return {};
  }
  try {
    const raw = localStorage.getItem(
      claveStorageBorradorTransfDepositos(origen, destino)
    );
    if (!raw) return {};
    return parseBorradorTransfDepositos(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

export function guardarBorradorTransfDepositos(
  origen: SucursalTransfDepositos | null,
  destino: SucursalTransfDepositos | null,
  borrador: BorradorTransfDepositos
): void {
  if (typeof window === "undefined" || !origen || !destino || origen === destino) {
    return;
  }
  const clave = claveStorageBorradorTransfDepositos(origen, destino);
  const limpio = normalizarBorradorParaGuardar(borrador);
  try {
    if (Object.keys(limpio).length === 0) {
      localStorage.removeItem(clave);
      return;
    }
    localStorage.setItem(clave, JSON.stringify(limpio));
  } catch {
    /* quota / modo privado */
  }
}

export function borrarBorradorTransfDepositos(
  origen: SucursalTransfDepositos | null,
  destino: SucursalTransfDepositos | null
): void {
  if (typeof window === "undefined" || !origen || !destino || origen === destino) {
    return;
  }
  try {
    localStorage.removeItem(claveStorageBorradorTransfDepositos(origen, destino));
  } catch {
    /* ignore */
  }
}
