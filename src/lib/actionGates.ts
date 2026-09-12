import { PERMISOS, puede } from "@/lib/permisos";
import { esEditor, getRol } from "@/lib/sesion";

/** Fallo de gate compatible con `ActionResult<T>` (sin rama de éxito). */
export type ActionGateFail = { ok: false; error: string };

async function requirePermiso(
  permiso: { simple: boolean; editor: boolean },
  error: string
): Promise<ActionGateFail | null> {
  const rol = await getRol();
  if (!puede(rol, permiso)) return { ok: false, error };
  return null;
}

async function requirePermisoEditor(
  permiso: { simple: boolean; editor: boolean },
  errorModulo: string,
  errorEditor = "Sin permisos de editor."
): Promise<ActionGateFail | null> {
  const gate = await requirePermiso(permiso, errorModulo);
  if (gate) return gate;
  if (!(await esEditor())) return { ok: false, error: errorEditor };
  return null;
}

export function requireFinanzasLectura(): Promise<ActionGateFail | null> {
  return requirePermiso(PERMISOS.finanzas.acceso, "Sin permisos para finanzas.");
}

export function requireEditorFinanzas(): Promise<ActionGateFail | null> {
  return requirePermisoEditor(PERMISOS.finanzas.acceso, "Sin permisos para finanzas.");
}

export function requireMarketingLectura(): Promise<ActionGateFail | null> {
  return requirePermiso(PERMISOS.marketing.acceso, "Sin permisos para marketing.");
}

export function requireEditorMarketing(): Promise<ActionGateFail | null> {
  return requirePermisoEditor(PERMISOS.marketing.acceso, "Sin permisos para marketing.");
}

export function requireFacturacionLectura(): Promise<ActionGateFail | null> {
  return requirePermiso(PERMISOS.facturacion.acceso, "Sin permisos para facturación.");
}

export function requireEditorFacturacion(): Promise<ActionGateFail | null> {
  return requirePermisoEditor(
    PERMISOS.facturacion.acceso,
    "Sin permisos para facturación."
  );
}

export function requireEstadisticasLectura(): Promise<ActionGateFail | null> {
  return requirePermiso(
    PERMISOS.estadisticasProductos.acceso,
    "Sin permisos para estadísticas de productos."
  );
}

export function requireEditorEstadisticas(): Promise<ActionGateFail | null> {
  return requirePermisoEditor(
    PERMISOS.estadisticasProductos.acceso,
    "Sin permisos para estadísticas de productos."
  );
}

export function requireAsistenteIaLectura(): Promise<ActionGateFail | null> {
  return requirePermiso(PERMISOS.asistenteIa.acceso, "Sin permisos para Asistente IA.");
}

export function requireEditorAsistenteIa(): Promise<ActionGateFail | null> {
  return requirePermisoEditor(
    PERMISOS.asistenteIa.acceso,
    "Sin permisos para Asistente IA."
  );
}

/** Gasto eventual: Ayuda Vendedor o el mismo flujo desde Balance · Gastos. */
export function requireCargarGastoEventual(): Promise<ActionGateFail | null> {
  return requirePermiso(
    PERMISOS.ayudaVendedor.cargarGasto,
    "Sin permisos para cargar gasto eventual."
  );
}

/** Envios (Vendedor): `simple` y `editor` pueden leer y mutar. */
export function requireEnvios(): Promise<ActionGateFail | null> {
  return requirePermiso(PERMISOS.envios.acceso, "Sin permisos para envíos.");
}

/** Control stock / transf. depósitos. */
export function requireStockAcceso(): Promise<ActionGateFail | null> {
  return requirePermiso(PERMISOS.stock.acceso, "Sin acceso.");
}
