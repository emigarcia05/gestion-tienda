import {
  MAIN_APP_AREAS,
  areaLabelMayusculas,
  type MainAppAreaId,
} from "@/lib/main-app-areas";
import {
  SUCURSALES_PREFERIDAS,
  type SucursalPreferida,
} from "@/lib/sucursalPreferida";

export const USUARIOS_PATH = "/finanzas/usuarios";

export const MODULOS_PERMITIDOS_USUARIO: {
  id: MainAppAreaId;
  label: string;
}[] = MAIN_APP_AREAS.map((area) => ({
  id: area.id,
  label: areaLabelMayusculas(area.label),
}));

export function ordenarModulosPermitidos(
  ids: readonly string[]
): MainAppAreaId[] {
  const set = new Set(
    ids.map((id) => (id === "facturacion" ? "gestion-productos" : id))
  );
  return MODULOS_PERMITIDOS_USUARIO.map((m) => m.id).filter((id) => set.has(id));
}

export function etiquetaModulosPermitidos(ids: readonly string[]): string {
  return MODULOS_PERMITIDOS_USUARIO.filter((m) => ids.includes(m.id))
    .map((m) => m.label)
    .join(" · ");
}

export function etiquetaSucursalPorDefecto(
  codigo: SucursalPreferida | null
): string {
  if (!codigo) return "";
  return (
    SUCURSALES_PREFERIDAS.find((s) => s.value === codigo)?.label ??
    codigo.toLocaleUpperCase("es")
  );
}

export function usuarioTieneAdministracion(
  modulos: readonly MainAppAreaId[]
): boolean {
  return modulos.includes("finanzas");
}

export function primerModuloPermitido(
  modulos: readonly MainAppAreaId[]
): MainAppAreaId | null {
  return modulos[0] ?? null;
}

export function puedeCambiarModulo(modulos: readonly MainAppAreaId[]): boolean {
  return modulos.length > 1;
}
