/**
 * Ventana (días) compartida: historial del modal y aviso de transferencia duplicada.
 * Mismo `cod_tienda` + origen + destino + cantidad dentro de esta ventana → advertencia.
 * Borrador de grilla: `localStorage` por par origen→destino hasta **Transferido**.
 * Si el local está vacío, la grilla se hidrata desde el lote abierto de `stock_trasn_depositos`.
 */

import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { listaPreciosCodTiendaSchema } from "@/lib/validations/common";
import { itemBorradorTransfDepositosSchema } from "@/lib/validations/transfDepositos";

export type SucursalTransfDepositos = "guaymallen" | "maipu";

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

/** Convierte el lote abierto de `stock_trasn_depositos` al shape del borrador de grilla. */
export function borradorDesdeLoteAbiertoTransfDepositos(
  loteAbierto: LoteAbiertoParaBorradorTransf[]
): BorradorTransfDepositos {
  const out: BorradorTransfDepositos = {};
  for (const p of loteAbierto) {
    if (!Number.isInteger(p.cantidad) || p.cantidad <= 0) continue;
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

export const TRANSF_DEPOSITOS_VENTANA_HISTORIAL_DIAS = 14;

/** Alias: misma ventana que el historial (14 días). */
export const TRANSF_DEPOSITOS_VENTANA_DUPLICADO_DIAS =
  TRANSF_DEPOSITOS_VENTANA_HISTORIAL_DIAS;

export const SUCURSAL_LABEL_TRANSF: Record<"guaymallen" | "maipu", string> = {
  guaymallen: "GUAYMALLÉN",
  maipu: "MAIPÚ",
};

/** Transferencia de depósitos en DUX. */
export const DUX_TRANSFERENCIA_DEPOSITOS_URL =
  "https://erp.duxsoftware.com.ar/pages/deposito/transferenciaDep.faces";

/** Nombre de ventana: reusa la misma pestaña (no `_blank`). Sin `noopener` para poder enfocarla. */
export const DUX_TRANSFERENCIA_DEPOSITOS_WINDOW_NAME =
  "dux-transferencia-depositos";

let duxTransferenciaDepositosWin: Window | null = null;

function esPestañaEnBlanco(win: Window): boolean {
  try {
    const href = win.location.href;
    return href === "about:blank" || href === "";
  } catch {
    return false;
  }
}

/** Abre (o reusa) transferencia de depósitos en DUX. Llamar en el gesto de elegir SUC. DESTINO. */
export function abrirDuxTransferenciaDepositosTab(): void {
  if (typeof window === "undefined") return;
  duxTransferenciaDepositosWin = window.open(
    DUX_TRANSFERENCIA_DEPOSITOS_URL,
    DUX_TRANSFERENCIA_DEPOSITOS_WINDOW_NAME
  );
}

/**
 * Trae al frente la pestaña DUX ya abierta. No pasa la URL: no recarga el formulario.
 * Si el usuario la cerró, vuelve a abrir DUX.
 */
export function enfocarDuxTransferenciaDepositosTab(): void {
  if (typeof window === "undefined") return;

  if (duxTransferenciaDepositosWin && !duxTransferenciaDepositosWin.closed) {
    duxTransferenciaDepositosWin.focus();
    return;
  }

  const win = window.open("", DUX_TRANSFERENCIA_DEPOSITOS_WINDOW_NAME);
  if (!win || win.closed) {
    abrirDuxTransferenciaDepositosTab();
    return;
  }

  if (esPestañaEnBlanco(win)) {
    win.location.href = DUX_TRANSFERENCIA_DEPOSITOS_URL;
  }
  duxTransferenciaDepositosWin = win;
  win.focus();
}

/** Query para abrir `GenerarTransfDepositosModal` al entrar a Trans. Depósitos. */
export const QUERY_ABRIR_GENERAR_TRANSF = "generar";

/**
 * URL canónica de Trans. Depósitos con el modal **Generar Transf.** abierto.
 */
export function hrefAbrirGenerarTransfDepositos(
  origen?: "guaymallen" | "maipu" | null
): string {
  const p = new URLSearchParams();
  if (origen) p.set("origen", origen);
  p.set(QUERY_ABRIR_GENERAR_TRANSF, "1");
  return `${GP_ROUTES.ayudaVendedor.transfDepositos}?${p.toString()}`;
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
 * Vive hasta **Transferido**. No es el ledger (`stock_trasn_depositos`).
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
